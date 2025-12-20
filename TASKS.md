# Task Breakdown: AI Integration & Backend Validation Architecture
**Feature Branch**: `002-ai-integration-architecture`  
**Created**: 2025-12-20  
**Status**: Ready for Implementation  
**Update**: Flask server exists at `server/app.py` with AI models

---

## ✅ Phase 1: Backend Infrastructure (Flask Server) - EXISTING

### 1.1 Custom AI Model Development - ✅ COMPLETE

**Existing Implementation**:
- ✅ Binary model (`binary_uclass_v1.h5`) - Stutter detection gatekeeper
- ✅ Multiclass model (`stutter_yamnet_v5.h5`) - Type classification (Block/Prolongation/Repetition)
- ✅ YAMNet embeddings for feature extraction
- ✅ MFCC features for binary classification
- ✅ Hybrid architecture: Binary gatekeeper → Specialist classifier

---

### 1.2 Flask API Endpoints - ⚠️ NEEDS ADAPTATION

**Existing Implementation**:
- ✅ Flask app structure (`server/app.py`)
- ✅ Audio upload handling (multipart/form-data)
- ✅ Single endpoint: `POST /analyze_audio`
- ✅ Google STT integration for transcription
- ✅ MFCC + YAMNet feature extraction
- ✅ Hybrid model inference

**Task 1.2.1**: Adapt existing endpoint for exercise-specific analysis
- [ ] Review current `/analyze_audio` response format
- [ ] Map existing stutter types (Block/Prolongation/Repetition) to exercise logic
- [ ] Add CORS configuration for React Native
- [ ] Create requirements.txt if missing
- **Estimated**: 2 hours
- **Priority**: P0 (blocker)

**Task 1.2.2**: Create exercise-specific endpoints OR adapt generic endpoint
- **Option A**: Keep single `/analyze_audio` endpoint and pass `exercise_type` parameter
- **Option B**: Create separate endpoints `/analyze/turtle`, `/analyze/snake`, etc.
- [ ] Add WPM calculation (use existing Google STT transcript + word timing)
- [ ] Add amplitude/duration analysis (use existing audio loading)
- [ ] Add breath detection logic (silence → onset pattern)
- [ ] Map AI stutter types to exercise validations:
  - Turtle: Block detection → `clinical_pass = !is_block`
  - Snake: Repetition detection → `clinical_pass = !is_repetition`  
  - Balloon: Block detection (hard attack) → `clinical_pass = !is_block`
  - One-Tap: Repetition detection → `clinical_pass = !is_repetition`
- [ ] Return JSON matching spec contracts (game_pass, clinical_pass, feedback)
- **Estimated**: 8 hours
- **Priority**: P0 (blocker)

**Task 1.2.3**: Create feedback message generator
- [ ] Write non-corrective, encouraging messages for each scenario
- [ ] Handle Hit cases (4 messages per exercise type)
- [ ] Handle Miss cases with gentle guidance
- [ ] Avoid negative/corrective language
- [ ] Make messages contextual to exercise type
- **Estimated**: 4 hours
- **Priority**: P1

---

### 1.3 Game Logic Processing (DSP/STT) - ⚠️ PARTIALLY COMPLETE

**Existing Implementation**:
- ✅ Google STT with word timing and confidence (can derive WPM)
- ✅ Audio loading with librosa (SR=16000)
- ✅ Audio trimming and normalization

**Task 1.3.1**: Add WPM calculation from existing Google STT
- [ ] Use `word_time_offsets` from Google STT response
- [ ] Calculate words per minute: `(word_count / duration_seconds) * 60`
- [ ] Handle empty transcriptions
- **Estimated**: 2 hours
- **Priority**: P1

**Task 1.3.2**: Add amplitude/duration analysis
- [ ] Extract RMS amplitude over time from loaded audio
- [ ] Detect sustained amplitude periods (>threshold for N seconds)
- [ ] Return duration and `amplitude_sustained` boolean
- **Estimated**: 3 hours
- **Priority**: P1

**Task 1.3.3**: Add breath detection logic
- [ ] Detect silence period (low amplitude <threshold)
- [ ] Detect sound onset after silence
- [ ] Calculate onset amplitude (check for hard attack)
- [ ] Return `breath_detected` and `onset_amplitude`
- **Estimated**: 3 hours
- **Priority**: P1

---

### 1.4 Testing & Performance

**Task 1.4.1**: Write unit tests for each endpoint
- [ ] Test /analyze/turtle with fluent slow speech
- [ ] Test /analyze/turtle with blocks
- [ ] Test /analyze/snake with smooth prolongation
- [ ] Test /analyze/snake with repetition loops
- [ ] Test /analyze/balloon with easy onset
- [ ] Test /analyze/balloon with hard attack
- [ ] Test /analyze/onetap with fluent speech
- [ ] Test /analyze/onetap with repetitions
- [ ] Achieve ≥80% code coverage
- **Estimated**: 8 hours
- **Priority**: P1

**Task 1.4.2**: Validate response contracts
- [ ] Test JSON structure matches spec for all endpoints
- [ ] Validate confidence scores are 0.0-1.0
- [ ] Validate feedback messages are strings
- [ ] Validate game_pass and clinical_pass are booleans
- **Estimated**: 2 hours
- **Priority**: P1

**Task 1.4.3**: Performance testing
- [ ] Test response time with 10-second audio files
- [ ] Test response time with 30-second audio files
- [ ] Optimize model inference if >5 seconds
- [ ] Implement audio compression if needed
- [ ] Validate 90th percentile ≤5 seconds
- **Estimated**: 6 hours
- **Priority**: P1

**Task 1.4.4**: Error handling tests
- [ ] Test with invalid audio format
- [ ] Test with silent audio
- [ ] Test with corrupted audio
- [ ] Test with very short audio (<0.5 seconds)
- [ ] Test with oversized files
- [ ] Validate error responses are structured JSON
- **Estimated**: 4 hours
- **Priority**: P2

**Task 1.4.5**: Load testing
- [ ] Setup load testing tool (Locust, Apache Bench)
- [ ] Test concurrent requests (10, 50, 100)
- [ ] Monitor memory usage during load
- [ ] Identify bottlenecks
- [ ] Document performance characteristics
- **Estimated**: 4 hours
- **Priority**: P2

---

## Phase 2: App Integration (React Native)

### 2.1 Exercise Flow Updates

**Task 2.1.1**: Create "Thinking..." UI component
- [ ] Design spinner/loading animation
- [ ] Add "Analyzing your speech..." text
- [ ] Make dismissible on completion
- [ ] Add to component library
- **Estimated**: 2 hours
- **Priority**: P1

**Task 2.1.2**: Implement audio upload service
- [ ] Create API client for Flask endpoints
- [ ] Implement multipart/form-data upload
- [ ] Handle network errors gracefully
- [ ] Add retry logic (3 attempts)
- [ ] Add timeout (10 seconds)
- **Estimated**: 5 hours
- **Priority**: P1

**Task 2.1.3**: Implement response parser
- [ ] Parse JSON responses from Flask
- [ ] Validate response structure
- [ ] Extract game metrics
- [ ] Extract clinical judgment
- [ ] Handle malformed responses
- **Estimated**: 3 hours
- **Priority**: P1

**Task 2.1.4**: Implement combined Hit/Miss logic
- [ ] Create decision function: `game_pass AND clinical_pass`
- [ ] Handle One-Tap exception (clinical_pass only)
- [ ] Return final Hit/Miss + feedback
- [ ] Log decision rationale
- **Estimated**: 2 hours
- **Priority**: P1

---

### 2.2 Exercise-Specific Integration

**Task 2.2.1**: Integrate Turtle exercise with /analyze/turtle
- [ ] Call audio upload after recording stops
- [ ] Show "Thinking..." spinner
- [ ] Parse response (WPM, block_detected, clinical_pass)
- [ ] Apply fluency filter (override if blocks detected)
- [ ] Display feedback message
- [ ] Update exercise result in state
- **Estimated**: 4 hours
- **Priority**: P1

**Task 2.2.2**: Integrate Snake exercise with /analyze/snake
- [ ] Call audio upload after recording stops
- [ ] Show "Thinking..." spinner
- [ ] Parse response (amplitude_sustained, repetition_detected, clinical_pass)
- [ ] Apply smoothness filter (override if repetition detected)
- [ ] Display feedback message
- [ ] Update exercise result in state
- **Estimated**: 4 hours
- **Priority**: P1

**Task 2.2.3**: Integrate Balloon exercise with /analyze/balloon
- [ ] Call audio upload after recording stops
- [ ] Show "Thinking..." spinner
- [ ] Parse response (breath_detected, hard_attack_detected, clinical_pass)
- [ ] Apply onset filter (override if hard attack detected)
- [ ] Display feedback message
- [ ] Update exercise result in state
- **Estimated**: 4 hours
- **Priority**: P1

**Task 2.2.4**: Integrate One-Tap exercise with /analyze/onetap
- [ ] Call audio upload after recording stops
- [ ] Show "Thinking..." spinner
- [ ] Parse response (repetition_detected, clinical_pass)
- [ ] Use only clinical judgment (no game logic override)
- [ ] Display feedback message
- [ ] Update exercise result in state
- **Estimated**: 4 hours
- **Priority**: P1

---

### 2.3 Feedback Display

**Task 2.3.1**: Create feedback display component
- [ ] Design feedback card UI
- [ ] Show Hit/Miss icon
- [ ] Display clinical feedback message
- [ ] Add optional confidence score indicator
- [ ] Make visually encouraging (colors, animations)
- **Estimated**: 4 hours
- **Priority**: P1

**Task 2.3.2**: Implement edge case UI handling
- [ ] Backend unavailable: Show friendly error + retry button
- [ ] Audio too short/silent: Prompt to re-record
- [ ] Ambiguous fluency (low confidence): Show "Almost there!" message
- [ ] Network timeout: Show timeout message + retry
- **Estimated**: 4 hours
- **Priority**: P2

---

### 2.4 Offline Queue Enhancement

**Task 2.4.1**: Extend offline queue for audio uploads
- [ ] Store audio files locally when backend unavailable
- [ ] Queue audio with exercise metadata
- [ ] Retry upload on reconnect
- [ ] Update exercise result after delayed analysis
- **Estimated**: 6 hours
- **Priority**: P2

**Task 2.4.2**: Cache Clinical Logic results
- [ ] Store clinical judgment in activity_logs
- [ ] Include game metrics, AI judgment, confidence
- [ ] Make available for offline review
- [ ] Sync with Firebase when online
- **Estimated**: 4 hours
- **Priority**: P2

---

## Phase 3: Real-Time Game Logic (UI Animations)

### 3.1 DSP Implementation (Client-Side)

**Task 3.1.1**: Implement real-time WPM extraction for Turtle
- [ ] Integrate on-device STT (Expo Speech or alternative)
- [ ] Calculate WPM as user speaks
- [ ] Update Turtle walking speed in real-time
- [ ] Target <100ms latency
- [ ] Test with various speech rates
- **Estimated**: 8 hours
- **Priority**: P1

**Task 3.1.2**: Implement real-time amplitude monitoring for Snake
- [ ] Access audio amplitude from microphone
- [ ] Monitor amplitude threshold
- [ ] Update Snake movement in real-time
- [ ] Target <100ms latency
- [ ] Test with sustained sounds
- **Estimated**: 6 hours
- **Priority**: P1

**Task 3.1.3**: Implement real-time breath detection for Balloon
- [ ] Monitor for silence period (breath intake)
- [ ] Detect sound onset after silence
- [ ] Update Balloon inflation in real-time
- [ ] Target <100ms latency
- [ ] Test with breath → speech patterns
- **Estimated**: 6 hours
- **Priority**: P1

---

### 3.2 Animation Responsiveness

**Task 3.2.1**: Optimize animation performance
- [ ] Profile animation frame rate
- [ ] Ensure 60fps during real-time updates
- [ ] Test on low-end devices
- [ ] Reduce audio processing overhead if needed
- **Estimated**: 4 hours
- **Priority**: P2

**Task 3.2.2**: Test responsiveness across exercises
- [ ] Measure latency from speech to animation
- [ ] Validate 95% of exercises animate within 100ms
- [ ] Document any cases exceeding threshold
- [ ] Optimize outliers
- **Estimated**: 3 hours
- **Priority**: P2

---

## Phase 4: Testing & Validation

### 4.1 Acceptance Testing

**Task 4.1.1**: Test User Story 1 (Turtle with Fluency)
- [ ] Scenario 1: Slow fluent speech → Hit
- [ ] Scenario 2: Slow speech with blocks → Fail
- [ ] Validate AI detects blocks masked by slow WPM
- [ ] Confirm feedback is non-corrective
- **Estimated**: 2 hours
- **Priority**: P1

**Task 4.1.2**: Test User Story 2 (Snake with Repetition)
- [ ] Scenario 1: Smooth prolongation → Hit
- [ ] Scenario 2: Repetition loop → Fail
- [ ] Validate AI detects repetition despite sustained amplitude
- [ ] Confirm feedback is non-corrective
- **Estimated**: 2 hours
- **Priority**: P1

**Task 4.1.3**: Test User Story 3 (Balloon with Onset)
- [ ] Scenario 1: Easy onset with breath → Hit
- [ ] Scenario 2: Hard attack despite breath → Fail
- [ ] Validate AI detects hard attack masked by good breathing
- [ ] Confirm feedback is non-corrective
- **Estimated**: 2 hours
- **Priority**: P1

**Task 4.1.4**: Test User Story 4 (One-Tap with AI)
- [ ] Scenario 1: Fluent word → Hit
- [ ] Scenario 2: Repetition stutter → Fail
- [ ] Validate AI is sole judge (no game logic)
- [ ] Confirm feedback is non-corrective
- **Estimated**: 2 hours
- **Priority**: P1

---

### 4.2 Edge Case Testing

**Task 4.2.1**: Test backend unavailable scenario
- [ ] Disconnect from Flask server
- [ ] Attempt exercise completion
- [ ] Verify friendly error message shown
- [ ] Verify audio queued for retry
- [ ] Reconnect and verify retry succeeds
- **Estimated**: 2 hours
- **Priority**: P2

**Task 4.2.2**: Test audio quality edge cases
- [ ] Test with silent audio → Prompt to re-record
- [ ] Test with very short audio (<0.5s) → Prompt to re-record
- [ ] Test with background noise → Verify robustness
- **Estimated**: 2 hours
- **Priority**: P2

**Task 4.2.3**: Test ambiguous fluency (low confidence)
- [ ] Create borderline stutter samples
- [ ] Verify AI returns mid-range confidence (0.4-0.6)
- [ ] Verify app shows gentle feedback ("Almost there!")
- **Estimated**: 2 hours
- **Priority**: P2

**Task 4.2.4**: Test network timeout scenario
- [ ] Simulate slow network (>5 seconds)
- [ ] Verify timeout message shown
- [ ] Verify retry option available
- [ ] Test retry succeeds with faster network
- **Estimated**: 2 hours
- **Priority**: P2

---

### 4.3 Clinical Review

**Task 4.3.1**: Prepare feedback message samples
- [ ] Collect all feedback messages from system
- [ ] Organize by exercise type and outcome
- [ ] Create review document for therapists
- **Estimated**: 2 hours
- **Priority**: P2

**Task 4.3.2**: Conduct therapist review
- [ ] Share samples with speech therapists
- [ ] Collect ratings on non-corrective/encouraging scale
- [ ] Gather qualitative feedback
- [ ] Target: ≥80% rated positively
- **Estimated**: 4 hours (external)
- **Priority**: P2

**Task 4.3.3**: Iterate on feedback based on review
- [ ] Update messages with low ratings
- [ ] Incorporate therapist suggestions
- [ ] Re-review updated messages
- **Estimated**: 3 hours
- **Priority**: P2

---

### 4.4 End-to-End Performance

**Task 4.4.1**: Measure full exercise flow timing
- [ ] Record → Game Logic Animation → Analysis → Result
- [ ] Test with 10-second audio samples
- [ ] Test with 30-second audio samples
- [ ] Measure 50th, 90th, 95th percentiles
- [ ] Validate 90th percentile ≤5 seconds
- **Estimated**: 3 hours
- **Priority**: P1

**Task 4.4.2**: Optimize if performance targets not met
- [ ] Profile bottlenecks (network, model inference, audio processing)
- [ ] Implement audio compression if needed
- [ ] Optimize model inference (quantization, pruning)
- [ ] Re-test after optimizations
- **Estimated**: 8 hours (contingent)
- **Priority**: P1

---

## Phase 5: Logging & Analytics

### 5.1 Exercise Attempt Records

**Task 5.1.1**: Extend activity_logs schema
- [ ] Add game_metrics field (WPM, amplitude, duration, breath)
- [ ] Add clinical_judgment field (stutter/block/repetition/hard_attack)
- [ ] Add confidence_score field (0.0-1.0)
- [ ] Add feedback_message field
- [ ] Update Firebase schema
- **Estimated**: 2 hours
- **Priority**: P2

**Task 5.1.2**: Implement logging on exercise completion
- [ ] Log game metrics from real-time analysis
- [ ] Log clinical judgment from Flask response
- [ ] Log final Hit/Miss outcome
- [ ] Log feedback message shown to user
- [ ] Sync to Firebase
- **Estimated**: 3 hours
- **Priority**: P2

---

### 5.2 Analytics Dashboard (Optional)

**Task 5.2.1**: Create analytics queries
- [ ] Query AI accuracy over time (% correct predictions)
- [ ] Query average response time by exercise type
- [ ] Query low-confidence results for review
- [ ] Query user progress (Hit rate by exercise)
- **Estimated**: 4 hours
- **Priority**: P3 (optional)

**Task 5.2.2**: Build simple dashboard UI
- [ ] Display AI accuracy chart
- [ ] Display response time chart
- [ ] List low-confidence attempts for manual review
- [ ] Filter by date range, exercise type
- **Estimated**: 8 hours
- **Priority**: P3 (optional)

---

## Summary

**Total Estimated Hours**: ~195 hours (~5 weeks for 1 developer)
- **Reduced from 286 hours** due to existing Flask server + AI models

**Critical Path** (Updated):
1. ✅ Phase 1.1 (AI Model) - COMPLETE
2. **Phase 1.2** (Adapt Flask Endpoints) → **Phase 2** (App Integration) → **Phase 4.1** (Acceptance Tests)

**Parallel Workstreams**:
- Phase 1.2-1.4 (Backend adaptation) and Phase 3 (Real-time UI) can be developed in parallel
- Phase 5 (Logging) can start after Phase 2 is partially complete

**Priority Levels**:
- **P0**: Blockers (must complete before others) - **Start here: Task 1.2.1-1.2.2**
- **P1**: Core functionality (required for MVP)
- **P2**: Quality & polish (important for production)
- **P3**: Optional enhancements

**Current Status**:
- ✅ AI models trained and ready (`binary_uclass_v1.h5`, `stutter_yamnet_v5.h5`)
- ✅ Flask app structure exists
- ⚠️ Need to adapt `/analyze_audio` endpoint for exercise-specific logic
- ⚠️ Need to add game logic metrics (WPM, amplitude, breath detection)
- ❌ App integration not started

---

**Next Steps**: 
1. Adapt Flask endpoint for exercise contracts (Task 1.2.1-1.2.3)
2. Start app integration (Phase 2)
3. Implement real-time game logic (Phase 3)
