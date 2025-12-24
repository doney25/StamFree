/**
 * Snake Game Screen
 * 
 * Full game screen integrating SnakeGameEngine, SnakePath, and SnakeVisualizer.
 * Implements core gameplay loop with progress indicator, controls, and post-game flow.
 * 
 * Related: FR-001 through FR-020, US1
 * Task: T023
 */

import { ConfettiAnimation } from '@/components/snake/ConfettiAnimation';
import { PauseOverlay } from '@/components/snake/PauseOverlay';
import { RetryModal } from '@/components/snake/RetryModal';
import { SnakeGameEngine } from '@/components/snake/SnakeGameEngine';
import { SnakePath } from '@/components/snake/SnakePath';
import { SnakeVisualizer } from '@/components/snake/SnakeVisualizer';
import { SuccessModal } from '@/components/snake/SuccessModal';
import { auth } from '@/config/firebaseConfig';
import { SNAKE_CONFIG } from '@/constants/snakeConfig';
import type { GameMetrics } from '@/hooks/useSnakeGame';
import { analyzeSnakeAudio } from '@/services/snakeAnalysis';
import {
  TIER_UNLOCK_THRESHOLDS,
  calculateXpReward,
  getInstructionText,
  getNextLevel,
  getSnakeLevel,
  getSnakeLevelsByTier,
  getUserSnakeProgress,
  saveSnakeProgress,
  type SnakeLevel,
} from '@/services/snakeProgression';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SnakeGameScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const [level, setLevel] = useState<SnakeLevel | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProgress, setUserProgress] = useState<any>(null);

  // Load level from params or Firestore
  useEffect(() => {
    const loadLevel = async () => {
      setLoading(true);
      try {
        if (!auth.currentUser) {
          throw new Error('User not authenticated');
        }

        // Load user progress for XP tracking
        const progress = await getUserSnakeProgress(auth.currentUser.uid);
        setUserProgress(progress);

        // Load level definition
        let levelData: SnakeLevel | null = null;
        if (params.levelId) {
          levelData = await getSnakeLevel(params.levelId as string);
        }

        if (!levelData) {
          // Adaptive default: pick first incomplete level in current tier
          const tierLevels = await getSnakeLevelsByTier(progress.currentTier as 1 | 2 | 3);
          const incomplete = tierLevels.find((lvl) => !progress.completedLevels.includes(lvl.levelId));
          levelData = incomplete || tierLevels[0] || {
            levelId: 'tier1_level1_word',
            tier: 1,
            type: 'word',
            targetPhonemes: ['M'],
            targetDurationSec: 2.0,
            allowPauses: false,
            maxPauseDuration: 0.5,
            xpReward: 10,
            contentExample: 'Mmmmm',
          };
        }

        setLevel(levelData);
      } catch (error) {
        console.error('[SnakeGame] Error loading level:', error);
        Alert.alert('Error', 'Failed to load level. Returning to menu.');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadLevel();
  }, [params.levelId]);

  const [gameStarted, setGameStarted] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [finalMetrics, setFinalMetrics] = useState<GameMetrics | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [showPauseOverlay, setShowPauseOverlay] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [completionReason, setCompletionReason] = useState<'win' | 'timeout' | 'manual' | 'silent'>('win');

  // Header back button
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'Snake Sound Trail',
      headerLeft: () => (
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1a73e8" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const handleBack = useCallback(() => {
    if (gameStarted && !gameCompleted) {
      Alert.alert(
        'Leave Game?',
        'Your progress will be lost. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  }, [gameStarted, gameCompleted]);

  const handleWin = useCallback((metrics: GameMetrics) => {
    console.log('[SnakeGame] Win!', metrics);
    setGameCompleted(true);
    setFinalMetrics(metrics);
    setCompletionReason('win');
    setShowRetryModal(false);
    setShowConfetti(true);
  }, []);

  const analyzeAndShowResult = useCallback(
    async (uri: string, metrics: GameMetrics) => {
      try {
        const promptPhoneme = level?.targetPhonemes?.[0];
        const result = await analyzeSnakeAudio(uri, metrics, promptPhoneme);
        if (result) {
          setAnalysisResult(result);
          return result;
        }
      } catch (error) {
        console.error('[SnakeGame] Analysis error:', error);
      }

      // Fallback when analysis is unavailable
      const fallback = {
        stars: 2,
        feedback: 'Great effort! Let\'s analyze this one next time.',
        confidence: 0,
      };
      setAnalysisResult(fallback);
      return fallback;
    },
    [level]
  );

  const handleTimeout = useCallback((metrics: GameMetrics) => {
    console.log('[SnakeGame] Timeout!', metrics);
    setGameCompleted(true);
    setFinalMetrics(metrics);
    setCompletionReason('timeout');
    setShowRetryModal(true);
  }, []);

  const handleRecordingStop = useCallback((uri: string | null) => {
    console.log('[SnakeGame] Recording stopped:', uri);
    setAudioUri(uri);
  }, []);

  const handleAudioError = useCallback((error: Error) => {
    console.error('[SnakeGame] Audio error:', error);
    
    // FR-017: Handle permission errors
    if (error.message.includes('permission')) {
      Alert.alert(
        'Microphone Needed',
        'Snake needs to hear you! Please enable microphone in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            },
          },
        ]
      );
    } else {
      Alert.alert('Audio Error', error.message);
    }
  }, []);

  const handleRetry = useCallback(() => {
    setGameStarted(false);
    setGameCompleted(false);
    setFinalMetrics(null);
    setAudioUri(null);
    setShowSuccessModal(false);
    setShowRetryModal(false);
    setShowConfetti(false);
    setAnalysisResult(null);
    setShowPauseOverlay(false);
  }, []);

  // When we have a win + metrics, run analysis (if audio is present) then show success modal
  useEffect(() => {
    if (completionReason !== 'win' || !finalMetrics) return;

    const run = async () => {
      if (audioUri) {
        await analyzeAndShowResult(audioUri, finalMetrics);
      } else {
        setAnalysisResult({
          stars: 2,
          feedback: 'Great effort! Try once more for a smoother sound.',
          confidence: 0,
        });
      }
      setShowSuccessModal(true);
    };

    run();
  }, [completionReason, finalMetrics, audioUri, analyzeAndShowResult]);

  const handlePause = useCallback(() => {
    setShowPauseOverlay(true);
  }, []);

  const handleResumePause = useCallback(() => {
    setShowPauseOverlay(false);
  }, []);

  const handlePauseQuit = useCallback(() => {
    setShowPauseOverlay(false);
    setGameStarted(false);
    setGameCompleted(true);
    router.back();
  }, []);

  const handleContinue = useCallback(() => {
    setShowSuccessModal(false);
    
    // Save progress and get next level (T028, T029)
    if (!auth.currentUser || !level || !analysisResult) {
      router.back();
      return;
    }

    const saveAndNavigate = async () => {
      try {
        // Calculate XP reward based on stars; penalize mismatch if backend reported it
        let xpReward = calculateXpReward(level.xpReward, analysisResult.stars, finalMetrics?.completionPercentage || 0);
        const phonemeMatch = analysisResult?.metrics?.phoneme_match;
        if (phonemeMatch === false) {
          xpReward = Math.round(xpReward * SNAKE_CONFIG.XP_MISMATCH_MULTIPLIER);
        }
        
        // Save progress to Firestore
        const updatedProgress = await saveSnakeProgress(
          auth.currentUser!.uid,
          level.levelId,
          analysisResult.stars,
          xpReward
        );

        if (!updatedProgress) {
          throw new Error('Failed to save progress');
        }

        // Get next level
        const nextLevel = await getNextLevel(level, updatedProgress);

        if (nextLevel) {
          // Auto-load next level
          Alert.alert(
            '🎉 Level Complete!',
            `You earned ${xpReward} XP! Ready for the next level?`,
            [
              { text: 'Back', style: 'cancel', onPress: () => router.back() },
              {
                text: 'Next Level',
                style: 'default',
                onPress: () => {
                  router.push({
                    pathname: '/exercises/snake-game',
                    params: {
                      levelId: nextLevel.levelId,
                      tier: nextLevel.tier,
                      levelType: nextLevel.type,
                      prompt: nextLevel.contentExample,
                      targetDuration: nextLevel.targetDurationSec,
                      targetPhonemes: nextLevel.targetPhonemes.join(','),
                    },
                  });
                },
              },
            ]
          );
        } else {
          // No next level available
          Alert.alert(
            '🏆 Wow!',
            'You\'ve unlocked all available levels! Keep practicing to improve your skills.',
            [{ text: 'Back', onPress: () => router.back() }]
          );
        }
      } catch (error) {
        console.error('[SnakeGame] Error saving progress:', error);
        Alert.alert('Error', 'Failed to save progress. Please try again.');
        router.back();
      }
    };

    saveAndNavigate();
  }, [level, analysisResult, finalMetrics]);

  return (
    <View style={styles.container}>
      {loading && (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#1a73e8" />
        </View>
      )}

      {!loading && level && (
        <>
          {/* T025: Success Modal with stars and AI feedback */}
          {analysisResult && finalMetrics && (
            <SuccessModal
              visible={showSuccessModal}
              gameMetrics={finalMetrics}
              stars={analysisResult.stars}
              feedback={analysisResult.feedback}
              xpReward={level.xpReward}
              totalXp={userProgress?.totalXP || 0}
              onContinue={handleContinue}
              onRetry={handleRetry}
            />
          )}

          {/* T027: Retry Modal with encouragement */}
          {completionReason !== 'win' && (
            <RetryModal
              visible={showRetryModal}
              reason={completionReason as 'timeout' | 'manual' | 'silent'}
              onRetry={handleRetry}
              onBack={() => {
                setShowRetryModal(false);
                router.back();
              }}
            />
          )}

          {/* T030: Pause Overlay with resume/quit options and auto-reset timer */}
          {finalMetrics && (
            <PauseOverlay
              visible={showPauseOverlay}
              elapsedTime={finalMetrics.durationAchieved}
              targetDuration={finalMetrics.targetDuration}
              completionPercentage={finalMetrics.completionPercentage}
              onResume={handleResumePause}
              onQuit={handlePauseQuit}
              onAutoReset={() => {
                console.log('[SnakeGame] Pause timeout - auto reset');
                handleRetry();
                setShowPauseOverlay(false);
              }}
            />
          )}

          {/* T024: Confetti Animation on win */}
          {showConfetti && (
            <ConfettiAnimation duration={3000} />
          )}

          <SnakeGameEngine
            pathLength={100}
            levelConfig={{
              targetDurationSec: level.targetDurationSec,
              allowPauses: level.allowPauses,
              maxPauseDuration: level.maxPauseDuration,
            }}
            onWin={handleWin}
            onTimeout={handleTimeout}
            onRecordingStop={handleRecordingStop}
            onAudioError={handleAudioError}
            enablePerfTracking={__DEV__} // Enable in dev mode only
      >
        {({
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
        }) => (
          <View style={styles.gameContainer}>
            {/* Progress Indicator - FR-018 */}
            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>
                Tier {level.tier} • {level.type.charAt(0).toUpperCase() + level.type.slice(1)}
              </Text>
              <Text style={styles.progressPercentage}>
                {Math.round(completionPercentage)}%
              </Text>
            </View>

            {/* Snake Path with Avatar - FR-001, FR-003, FR-015, FR-016 */}
            <View style={styles.pathContainer}>
              <SnakePath
                position={gameState.position / 100}
                isMoving={isRunning && !isPaused}
                showSleepOverlay={gameState.showSleepOverlay}
                pathLength={100}
                showBackground={true}
                triggerAppleEat={gameState.isWon}
              />

              {/* Corner HUD badges to avoid covering the apple */}
              <View style={styles.hudContainer} pointerEvents="none">
                <View style={[styles.hudBubble, styles.hudTopLeft]}>
                  <Text style={styles.hudLabel}>Tier {userProgress?.currentTier || level.tier}</Text>
                  <Text style={styles.hudValue}>{level.targetPhonemes.join(', ')}</Text>
                </View>
                <View style={[styles.hudBubble, styles.hudTopRight]}>
                  <Text style={styles.hudLabel}>Next Tier</Text>
                  <Text style={styles.hudValue}>
                    {(() => {
                      const totalXp = userProgress?.totalXP || 0;
                      const nextTier = Math.min(3, (userProgress?.currentTier || level.tier) + 1) as 1 | 2 | 3;
                      const needed = Math.max(0, TIER_UNLOCK_THRESHOLDS[nextTier] - totalXp);
                      return needed > 0 ? `${needed} XP` : 'Unlocked';
                    })()}
                  </Text>
                </View>
              </View>
              
              {/* Prompt overlay when not started */}
              {!gameStarted && !gameCompleted && (
                <View style={styles.promptOverlay}>
                  <View style={styles.promptCard}>
                    <Text style={styles.promptTitle}>Say this sound:</Text>
                    <Text style={styles.promptPhoneme}>{level.contentExample}</Text>
                    <Text style={styles.promptInstruction}>
                      {getInstructionText(level)} for {level.targetDurationSec} seconds!
                    </Text>
                  </View>
                </View>
              )}

              {/* Sleep prompt overlay - FR-015 */}
              {gameState.showSleepOverlay && isRunning && (
                <View style={styles.sleepPromptOverlay}>
                  <View style={styles.sleepPromptCard}>
                    <Text style={styles.sleepPromptEmoji}>😴</Text>
                    <Text style={styles.sleepPromptText}>
                      Wake up the snake! Keep saying your sound
                    </Text>
                  </View>
                </View>
              )}

              {/* Completion overlay */}
              {gameCompleted && finalMetrics && completionReason !== 'win' && (
                <View style={styles.completionOverlay}>
                  <View style={styles.completionCard}>
                    <Text style={styles.completionTitle}>
                      {finalMetrics.completionPercentage >= 100 ? '🎉 Well Done!' : '⏱️ Time\'s Up!'}
                    </Text>
                    <Text style={styles.completionStats}>
                      Duration: {finalMetrics.durationAchieved.toFixed(1)}s / {finalMetrics.targetDuration}s
                    </Text>
                    <Text style={styles.completionStats}>
                      Progress: {Math.round(finalMetrics.completionPercentage)}%
                    </Text>
                    {finalMetrics.pauseCount > 0 && (
                      <Text style={styles.completionStats}>
                        Pauses: {finalMetrics.pauseCount} ({finalMetrics.totalPauseDuration.toFixed(1)}s)
                      </Text>
                    )}
                    
                    <View style={styles.completionButtons}>
                      <TouchableOpacity
                        style={[styles.button, styles.buttonSecondary]}
                        onPress={handleRetry}
                      >
                        <Text style={styles.buttonSecondaryText}>Try Again</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.button, styles.buttonPrimary]}
                        onPress={() => router.back()}
                      >
                        <Text style={styles.buttonPrimaryText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Bar Visualizer - FR-005 */}
            <SnakeVisualizer
              amplitude={currentAmplitude}
              threshold={SNAKE_CONFIG.AMPLITUDE_THRESHOLD}
              showThreshold={true}
            />

            {/* Control Buttons */}
            <View style={styles.controlsContainer}>

              {!gameStarted && !gameCompleted && (
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary, styles.buttonLarge, !hasPermission && styles.buttonDisabled]}
                  onPress={async () => {
                    setGameStarted(true);
                    await start();
                  }}
                  disabled={!hasPermission}
                >
                  <MaterialCommunityIcons name="play" size={32} color="#FFFFFF" />
                  <Text style={styles.buttonPrimaryText}>Start</Text>
                </TouchableOpacity>
              )}

              {isRunning && !gameCompleted && (
                <View style={styles.gameControls}>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={() => {
                      if (isPaused) {
                        resume();
                        handleResumePause();
                      } else {
                        pause();
                        handlePause();
                      }
                    }}
                  >
                    <MaterialCommunityIcons
                      name={isPaused ? 'play' : 'pause'}
                      size={24}
                      color="#1a73e8"
                    />
                    <Text style={styles.buttonSecondaryText}>
                      {isPaused ? 'Resume' : 'Pause'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.button, styles.buttonDanger]}
                    onPress={async () => {
                      await stop();
                      handleRetry();
                    }}
                  >
                    <MaterialCommunityIcons name="stop" size={24} color="#FFFFFF" />
                    <Text style={styles.buttonPrimaryText}>Stop</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Permission warning */}
              {!hasPermission && (
                <Text style={styles.permissionWarning}>
                  Microphone permission required
                </Text>
              )}

              {/* Dev performance stats */}
              {__DEV__ && perfStats && (
                <View style={styles.perfStats}>
                  <Text style={styles.perfStatsText}>
                    Frame: {perfStats.averageFrameTime.toFixed(1)}ms avg | {perfStats.p95FrameTime.toFixed(1)}ms p95
                  </Text>
                  {perfStats.droppedFrames > 0 && (
                    <Text style={[styles.perfStatsText, styles.perfWarning]}>
                      ⚠️ Dropped frames: {perfStats.droppedFrames}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </View>
        )}
      </SnakeGameEngine>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FFF0',
  },
  gameContainer: {
    flex: 1,
  },
  headerButton: {
    padding: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  progressPercentage: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a73e8',
  },
  hudContainer: {
    ...StyleSheet.absoluteFillObject,
    padding: 12,
  },
  hudBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D5E3FF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  hudLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1a73e8',
  },
  hudValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  hudTopLeft: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  hudTopRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    alignItems: 'flex-end',
  },
  pathContainer: {
    flex: 1,
    position: 'relative',
  },
  promptOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  promptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  promptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 12,
  },
  promptPhoneme: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1a73e8',
    marginBottom: 16,
  },
  promptInstruction: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  sleepPromptOverlay: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  sleepPromptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    maxWidth: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sleepPromptEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  sleepPromptText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  completionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  completionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  completionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 20,
    textAlign: 'center',
  },
  completionStats: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 8,
  },
  completionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  controlsContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  gameControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
    minWidth: 120,
  },
  buttonLarge: {
    paddingVertical: 16,
    width: '100%',
  },
  buttonPrimary: {
    backgroundColor: '#1a73e8',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1a73e8',
    flex: 1,
  },
  buttonDanger: {
    backgroundColor: '#DC3545',
    flex: 1,
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#1a73e8',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionWarning: {
    textAlign: 'center',
    color: '#DC3545',
    fontSize: 14,
    marginTop: 8,
  },
  perfStats: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
  },
  perfStatsText: {
    fontSize: 11,
    color: '#666666',
    fontFamily: 'monospace',
  },
  perfWarning: {
    color: '#DC3545',
    fontWeight: 'bold',
  },
});
