/**
 * Snake Game Loop Hook
 * 
 * Manages 60 FPS game loop with real-time audio amplitude processing.
 * Integrates game state logic with animation frame updates.
 * 
 * Related: FR-002, FR-003, FR-004, FR-005, NFR-001, NFR-004
 * Task: T014
 */

import { SNAKE_CONFIG } from '@/constants/snakeConfig';
import {
  createInitialGameState,
  getCompletionPercentage,
  updateGameState,
  type GameState,
  type LevelConfig,
} from '@/services/snakeGameLogic';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseSnakeGameOptions {
  pathLength: number;
  levelConfig: LevelConfig;
  onWin?: (metrics: GameMetrics) => void;
  onTimeout?: (metrics: GameMetrics) => void;
  /** Enable performance instrumentation for T035/T059 */
  enablePerfTracking?: boolean;
}

export interface GameMetrics {
  durationAchieved: number;
  targetDuration: number;
  completionPercentage: number;
  pauseCount: number;
  totalPauseDuration: number;
}

export interface SnakeGameHookResult {
  /** Current game state */
  gameState: GameState;
  /** Current completion percentage (0-100) */
  completionPercentage: number;
  /** Start the game loop */
  startGame: () => void;
  /** Pause the game loop */
  pauseGame: () => void;
  /** Resume from pause */
  resumeGame: () => void;
  /** Reset to initial state */
  resetGame: () => void;
  /** Update current amplitude (called by audio recorder) */
  updateAmplitude: (amplitude: number) => void;
  /** Whether game loop is running */
  isRunning: boolean;
  /** Whether game is paused */
  isPaused: boolean;
  /** Performance stats (if enablePerfTracking=true) */
  perfStats: PerfStats | null;
}

export interface PerfStats {
  averageFrameTime: number;
  maxFrameTime: number;
  p95FrameTime: number;
  droppedFrames: number;
}

export function useSnakeGame(options: UseSnakeGameOptions): SnakeGameHookResult {
  const { pathLength, levelConfig, onWin, onTimeout, enablePerfTracking = false } = options;

  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialGameState(pathLength, levelConfig.targetDurationSec)
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [perfStats, setPerfStats] = useState<PerfStats | null>(null);

  // Refs for game loop
  const rafIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const currentAmplitudeRef = useRef<number>(0);
  const pauseStartTimeRef = useRef<number | null>(null);
  const gameStateRef = useRef<GameState>(
    createInitialGameState(pathLength, levelConfig.targetDurationSec)
  );
  const isGameOverRef = useRef<boolean>(false);

  // Performance tracking
  const frameTimesRef = useRef<number[]>([]);

  const completionPercentage = getCompletionPercentage(gameState.position, gameState.pathLength);

  // Game loop tick
  const tick = useCallback(
    (currentTime: number) => {
      const frameStartTime = performance.now();

      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = currentTime;
        rafIdRef.current = requestAnimationFrame(tick);
        return;
      }

      const deltaTime = (currentTime - lastFrameTimeRef.current) / 1000; // Convert to seconds
      lastFrameTimeRef.current = currentTime;

      // Update game state
      setGameState((prevState) => {
        const newState = updateGameState(
          prevState,
          currentAmplitudeRef.current,
          deltaTime,
          levelConfig
        );

        // Sync ref immediately for stale-closure prevention
        gameStateRef.current = newState;

        // Check win condition
        if (newState.isWon && !prevState.isWon) {
          isGameOverRef.current = true;
          const clampedDuration = Math.min(newState.elapsedTime, newState.targetDuration);
          const metrics: GameMetrics = {
            durationAchieved: clampedDuration,
            targetDuration: newState.targetDuration,
            completionPercentage: 100,
            pauseCount: newState.pauseCount,
            totalPauseDuration: newState.totalPauseDuration,
          };
          // Defer callback to avoid state updates during render
          setTimeout(() => onWin?.(metrics), 0);
        }

        // Check timeout condition
        if (newState.isTimedOut && !prevState.isTimedOut) {
          isGameOverRef.current = true;
          const clampedDuration = Math.min(newState.elapsedTime, newState.targetDuration);
          const metrics: GameMetrics = {
            durationAchieved: clampedDuration,
            targetDuration: newState.targetDuration,
            completionPercentage: getCompletionPercentage(
              newState.position,
              newState.pathLength
            ),
            pauseCount: newState.pauseCount,
            totalPauseDuration: newState.totalPauseDuration,
          };
          setTimeout(() => onTimeout?.(metrics), 0);
        }

        return newState;
      });

      // Performance tracking
      if (enablePerfTracking) {
        const frameTime = performance.now() - frameStartTime;
        frameTimesRef.current.push(frameTime);

        // Keep last 300 frames (5 seconds at 60fps)
        if (frameTimesRef.current.length > 300) {
          frameTimesRef.current.shift();
        }

        // Update stats every 60 frames
        if (frameTimesRef.current.length % 60 === 0) {
          const sorted = [...frameTimesRef.current].sort((a, b) => a - b);
          const p95Index = Math.floor(sorted.length * 0.95);
          const droppedFrames = frameTimesRef.current.filter(
            (t) => t > SNAKE_CONFIG.AMPLITUDE_PROCESSING_BUDGET_MS
          ).length;

          setPerfStats({
            averageFrameTime:
              frameTimesRef.current.reduce((a, b) => a + b, 0) /
              frameTimesRef.current.length,
            maxFrameTime: Math.max(...frameTimesRef.current),
            p95FrameTime: sorted[p95Index] ?? 0,
            droppedFrames,
          });

          // Warn if budget exceeded at p95
          if (sorted[p95Index] > SNAKE_CONFIG.AMPLITUDE_PROCESSING_BUDGET_MS) {
            console.warn(
              `[SnakeGame] Frame time exceeded budget at p95: ${sorted[p95Index].toFixed(2)}ms > ${SNAKE_CONFIG.AMPLITUDE_PROCESSING_BUDGET_MS}ms`
            );
          }
        }
      }

      // Continue loop if game not finished (ref-based)
      if (!isGameOverRef.current) {
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        setIsRunning(false);
      }
    },
    [levelConfig, onWin, onTimeout, enablePerfTracking]
  );

  // Start game
  const startGame = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    setIsPaused(false);
    lastFrameTimeRef.current = null;
    frameTimesRef.current = [];
    isGameOverRef.current = false;
    rafIdRef.current = requestAnimationFrame(tick);
  }, [isRunning, tick]);

  // Pause game
  const pauseGame = useCallback(() => {
    if (!isRunning || isPaused) return;
    setIsPaused(true);
    pauseStartTimeRef.current = performance.now();
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, [isRunning, isPaused]);

  // Resume game
  const resumeGame = useCallback(() => {
    if (!isPaused) return;
    setIsPaused(false);
    lastFrameTimeRef.current = null; // Reset to avoid large delta
    pauseStartTimeRef.current = null;
    rafIdRef.current = requestAnimationFrame(tick);
  }, [isPaused, tick]);

  // Reset game
  const resetGame = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setIsRunning(false);
    setIsPaused(false);
    const initial = createInitialGameState(pathLength, levelConfig.targetDurationSec);
    setGameState(initial);
    gameStateRef.current = initial;
    isGameOverRef.current = false;
    currentAmplitudeRef.current = 0;
    lastFrameTimeRef.current = null;
    frameTimesRef.current = [];
    setPerfStats(null);
  }, [pathLength, levelConfig.targetDurationSec]);

  // Update amplitude from audio recorder
  const updateAmplitude = useCallback((amplitude: number) => {
    currentAmplitudeRef.current = amplitude;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    gameState,
    completionPercentage,
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    updateAmplitude,
    isRunning,
    isPaused,
    perfStats,
  };
}
