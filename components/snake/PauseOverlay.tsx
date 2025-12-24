/**
 * Pause Overlay Component
 * 
 * Displays when user pauses mid-game, showing time elapsed and options to resume or quit.
 * Handles pause duration limit: if paused >5 minutes, auto-reset to beginning.
 * 
 * Related: FR-012, Edge Cases
 * Task: T030
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Maximum pause duration before auto-reset (seconds)
 * Related: Edge Cases
 */
const MAX_PAUSE_DURATION_SEC = 5 * 60; // 5 minutes

export interface PauseOverlayProps {
  /** Whether overlay is visible */
  visible: boolean;
  /** Elapsed game time when paused (seconds) */
  elapsedTime: number;
  /** Target duration for level (seconds) */
  targetDuration: number;
  /** Current completion percentage */
  completionPercentage: number;
  /** Called when user taps "Resume" */
  onResume: () => void;
  /** Called when user taps "Quit" */
  onQuit: () => void;
  /** Called when pause duration exceeds MAX_PAUSE_DURATION_SEC */
  onAutoReset?: () => void;
}

export function PauseOverlay(props: PauseOverlayProps) {
  const {
    visible,
    elapsedTime,
    targetDuration,
    completionPercentage,
    onResume,
    onQuit,
    onAutoReset,
  } = props;

  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [pauseDuration, setPauseDuration] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  // Track pause duration and auto-reset if exceeded
  useEffect(() => {
    if (!visible) {
      setPausedAt(null);
      setPauseDuration(0);
      setIsExpired(false);
      return;
    }

    // Mark when pause started
    if (pausedAt === null) {
      setPausedAt(Date.now());
      return;
    }

    // Update pause duration every 100ms
    const interval = setInterval(() => {
      const duration = (Date.now() - pausedAt) / 1000;
      setPauseDuration(duration);

      // Check if exceeded max pause duration
      if (duration >= MAX_PAUSE_DURATION_SEC && !isExpired) {
        setIsExpired(true);
        onAutoReset?.();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [visible, pausedAt, isExpired, onAutoReset]);

  const handleResume = () => {
    if (isExpired) {
      // Don't allow resume if pause expired
      onAutoReset?.();
      return;
    }
    onResume();
  };

  const handleQuit = () => {
    onQuit();
  };

  // Format time display (mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Determine pause duration warning color
  const getPauseDurationColor = () => {
    const percentOfMax = pauseDuration / MAX_PAUSE_DURATION_SEC;
    if (percentOfMax >= 1.0) return '#d32f2f'; // Red - expired
    if (percentOfMax >= 0.8) return '#f57c00'; // Orange - warning
    return '#1a73e8'; // Blue - normal
  };

  const remainingTime = Math.max(0, MAX_PAUSE_DURATION_SEC - pauseDuration);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      hardwareAccelerated={true}
    >
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          {/* Pause Icon */}
          <MaterialCommunityIcons
            name="pause-circle-outline"
            size={64}
            color="#1a73e8"
            style={styles.icon}
          />

          {/* Title */}
          <Text style={styles.title}>Game Paused</Text>

          {/* Game Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Elapsed:</Text>
              <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Target:</Text>
              <Text style={styles.statValue}>{formatTime(targetDuration)}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Progress:</Text>
              <Text style={styles.statValue}>{Math.round(completionPercentage)}%</Text>
            </View>
          </View>

          {/* Pause Duration Warning */}
          <View
            style={[
              styles.pauseDurationContainer,
              { borderColor: getPauseDurationColor() },
            ]}
          >
            <View style={styles.pauseDurationRow}>
              <MaterialCommunityIcons
                name={isExpired ? 'alert-circle' : 'clock-outline'}
                size={20}
                color={getPauseDurationColor()}
              />
              <Text
                style={[
                  styles.pauseDurationText,
                  { color: getPauseDurationColor() },
                ]}
              >
                {isExpired
                  ? 'Pause limit exceeded'
                  : `Paused for ${formatTime(pauseDuration)}`}
              </Text>
            </View>

            {!isExpired && (
              <Text style={styles.pauseRemainingText}>
                Auto-reset in {formatTime(remainingTime)}
              </Text>
            )}
          </View>

          {/* Info Text */}
          <Text style={styles.infoText}>
            {isExpired
              ? 'Pause duration exceeded. The game will reset to the beginning.'
              : 'You can pause for up to 5 minutes before the game resets.'}
          </Text>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.quitButton]}
              onPress={handleQuit}
            >
              <MaterialCommunityIcons name="exit-to-app" size={20} color="#FFFFFF" />
              <Text style={styles.quitButtonText}>Quit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.resumeButton,
                isExpired && styles.buttonDisabled,
              ]}
              onPress={handleResume}
              disabled={isExpired}
            >
              <MaterialCommunityIcons name="play" size={20} color="#FFFFFF" />
              <Text style={styles.resumeButtonText}>
                {isExpired ? 'Game Reset' : 'Resume'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '85%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  statsContainer: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  pauseDurationContainer: {
    width: '100%',
    borderLeftWidth: 4,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  pauseDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pauseDurationText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  pauseRemainingText: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
    marginLeft: 28,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  quitButton: {
    backgroundColor: '#f57c00',
  },
  quitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resumeButton: {
    backgroundColor: '#00c853',
  },
  resumeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
});
