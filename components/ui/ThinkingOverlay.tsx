import React from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';

export type ThinkingOverlayProps = {
  visible: boolean;
  title?: string;
  message?: string;
  cancelText?: string;
  retryText?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  /** If true, hides Cancel button to prevent closing while processing */
  blocking?: boolean;
};

/**
 * ThinkingOverlay: Full-screen modal overlay with spinner and optional actions.
 * Use during post-processing (e.g., AI analysis) to indicate background work.
 */
export default function ThinkingOverlay({
  visible,
  title = 'Thinking...',
  message,
  cancelText = 'Cancel',
  retryText = 'Retry',
  onCancel,
  onRetry,
  blocking = false,
}: ThinkingOverlayProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <ThemedView style={styles.card}>
          <ActivityIndicator size="large" color={Platform.OS === 'ios' ? '#007AFF' : '#2196F3'} />
          <ThemedText type="title" style={styles.title}>{title}</ThemedText>
          {message ? <ThemedText style={styles.message}>{message}</ThemedText> : null}

          <View style={styles.actions}>
            {!blocking && onCancel ? (
              <Pressable style={[styles.button, styles.secondary]} onPress={onCancel}>
                <Text style={styles.secondaryText}>{cancelText}</Text>
              </Pressable>
            ) : null}
            {onRetry ? (
              <Pressable style={[styles.button, styles.primary]} onPress={onRetry}>
                <Text style={styles.primaryText}>{retryText}</Text>
              </Pressable>
            ) : null}
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    marginTop: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    minWidth: 120,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: Platform.OS === 'ios' ? '#007AFF' : '#2196F3',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#CCC',
  },
  secondaryText: {
    color: '#444',
    fontWeight: '600',
  },
});
