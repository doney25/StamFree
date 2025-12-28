/**
 * Snake Sound Trail Game Configuration
 * 
 * Defines thresholds, caps, and timing constants for the real-time
 * prolongation therapy game. These values control game mechanics,
 * audio processing, and visual feedback timing.
 * 
 * Related: FR-003, FR-004, NFR-001, NFR-004
 * Spec: specs/003-snake-sound-trail/spec.md
 */

export const SNAKE_CONFIG = {
  /**
   * Amplitude threshold for movement detection.
   * Movement halts when amplitude < AMPLITUDE_THRESHOLD for > SILENCE_GRACE_PERIOD.
   * Range: [0.0, 1.0]
   * Default: 0.1 (10% of max amplitude)
   * Related: FR-004, FR-020
   */
  AMPLITUDE_THRESHOLD: 0.1,

  /**
   * Grace period before halting movement when amplitude drops below threshold.
   * Prevents brief dips from stopping the snake immediately.
   * Unit: seconds
   * Default: 0.1s
   * Related: FR-004
   */
  SILENCE_GRACE_PERIOD: 0.1,

  /**
   * Delay before showing "Zzz" sleep overlay after continuous silence.
   * Movement halts after SILENCE_GRACE_PERIOD; sleep state appears after SLEEP_OVERLAY_DELAY.
   * Unit: seconds
   * Default: 2.0s
   * Related: Edge Cases, US4 Acceptance Scenario 2
   */
  SLEEP_OVERLAY_DELAY: 2.0,

  /**
   * Maximum snake speed cap (as multiplier of base speed).
   * Prevents loud volume from making the game too easy.
   * Base speed = pathLength / targetDuration
   * Effective speed = min(v_max, baseSpeed * f(amplitude))
   * Range: [1.0, Infinity]
  * Default: 1.0 (cap at base speed)
   * Related: FR-003, FR-019
   */
  V_MAX: 1.0,

  /**
   * Target frame rate for game loop and visualizer updates.
   * Related: NFR-001, NFR-004
   */
  TARGET_FPS: 60,

  /**
   * Maximum allowed per-frame audio processing time (milliseconds).
   * Game loop must complete amplitude calculation + state update within this budget
   * to maintain TARGET_FPS. Logs warnings if exceeded at p95.
   * Related: NFR-004, T059
   */
  AMPLITUDE_PROCESSING_BUDGET_MS: 8,

  /**
   * Minimum continuous voicing duration before snake moves (seconds).
   * Prevents "cheating" by rapid taps; user must sustain sound briefly.
   * Related: Risk Mitigation, Edge Cases
   */
  MIN_CONTINUOUS_DURATION: 0.5,

  /**
   * Maximum allowed pause duration when allowPauses=true (seconds).
   * Loaded from Firestore progression_rules per level; this is fallback.
   * Related: FR-014, US2 Acceptance Scenario 2
   */
  MAX_PAUSE_DURATION_DEFAULT: 0.5,

  /**
   * Timeout multiplier: level fails if not completed within (targetDuration * TIMEOUT_MULTIPLIER).
   * Related: Edge Cases
   */
  TIMEOUT_MULTIPLIER: 2.0,

  /**
   * Noise floor used to gate background hum; amplitudes below this are treated as 0
   */
  NOISE_FLOOR: 0.1,

  /**
   * Smoothing factor for amplitude low-pass filter (0..1, higher = more weight on new sample)
   */
  AMPLITUDE_SMOOTHING_ALPHA: 0.35,

  /**
   * Hysteresis thresholds for voicing detection
   * - Movement only allowed when smoothed amplitude rises above VOICING_ON_THRESHOLD
   * - Movement stops when smoothed amplitude falls below VOICING_OFF_THRESHOLD
   * Helps avoid flicker from borderline inputs and enforces stronger starts with quicker stops.
   */
  VOICING_ON_THRESHOLD: 0.35,
  VOICING_OFF_THRESHOLD: 0.25,
  /**
   * Minimum sustained time above VOICING_ON_THRESHOLD required to wake the snake (seconds)
   */
  WAKE_LOCK_DURATION: 0.15,

  /**
   * Raw off hold: if raw (unsmoothed) amplitude falls at/below NOISE_FLOOR
   * for this duration (seconds), force voicing off immediately.
   * Helps the snake stop promptly when the user stops speaking.
   */
  RAW_OFF_HOLD: 0.06,

  /**
   * Classifier/voicing thresholds (keep in sync with server SPEECH_PROB_MIN/PITCHED_RATIO_MIN)
   * SPEECH_PROB_MIN: minimum speech probability to treat as voiced for indicator/back-end alignment
   * PITCHED_RATIO_MIN: minimum voiced-frame ratio to consider voiced in heuristics
   */
  SPEECH_PROB_MIN: 0.35,
  PITCHED_RATIO_MIN: 0.15,

  /**
   * If true, mismatched phoneme reduces stars/XP strictly.
   */
  STRICT_PHONEME_REQUIRED: true,

  /**
   * XP multiplier when phoneme mismatch is detected by backend.
   * Set to 0 for no XP on mismatch; a small value (e.g., 0.2) grants minimal XP.
   */
  XP_MISMATCH_MULTIPLIER: 0.2,
} as const;

/**
 * Amplitude-to-speed mapping function.
 * Maps normalized amplitude [0, 1] to speed multiplier.
 * - amplitude < AMPLITUDE_THRESHOLD → 0 (no movement)
 * - amplitude >= AMPLITUDE_THRESHOLD → linear in [0, 1]
 * 
 * @param amplitude - Normalized amplitude from expo-av (0.0-1.0)
 * @returns Speed multiplier in [0, 1]
 * Related: FR-003
 */
export function amplitudeToSpeedMultiplier(amplitude: number): number {
  if (amplitude < SNAKE_CONFIG.AMPLITUDE_THRESHOLD) {
    return 0;
  }
  // Linear map from [threshold, 1.0] to [0, 1]
  const normalized = (amplitude - SNAKE_CONFIG.AMPLITUDE_THRESHOLD) / (1.0 - SNAKE_CONFIG.AMPLITUDE_THRESHOLD);
  return Math.min(1.0, Math.max(0, normalized));
}

/**
 * Calculate instantaneous snake speed given amplitude and level config.
 * 
 * @param amplitude - Current microphone amplitude (0.0-1.0)
 * @param pathLength - Total path length in logical units
 * @param targetDuration - Target duration for level (seconds)
 * @returns Instantaneous speed (units per second), capped at V_MAX
 * Related: FR-003, FR-019
 */
export function calculateSnakeSpeed(
  amplitude: number,
  pathLength: number,
  targetDuration: number
): number {
  const baseSpeed = pathLength / targetDuration;
  const speedMultiplier = amplitudeToSpeedMultiplier(amplitude);
  const uncappedSpeed = baseSpeed * speedMultiplier;
  return Math.min(uncappedSpeed, baseSpeed * SNAKE_CONFIG.V_MAX);
}
