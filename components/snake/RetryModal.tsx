/**
 * Retry Modal Component
 * 
 * Displays gentle, encouraging prompt when user doesn't complete level.
 * Provides soft encouragement and option to retry or exit.
 * 
 * Related: FR-015, US4 Acceptance Scenario 2
 * Task: T027
 */

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

export interface RetryModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Reason for not completing: 'timeout' | 'manual' | 'silent' */
  reason?: 'timeout' | 'manual' | 'silent';
  /** Message to display */
  message?: string;
  /** Called when user taps "Try Again" */
  onRetry: () => void;
  /** Called when user taps "Back" */
  onBack: () => void;
}

export const RetryModal: React.FC<RetryModalProps> = ({
  visible,
  reason = 'timeout',
  message,
  onRetry,
  onBack,
}) => {
  const defaultMessages: Record<string, string> = {
    timeout: "Time's up! But you did great! Let's try again and push a little further.",
    manual: 'No worries! Ready to give it another shot?',
    silent:
      'Wake up the snake! Keep saying your sound to help it reach the apple. You\'ve got this!',
  };

  const displayMessage = message || defaultMessages[reason];

  const getEmoji = () => {
    switch (reason) {
      case 'silent':
        return '😴';
      case 'timeout':
        return '⏱️';
      case 'manual':
        return '👋';
      default:
        return '💪';
    }
  };

  const getTitle = () => {
    switch (reason) {
      case 'silent':
        return 'Keep Going!';
      case 'timeout':
        return 'Time\'s Up!';
      case 'manual':
        return 'Not Ready?';
      default:
        return 'Try Again';
    }
  };

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
          {/* Emoji */}
          <Text style={styles.emoji}>{getEmoji()}</Text>

          {/* Title */}
          <Text style={styles.title}>{getTitle()}</Text>

          {/* Message */}
          <Text style={styles.message}>{displayMessage}</Text>

          {/* Encouragement Tips */}
          <View style={styles.tipsContainer}>
            <View style={styles.tip}>
              <MaterialCommunityIcons
                name="microphone"
                size={18}
                color="#1a73e8"
              />
              <Text style={styles.tipText}>Keep your sound smooth and steady</Text>
            </View>
            
            <View style={styles.tip}>
              <MaterialCommunityIcons
                name="volume-high"
                size={18}
                color="#1a73e8"
              />
              <Text style={styles.tipText}>Speak loud enough for the mic to hear</Text>
            </View>
            
            <View style={styles.tip}>
              <MaterialCommunityIcons
                name="timer"
                size={18}
                color="#1a73e8"
              />
              <Text style={styles.tipText}>Watch the progress bar and keep going!</Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.backButton]}
              onPress={onBack}
            >
              <MaterialCommunityIcons name="arrow-left" size={20} color="#1a73e8" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.retryButton]}
              onPress={onRetry}
            >
              <MaterialCommunityIcons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>

          {/* Motivational tagline */}
          <Text style={styles.tagline}>
            Every attempt makes you stronger! 🚀
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  tipsContainer: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#555555',
    flex: 1,
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
  backButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1a73e8',
  },
  backButtonText: {
    color: '#1a73e8',
    fontSize: 15,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#1a73e8',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  tagline: {
    fontSize: 13,
    color: '#999999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
