import os
import io
import time
import uuid
import numpy as np
import librosa
import torch
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from google.cloud import speech
from pydub import AudioSegment
from g2p_en import G2p
import nltk
from transformers import AutoFeatureExtractor, AutoModelForAudioClassification

# --- NLTK SETUP ---
try:
    nltk.data.find('taggers/averaged_perceptron_tagger_eng')
except LookupError:
    nltk.download('averaged_perceptron_tagger_eng')
    nltk.download('cmudict')

# --- CONFIGURATION ---
PORT = int(os.environ.get('PORT', 5000))
CREDENTIALS_PATH = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'credentials.json')

# Check credentials
if not os.path.exists(CREDENTIALS_PATH):
    print(f"⚠️ WARNING: Google Cloud credentials not found at {CREDENTIALS_PATH}")

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = CREDENTIALS_PATH

# --- WAV2VEC MODEL PATH ---
# Prefer environment variable MODEL_PATH; fallback to repo-relative folder `server/final_stutter_wav2vec`
MODEL_PATH = os.environ.get("MODEL_PATH")
if not MODEL_PATH:
    MODEL_PATH = os.path.join(os.path.dirname(__file__), "final_stutter_wav2vec")
MODEL_PATH = os.path.abspath(MODEL_PATH)

if not os.path.exists(MODEL_PATH):
    raise ValueError(f"❌ Path not found: {MODEL_PATH}")

if not os.path.exists(os.path.join(MODEL_PATH, "config.json")):
    raise ValueError(f"❌ config.json not found in {MODEL_PATH}. Are you pointing to the right folder?")

# --- CONSTANTS & TUNING ---
SAMPLE_RATE = 16000
MAX_AUDIO_BYTES = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {'wav', 'm4a', 'mp3'}
SPEECH_PROB_MIN = float(os.environ.get('SPEECH_PROB_MIN', '0.35'))
PITCHED_RATIO_MIN = float(os.environ.get('PITCHED_RATIO_MIN', '0.15'))
PROGRESSION_CONFIDENCE = 0.75

# --- FLASK SETUP ---
app = Flask(__name__)
CORS(app)
g2p = G2p()

# --- KID FRIENDLY PHONEMES ---
PHONEME_MAP = {
    'AA': 'a', 'AE': 'a', 'AH': 'u', 'AO': 'aw', 'AW': 'ow',
    'AY': 'i', 'B': 'b', 'CH': 'ch', 'D': 'd', 'DH': 'th',
    'EH': 'e', 'ER': 'er', 'EY': 'a', 'F': 'f', 'G': 'g',
    'HH': 'h', 'IH': 'i', 'IY': 'ee', 'JH': 'j', 'K': 'k',
    'L': 'l', 'M': 'm', 'N': 'n', 'NG': 'ng', 'OW': 'o',
    'OY': 'oy', 'P': 'p', 'R': 'r', 'S': 's', 'SH': 'sh',
    'T': 't', 'TH': 'th', 'UH': 'u', 'UW': 'oo', 'V': 'v',
    'W': 'w', 'Y': 'y', 'Z': 'z', 'ZH': 'zh'
}

# --- LOAD MODELS (IMMEDIATE LOADING) ---
print("📥 Loading Wav2Vec 2.0 Model...")
try:
    # Feature Extractor handles audio processing (16kHz resampling, padding)
    processor = AutoFeatureExtractor.from_pretrained(MODEL_PATH)
    # Audio Classification Model handles the prediction
    model = AutoModelForAudioClassification.from_pretrained(MODEL_PATH)
    
    # Optional: Move to GPU if available
    # device = "cuda" if torch.cuda.is_available() else "cpu"
    # model.to(device)
    
    print("✅ Wav2Vec 2.0 System Ready!")
except Exception as e:
    print(f"❌ Critical Error Loading Model: {e}")
    raise e

# --- HELPER FUNCTIONS ---

def predict_file(filepath):
    """
    Manual prediction using Wav2Vec.
    Returns: (label_string, confidence_float)
    """
    # 1. Load Audio (Force 16kHz for Wav2Vec)
    audio, sr = librosa.load(filepath, sr=16000)
    
    # 2. Process Audio (Normalize & Extract Features)
    inputs = processor(
        audio, 
        sampling_rate=16000, 
        return_tensors="pt", 
        padding=True, 
        truncation=True, 
        max_length=16000*3 # Max 3 seconds context
    )
    
    # 3. Model Inference
    with torch.no_grad():
        logits = model(**inputs).logits
    
    # 4. Softmax for Probabilities
    probs = torch.nn.functional.softmax(logits, dim=-1)
    
    # 5. Get Winner
    score, id = torch.max(probs, dim=-1)
    label = model.config.id2label[id.item()]
    
    return label, score.item()

def get_google_transcript(file_path):
    """Returns transcript and word-level timestamps."""
    try:
        client = speech.SpeechClient()
        audio = AudioSegment.from_file(file_path)
        audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
        wav_data = io.BytesIO()
        audio.export(wav_data, format="wav")
        content = wav_data.getvalue()
        
        audio_file = speech.RecognitionAudio(content=content)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=16000,
            language_code="en-US",
            enable_word_time_offsets=True,
            enable_word_confidence=True,
        )
        response = client.recognize(config=config, audio=audio_file)
        
        words = []
        full_text = ""
        for result in response.results:
            full_text += result.alternatives[0].transcript + " "
            for w in result.alternatives[0].words:
                words.append({
                    "word": w.word,
                    "start": w.start_time.total_seconds(),
                    "end": w.end_time.total_seconds(),
                    "confidence": w.confidence
                })
        return full_text.strip(), words
    except Exception as e:
        print(f"STT Error: {e}")
        return "", []

def calculate_wpm(words_data):
    """Calculate words per minute."""
    if not words_data or len(words_data) < 2:
        return 0
    first = words_data[0]
    last = words_data[-1]
    start = first.get('start', 0)
    end = last.get('end', start)
    duration = end - start
    if duration <= 0: return 0
    return round((len(words_data) / duration) * 60, 1)

def analyze_voicing_noise(filepath):
    """
    Return heuristics for anti-blow validation (Transferred from old app).
    """
    try:
        y, sr = librosa.load(filepath, sr=SAMPLE_RATE)
        if len(y) < int(0.3 * sr):
            return {'pitched_ratio': 0.0, 'voiced_detected': False, 'noise_suspected': True}

        # Zero-crossing rate
        zcr = librosa.feature.zero_crossing_rate(y=y)[0]
        zcr_mean = float(np.mean(zcr))

        # Pitch detection (pyin)
        try:
            f0, _, _ = librosa.pyin(y, fmin=80, fmax=400, sr=sr)
            voiced_frames = np.sum(~np.isnan(f0))
            total_frames = len(f0)
            pitched_ratio = float(voiced_frames) / float(total_frames) if total_frames > 0 else 0.0
        except:
            pitched_ratio = 0.0

        voiced_detected = pitched_ratio >= PITCHED_RATIO_MIN
        noise_suspected = pitched_ratio < (PITCHED_RATIO_MIN * 0.67) and zcr_mean > 0.2

        return {
            'pitched_ratio': pitched_ratio,
            'zcr_mean': zcr_mean,
            'voiced_detected': voiced_detected,
            'noise_suspected': noise_suspected,
        }
    except Exception as e:
        print(f"Voicing analysis error: {e}")
        return {'voiced_detected': False, 'noise_suspected': True}

def analyze_amplitude(filepath, threshold=0.02, min_duration=1.5):
    """Analyze sustained amplitude for Snake exercise."""
    try:
        audio, sr = librosa.load(filepath, sr=SAMPLE_RATE)
        audio, _ = librosa.effects.trim(audio, top_db=30) 
        
        rms = librosa.feature.rms(y=audio)[0]
        frame_duration = len(audio) / sr / len(rms)
        
        above_threshold = rms > threshold
        sustained_frames = 0
        max_sustained = 0
        
        for val in above_threshold:
            if val:
                sustained_frames += 1
                max_sustained = max(max_sustained, sustained_frames)
            else:
                sustained_frames = 0
        
        sustained_duration = max_sustained * frame_duration
        amplitude_sustained = sustained_duration >= min_duration
        
        return {'duration_sec': round(sustained_duration, 2), 'amplitude_sustained': amplitude_sustained}
    except:
        return {'duration_sec': 0, 'amplitude_sustained': False}

def detect_breath(filepath, silence_threshold=0.01, min_silence=0.3):
    """Detect breath pattern for Balloon exercise."""
    try:
        audio, sr = librosa.load(filepath, sr=SAMPLE_RATE)
        rms = librosa.feature.rms(y=audio, frame_length=2048, hop_length=512)[0]
        frame_duration = len(audio) / sr / len(rms)
        
        silence_frames = rms < silence_threshold
        has_silence = False
        silence_count = 0
        
        for i, is_silent in enumerate(silence_frames):
            if is_silent:
                silence_count += 1
            elif silence_count > 0:
                silence_duration = silence_count * frame_duration
                if silence_duration >= min_silence:
                    has_silence = True
                    if i < len(rms):
                        return {'breath_detected': True, 'amplitude_onset': round(float(rms[i]), 3)}
                silence_count = 0
        return {'breath_detected': has_silence, 'amplitude_onset': 0.0}
    except:
        return {'breath_detected': False, 'amplitude_onset': 0.0}

def get_feedback(exercise_type, is_hit, stutter_type=None):
    hit_msgs = {
        'turtle': ["Great! You spoke slowly and fluently.", "Awesome slow speech!"],
        'snake': ["Smooth prolongation! The snake loved that.", "Excellent sustained sound!"],
        'balloon': ["Perfect easy onset!", "Great gentle start!"],
        'onetap': ["Fluent one-tap! Nailed it.", "Awesome! No bumps!"]
    }
    miss_msgs = {
        'turtle': "Try to keep it smooth and steady!",
        'snake': "Try to make it one smooth sound.",
        'balloon': "Remember: gentle breath, then soft start.",
        'onetap': "Almost! Try to make it smoother."
    }
    import random
    if is_hit: return random.choice(hit_msgs.get(exercise_type, ["Great job!"]))
    return miss_msgs.get(exercise_type, "Give it another try!")


# --- MAIN ENDPOINT: GENERAL ANALYSIS ---
@app.route('/analyze_audio', methods=['POST'])
def analyze_audio():
    if 'file' not in request.files: return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    filename = secure_filename(file.filename)
    filepath = os.path.join(os.getcwd(), filename)
    file.save(filepath)

    try:
        # 1. RUN WAV2VEC PREDICTION
        label, confidence = predict_file(filepath)
        
        # Logic: If label contains "fluent", it's fluent. Else it's a stutter.
        # Note: Your model labels are likely "0_fluent", "1_block", etc.
        is_stutter = "fluent" not in label.lower()
        stutter_type = "Fluent"
        
        if is_stutter:
            if "_" in label:
                stutter_type = label.split('_')[1].capitalize()
            else:
                stutter_type = label.capitalize()

        # 2. GET TRANSCRIPT (for phonemes)
        full_text, words = get_google_transcript(filepath)
        final_phoneme = None

        if is_stutter and words:
            # Find the word with lowest confidence (often the stuttered one)
            culprit = min(words, key=lambda w: w['confidence'])
            
            phonemes = g2p(culprit['word'])
            clean = [p for p in phonemes if p not in [" ", "'"]]
            if clean:
                raw = ''.join([i for i in clean[0] if not i.isdigit()])
                final_phoneme = PHONEME_MAP.get(raw, raw.lower())

        response = {
            'is_stutter': is_stutter,
            'stutter_score': confidence,
            'type': stutter_type,
            'problem_phoneme': final_phoneme,
            'transcript': full_text,
        }
        return jsonify(response)

    finally:
        if os.path.exists(filepath):
            try: os.remove(filepath)
            except: pass


# --- EXERCISE ENDPOINTS (Fully Restored Logic) ---

@app.route('/analyze/turtle', methods=['POST'])
def analyze_turtle():
    if 'file' not in request.files: return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    filename = secure_filename(file.filename)
    filepath = os.path.join(os.getcwd(), filename)
    file.save(filepath)

    try:
        t0 = time.time()
        
        # 1. AI Check (Wav2Vec)
        label, score = predict_file(filepath)
        
        is_stutter = "fluent" not in label.lower()
        block_detected = "block" in label.lower()
        
        # 2. WPM Check
        text, words = get_google_transcript(filepath)
        wpm = calculate_wpm(words) if words else 0
        
        game_pass = wpm < 120 and wpm > 0
        clinical_pass = not block_detected
        is_hit = game_pass and clinical_pass
        
        elapsed_ms = int((time.time() - t0) * 1000)
        return jsonify({
            'wpm': wpm, 'game_pass': game_pass,
            'stutter_detected': is_stutter, 'block_detected': block_detected,
            'clinical_pass': clinical_pass, 'confidence': score,
            'feedback': get_feedback('turtle', is_hit, 'Block' if block_detected else None),
            'elapsed_ms': elapsed_ms
        })
    finally:
        if os.path.exists(filepath): 
            try: os.remove(filepath)
            except: pass

@app.route('/analyze/snake', methods=['POST'])
def analyze_snake():
    # Supports both field names for compatibility
    file = request.files.get('file') or request.files.get('audioFile')
    if not file:
        return jsonify({'error': 'Missing required field: audioFile', 'code': 'MISSING_FIELD'}), 400

    filename = secure_filename(file.filename)
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({'error': 'Invalid format. Supported: WAV, M4A, MP3', 'code': 'INVALID_FORMAT'}), 400

    if request.content_length and request.content_length > MAX_AUDIO_BYTES:
        return jsonify({'error': 'File too large', 'code': 'FILE_TOO_LARGE'}), 400

    # Retrieve Game Data
    target_phoneme = request.form.get('targetPhoneme') or request.form.get('prompt_phoneme')
    
    filepath = os.path.join(os.getcwd(), filename)
    file.save(filepath)

    try:
        t0 = time.time()
        
        # 1. AI Check (Wav2Vec)
        label, score = predict_file(filepath)
        repetition_detected = "repetition" in label.lower()
        
        # 2. Amplitude Check
        amp_data = analyze_amplitude(filepath)
        game_pass = amp_data['amplitude_sustained']
        clinical_pass = not repetition_detected
        
        # 3. Voicing / Anti-Blow Logic
        voicing = analyze_voicing_noise(filepath)
        
        # 4. Phoneme Validation (Google STT)
        phoneme_match = None
        if target_phoneme:
            try:
                full_text, words = get_google_transcript(filepath)
                if words:
                    target = target_phoneme.strip().lower()
                    found = False
                    for w in words:
                        try:
                            phonemes = g2p(w['word'])
                            clean = [p for p in phonemes if p not in [" ", "'"]]
                            for p in clean:
                                raw = ''.join([i for i in p if not i.isdigit()])
                                mapped = PHONEME_MAP.get(raw, raw.lower())
                                if mapped.lower() == target:
                                    found = True
                                    break
                            if found: break
                        except Exception:
                            pass
                    phoneme_match = found
                else:
                    # STT detected no words - trust voicing detection instead
                    # If user was voicing, don't fail them for STT's inability to transcribe
                    if voicing['voiced_detected']:
                        phoneme_match = None  # Ignore phoneme match when STT fails but voicing detected
                    else:
                        phoneme_match = False  # Silence/Hum usually means no word found
            except Exception:
                phoneme_match = None # STT error, ignore

        # 5. Apply Anti-Blow Rule (only override if we have strong evidence of no speech)
        if target_phoneme:
            voiced_targets = {'a','e','i','o','u','oo','ee','er','m','n','l','r','w','y','ng','v','z','j'}
            is_voiced_target = (target_phoneme.strip().lower() in voiced_targets)
            if is_voiced_target:
                # Only fail if BOTH voicing AND STT failed (strong evidence of blow/noise)
                # If either passed, give benefit of doubt
                speech_likely = voicing['voiced_detected'] or score > 0.6 or (phoneme_match is True)
                if not speech_likely and phoneme_match is False:
                    # Only override to False if we already had a phoneme mismatch from STT
                    pass  # Keep phoneme_match as False
                elif not speech_likely and phoneme_match is None:
                    # STT didn't detect anything but voicing also failed - likely blow/noise
                    phoneme_match = False

        is_hit = game_pass and clinical_pass
        is_stutter = repetition_detected or not game_pass
        stutter_type = 'Fluent'
        if repetition_detected: stutter_type = 'Repetition'
        elif not game_pass: stutter_type = 'Block'

        stars_awarded = 1 if stutter_type in ['Repetition', 'Block'] else 3
        session_id = request.form.get('sessionId') or str(uuid.uuid4())
        inference_ms = int((time.time() - t0) * 1000)

        # Calculate overall confidence (0.0-1.0) for progression
        # Factors: game pass (40%), clinical pass (30%), phoneme match (20%), voicing (10%)
        confidence_score = 0.0
        if game_pass:
            confidence_score += 0.4
        if clinical_pass:
            confidence_score += 0.3
        if phoneme_match is True:
            confidence_score += 0.2
        elif phoneme_match is None:  # STT error or no target - don't penalize
            confidence_score += 0.15
        if voicing['voiced_detected']:
            confidence_score += 0.1

        response_payload = {
            'sessionId': session_id,
            'isStutter': is_stutter,
            'stutterType': stutter_type,
            'confidence': confidence_score,  # Overall performance confidence for progression
            # Back-compat for client VoiceIndicator: use model confidence as speech_prob proxy
            'speech_prob': float(score),
            'starsAwarded': stars_awarded,
            'feedback': get_feedback('snake', is_hit, 'Repetition' if repetition_detected else None),
            'inferenceTimeMs': inference_ms,
            'duration_sec': amp_data['duration_sec'],
            'amplitude_sustained': amp_data['amplitude_sustained'],
            'game_pass': game_pass,
            'repetition_detected': repetition_detected,
            'clinical_pass': clinical_pass,
            'phoneme_match': phoneme_match,
            'voiced_detected': voicing['voiced_detected'],
            'progressionConfidence': PROGRESSION_CONFIDENCE,
        }
        return jsonify(response_payload)
    finally:
        if os.path.exists(filepath): 
            try: os.remove(filepath)
            except: pass

@app.route('/analyze/balloon', methods=['POST'])
def analyze_balloon():
    if 'file' not in request.files: return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    filename = secure_filename(file.filename)
    filepath = os.path.join(os.getcwd(), filename)
    file.save(filepath)

    try:
        t0 = time.time()
        
        # 1. AI Check (Wav2Vec)
        label, score = predict_file(filepath)
        
        # Hard attack often sounds like a block or a very high confidence stutter start
        hard_attack = "block" in label.lower() or (score > 0.9 and "fluent" not in label.lower())
        
        # 2. Breath Check (Restored Logic)
        breath_data = detect_breath(filepath)
        game_pass = breath_data['breath_detected']
        
        clinical_pass = not hard_attack
        is_hit = game_pass and clinical_pass
        
        return jsonify({
            'breath_detected': breath_data['breath_detected'], 
            'amplitude_onset': breath_data['amplitude_onset'],
            'game_pass': game_pass, 
            'hard_attack_detected': hard_attack,
            'clinical_pass': clinical_pass, 
            'confidence': score,
            'feedback': get_feedback('balloon', is_hit, 'Block' if hard_attack else None),
            'elapsed_ms': int((time.time() - t0) * 1000)
        })
    finally:
        if os.path.exists(filepath): 
            try: os.remove(filepath)
            except: pass

@app.route('/analyze/onetap', methods=['POST'])
def analyze_onetap():
    if 'file' not in request.files: return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    filename = secure_filename(file.filename)
    filepath = os.path.join(os.getcwd(), filename)
    file.save(filepath)

    try:
        t0 = time.time()
        
        # Simple AI Check
        label, score = predict_file(filepath)
        
        is_stutter = "fluent" not in label.lower()
        clinical_pass = not is_stutter
        
        return jsonify({
            'stutter_detected': is_stutter,
            'repetition_detected': is_stutter, # Legacy field support
            'clinical_pass': clinical_pass,
            'confidence': score,
            'feedback': get_feedback('onetap', clinical_pass, 'Stutter' if is_stutter else None),
            'elapsed_ms': int((time.time() - t0) * 1000)
        })
    finally:
        if os.path.exists(filepath): 
            try: os.remove(filepath)
            except: pass

# --- HEALTH CHECK ---
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'Wav2Vec 2.0'}), 200

if __name__ == '__main__':
    # Debug=False prevents reloading large models twice
    app.run(host='0.0.0.0', port=PORT, debug=False)