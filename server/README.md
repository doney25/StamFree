# StamFree Flask Server

Flask backend for StamFree speech therapy app with AI-powered fluency detection.

## Features

- **Hybrid AI Architecture**: Binary gatekeeper + multiclass specialist
- **Exercise-Specific Endpoints**: Turtle, Snake, Balloon, One-Tap
- **Game Logic Metrics**: WPM, amplitude, breath detection
- **Clinical Validation**: Block, Repetition, Prolongation detection
- **Encouraging Feedback**: Non-corrective, kid-friendly messages

## Setup

### Prerequisites

- Python 3.9+
- Google Cloud credentials (for Speech-to-Text)
- FFmpeg (for audio processing)

### Installation

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Configuration

1. Place your Google Cloud credentials at `credentials.json`
2. Ensure AI models are present:
   - `binary_uclass_v1.h5` - Binary stutter detector
   - `stutter_yamnet_v5.h5` - Multiclass type classifier

### Run Server

```bash
python app.py
```

Server runs on `http://localhost:5000`

## API Endpoints

### Legacy Endpoint

**POST /analyze_audio**
- Original endpoint for backward compatibility
- Returns: `is_stutter`, `stutter_score`, `type`, `transcript`, `problem_phoneme`

### Exercise Endpoints

#### POST /analyze/turtle
Slow speech with fluency validation

**Request**: `multipart/form-data` with `file` (audio)

**Response**:
```json
{
  "wpm": 105,
  "game_pass": true,
  "stutter_detected": false,
  "block_detected": false,
  "clinical_pass": true,
  "confidence": 0.65,
  "feedback": "Great! You spoke slowly and fluently. Keep it up!"
}
```

#### POST /analyze/snake
Prolongation with smoothness validation

**Request**: `multipart/form-data` with `file` (audio)

**Response**:
```json
{
  "duration_sec": 2.3,
  "amplitude_sustained": true,
  "game_pass": true,
  "repetition_detected": false,
  "clinical_pass": true,
  "confidence": 0.70,
  "feedback": "Smooth prolongation! The snake loved that!"
}
```

#### POST /analyze/balloon
Easy onset with breath validation

**Request**: `multipart/form-data` with `file` (audio)

**Response**:
```json
{
  "breath_detected": true,
  "amplitude_onset": 0.25,
  "game_pass": true,
  "hard_attack_detected": false,
  "clinical_pass": true,
  "confidence": 0.68,
  "feedback": "Perfect easy onset! The balloon floated high!"
}
```

#### POST /analyze/onetap
Pure AI judgment for repetition detection

**Request**: `multipart/form-data` with `file` (audio)

**Response**:
```json
{
  "repetition_detected": false,
  "repetition_prob": 0.08,
  "clinical_pass": true,
  "confidence": 0.72,
  "feedback": "Fluent one-tap! You nailed it!"
}
```

## Architecture

### Hybrid AI Model

1. **Binary Gatekeeper** (MFCC → CNN)
   - Detects stutter vs fluent (threshold: 0.75)
   - Fast, efficient first pass

2. **Multiclass Specialist** (YAMNet embeddings → CNN)
   - Classifies stutter type: Block, Prolongation, Repetition
   - Only runs if gatekeeper detects stutter

### Game Logic

- **WPM Calculation**: From Google STT word timing
- **Amplitude Analysis**: RMS over time for sustained sounds
- **Breath Detection**: Silence → onset pattern

### Clinical Logic

- **Fluency Filter** (Turtle): Blocks override slow speech pass
- **Smoothness Filter** (Snake): Repetition overrides amplitude pass
- **Onset Filter** (Balloon): Hard attack overrides breath pass
- **Pure AI** (One-Tap): No game logic, only clinical judgment

## Configuration

### Tuning Parameters

In `app.py`:

```python
BINARY_THRESHOLD = 0.75  # Stutter detection sensitivity
TRIM_DB = 30             # Audio trimming threshold
SAMPLE_RATE = 16000      # Audio sample rate
```

### Exercise Thresholds

- **Turtle WPM**: < 120 (slow speech)
- **Snake Duration**: ≥ 1.5 seconds sustained
- **Balloon Silence**: ≥ 0.3 seconds (breath)

## Testing

Test endpoints with curl:

```bash
# Test Turtle
curl -X POST -F "file=@test_audio.wav" http://localhost:5000/analyze/turtle

# Test Snake
curl -X POST -F "file=@test_audio.wav" http://localhost:5000/analyze/snake

# Test Balloon
curl -X POST -F "file=@test_audio.wav" http://localhost:5000/analyze/balloon

# Test One-Tap
curl -X POST -F "file=@test_audio.wav" http://localhost:5000/analyze/onetap
```

## Deployment

For production:

1. Set `debug=False` in `app.py`
2. Use production WSGI server (gunicorn, uWSGI)
3. Configure CORS for your React Native app domain
4. Set up SSL/TLS certificates
5. Use environment variables for credentials

```bash
# Example with gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## License

MIT
