# Snake Sound Trail Configuration Reference

This document details the configuration constants and helpers defined in `constants/snakeConfig.ts` for the Snake Sound Trail game.

## Core Constants

### Amplitude & Movement Detection

- **AMPLITUDE_THRESHOLD**: `0.1`  
  Minimum amplitude (0-1 scale) required to trigger snake movement. Values below this are treated as silence.  
  _Related: FR-004, FR-020_

- **SILENCE_GRACE_PERIOD**: `0.1` seconds  
  Time the amplitude must stay below threshold before movement halts. Prevents brief dips from stopping the snake.  
  _Related: FR-004_

- **SLEEP_OVERLAY_DELAY**: `2.0` seconds  
  After continuous silence, the "Zzz" sleep icon appears after this delay. Movement already halted per SILENCE_GRACE_PERIOD.  
  _Related: Edge Cases, User Story 4_

### Speed & Performance

- **V_MAX**: `1.5`  
  Maximum speed cap as a multiplier of base speed. Even at loudest volume, speed won't exceed `baseSpeed × 1.5`.  
  _Related: FR-003, FR-019_

- **TARGET_FPS**: `60`  
  Target frame rate for game loop and visualizer updates.  
  _Related: NFR-001_

- **AMPLITUDE_PROCESSING_BUDGET_MS**: `8` milliseconds  
  Maximum per-frame time allowed for audio amplitude calculation + state updates. Logs warnings if p95 exceeds this.  
  _Related: NFR-004, T059_

### Gameplay

- **MIN_CONTINUOUS_DURATION**: `0.5` seconds  
  User must sustain sound for at least this long before progress counts. Prevents "cheating" via rapid taps.  
  _Related: Risk Mitigation_

- **MAX_PAUSE_DURATION_DEFAULT**: `0.5` seconds  
  Default max pause allowed when `allowPauses=true`. Overridden by level-specific config from Firestore.  
  _Related: FR-014, US2_

- **TIMEOUT_MULTIPLIER**: `2.0`  
  Level fails if not completed within `targetDuration × 2.0`.  
  _Related: Edge Cases_

## Helper Functions

### `amplitudeToSpeedMultiplier(amplitude: number): number`

Maps raw amplitude (0-1) to a speed multiplier (0-1):
- Below threshold → `0` (no movement)
- At/above threshold → linear mapping from `[threshold, 1.0]` to `[0, 1]`

Example:
```typescript
amplitudeToSpeedMultiplier(0.05) // → 0 (below threshold)
amplitudeToSpeedMultiplier(0.1)  // → 0 (at threshold)
amplitudeToSpeedMultiplier(0.55) // → 0.5 (mid-range)
amplitudeToSpeedMultiplier(1.0)  // → 1.0 (max)
```

### `calculateSnakeSpeed(amplitude, pathLength, targetDuration): number`

Calculates instantaneous snake speed (units/second):

```typescript
baseSpeed = pathLength / targetDuration
speedMultiplier = amplitudeToSpeedMultiplier(amplitude)
uncappedSpeed = baseSpeed × speedMultiplier
return min(uncappedSpeed, baseSpeed × V_MAX)
```

Example for a 100-unit path with 5s target:
- `baseSpeed = 20 units/s`
- At 0.5 amplitude → `~10 units/s` (50% of base)
- At 1.0 amplitude → `30 units/s` (capped at 1.5× base)

## Audio Recording Quality (NFR-002)

The `useAudioRecording` hook uses `Audio.RecordingOptionsPresets.HIGH_QUALITY`, which on iOS/Android typically provides:
- **Sample Rate**: 44.1kHz or 48kHz (device-dependent)
- **Bit Depth**: 16-bit PCM (minimum required)
- **Format**: AAC or PCM depending on platform

To verify or customize:
1. Check Expo AV docs for `RecordingOptions` type
2. Override preset if device-specific tuning needed
3. Log actual settings during recording setup (dev mode)

## Usage in Implementation

Import and use throughout snake game components:

```typescript
import { SNAKE_CONFIG, calculateSnakeSpeed } from '@/constants/snakeConfig';

// In game loop (useSnakeGame hook)
const speed = calculateSnakeSpeed(currentAmplitude, pathLength, targetDuration);
position += speed * deltaTime;

// In silence detection
if (amplitude < SNAKE_CONFIG.AMPLITUDE_THRESHOLD) {
  silenceTimer += deltaTime;
  if (silenceTimer > SNAKE_CONFIG.SILENCE_GRACE_PERIOD) {
    haltMovement();
  }
  if (silenceTimer > SNAKE_CONFIG.SLEEP_OVERLAY_DELAY) {
    showSleepOverlay();
  }
}
```

## Testing

Validate these constants with:
- **T019**: Unit tests for speed calculation edge cases (zero, threshold, max, >max)
- **T020**: Audio fixture tests verifying noise floor handling
- **T059**: Instrumentation confirming <8ms processing time at p95

## Calibration (Future)

Per risk mitigation, a calibration screen (T048) may allow per-device threshold adjustment. Store overrides in AsyncStorage and merge with these defaults at runtime.
