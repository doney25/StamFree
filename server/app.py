import os
import io
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
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "credentials.json"

# MODEL FILES
BINARY_MODEL_PATH = 'binary_uclass.h5'      
MULTICLASS_MODEL_PATH = 'multi_label_sep28k.h5' 

BINARY_THRESHOLD = 0.75  

TRIM_DB = 30 

# CONSTANTS
FIXED_FRAMES = 94 
N_MFCC = 40
SAMPLE_RATE = 16000
DURATION = 3

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

# --- LOAD MODELS ---
print("1. Loading YAMNet Base...")
yamnet_model = hub.load('https://tfhub.dev/google/yamnet/1')

print("2. Loading Custom Models...")
binary_model = load_model(BINARY_MODEL_PATH)
multiclass_model = load_model(MULTICLASS_MODEL_PATH)

# --- HELPER 1: GOOGLE STT ---
def get_google_transcript(file_path):
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
        
        transcript_data = []
        full_text = ""
        for result in response.results:
            full_text += result.alternatives[0].transcript + " "
            for word_info in result.alternatives[0].words:
                transcript_data.append({
                    "word": word_info.word,
                    "confidence": word_info.confidence
                })
        return full_text.strip(), transcript_data
    except Exception as e:
        print(f"STT Error: {e}")
        return "", []


# --- HELPER 2: MFCC (For Binary Gatekeeper) ---
def get_mfcc_features(file_path):
    try:
        # Load & Preprocess
        audio, sr = librosa.load(file_path, sr=SAMPLE_RATE)
        
        # FIX: Gentler Trim
        audio, _ = librosa.effects.trim(audio, top_db=TRIM_DB)
        
        # Keep Normalization (It fixed the "0.03" score issue)
        audio = librosa.util.normalize(audio)
        
        # Duration Check
        target_len = SAMPLE_RATE * DURATION 
        if len(audio) > target_len:
            center = len(audio) // 2
            start = center - (target_len // 2)
            audio = audio[start : start + target_len]
        elif len(audio) < target_len:
            audio = np.pad(audio, (0, target_len - len(audio)))
            
        # Extract MFCC
        mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=N_MFCC).T 
        
        # Shape Enforcement (94, 40)
        if mfcc.shape[0] < FIXED_FRAMES:
            mfcc = np.pad(mfcc, ((0, FIXED_FRAMES - mfcc.shape[0]), (0, 0)))
        elif mfcc.shape[0] > FIXED_FRAMES:
            mfcc = mfcc[:FIXED_FRAMES, :]
            
        return mfcc[np.newaxis, ...]
    except:
        return None


# --- HELPER 3: YAMNET EMBEDDING (For Specialist) ---
def get_yamnet_embedding(file_path):
    try:
        # Load full audio at 16k
        waveform, _ = librosa.load(file_path, sr=16000)
        waveform = waveform.astype(np.float32)
        
        # Get Embeddings from TF Hub Model
        _, embeddings, _ = yamnet_model(waveform)
        
        # Average to get (1, 1024)
        global_embedding = tf.reduce_mean(embeddings, axis=0)
        return global_embedding.numpy()[np.newaxis, ...]
    except Exception as e:
        print(f"YAMNet Error: {e}")
        return None


# --- HELPER 4: GAME LOGIC METRICS ---
def calculate_wpm(words_data):
    """Calculate words per minute from Google STT word timing"""
    if not words_data or len(words_data) < 2:
        return 0
    
    first_word = words_data[0]
    last_word = words_data[-1]
    
    start_time = first_word.get('start_time', 0)
    end_time = last_word.get('end_time', start_time)
    
    duration_seconds = end_time - start_time
    if duration_seconds <= 0:
        return 0
    
    word_count = len(words_data)
    wpm = (word_count / duration_seconds) * 60
    return round(wpm, 1)


def analyze_amplitude(filepath, threshold=0.02, min_duration=1.5):
    """Analyze sustained amplitude for Snake exercise"""
    try:
        audio, sr = librosa.load(filepath, sr=SAMPLE_RATE)
        audio, _ = librosa.effects.trim(audio, top_db=TRIM_DB)
        
        # Calculate RMS amplitude
        rms = librosa.feature.rms(y=audio)[0]
        frame_duration = len(audio) / sr / len(rms)
        
        # Find sustained periods
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
        
        return {
            'duration_sec': round(sustained_duration, 2),
            'amplitude_sustained': amplitude_sustained
        }
    except:
        return {'duration_sec': 0, 'amplitude_sustained': False}


def detect_breath(filepath, silence_threshold=0.01, min_silence=0.3):
    """Detect breath pattern (silence → onset) for Balloon exercise"""
    try:
        audio, sr = librosa.load(filepath, sr=SAMPLE_RATE)
        
        # Calculate RMS amplitude
        rms = librosa.feature.rms(y=audio, frame_length=2048, hop_length=512)[0]
        frame_duration = len(audio) / sr / len(rms)
        
        # Find silence periods
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
                    # Check onset amplitude after silence
                    if i < len(rms):
                        onset_amplitude = float(rms[i])
                        return {
                            'breath_detected': True,
                            'amplitude_onset': round(onset_amplitude, 3)
                        }
                silence_count = 0
        
        return {'breath_detected': has_silence, 'amplitude_onset': 0.0}
    except:
        return {'breath_detected': False, 'amplitude_onset': 0.0}


# --- HELPER 5: FEEDBACK MESSAGES ---
def get_feedback(exercise_type, is_hit, stutter_type=None):
    """Generate non-corrective, encouraging feedback messages"""
    
    hit_messages = {
        'turtle': [
            "Great! You spoke slowly and fluently. Keep it up!",
            "Awesome slow speech! The turtle loved that pace!",
            "Perfect control! You're mastering slow speech!",
            "Wonderful! Your slow, steady speech was excellent!"
        ],
        'snake': [
            "Smooth prolongation! The snake loved that!",
            "Excellent sustained sound! Keep that smoothness going!",
            "Beautiful! You held that sound perfectly!",
            "Amazing! That was a really smooth prolongation!"
        ],
        'balloon': [
            "Perfect easy onset! The balloon floated high!",
            "Great breath and gentle start! You've got this!",
            "Wonderful! That was a soft, easy beginning!",
            "Excellent! Your easy onset was spot on!"
        ],
        'onetap': [
            "Fluent one-tap! You nailed it!",
            "Perfect! That was smooth and clear!",
            "Awesome! No bumps in that word!",
            "Great job! That word flowed beautifully!"
        ]
    }
    
    miss_messages = {
        'turtle': "Try to keep it smooth and steady—no rush, no bumps!",
        'snake': "Try to make it one smooth sound, like a long slide!",
        'balloon': "Remember: gentle breath, then soft and easy!",
        'onetap': "Almost there! Let's try to make it even smoother!"
    }
    
    if is_hit:
        import random
        return random.choice(hit_messages.get(exercise_type, ["Great job!"]))
    else:
        return miss_messages.get(exercise_type, "Give it another try—you're doing great!")


# --- MAIN ROUTE ---
@app.route('/analyze_audio', methods=['POST'])
def analyze_audio():
    """Legacy endpoint - kept for backward compatibility"""
    if 'file' not in request.files: return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    filename = secure_filename(file.filename)
    filepath = os.path.join(os.getcwd(), filename)
    file.save(filepath)

    try:
        # 1. GATEKEEPER (MFCC -> Binary Model)
        mfcc_input = get_mfcc_features(filepath)
        is_stutter = False
        stutter_type = "Fluent"
        stutter_confidence = 0.0
        score = 0.0
        
        if mfcc_input is not None:
            score = float(binary_model.predict(mfcc_input, verbose=0)[0][0])
            is_stutter = score > BINARY_THRESHOLD
            print(f"Gatekeeper Score: {score:.4f} -> Stutter: {is_stutter}")
            
            # 2. SPECIALIST (YAMNet -> Multiclass Model)
            if is_stutter:
                yamnet_input = get_yamnet_embedding(filepath)
                
                if yamnet_input is not None:
                    preds = multiclass_model.predict(yamnet_input, verbose=0)[0]
                    labels = ['Fluent', 'Block', 'Prolongation', 'Repetition']
                    preds[0] = -1
                    
                    winner_idx = np.argmax(preds)
                    stutter_type = labels[winner_idx]
                    stutter_confidence = float(preds[winner_idx])
                    print(f"Specialist Type: {stutter_type} ({stutter_confidence:.2f})")

        # 3. TEXT & PHONEME LOGIC
        text, words = get_google_transcript(filepath)
        problem_phoneme = None
        
        if words:
            worst_word = min(words, key=lambda x: x['confidence'])
            culprit_word = worst_word['word'] if worst_word['confidence'] < 0.85 else words[0]['word']
            
            phonemes = g2p(culprit_word) 
            cleaned_phonemes = [p for p in phonemes if p not in [" ", "'"]]
            
            if cleaned_phonemes:
                raw_phoneme = cleaned_phonemes[0]
                raw_phoneme = ''.join([i for i in raw_phoneme if not i.isdigit()]) 
                problem_phoneme = PHONEME_MAP.get(raw_phoneme, raw_phoneme.lower())

        response = {
            'is_stutter': is_stutter,
            'stutter_score': score,
            'type': stutter_type,
            'type_confidence': stutter_confidence,
            'transcript': text,
            'problem_phoneme': problem_phoneme if is_stutter else None,
        }
        
        return jsonify(response)

    finally:
        if os.path.exists(filepath): 
            try: os.remove(filepath)
            except: pass


# --- EXERCISE-SPECIFIC ENDPOINTS ---

@app.route('/analyze/turtle', methods=['POST'])
def analyze_turtle():
    """Turtle Exercise: Slow speech with fluency validation"""
    if 'file' not in request.files: 
        return jsonify({'error': 'No file'}), 400
    
    file = request.files['file']
    filename = secure_filename(file.filename)
    filepath = os.path.join(os.getcwd(), filename)
    file.save(filepath)

    try:
        # Get AI analysis
        mfcc_input = get_mfcc_features(filepath)
        score = 0.0
        block_detected = False
        
        if mfcc_input is not None:
            score = float(binary_model.predict(mfcc_input, verbose=0)[0][0])
            is_stutter = score > BINARY_THRESHOLD
            
            if is_stutter:
                yamnet_input = get_yamnet_embedding(filepath)
                if yamnet_input is not None:
                    preds = multiclass_model.predict(yamnet_input, verbose=0)[0]
                    labels = ['Fluent', 'Block', 'Prolongation', 'Repetition']
                    stutter_type = labels[np.argmax(preds)]
                    block_detected = (stutter_type == 'Block')
        
        # Get transcript for WPM
        text, words = get_google_transcript(filepath)
        wpm = calculate_wpm(words) if words else 0
        
        # Game Logic: Pass if WPM is slow (< 120)
        game_pass = wpm < 120 and wpm > 0
        
        # Clinical Logic: Pass if no blocks detected
        clinical_pass = not block_detected
        
        # Combined result
        is_hit = game_pass and clinical_pass
        
        response = {
            'wpm': wpm,
            'game_pass': game_pass,
            'stutter_detected': score > BINARY_THRESHOLD,
            'block_detected': block_detected,
            'clinical_pass': clinical_pass,
            'confidence': float(score),
            'feedback': get_feedback('turtle', is_hit, 'Block' if block_detected else None)
        }
        
        print(f"[TURTLE] WPM={wpm}, Block={block_detected}, Hit={is_hit}")
        return jsonify(response)

    finally:
        if os.path.exists(filepath): 
            try: os.remove(filepath)
            except: pass


@app.route('/analyze/snake', methods=['POST'])
def analyze_snake():
    """Snake Exercise: Prolongation with smoothness validation"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    
    file = request.files['file']
    filename = secure_filename(file.filename)
    filepath = os.path.join(os.getcwd(), filename)
    file.save(filepath)

    try:
        # Get AI analysis
        mfcc_input = get_mfcc_features(filepath)
        score = 0.0
        repetition_detected = False
        
        if mfcc_input is not None:
            score = float(binary_model.predict(mfcc_input, verbose=0)[0][0])
            is_stutter = score > BINARY_THRESHOLD
            
            if is_stutter:
                yamnet_input = get_yamnet_embedding(filepath)
                if yamnet_input is not None:
                    preds = multiclass_model.predict(yamnet_input, verbose=0)[0]
                    labels = ['Fluent', 'Block', 'Prolongation', 'Repetition']
                    stutter_type = labels[np.argmax(preds)]
                    repetition_detected = (stutter_type == 'Repetition')
        
        # Get amplitude analysis
        amp_data = analyze_amplitude(filepath)
        
        # Game Logic: Pass if sustained amplitude
        game_pass = amp_data['amplitude_sustained']
        
        # Clinical Logic: Pass if no repetition detected
        clinical_pass = not repetition_detected
        
        # Combined result
        is_hit = game_pass and clinical_pass
        
        response = {
            'duration_sec': amp_data['duration_sec'],
            'amplitude_sustained': amp_data['amplitude_sustained'],
            'game_pass': game_pass,
            'repetition_detected': repetition_detected,
            'clinical_pass': clinical_pass,
            'confidence': float(score),
            'feedback': get_feedback('snake', is_hit, 'Repetition' if repetition_detected else None)
        }
        
        print(f"[SNAKE] Duration={amp_data['duration_sec']}s, Repetition={repetition_detected}, Hit={is_hit}")
        return jsonify(response)

    finally:
        if os.path.exists(filepath):
            try: os.remove(filepath)
            except: pass


@app.route('/analyze/balloon', methods=['POST'])
def analyze_balloon():
    """Balloon Exercise: Easy onset with breath validation"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    
    file = request.files['file']
    filename = secure_filename(file.filename)
    filepath = os.path.join(os.getcwd(), filename)
    file.save(filepath)

    try:
        # Get AI analysis for hard attack (treated as Block)
        mfcc_input = get_mfcc_features(filepath)
        score = 0.0
        hard_attack_detected = False
        
        if mfcc_input is not None:
            score = float(binary_model.predict(mfcc_input, verbose=0)[0][0])
            is_stutter = score > BINARY_THRESHOLD
            
            if is_stutter:
                yamnet_input = get_yamnet_embedding(filepath)
                if yamnet_input is not None:
                    preds = multiclass_model.predict(yamnet_input, verbose=0)[0]
                    labels = ['Fluent', 'Block', 'Prolongation', 'Repetition']
                    stutter_type = labels[np.argmax(preds)]
                    # Hard attack manifests as Block
                    hard_attack_detected = (stutter_type == 'Block')
        
        # Get breath detection
        breath_data = detect_breath(filepath)
        
        # Game Logic: Pass if breath detected
        game_pass = breath_data['breath_detected']
        
        # Clinical Logic: Pass if no hard attack
        clinical_pass = not hard_attack_detected
        
        # Combined result
        is_hit = game_pass and clinical_pass
        
        response = {
            'breath_detected': breath_data['breath_detected'],
            'amplitude_onset': breath_data['amplitude_onset'],
            'game_pass': game_pass,
            'hard_attack_detected': hard_attack_detected,
            'clinical_pass': clinical_pass,
            'confidence': float(score),
            'feedback': get_feedback('balloon', is_hit, 'Block' if hard_attack_detected else None)
        }
        
        print(f"[BALLOON] Breath={breath_data['breath_detected']}, HardAttack={hard_attack_detected}, Hit={is_hit}")
        return jsonify(response)

    finally:
        if os.path.exists(filepath):
            try: os.remove(filepath)
            except: pass


@app.route('/analyze/onetap', methods=['POST'])
def analyze_onetap():
    """One-Tap Exercise: Pure AI judgment for repetition detection"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    
    file = request.files['file']
    filename = secure_filename(file.filename)
    filepath = os.path.join(os.getcwd(), filename)
    file.save(filepath)

    try:
        # Get AI analysis (no game logic, pure clinical judgment)
        mfcc_input = get_mfcc_features(filepath)
        score = 0.0
        repetition_detected = False
        repetition_prob = 0.0
        
        if mfcc_input is not None:
            score = float(binary_model.predict(mfcc_input, verbose=0)[0][0])
            is_stutter = score > BINARY_THRESHOLD
            
            if is_stutter:
                yamnet_input = get_yamnet_embedding(filepath)
                if yamnet_input is not None:
                    preds = multiclass_model.predict(yamnet_input, verbose=0)[0]
                    labels = ['Fluent', 'Block', 'Prolongation', 'Repetition']
                    stutter_type = labels[np.argmax(preds)]
                    repetition_detected = (stutter_type == 'Repetition')
                    repetition_prob = float(preds[3])  # Repetition is index 3
        
        # Clinical Logic: Pass if no repetition
        clinical_pass = not repetition_detected
        
        # No game logic for one-tap
        is_hit = clinical_pass
        
        response = {
            'repetition_detected': repetition_detected,
            'repetition_prob': repetition_prob,
            'clinical_pass': clinical_pass,
            'confidence': float(score),
            'feedback': get_feedback('onetap', is_hit, 'Repetition' if repetition_detected else None)
        }
        
        print(f"[ONETAP] Repetition={repetition_detected}, Hit={is_hit}")
        return jsonify(response)

    finally:
        if os.path.exists(filepath):
            try: os.remove(filepath)
            except: pass

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)