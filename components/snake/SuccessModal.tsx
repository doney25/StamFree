/**
 * Success Modal Component
 * 
 * Displays post-game results with stars, feedback, and XP reward.
 * Shows AI analysis results with encouraging feedback.
 * 
 * Related: FR-008, FR-016, US4
 * Task: T025
 */

import { VoiceIndicator } from '@/components/snake/VoiceIndicator';
import { SNAKE_CONFIG } from '@/constants/snakeConfig';
import type { GameMetrics } from '@/hooks/useSnakeGame';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface SuccessModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Game metrics from completion */
  gameMetrics: GameMetrics;
  /** Optimistic star rating (1-3) shown immediately on win */
  stars: number;
  /** Optional final star rating from AI (overrides optimistic when different) */
  finalStars?: number;
  /** Feedback message from AI or game */
  feedback: string;
  /** Whether AI analysis is still pending (shows "Analyzing..." state) */
  isLoading?: boolean;
  /** XP reward for this level */
  xpReward?: number;
  /** Current total XP */
  totalXp?: number;
  /** Optional phoneme match flag from backend */
  phonemeMatch?: boolean | undefined;
  /** Optional speech probability for voiced-target guidance */
  speechProb?: number;
  /** Optional voicing heuristic flag */
  voicedDetected?: boolean;
  /** Minimum speech probability threshold */
  speechThreshold?: number;
  /** Whether the target phoneme is voiced (controls indicator visibility) */
  isVoicedTarget?: boolean;
  /** Called when user taps "Next Level" or "Continue" */
  onContinue: () => void;
  /** Called when user taps "Retry" */
  onRetry: () => void;
  /** Called when modal is dismissed (e.g., back button) */
  onClose?: () => void;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  visible,
  gameMetrics,
  stars,
  finalStars,
  feedback,
  isLoading = false,
  xpReward = 10,
  totalXp = 0,
  phonemeMatch,
  speechProb,
  voicedDetected,
  speechThreshold,
  isVoicedTarget = true,
  onContinue,
  onRetry,
  onClose,
}) => {
  const spinRotation = useRef(new Animated.Value(0)).current;
  
  // Animate loading spinner
  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.timing(spinRotation, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [isLoading, spinRotation]);

  const spinInterpolate = spinRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const displayStars = typeof finalStars === 'number' ? finalStars : stars;
  const hasDowngrade = false; // No longer showing downgrades since we start at 0
  const hasUpgrade = typeof finalStars === 'number' && finalStars > 0 && stars === 0;

  // Determine feedback message for VoiceIndicator
  let voiceFeedback = feedback;
  if (isLoading) {
    voiceFeedback = 'Analyzing your voice...';
  }

  const renderStars = () => {
    return Array.from({ length: 3 }, (_, i) => (
      <View key={i} style={styles.starWrapper}>
        <MaterialCommunityIcons
          name={i < displayStars ? 'star' : 'star-outline'}
          size={48}
          color={i < displayStars ? '#FFD700' : '#CCCCCC'}
          style={styles.star}
        />
        {/* Show optimistic star fading if downgraded */}
        {hasDowngrade && typeof finalStars === 'number' && i < stars && i >= finalStars && (
          <View style={styles.starFadedOverlay} />
        )}
      </View>
    ));
  };

  const feedbackColor =
    displayStars === 3 ? '#00C853' : displayStars === 1 ? '#FF9800' : '#FFC107';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.overlay} />
        
        <View style={styles.card}>
          {/* Stars */}
          <View style={styles.starsContainer}>
            {renderStars()}
          </View>

          {isLoading && (
            <View style={styles.loadingRow}>
              <MaterialCommunityIcons name="waveform" size={18} color="#1a73e8" />
              <Text style={styles.loadingText}>Listening to your voice... just a moment</Text>
            </View>
          )}

          {/* Title based on stars */}
          <Text style={styles.title}>
            {isLoading
              ? '🎧 Analyzing...'
              : displayStars === 3
              ? '🎉 Amazing!'
              : displayStars === 2
              ? '👏 Great!'
              : displayStars >= 1
              ? '💪 Way To Go!'
              : '🎯 Complete!'}
          </Text>

          {/* Metrics */}
          <View style={styles.metricsContainer}>
            {isVoicedTarget && (
              <View style={styles.voiceIndicatorWrapper}>
                <VoiceIndicator
                  speechProb={speechProb}
                  voicedDetected={voicedDetected}
                  threshold={speechThreshold ?? SNAKE_CONFIG.SPEECH_PROB_MIN}
                  isLoading={isLoading}
                  isVoicedTarget={isVoicedTarget}
                  feedback={voiceFeedback}
                />
              </View>
            )}

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Duration:</Text>
              <Text style={styles.metricValue}>
                {gameMetrics.durationAchieved.toFixed(1)}s / {gameMetrics.targetDuration}s
              </Text>
            </View>
            
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Progress:</Text>
              <Text style={styles.metricValue}>
                {Math.round(gameMetrics.completionPercentage)}%
              </Text>
            </View>

            {gameMetrics.pauseCount > 0 && (
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Pauses:</Text>
                <Text style={styles.metricValue}>
                  {gameMetrics.pauseCount} ({gameMetrics.totalPauseDuration.toFixed(1)}s)
                </Text>
              </View>
            )}
            {typeof phonemeMatch === 'boolean' && (
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Phoneme:</Text>
                <Text style={[
                    styles.metricValue,
                    phonemeMatch ? styles.metricValuePositive : styles.metricValueWarning,
                  ]}
                >
                  {phonemeMatch ? 'Matched' : 'Try the target sound again'}
                </Text>
              </View>
            )}

            {xpReward > 0 && (
              <View style={[styles.metricRow, styles.xpRow]}>
                <MaterialCommunityIcons name="lightning-bolt" size={18} color="#FFD700" />
                <Text style={styles.xpText}>+{xpReward} XP</Text>
                <Text style={styles.xpTotal}>Total: {totalXp} XP</Text>
              </View>
            )}
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.retryButton]}
              onPress={onRetry}
            >
              <MaterialCommunityIcons name="refresh" size={20} color="#1a73e8" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.nextButton, isLoading && styles.nextButtonLoading]}
              onPress={onContinue}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
                    <MaterialCommunityIcons name="loading" size={18} color="#FFFFFF" />
                  </Animated.View>
                  <Text style={styles.nextButtonText}>Analyzing</Text>
                </>
              ) : (
                <>
                  <Text style={styles.nextButtonText}>Next Level</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 10,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#666666',
  },
  starWrapper: {
    position: 'relative',
  },
  starFadedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 4,
  },
  star: {
    marginHorizontal: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 20,
  },
  metricsContainer: {
    width: '100%',
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  metricLabel: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 13,
    color: '#333333',
    fontWeight: '600',
  },
  metricValueWarning: {
    color: '#D97706',
  },
  metricValuePositive: {
    color: '#059669',
  },
  voiceIndicatorWrapper: {
    marginBottom: 8,
  },
  xpRow: {
    borderBottomWidth: 0,
    backgroundColor: '#FFFACD',
    borderRadius: 6,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  xpText: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 8,
  },
  xpTotal: {
    fontSize: 12,
    color: '#999999',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 16,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  retryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1a73e8',
  },
  retryButtonText: {
    color: '#1a73e8',
    fontSize: 15,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#1a73e8',
  },
  nextButtonLoading: {
    opacity: 0.7,
  },
  loadingSpinner: {
    marginRight: 4,
    marginLeft: -4,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  encouragement: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
