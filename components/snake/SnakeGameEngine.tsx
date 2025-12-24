/**
 * Snake Game Engine Component
 * 
 * Orchestrates the game loop, audio recording, and real-time amplitude updates.
 * Provides render props pattern for child components (path, visualizer, controls).
 * 
 * Related: FR-002, FR-004, FR-017, NFR-001
 * Task: T015
 */

import { SNAKE_CONFIG } from '@/constants/snakeConfig';
import { useSnakeGame, type GameMetrics, type UseSnakeGameOptions } from '@/hooks/useSnakeGame';
import type { GameState } from '@/services/snakeGameLogic';
import { Audio } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

export interface SnakeGameEngineProps extends UseSnakeGameOptions {
  /** Called when recording starts successfully */
  onRecordingStart?: () => void;
  /** Called when recording stops (win/timeout/manual) */
  onRecordingStop?: (uri: string | null) => void;
  /** Called with error if audio setup fails */
  onAudioError?: (error: Error) => void;
  /** Render function receiving game state and controls */
  children: (props: SnakeGameEngineRenderProps) => React.ReactNode;
}

export interface SnakeGameEngineRenderProps {
  /** Current game state from hook */
  gameState: GameState;
  /** Completion percentage (0-100) */
  completionPercentage: number;
  /** Current amplitude (0-1) for visualizer */
  currentAmplitude: number;
  /** Whether game is running */
  isRunning: boolean;
  /** Whether game is paused */
  isPaused: boolean;
  /** Start game and recording */
  start: () => Promise<void>;
  /** Stop game and recording */
  stop: () => Promise<void>;
  /** Pause game and recording */
  pause: () => void;
  /** Resume game and recording */
  resume: () => void;
  /** Reset to initial state */
  reset: () => void;
  /** Whether audio permissions are granted */
  hasPermission: boolean;
  /** Performance stats (if enabled) */
  perfStats: ReturnType<typeof useSnakeGame>['perfStats'];
}

export const SnakeGameEngine: React.FC<SnakeGameEngineProps> = ({
  pathLength,
  levelConfig,
  onWin,
  onTimeout,
  onRecordingStart,
  onRecordingStop,
  onAudioError,
  enablePerfTracking = false,
  children,
}) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [currentAmplitude, setCurrentAmplitude] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const audioUriRef = useRef<string | null>(null);
  const smoothedAmplitudeRef = useRef(0);

  // Game hook
  const {
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
  } = useSnakeGame({
    pathLength,
    levelConfig,
    onWin: useCallback(
      (metrics: GameMetrics) => {
        // Stop recording on win
        stopRecording().then(() => onWin?.(metrics));
      },
      [onWin]
    ),
    onTimeout: useCallback(
      (metrics: GameMetrics) => {
        // Stop recording on timeout
        stopRecording().then(() => onTimeout?.(metrics));
      },
      [onTimeout]
    ),
    enablePerfTracking,
  });

  // Request audio permissions
  const requestPermission = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      setHasPermission(granted);
      if (!granted) {
        throw new Error('Microphone permission denied');
      }
      return granted;
    } catch (error) {
      onAudioError?.(error as Error);
      throw error;
    }
  }, [onAudioError]);

  // Configure audio mode
  const configureAudio = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      onAudioError?.(error as Error);
      throw error;
    }
  }, [onAudioError]);

  // Start recording with amplitude updates
  const startRecording = useCallback(async () => {
    try {
      if (!hasPermission) {
        await requestPermission();
      }

      await configureAudio();

      const recording = new Audio.Recording();
      
      // Configure recording options for high quality (NFR-002)
      const recordingOptions = {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        android: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };

      await recording.prepareToRecordAsync(recordingOptions);

      // Set up real-time amplitude updates (FR-002, FR-005)
      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && status.metering !== undefined) {
          // Convert dB to linear amplitude (0-1)
          // Expo AV metering is in dB, typically -160 to 0
          // Normalize to 0-1 range
          const dbValue = status.metering;
          const normalizedAmplitude = Math.max(0, Math.min(1, (dbValue + 160) / 160));

          // Apply low-pass smoothing and noise gate so background hum does not move the snake
          const smoothed =
            smoothedAmplitudeRef.current * (1 - SNAKE_CONFIG.AMPLITUDE_SMOOTHING_ALPHA) +
            normalizedAmplitude * SNAKE_CONFIG.AMPLITUDE_SMOOTHING_ALPHA;

          smoothedAmplitudeRef.current = smoothed;

          const gatedAmplitude =
            smoothed < Math.max(SNAKE_CONFIG.NOISE_FLOOR, SNAKE_CONFIG.AMPLITUDE_THRESHOLD)
              ? 0
              : smoothed;
          
          setCurrentAmplitude(gatedAmplitude);
          updateAmplitude(gatedAmplitude);
        }
      });

      await recording.startAsync();
      recordingRef.current = recording;
      audioUriRef.current = null;

      onRecordingStart?.();
    } catch (error) {
      onAudioError?.(error as Error);
      throw error;
    }
  }, [hasPermission, requestPermission, configureAudio, updateAmplitude, onRecordingStart, onAudioError]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      if (!recordingRef.current) return;

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      audioUriRef.current = uri;
      recordingRef.current = null;

      // Reset amplitude
      smoothedAmplitudeRef.current = 0;
      setCurrentAmplitude(0);
      updateAmplitude(0);

      onRecordingStop?.(uri);
    } catch (error) {
      console.error('[SnakeGameEngine] Stop recording error:', error);
      onRecordingStop?.(null);
    }
  }, [updateAmplitude, onRecordingStop]);

  // Start game + recording
  const start = useCallback(async () => {
    try {
      await startRecording();
      startGame();
    } catch (error) {
      console.error('[SnakeGameEngine] Start error:', error);
    }
  }, [startRecording, startGame]);

  // Stop game + recording
  const stop = useCallback(async () => {
    try {
      await stopRecording();
      // Game loop stops automatically on win/timeout, but we can force stop
      resetGame();
    } catch (error) {
      console.error('[SnakeGameEngine] Stop error:', error);
    }
  }, [stopRecording, resetGame]);

  // Pause game + recording
  const pause = useCallback(() => {
    pauseGame();
    // Note: expo-av doesn't support pause, so we keep recording
    // but game loop is paused
  }, [pauseGame]);

  // Resume game + recording
  const resume = useCallback(() => {
    resumeGame();
  }, [resumeGame]);

  // Reset handler
  const reset = useCallback(() => {
    stopRecording().then(() => {
      smoothedAmplitudeRef.current = 0;
      resetGame();
    });
  }, [stopRecording, resetGame]);

  // Request permission on mount
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, []);

  // Render props
  const renderProps: SnakeGameEngineRenderProps = {
    gameState,
    completionPercentage,
    currentAmplitude,
    isRunning,
    isPaused,
    start,
    stop,
    pause,
    resume,
    reset,
    hasPermission,
    perfStats,
  };

  return <View style={styles.container}>{children(renderProps)}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
});
