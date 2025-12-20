import os
import io
import numpy as np
import librosa
import librosa.util
import tensorflow as tf
import tensorflow_hub as hub 
from flask import Flask, request, jsonify
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


# --- MAIN ROUTE ---
@app.route('/analyze_audio', methods=['POST'])
def analyze_audio():
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
        score = 0.0 # Default
        
        if mfcc_input is not None:
            # Predict
            score = float(binary_model.predict(mfcc_input, verbose=0)[0][0])
            
            # THE NEW THRESHOLD CHECK
            is_stutter = score > BINARY_THRESHOLD
            print(f"Gatekeeper Score: {score:.4f} (Threshold: {BINARY_THRESHOLD}) -> Stutter: {is_stutter}")
            
            # 2. SPECIALIST (YAMNet -> Multiclass Model)
            if is_stutter:
                yamnet_input = get_yamnet_embedding(filepath)
                
                if yamnet_input is not None:
                    preds = multiclass_model.predict(yamnet_input, verbose=0)[0]
                    labels = ['Fluent', 'Block', 'Prolongation', 'Repetition']
                    preds[0] = -1 # Ignore Fluent
                    
                    winner_idx = np.argmax(preds)
                    stutter_type = labels[winner_idx]
                    stutter_confidence = float(preds[winner_idx])
                    print(f"Specialist Type: {stutter_type} ({stutter_confidence:.2f})")

        # 3. TEXT & PHONEME LOGIC
        text, words = get_google_transcript(filepath)
        problem_phoneme = None
        
        if words:
            # Find low confidence words
            worst_word = min(words, key=lambda x: x['confidence'])
            
            # Force Stutter if Confidence is TERRIBLE (< 0.6) even if audio missed it?
            # Optional: Uncomment below line to let Google override Audio
            # if worst_word['confidence'] < 0.6: is_stutter = True 

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)