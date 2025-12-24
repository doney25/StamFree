/**
 * Success Modal Component
 * 
 * Displays post-game results with stars, feedback, and XP reward.
 * Shows AI analysis results with encouraging feedback.
 * 
 * Related: FR-008, FR-016, US4
 * Task: T025
 */

import type { GameMetrics } from '@/hooks/useSnakeGame';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
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
  /** Star rating (1-3) */
  stars: number;
  /** Feedback message from AI or game */
  feedback: string;
  /** XP reward for this level */
  xpReward?: number;
  /** Current total XP */
  totalXp?: number;
  /** Called when user taps "Next Level" or "Continue" */
  onContinue: () => void;
  /** Called when user taps "Retry" */
  onRetry: () => void;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  visible,
  gameMetrics,
  stars,
  feedback,
  xpReward = 10,
  totalXp = 0,
  onContinue,
  onRetry,
}) => {
  const renderStars = () => {
    return Array.from({ length: 3 }, (_, i) => (
      <MaterialCommunityIcons
        key={i}
        name={i < stars ? 'star' : 'star-outline'}
        size={48}
        color={i < stars ? '#FFD700' : '#CCCCCC'}
        style={styles.star}
      />
    ));
  };

  const feedbackColor =
    stars === 3 ? '#00C853' : stars === 1 ? '#FF9800' : '#FFC107';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.container}>
        <View style={styles.overlay} />
        
        <View style={styles.card}>
          {/* Stars */}
          <View style={styles.starsContainer}>
            {renderStars()}
          </View>

          {/* Title based on stars */}
          <Text style={styles.title}>
            {stars === 3
              ? '🎉 Excellent!'
              : stars === 2
              ? '👍 Good!'
              : '💪 Nice Try!'}
          </Text>

          {/* Feedback */}
          <View style={[styles.feedbackBox, { borderLeftColor: feedbackColor }]}>
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>

          {/* Metrics */}
          <View style={styles.metricsContainer}>
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
              style={[styles.button, styles.nextButton]}
              onPress={onContinue}
            >
              <Text style={styles.nextButtonText}>Next Level</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Encouragement message */}
          <Text style={styles.encouragement}>
            {stars === 3
              ? 'You\'re crushing it! 🚀'
              : stars === 2
              ? 'Keep it up! 💪'
              : 'Practice makes perfect! 🎯'}
          </Text>
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
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
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
  feedbackBox: {
    backgroundColor: '#F5F5F5',
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    width: '100%',
  },
  feedbackText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
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
