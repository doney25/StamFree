import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface VoiceIndicatorProps {
  speechProb?: number;
  voicedDetected?: boolean;
  threshold?: number;
  isLoading?: boolean;
  isVoicedTarget?: boolean;
  feedback?: string;
}

/**
 * Displays a simple post-game indicator for voice detection quality.
 * Uses speech probability and voicing heuristic to guide the player.
 */
export const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({
  speechProb,
  voicedDetected,
  threshold = 0.35,
  isLoading = false,
  isVoicedTarget = true,
  feedback,
}) => {
  if (!isVoicedTarget) return null;

  const passed = Boolean(voicedDetected) || (typeof speechProb === 'number' && speechProb >= threshold);
  const percent = Math.max(0, Math.min(1, speechProb ?? 0));
  const percentValue = Math.round(percent * 100);
  // Ensure bar is visible even at low percentages
  const barWidth = percentValue > 0 ? Math.max(percentValue, 2) : 0;

  let title = 'Use your voice';
  let helper = feedback || 'Try humming the target sound so I can hear it.';
  let color = '#D97706';
  let icon: 'check-circle' | 'microphone-off' | 'waveform' = 'microphone-off';

  if (isLoading) {
    title = 'Listening...';
    helper = feedback || 'Analyzing your voice quality.';
    color = '#1a73e8';
    icon = 'waveform';
  } else if (passed) {
    title = 'Voice detected!';
    helper = feedback || 'Great job using your voice. Keep it smooth and steady!';
    color = '#059669';
    icon = 'check-circle';
  }

  return (
    <View style={[styles.card, { borderColor: color }]}> 
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
        <Text style={[styles.title, { color }]}>{title}</Text>
      </View>
      <Text style={styles.helper}>{helper}</Text>
      <View style={styles.barBackground}>
        <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Voice confidence</Text>
        <Text style={[styles.value, { color }]}>{percentValue}%</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  helper: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
  },
  barBackground: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
  },
  value: {
    fontSize: 12,
    fontWeight: '700',
  },
});
