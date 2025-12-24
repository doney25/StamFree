/**
 * Snake Sound Trail Game Logic
 * 
 * Pure functions for game state calculations, silence detection,
 * pause handling, and win conditions. All functions are stateless
 * and unit-testable.
 * 
 * Related: FR-003, FR-004, FR-006, FR-012, FR-014
 * Tests: __tests__/snakeGameLogic.test.ts (T019)
 */

import { SNAKE_CONFIG, calculateSnakeSpeed } from '@/constants/snakeConfig';

/**
 * Game state representing a single frame/tick
 */
export interface GameState {
  /** Current snake position along path (0 to pathLength) */
  position: number;
  /** Target path length in logical units */
  pathLength: number;
  /** Target duration for level (seconds) */
  targetDuration: number;
  /** Total elapsed time (seconds) */
  elapsedTime: number;
  /** Time spent in silence (seconds) */
  silenceTime: number;
  /** Whether movement is currently halted */
  isHalted: boolean;
  /** Whether sleep overlay should be shown */
  showSleepOverlay: boolean;
  /** Whether level is won */
  isWon: boolean;
  /** Whether level has timed out */
  isTimedOut: boolean;
  /** Current pause count (for allowPauses mode) */
  pauseCount: number;
  /** Total time spent paused (seconds) */
  totalPauseDuration: number;
  /** Last recorded amplitude */
  lastAmplitude: number;
}

/**
 * Level configuration from Firestore
 */
export interface LevelConfig {
  targetDurationSec: number;
  allowPauses: boolean;
  maxPauseDuration?: number;
}

/**
 * Initialize a new game state
 */
export function createInitialGameState(
  pathLength: number,
  targetDuration: number
): GameState {
  return {
    position: 0,
    pathLength,
    targetDuration,
    elapsedTime: 0,
    silenceTime: 0,
    isHalted: false,
    showSleepOverlay: false,
    isWon: false,
    isTimedOut: false,
    pauseCount: 0,
    totalPauseDuration: 0,
    lastAmplitude: 0,
  };
}

/**
 * Detect if current amplitude is below threshold (silence)
 * Related: FR-004, FR-020
 */
export function isSilent(amplitude: number): boolean {
  return amplitude < SNAKE_CONFIG.AMPLITUDE_THRESHOLD;
}

/**
 * Check if movement should halt due to silence
 * Related: FR-004
 */
export function shouldHaltMovement(silenceTime: number): boolean {
  return silenceTime > SNAKE_CONFIG.SILENCE_GRACE_PERIOD;
}

/**
 * Check if sleep overlay should appear
 * Related: Edge Cases, US4
 */
export function shouldShowSleepOverlay(silenceTime: number): boolean {
  return silenceTime >= SNAKE_CONFIG.SLEEP_OVERLAY_DELAY;
}

/**
 * Check if level is won
 * Related: FR-006
 */
export function isLevelWon(position: number, pathLength: number): boolean {
  return position >= pathLength;
}

/**
 * Check if level has timed out
 * Related: Edge Cases
 */
export function isLevelTimedOut(
  elapsedTime: number,
  targetDuration: number
): boolean {
  return elapsedTime >= targetDuration * SNAKE_CONFIG.TIMEOUT_MULTIPLIER;
}

/**
 * Calculate new position after delta time
 * Related: FR-003
 */
export function calculateNewPosition(
  currentPosition: number,
  amplitude: number,
  pathLength: number,
  targetDuration: number,
  deltaTime: number
): number {
  const speed = calculateSnakeSpeed(amplitude, pathLength, targetDuration);
  const newPosition = currentPosition + speed * deltaTime;
  // Clamp to valid range
  return Math.max(0, Math.min(pathLength, newPosition));
}

/**
 * Determine if a pause is intentional (allowPauses mode)
 * vs. a block that should halt progress.
 * 
 * Related: FR-014
 * @param silenceTime - Current accumulated silence (seconds)
 * @param maxPauseDuration - Max allowed pause from level config (seconds)
 * @returns true if silence is within allowed pause window
 */
export function isIntentionalPause(
  silenceTime: number,
  maxPauseDuration: number
): boolean {
  return (
    silenceTime > SNAKE_CONFIG.SILENCE_GRACE_PERIOD &&
    silenceTime <= maxPauseDuration
  );
}

/**
 * Update game state for a single frame tick
 * 
 * @param state - Current game state
 * @param amplitude - Current microphone amplitude (0-1)
 * @param deltaTime - Time since last frame (seconds)
 * @param levelConfig - Level-specific configuration
 * @returns Updated game state (immutable)
 */
export function updateGameState(
  state: GameState,
  amplitude: number,
  deltaTime: number,
  levelConfig: LevelConfig
): GameState {
  // Check win/timeout conditions first
  if (state.isWon || state.isTimedOut) {
    return state;
  }

  const silent = isSilent(amplitude);
  let newSilenceTime = silent ? state.silenceTime + deltaTime : 0;
  let newPauseCount = state.pauseCount;
  let newTotalPauseDuration = state.totalPauseDuration;

  // Handle pause detection in allowPauses mode
  if (
    levelConfig.allowPauses &&
    silent &&
    isIntentionalPause(
      newSilenceTime,
      levelConfig.maxPauseDuration ?? SNAKE_CONFIG.MAX_PAUSE_DURATION_DEFAULT
    )
  ) {
    // Track pause but don't halt movement permanently
    if (newSilenceTime > SNAKE_CONFIG.SILENCE_GRACE_PERIOD && state.silenceTime <= SNAKE_CONFIG.SILENCE_GRACE_PERIOD) {
      newPauseCount += 1;
    }
    newTotalPauseDuration += deltaTime;
  }

  // Determine movement halt
  const newIsHalted = shouldHaltMovement(newSilenceTime);
  const newShowSleepOverlay = shouldShowSleepOverlay(newSilenceTime);

  // Update position only if not halted
  let newPosition = state.position;
  if (!newIsHalted) {
    newPosition = calculateNewPosition(
      state.position,
      amplitude,
      state.pathLength,
      state.targetDuration,
      deltaTime
    );
  }

  // Check win condition
  const newIsWon = isLevelWon(newPosition, state.pathLength);

  // Check timeout
  const newElapsedTime = state.elapsedTime + deltaTime;
  const newIsTimedOut = isLevelTimedOut(newElapsedTime, state.targetDuration);

  return {
    ...state,
    position: newPosition,
    elapsedTime: newElapsedTime,
    silenceTime: newSilenceTime,
    isHalted: newIsHalted,
    showSleepOverlay: newShowSleepOverlay,
    isWon: newIsWon,
    isTimedOut: newIsTimedOut,
    pauseCount: newPauseCount,
    totalPauseDuration: newTotalPauseDuration,
    lastAmplitude: amplitude,
  };
}

/**
 * Calculate completion percentage for UI display
 * Related: FR-018
 */
export function getCompletionPercentage(
  position: number,
  pathLength: number
): number {
  if (pathLength === 0) return 0;
  const percentage = (position / pathLength) * 100;
  return Math.max(0, Math.min(100, Math.round(percentage)));
}

/**
 * Check if enough continuous voicing has occurred
 * to count as valid attempt (anti-cheat)
 * Related: Risk Mitigation
 */
export function hasMinimumContinuousVoicing(
  position: number,
  pathLength: number,
  targetDuration: number
): boolean {
  if (position === 0) return false;
  // Estimate time spent voicing based on position
  // Assumes average speed near base speed
  const estimatedVoicingTime = (position / pathLength) * targetDuration;
  return estimatedVoicingTime >= SNAKE_CONFIG.MIN_CONTINUOUS_DURATION;
}
