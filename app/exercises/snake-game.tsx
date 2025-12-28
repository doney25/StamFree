/**
 * Snake Game Screen
 * 
 * Full game screen integrating SnakeGameEngine and SnakePath.
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
import { SuccessModal } from '@/components/snake/SuccessModal';
import { isVoicedPhoneme } from '@/constants/phonemes';
import { SNAKE_CONFIG } from '@/constants/snakeConfig';
import type { GameMetrics } from '@/hooks/useSnakeGame';
import { useSnakeSession } from '@/hooks/useSnakeSession';
import { getInstructionText } from '@/services/snakeProgression';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Animated, BackHandler, Easing, ImageBackground, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const backgroundImage = require('@/assets/images/jungle-background.png');

type PressableScaleButtonProps = React.PropsWithChildren<{
  disabled?: boolean;
  onPress?: () => void | Promise<void>;
  style?: any;
  testID?: string;
  accessibilityLabel?: string;
}>;

const PressableScaleButton: React.FC<PressableScaleButtonProps> = ({
  disabled,
  onPress,
  style,
  children,
  testID,
  accessibilityLabel,
}) => {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 0.96,
      speed: 18,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  }, [disabled, scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      speed: 18,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        disabled={disabled}
        style={style}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

const useHaptics = () => {
  const light = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
  }, []);

  const medium = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  }, []);

  const success = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, []);

  const warning = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  }, []);

  return { light, medium, success, warning };
};

export default function SnakeGameScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const { light: hapticLight, medium: hapticMedium, success: hapticSuccess, warning: hapticWarning } = useHaptics();
  const readyToastOpacity = React.useRef(new Animated.Value(0)).current;

  // Memoize error handler to prevent infinite loop in useSnakeSession
  const handleSessionError = React.useCallback((error: Error) => {
    console.error('[SnakeGame] Session error:', error);
    Alert.alert('Error', 'Failed to load level. Returning to menu.');
    router.back();
  }, []);

  // Use Brain logic hook for level management
  const {
    level,
    userProgress,
    isLoading: loading,
    isAnalyzing,
    loadLevel,
    completeLevel,
    handleFailure,
  } = useSnakeSession({
    levelId: params.levelId as string | undefined,
    onError: handleSessionError,
  });

  const [gameStarted, setGameStarted] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [finalMetrics, setFinalMetrics] = useState<GameMetrics | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [showPauseOverlay, setShowPauseOverlay] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [optimisticStars, setOptimisticStars] = useState<number>(3);
  const [finalStars, setFinalStars] = useState<number | undefined>(undefined);
  const [displayFeedback, setDisplayFeedback] = useState<string>("Great job! We're analyzing your sound...");
  const [earnedXp, setEarnedXp] = useState<number | undefined>(undefined);
  const [completionReason, setCompletionReason] = useState<'win' | 'timeout' | 'manual' | 'silent'>('win');
  const engineResetRef = React.useRef<(() => void) | null>(null);
  const pathSeedRef = React.useRef<number>(0);
  const [pathSeed, setPathSeed] = useState<number>(0);

  const isVoicedTarget = level ? isVoicedPhoneme(level.targetPhonemes?.[0]) : false;
  const speechProb = analysisResult?.aiResult?.confidence as number | undefined; // Overall performance confidence
  const voicedDetected = analysisResult?.aiResult?.metrics?.voiced_detected as boolean | undefined;

  // Header back button
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const handleBack = useCallback(() => {
    hapticLight();
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
  }, [gameStarted, gameCompleted, hapticLight]);

  const handleWin = useCallback((metrics: GameMetrics) => {
    console.log('[SnakeGame] Win!', metrics);
    hapticSuccess();
    setGameCompleted(true);
    setFinalMetrics(metrics);
    setCompletionReason('win');
    setShowRetryModal(false);
    setShowConfetti(true);
    // Show 0 stars initially while analyzing
    setOptimisticStars(0);
    setFinalStars(undefined);
    setDisplayFeedback('🎉 You did it! Let me listen to your amazing voice...');
    // Don't show modal yet - wait for confetti to finish
    setShowSuccessModal(false);
  }, [hapticSuccess]);

  // Analyze after win if audio available
  useEffect(() => {
    if (completionReason !== 'win' || !finalMetrics || !audioUri) return;

    const runAnalysis = async () => {
      try {
        const result = await completeLevel(finalMetrics, audioUri);
        setOptimisticStars(result.optimisticStars);

        // Wait for AI analysis in background
        const analysisData = await result.analysisPromise;
        if (analysisData) {
          setFinalStars(analysisData.aiResult?.stars ?? result.optimisticStars);
          setDisplayFeedback(
            analysisData.aiResult?.feedback ??
              'Great effort! Let\'s analyze this one next time.'
          );
          setEarnedXp(analysisData.xp);
          setAnalysisResult(analysisData);
        }
      } catch (error) {
        console.error('[SnakeGame] Analysis error:', error);
        const fallback = {
          stars: 1,
          feedback: 'Great effort! Let\'s analyze this one next time.',
        };
        setFinalStars(fallback.stars);
        setDisplayFeedback(fallback.feedback);
      }
    };

    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completionReason, finalMetrics, audioUri]);

  const handleTimeout = useCallback((metrics: GameMetrics) => {
    console.log('[SnakeGame] Timeout!', metrics);
    hapticWarning();
    setGameCompleted(true);
    setFinalMetrics(metrics);
    setCompletionReason('timeout');
    setShowRetryModal(true);
  }, [hapticWarning]);

  const handleRecordingStop = useCallback((uri: string | null) => {
    console.log('[SnakeGame] Recording stopped:', uri);
    setAudioUri(uri);
  }, []);

  const triggerReadyToast = useCallback(() => {
    readyToastOpacity.stopAnimation?.();
    readyToastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(readyToastOpacity, { toValue: 1, duration: 160, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.delay(900),
      Animated.timing(readyToastOpacity, { toValue: 0, duration: 220, useNativeDriver: true, easing: Easing.in(Easing.cubic) }),
    ]).start();
  }, [readyToastOpacity]);

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
    setCompletionReason('win');
    pathSeedRef.current += 1;
    setPathSeed(pathSeedRef.current);
    engineResetRef.current?.();
  }, []);

  const handlePause = useCallback(() => {
    hapticLight();
    setShowPauseOverlay(true);
  }, [hapticLight]);

  const handleResumePause = useCallback(() => {
    hapticLight();
    setShowPauseOverlay(false);
  }, [hapticLight]);

  const handlePauseQuit = useCallback(() => {
    hapticMedium();
    setShowPauseOverlay(false);
    setGameStarted(false);
    setGameCompleted(true);
    router.back();
  }, [hapticMedium]);

  const handleContinue = useCallback(() => {
    setShowSuccessModal(false);

    if (!level || !analysisResult) {
      router.back();
      return;
    }

    const nextLevel = analysisResult.nextLevel;

    if (nextLevel) {
      // Reload with new level instead of router.push (avoids stack buildup)
      pathSeedRef.current += 1;
      setPathSeed(pathSeedRef.current);
      setGameStarted(false);
      setGameCompleted(false);
      setFinalMetrics(null);
      setAudioUri(null);
      setShowSuccessModal(false);
      setShowRetryModal(false);
      setShowConfetti(false);
      setAnalysisResult(null);
      loadLevel(nextLevel.levelId);
    } else {
      // No more levels - go back
      router.back();
    }
  }, [level, analysisResult, loadLevel]);

  const handleCloseSuccessModal = useCallback(() => {
    setShowSuccessModal(false);
    router.back();
  }, []);

  // Handle hardware back button when success modal is visible
  useEffect(() => {
    if (!showSuccessModal) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCloseSuccessModal();
      return true; // Prevent default behavior
    });

    return () => backHandler.remove();
  }, [showSuccessModal, handleCloseSuccessModal]);

  // Subtle entrance animation for header and cards
  const introAnim = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(introAnim, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [introAnim]);

  const headerEntranceStyle = useMemo(() => ({
    opacity: introAnim,
    transform: [
      {
        translateY: introAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }),
      },
    ],
  }), [introAnim]);

  const cardEntranceStyle = useMemo(() => ({
    opacity: introAnim,
    transform: [
      {
        translateY: introAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
      },
    ],
  }), [introAnim]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {loading && (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#1a73e8" />
        </View>
      )}

      {!loading && level && (
        <>
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

          {/* T025: Success Modal with stars and AI feedback (optimistic → final) */}
          {finalMetrics && (
            <SuccessModal
              visible={showSuccessModal}
              gameMetrics={finalMetrics}
              stars={optimisticStars}
              onClose={handleCloseSuccessModal}
              finalStars={finalStars}
              isLoading={isAnalyzing}
              feedback={displayFeedback}
              xpReward={earnedXp ?? level.xpReward}
              totalXp={userProgress?.totalXP || 0}
              phonemeMatch={analysisResult?.aiResult?.metrics?.phoneme_match as boolean | undefined}
              speechProb={speechProb}
              voicedDetected={voicedDetected}
              speechThreshold={SNAKE_CONFIG.SPEECH_PROB_MIN}
              isVoicedTarget={isVoicedTarget}
              onContinue={handleContinue}
              onRetry={handleRetry}
            />
          )}

          {/* Confetti Animation on win */}
          {showConfetti && (
            <ConfettiAnimation
              duration={3000}
              onComplete={() => {
                setShowConfetti(false);
                setShowSuccessModal(true);
              }}
            />
          )}

          {/* GAME VIEWPORT CARD */}
          <SnakeGameEngine
            pathLength={100}
            levelConfig={{
              targetDurationSec: level.targetDurationSec,
              allowPauses: level.allowPauses,
              maxPauseDuration: level.maxPauseDuration,
            }}
            voicingRequired={isVoicedTarget}
            onWin={handleWin}
            onTimeout={handleTimeout}
            onRecordingStop={handleRecordingStop}
            onAudioError={handleAudioError}
            enablePerfTracking={__DEV__}
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
              <View style={{ flex: 1, flexDirection: 'column' }}>
                {/* FLOATING HEADER - Pause Button & Level Pill */}
                <Animated.View 
                  style={[styles.floatingHeader, headerEntranceStyle]} 
                  pointerEvents="box-none"
                >
                  {/* Back Button (Top Left) - Always accessible */}
                  <PressableScaleButton
                    style={styles.backButton}
                    onPress={showSuccessModal ? handleCloseSuccessModal : handleBack}
                    accessibilityLabel="Back"
                  >
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#1a73e8" />
                  </PressableScaleButton>

                  {/* Level & Progress Pill (Top Center) */}
                  <View style={styles.levelGroup}>
                    <View style={styles.levelPill}>
                      <Text style={styles.levelPillText}>
                        Level {level.tier}-{level.levelId.split('_')[2] || '1'}
                      </Text>
                      <Text style={styles.levelPillSubtext}>
                        {Math.round((userProgress?.totalXP || 0) / 100)}★
                      </Text>
                    </View>
                  </View>

                  {/* Pause Button (Top Right) */}
                  <PressableScaleButton
                    style={styles.pauseButton}
                    onPress={async () => {
                      hapticLight();
                      if (isPaused) {
                        resume();
                        handleResumePause();
                      } else {
                        pause();
                        handlePause();
                      }
                    }}
                    disabled={!isRunning || gameCompleted}
                    accessibilityLabel={isPaused ? 'Resume' : 'Pause'}
                  >
                    <MaterialCommunityIcons
                      name={isPaused ? 'play' : 'pause'}
                      size={24}
                      color="#FFFFFF"
                    />
                  </PressableScaleButton>
                </Animated.View>

                {/* GAME VIEWPORT CARD */}
                <Animated.View style={[styles.gameViewportCard, cardEntranceStyle]}>
                  {(() => {
                    engineResetRef.current = reset;
                    return null;
                  })()}

                  {/* Background with Snake Path */}
                  <ImageBackground
                    source={backgroundImage}
                    style={styles.gameBackground}
                    resizeMode="cover"
                  >
                    {/* Snake Path with Avatar - FR-001, FR-003, FR-015, FR-016 */}
                    <SnakePath
                      position={gameState.position / 100}
                      isMoving={isRunning && !isPaused && !gameState.isHalted}
                      showSleepOverlay={gameState.showSleepOverlay}
                      pathLength={100}
                      showBackground={true}
                      triggerAppleEat={gameState.isWon}
                      variationKey={pathSeed}
                    />
                  </ImageBackground>

                  {isPaused && isRunning && (
                    <View style={styles.pausedTint} pointerEvents="none">
                      <Text style={styles.pausedTintText}>Paused</Text>
                    </View>
                  )}

                  {/* Prompt overlay when not started */}
                  {!gameStarted && !gameCompleted && (
                    <View style={styles.promptOverlay}>
                      <View style={styles.promptCard}>
                        <Text style={styles.promptTitle}>Say this sound:</Text>
                        <Text style={styles.promptPhoneme}>{level.contentExample}</Text>
                        <Text style={styles.promptInstruction}>
                          {getInstructionText(level)} for {level.targetDurationSec} seconds!
                        </Text>
                        <View style={styles.promptButtonContainer}>
                          <PressableScaleButton
                            style={[styles.button, styles.buttonPrimary, !hasPermission && styles.buttonDisabled]}
                            onPress={async () => {
                              hapticLight();
                              triggerReadyToast();
                              setGameStarted(true);
                              await start();
                            }}
                            disabled={!hasPermission}
                            accessibilityLabel="Start"
                          >
                            <MaterialCommunityIcons name="play" size={32} color="#FFFFFF" />
                            <Text style={styles.buttonPrimaryText}>Start</Text>
                          </PressableScaleButton>
                          {!hasPermission && (
                            <Text style={styles.permissionWarning}>
                              Microphone permission required
                            </Text>
                          )}
                        </View>
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
                          <PressableScaleButton
                            style={[styles.button, styles.buttonSecondary]}
                            onPress={() => {
                              hapticLight();
                              handleRetry();
                            }}
                            accessibilityLabel="Try again"
                          >
                            <Text style={styles.buttonSecondaryText}>Try Again</Text>
                          </PressableScaleButton>
                          <PressableScaleButton
                            style={[styles.button, styles.buttonPrimary]}
                            onPress={() => {
                              hapticLight();
                              router.back();
                            }}
                            accessibilityLabel="Done"
                          >
                            <Text style={styles.buttonPrimaryText}>Done</Text>
                          </PressableScaleButton>
                        </View>
                      </View>
                    </View>
                  )}
                </Animated.View>

                {/* CONTROL DECK CARD (Bottom) */}
                <Animated.View style={[styles.controlDeckCard, cardEntranceStyle]}>
                  {/* <Animated.View pointerEvents="none" style={[styles.readyToast, { opacity: readyToastOpacity }]}> 
                    <Text style={styles.readyToastText}>Ready</Text>
                  </Animated.View> */}
                  {/* Sentence / Prompt Display */}
                  <View style={styles.sentenceCard}>
                    <Text style={styles.sentenceLabel}>Say:</Text>
                    <Text style={styles.sentenceText}>{level.contentExample}</Text>
                  </View>
                  {/* Real-time Visualizer (FR-005) */}
                  {/* <View style={styles.visualizerContainer}>
                    {Array.from({ length: 16 }).map((_, i) => {
                      const height = Math.max(4, Math.round((i % 4 + 1) * 8 * (gameState.lastAmplitude || 0)));
                      const active = (gameState.lastAmplitude || 0) >= 0.5;
                      return (
                        <View
                          key={i}
                          style={[
                            styles.visualizerBar,
                            { height },
                            active ? styles.visualizerBarActive : styles.visualizerBarIdle,
                          ]}
                        />
                      );
                    })}
                  </View> */}
                </Animated.View>
              </View>
            )}
          </SnakeGameEngine>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FFF0',
    flexDirection: 'column',
  },
  
  /* ============ FLOATING HEADER ============ */
  floatingHeader: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 4,
    backgroundColor: 'transparent',
    zIndex: 30,
  },
  pauseButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(26, 115, 232, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(26, 115, 232, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  levelPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(26, 115, 232, 0.3)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  levelPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a73e8',
  },
  levelPillSubtext: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  levelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pausedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 193, 7, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.4)',
  },
  pausedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8a6d00',
  },
  
  /* ============ GAME VIEWPORT CARD ============ */
  gameViewportCard: {
    flex: 1,
    margin: 12,
    marginTop: 8,
    backgroundColor: '#F7FAFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(26, 115, 232, 0.08)',
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },

  gameBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  pausedTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 18, 28, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pausedTintText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 0.5,
  },
  
  /* ============ CONTROL DECK CARD ============ */
  controlDeckCard: {
    backgroundColor: '#F9FBFF',
    borderRadius: 18,
    margin: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(26, 115, 232, 0.08)',
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    position: 'relative',
  },
  
  /* ============ GAME CONTAINER (Legacy) ============ */
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
    maxWidth: 180,
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
    flexShrink: 1,
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
  
  /* ============ OVERLAYS & PROMPTS ============ */
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
    marginBottom: 20,
  },
  promptButtonContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  sleepPromptOverlay: {
    position: 'absolute',
    top: '26%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  sleepPromptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    maxWidth: '55%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  sleepPromptEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  sleepPromptText: {
    fontSize: 13,
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
  
  /* ============ CONTROLS & BUTTONS ============ */
  controlsContainer: {
    padding: 16,
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
  
  /* ============ SENTENCE CARD ============ */
  sentenceCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  sentenceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  sentenceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  sentencePhonemes: {
    fontSize: 13,
    color: '#4B5563',
  },
  visualizerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  visualizerBar: {
    width: 8,
    borderRadius: 4,
  },
  visualizerBarIdle: {
    backgroundColor: '#D1D5DB',
  },
  visualizerBarActive: {
    backgroundColor: '#34D399',
  },
  readyToast: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(26, 115, 232, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(26, 115, 232, 0.25)',
  },
  readyToastText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a73e8',
    letterSpacing: 0.3,
  },
});
