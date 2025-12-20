import { AudioRecorder } from '@/components/audio/AudioRecorder';
import { auth } from '@/config/firebaseConfig';
import { getPhonemesForLevel } from '@/constants/phonemes';
import { getNextSentence, getSentencesForLevel } from '@/constants/sentences';
import { saveSession } from '@/services/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SpeechPracticeScreen() {
  const navigation = useNavigation();
  const [currentLevel, setCurrentLevel] = useState(1);
  const [completedSentenceIds, setCompletedSentenceIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const levelSentences = useMemo(() => getSentencesForLevel(currentLevel), [currentLevel]);
  const currentSentence = useMemo(
    () => getNextSentence(completedSentenceIds, currentLevel),
    [completedSentenceIds, currentLevel]
  );
  const unlockedPhonemes = useMemo(() => getPhonemesForLevel(currentLevel), [currentLevel]);

  const handleBack = useCallback(() => {
    router.replace('/(tabs)');
  }, []);

  const handleRecorded = useCallback(
    async (uri: string, durationMs: number) => {
      if (!auth.currentUser || !currentSentence) return;
      setUploading(true);
      setMessage(null);
      try {
        const primaryPhoneme = currentSentence.targetPhonemes[0] ?? 'unknown';

        await saveSession({
          uid: auth.currentUser.uid,
          phonemeId: primaryPhoneme,
          durationMs,
          sentenceId: currentSentence.id,
          targetPhonemes: currentSentence.targetPhonemes,
          level: currentLevel,
        });

        const updatedCompleted = completedSentenceIds.includes(currentSentence.id)
          ? completedSentenceIds
          : [...completedSentenceIds, currentSentence.id];

        setCompletedSentenceIds(updatedCompleted);

        const remainingInLevel = levelSentences.filter((s) => !updatedCompleted.includes(s.id)).length;
        if (remainingInLevel === 0) {
          const hasNextLevel = getSentencesForLevel(currentLevel + 1).length > 0;
          if (hasNextLevel) {
            setCurrentLevel((lvl) => lvl + 1);
            setMessage('🎉 Level up! New phonemes unlocked.');
          } else {
            setMessage('✅ All practice sentences completed!');
          }
        } else {
          setMessage('✅ Saved successfully!');
        }
      } catch (err) {
        console.error('Upload/save failed:', err);
        setMessage('❌ Failed to save recording');
      } finally {
        setUploading(false);
      }
    },
    [completedSentenceIds, currentLevel, currentSentence, levelSentences]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'Speech Practice',
      headerLeft: () => (
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1a73e8" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleBack]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} bounces>
        <View style={styles.contentPadding}>
          <Text style={styles.sectionTitle}>Let&apos;s Practice! 🎯</Text>

          <View style={styles.progressRow}>
            <Text style={styles.levelText}>Level {currentLevel}</Text>
            <Text style={styles.levelText}>
              {levelSentences.length - levelSentences.filter((s) => completedSentenceIds.includes(s.id)).length} left
            </Text>
          </View>

          {currentSentence ? (
            <View style={styles.sentenceCard}>
              <Text style={styles.sentenceLabel}>Repeat this sentence:</Text>
              <Text style={styles.sentenceText}>{currentSentence.text}</Text>

              <View style={styles.phonemeTagRow}>
                {currentSentence.targetPhonemes.map((pid) => {
                  const ph = unlockedPhonemes.find((p) => p.id === pid);
                  return (
                    <View key={pid} style={styles.phonemeTag}>
                      <Text style={styles.phonemeIpa}>{ph?.ipa ?? pid}</Text>
                      <Text style={styles.phonemeLabel}>{ph?.label ?? ''}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.recorderSection}>
                <AudioRecorder onRecorded={handleRecorded} />
                {uploading && <Text style={styles.statusText}>Uploading...</Text>}
                {message && <Text style={styles.statusText}>{message}</Text>}
              </View>
            </View>
          ) : (
            <View style={styles.sentenceCard}>
              <Text style={styles.sentenceLabel}>All available sentences completed at this level.</Text>
              <Text style={styles.sentenceText}>Great job! 🎉</Text>
            </View>
          )}

          <Text style={styles.subtitle}>Unlocked phonemes:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.phonemeScroll}
            contentContainerStyle={styles.phonemeScrollContent}
          >
            {unlockedPhonemes.map((p) => (
              <View key={p.id} style={[styles.phonemeChip, styles.phonemeChipSelected]}>
                <Text style={styles.phonemeIpa}>{p.ipa}</Text>
                <Text style={styles.phonemeLabel}>{p.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
    color: '#2D3436',
    textAlign: 'center',
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#2D3436',
  },
  phonemeScroll: {
    marginBottom: 20,
  },
  phonemeScrollContent: {
    paddingHorizontal: 4,
  },
  phonemeChip: {
    marginHorizontal: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    minWidth: 100,
    alignItems: 'center',
  },
  phonemeChipSelected: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFE0E0',
  },
  phonemeIpa: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  phonemeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  recorderSection: {
    marginTop: 12,
  },
  statusText: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3436',
  },
  sentenceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  sentenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  sentenceText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  phonemeTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  phonemeTag: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FFE0E0',
    borderColor: '#FF6B6B',
    borderWidth: 1,
    minWidth: 90,
    alignItems: 'center',
  },
});