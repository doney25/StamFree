import os
import io
import time
import numpy as np
import librosa
import librosa.util
import tensorflow as tf
import tensorflow_hub as hub
from flask import Flask, request, jsonify
from flask_cors import CORS
from tensorflow.keras.models import load_model
from werkzeug.utils import secure_filename
from google.cloud import speech
from pydub import AudioSegment
from g2p_en import G2p
import nltk

# --- NLTK SETUP ---
try:
    nltk.data.find('taggers/averaged_perceptron_tagger_eng')
except LookupError:
    nltk.download('averaged_perceptron_tagger_eng')
    nltk.download('cmudict')

# --- CONFIGURATION ---
PORT = int(os.environ.get('PORT', 5000))
CREDENTIALS_PATH = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'credentials.json')

if not os.path.exists(CREDENTIALS_PATH):
    print(f"⚠️ WARNING: Google Cloud credentials not found at {CREDENTIALS_PATH}")
    # We don't raise error immediately to allow server to start, 
    # but STT features will fail if not fixed.

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = CREDENTIALS_PATH

# MODEL FILES (Using the NEW Mega Models)
BINARY_MODEL_PATH = 'binary.h5'      
MULTICLASS_MODEL_PATH = 'multiclass.h5' 

# TUNING (Optimized for Mega Models)
BINARY_THRESHOLD = 0.60 
SAMPLE_RATE = 16000
WINDOW_STEP = 0.5 

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

# --- LAZY MODEL LOADING ---
yamnet_model = None
binary_model = None
multiclass_model = None

def ensure_models():
    """Load heavy models on first use to keep startup fast."""
    global yamnet_model, binary_model, multiclass_model
    if yamnet_model is None:
        yamnet_model = hub.load('https://tfhub.dev/google/yamnet/1')
    if binary_model is None:
        binary_model = load_model(BINARY_MODEL_PATH)
    if multiclass_model is None:
        multiclass_model = load_model(MULTICLASS_MODEL_PATH)

print("✅ Server starting (models will lazy-load on first request)")

# --- HEALTH CHECK ---
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

# Cloud Run default root check
@app.route('/', methods=['GET'])
def root():
    return jsonify({'status': 'ok'}), 200


# --- CORE HELPERS (AI & STT) ---

def get_google_transcript(file_path):
    """Returns timestamps and confidence for words"""
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

def extract_yamnet_features(audio_segment):
    """
    Unified Feature Extractor for ALL endpoints.
    Replaces get_mfcc_features.
    """
    # 1. Normalize Volume
    wav = librosa.util.normalize(audio_segment)
    
    # 2. Pad if too short for YAMNet (needs ~0.975s)
    if len(wav) < int(0.975 * SAMPLE_RATE):
        wav = np.pad(wav, (0, int(0.975 * SAMPLE_RATE) - len(wav)))
        
    # 3. YAMNet Inference (ensure model is loaded)
    ensure_models()
    waveform = wav.astype(np.float32)
    _, embeddings, _ = yamnet_model(waveform)
    
    # 4. Global Average Pooling -> (1, 1024)
    global_embed = tf.reduce_mean(embeddings, axis=0).numpy()
    return global_embed[np.newaxis, ...]


# --- GAME METRIC HELPERS ---

def calculate_wpm(words_data):
    """Calculate words per minute"""
    if not words_data or len(words_data) < 2:
        return 0
    
    first_word = words_data[0]
    last_word = words_data[-1]
    
    # Use 'start' from new STT function (was 'start_time' in old)
    start_time = first_word.get('start', 0)
    end_time = last_word.get('end', start_time)
    
    duration_seconds = end_time - start_time
    if duration_seconds <= 0: return 0
    
    wpm = (len(words_data) / duration_seconds) * 60
    return round(wpm, 1)

def analyze_amplitude(filepath, threshold=0.02, min_duration=1.5):
    """Analyze sustained amplitude for Snake exercise"""
    try:
        audio, sr = librosa.load(filepath, sr=SAMPLE_RATE)
        # Gentler trim for heuristics
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
    """Detect breath pattern for Balloon exercise"""
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
    hit_messages = {
        'turtle': ["Great! You spoke slowly and fluently. Keep it up!", "Awesome slow speech!"],
        'snake': ["Smooth prolongation! The snake loved that!", "Excellent sustained sound!"],
        'balloon': ["Perfect easy onset!", "Great breath and gentle start!"],
        'onetap': ["Fluent one-tap! You nailed it!", "Awesome! No bumps in that word!"]
    }
    miss_messages = {
        'turtle': "Try to keep it smooth and steady—no rush!",
        'snake': "Try to make it one smooth sound, like a long slide!",
        'balloon': "Remember: gentle breath, then soft and easy!",
        'onetap': "Almost there! Let's try to make it even smoother!"
    }
    
    if is_hit:
        import random
        return random.choice(hit_messages.get(exercise_type, ["Great job!"]))
    else:
        return miss_messages.get(exercise_type, "Give it another try!")


# --- MAIN ENDPOINT: GENERAL ANALYSIS (Sliding Window) ---
@app.route('/analyze_audio', methods=['POST'])
def analyze_audio():
    if 'file' not in request.files: return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    filename = secure_filename(file.filename)
    filepath = os.path.join(os.getcwd(), filename)
    file.save(filepath)

    try:
        ensure_models()
        # 1. Google STT
        full_text, words = get_google_transcript(filepath)
        
        # 2. Load Audio
        full_audio, sr = librosa.load(filepath, sr=SAMPLE_RATE)
        duration = len(full_audio) / sr
        
        max_score = 0.0
        final_type = "Fluent"
        final_phoneme = None
        hotspot_time = 0.0
        
        # Helper for single window prediction
        def predict_window(win_audio):
            embed = extract_yamnet_features(win_audio)
            score = float(binary_model.predict(embed, verbose=0)[0][0])
            sType = "Fluent"
            if score > BINARY_THRESHOLD:
                preds = multiclass_model.predict(embed, verbose=0)[0]
                stutter_preds = preds[1:] # Skip Fluent
                winner_idx = np.argmax(stutter_preds)
                if stutter_preds[winner_idx] > 0.45:
                    labels = ['Block', 'Prolongation', 'Repetition']
                    sType = labels[winner_idx]
                else:
                    sType = "Block" # Fallback
            return score, sType

        # 3. Sliding Window
        if duration < 3.0:
            score, s_type = predict_window(full_audio)
            max_score = score
            final_type = s_type
            hotspot_time = duration / 2
        else:
            current_time = 0.0
            while current_time + 3.0 <= duration:
                start_s = int(current_time * sr)
                end_s = int((current_time + 3.0) * sr)
                window = full_audio[start_s:end_s]
                
                score, s_type = predict_window(window)
                print(f"🪟 {current_time}-{current_time+3.0}s | Score: {score:.2f} | Type: {s_type}")
                
                if score > max_score:
                    max_score = score
                    final_type = s_type
                    hotspot_time = current_time + 1.5 
                current_time += WINDOW_STEP

        is_stutter = max_score > BINARY_THRESHOLD
        
        # 4. Phoneme Mapping
        if is_stutter and words:
            culprit = min(words, key=lambda w: abs(w['start'] - hotspot_time))
            
            # Trust Google Check (Optional)
            if culprit['confidence'] > 0.95 and max_score < 0.8:
                print(f"⚠️ Conflict: Google confident '{culprit['word']}'")
            
            phonemes = g2p(culprit['word'])
            clean = [p for p in phonemes if p not in [" ", "'"]]
            if clean:
                raw = ''.join([i for i in clean[0] if not i.isdigit()])
                final_phoneme = PHONEME_MAP.get(raw, raw.lower())

        response = {
            'is_stutter': is_stutter,
            'stutter_score': max_score,
            'type': final_type if is_stutter else "Fluent",
            'problem_phoneme': final_phoneme,
            'transcript': full_text,
        }
        return jsonify(response)

    finally:
        if os.path.exists(filepath): 
            try: os.remove(filepath)
            except: pass


# --- EXERCISE ENDPOINTS (UPDATED FOR YAMNET) ---

@app.route('/analyze/turtle', methods=['POST'])
def analyze_turtle():
    if 'file' not in request.files: return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    filename = secure_filename(file.filename)
    filepath = os.path.join(os.getcwd(), filename)
    file.save(filepath)

    try:
        ensure_models()
        t0 = time.time()
        # 1. AI Check (Using NEW YAMNET Logic)
        audio, sr = librosa.load(filepath, sr=SAMPLE_RATE)
        embedding = extract_yamnet_features(audio)
        
        score = float(binary_model.predict(embedding, verbose=0)[0][0])
        is_stutter = score > BINARY_THRESHOLD
        block_detected = False
        
        if is_stutter:
            preds = multiclass_model.predict(embedding, verbose=0)[0]
            # Use same fallback logic as main endpoint
            stutter_preds = preds[1:]
            if np.max(stutter_preds) > 0.45:
                labels = ['Block', 'Prolongation', 'Repetition']
                stutter_type = labels[np.argmax(stutter_preds)]
                block_detected = (stutter_type == 'Block')
            else:
                block_detected = True # Default to block if unsure

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
            'clinical_pass': clinical_pass, 'confidence': float(score),
            'feedback': get_feedback('turtle', is_hit, 'Block' if block_detected else None),
            'elapsed_ms': elapsed_ms
        })
    finally:
        if os.path.exists(filepath): 
            try: os.remove(filepath)
            except: pass

@app.route('/analyze/snake', methods=['POST'])
def analyze_snake():
    if 'file' not in request.files: return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    filename = secure_filename(file.filename)
    filepath = os.path.join(os.getcwd(), filename)
    file.save(filepath)

    try:
        ensure_models()
        t0 = time.time()
        # 1. AI Check
        audio, sr = librosa.load(filepath, sr=SAMPLE_RATE)
        embedding = extract_yamnet_features(audio)
        score = float(binary_model.predict(embedding, verbose=0)[0][0])
        repetition_detected = False
        
        if score > BINARY_THRESHOLD:
            preds = multiclass_model.predict(embedding, verbose=0)[0]
            stutter_preds = preds[1:]
            if np.max(stutter_preds) > 0.45:
                labels = ['Block', 'Prolongation', 'Repetition']
                if labels[np.argmax(stutter_preds)] == 'Repetition':
                    repetition_detected = True

        # 2. Amplitude Check
        amp_data = analyze_amplitude(filepath)
        game_pass = amp_data['amplitude_sustained']
        clinical_pass = not repetition_detected
        is_hit = game_pass and clinical_pass
        
        return jsonify({
            'duration_sec': amp_data['duration_sec'], 'amplitude_sustained': amp_data['amplitude_sustained'],
            'game_pass': game_pass, 'repetition_detected': repetition_detected,
            'clinical_pass': clinical_pass, 'confidence': float(score),
            'feedback': get_feedback('snake', is_hit, 'Repetition' if repetition_detected else None),
            'elapsed_ms': int((time.time() - t0) * 1000)
        })
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
        ensure_models()
        t0 = time.time()
        # 1. AI Check
        audio, sr = librosa.load(filepath, sr=SAMPLE_RATE)
        embedding = extract_yamnet_features(audio)
        score = float(binary_model.predict(embedding, verbose=0)[0][0])
        hard_attack = False
        
        if score > BINARY_THRESHOLD:
            preds = multiclass_model.predict(embedding, verbose=0)[0]
            stutter_preds = preds[1:]
            # Hard attack usually sounds like a Block
            if np.max(stutter_preds) > 0.45 and np.argmax(stutter_preds) == 0: # 0 is Block
                hard_attack = True
            elif score > 0.8: # If very high confidence stutter, likely hard attack here
                hard_attack = True

        # 2. Breath Check
        breath_data = detect_breath(filepath)
        game_pass = breath_data['breath_detected']
        clinical_pass = not hard_attack
        is_hit = game_pass and clinical_pass
        
        return jsonify({
            'breath_detected': breath_data['breath_detected'], 'amplitude_onset': breath_data['amplitude_onset'],
            'game_pass': game_pass, 'hard_attack_detected': hard_attack,
            'clinical_pass': clinical_pass, 'confidence': float(score),
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
        ensure_models()
        t0 = time.time()
        audio, sr = librosa.load(filepath, sr=SAMPLE_RATE)
        embedding = extract_yamnet_features(audio)
        score = float(binary_model.predict(embedding, verbose=0)[0][0])
        
        is_stutter = score > BINARY_THRESHOLD
        
        # Clinical pass if no stutter detected at all
        clinical_pass = not is_stutter
        
        return jsonify({
            'repetition_detected': is_stutter, # Simplifying for one tap
            'clinical_pass': clinical_pass,
            'confidence': float(score),
            'feedback': get_feedback('onetap', clinical_pass, 'Stutter' if is_stutter else None),
            'elapsed_ms': int((time.time() - t0) * 1000)
        })
    finally:
        if os.path.exists(filepath): 
            try: os.remove(filepath)
            except: pass

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=False)