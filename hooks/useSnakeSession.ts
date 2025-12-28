/**
 * Snake Session Hook (Brain Logic)
 * 
 * Manages session-level concerns: level loading, XP calculation,
 * next level selection (adaptive), progress persistence.
 * 
 * Separates macro logic (progression) from micro logic (physics in useSnakeGame).
 * 
 * Related: FR-022, FR-023, Clarifications 2025-12-27
 * Task: T023
 */

import { auth } from '@/config/firebaseConfig';
import type { GameMetrics } from '@/hooks/useSnakeGame';
import {
    saveSnakeAttempt,
    updateUserSnakeProgressAggregate,
} from '@/services/firestore';
import { analyzeSnakeAudio, type SnakeAnalysisResult } from '@/services/snakeAnalysis';
import {
    calculateXpReward,
    getNextLevel,
    getSnakeLevel,
    getUserSnakeProgress,
    saveSnakeProgress,
    type SnakeLevel,
    type UserProgress,
} from '@/services/snakeProgression';
import { useCallback, useEffect, useState } from 'react';

export interface UseSnakeSessionOptions {
  /** Initial level ID (if specified) */
  levelId?: string;
  /** Called when session is ready */
  onReady?: () => void;
  /** Called on critical errors */
  onError?: (error: Error) => void;
}

export interface UseSnakeSessionResult {
  /** Current level configuration */
  level: SnakeLevel | null;
  /** User's overall progress */
  userProgress: UserProgress | null;
  /** Whether session is loading */
  isLoading: boolean;
  /** Whether completion analysis is in-flight */
  isAnalyzing: boolean;
  /** Load or reload level */
  loadLevel: (levelId?: string) => Promise<void>;
  /** Complete level with metrics and audio */
  completeLevel: (
    metrics: GameMetrics,
    audioUri: string
  ) => Promise<CompleteLevelResult>;
  /** Handle failure (timeout/quit) */
  handleFailure: () => void;
}

export interface CompleteLevelResult {
  /** Optimistic stars (shown immediately) */
  optimisticStars: number;
  /** Promise resolving to AI analysis + next level */
  analysisPromise: Promise<AnalysisData | null>;
}

export interface AnalysisData {
  aiResult: SnakeAnalysisResult | null;
  xp: number;
  nextLevel: SnakeLevel | null;
  savedProgress: UserProgress | null;
}

/**
 * Snake Session Hook - Brain/Macro Logic
 * 
 * Orchestrates:
 * - Level loading from Firestore
 * - XP calculation and progress updates
 * - Adaptive next-level selection based on AI confidence
 * - Optimistic UI updates with async reconciliation
 */
export function useSnakeSession(
  options: UseSnakeSessionOptions = {}
): UseSnakeSessionResult {
  const { levelId: initialLevelId, onReady, onError } = options;

  const [level, setLevel] = useState<SnakeLevel | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  /**
   * Load level and user progress
   */
  const loadLevel = useCallback(
    async (levelId?: string) => {
      setIsLoading(true);
      try {
        if (!auth.currentUser) {
          throw new Error('User not authenticated');
        }

        // Load user progress
        const progress = await getUserSnakeProgress(auth.currentUser.uid);
        setUserProgress(progress);

        // Load level
        let levelData: SnakeLevel | null = null;
        if (levelId) {
          levelData = await getSnakeLevel(levelId);
        }

        if (!levelData) {
          // Default: pick first incomplete level in current tier
          const { getSnakeLevelsByTier } = await import('@/services/snakeProgression');
          const tierLevels = await getSnakeLevelsByTier(progress.currentTier);
          const incomplete = tierLevels.find(
            (lvl) => !progress.completedLevels.includes(lvl.levelId)
          );
          levelData =
            incomplete ||
            tierLevels[0] || {
              levelId: 'fallback_tier1_word',
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
        setIsLoading(false);
        onReady?.();

        console.log('[SnakeSession] Loaded level:', levelData.levelId);
      } catch (error) {
        console.error('[SnakeSession] Error loading level:', error);
        setIsLoading(false);
        onError?.(error as Error);
      }
    },
    [] // Empty deps - callbacks are called but not stored in closure
  );

  /**
   * Complete level: calculate optimistic result, start AI analysis in background
   */
  const completeLevel = useCallback(
    async (
      metrics: GameMetrics,
      audioUri: string
    ): Promise<CompleteLevelResult> => {
      if (!auth.currentUser || !level || !userProgress) {
        throw new Error('Cannot complete level: missing session data');
      }

      // 1. Calculate optimistic result (immediate)
      const optimisticStars: 1 | 3 = metrics.completionPercentage >= 100 ? 3 : 1;
      const normalizeStars = (stars: number): 1 | 3 => (stars === 3 ? 3 : 1);

      // 2. Start AI analysis in background (non-blocking)
      const analysisPromise = (async (): Promise<AnalysisData | null> => {
        setIsAnalyzing(true);
        try {
          const aiResult = await analyzeSnakeAudio(
            audioUri,
            metrics,
            level.targetPhonemes[0]
          );

          const finalStars = aiResult ? normalizeStars(aiResult.stars) : optimisticStars;
          const confidence = aiResult?.confidence ?? 1.0;

          // Calculate XP
          const xp = calculateXpReward(
            level.xpReward,
            finalStars,
            metrics.completionPercentage
          );

          // Apply phoneme mismatch penalty if strict mode
          let adjustedXp = xp;
          const phonemeMatch = aiResult?.metrics?.phoneme_match;
          if (typeof phonemeMatch === 'boolean' && phonemeMatch === false) {
            const { SNAKE_CONFIG } = await import('@/constants/snakeConfig');
            if (SNAKE_CONFIG.STRICT_PHONEME_REQUIRED) {
              adjustedXp = Math.max(1, Math.round(xp * 0.5));
              console.log(
                `[SnakeSession] Phoneme mismatch detected - XP reduced: ${xp} → ${adjustedXp}`
              );
            }
          }

          // Save progress to Firestore
          const savedProgress = await saveSnakeProgress(
            auth.currentUser!.uid,
            level.levelId,
            finalStars,
            adjustedXp
          );

          if (savedProgress) {
            setUserProgress(savedProgress);
          }

          // Save detailed attempt log
          if (aiResult && savedProgress) {
            try {
              const awardedStars: 1 | 3 = normalizeStars(finalStars);

              // Build metrics object without undefined fields (Firestore rejects undefined)
              const metricsToSave: {
                phoneme_match: boolean;
                confidence: number;
                smoothness_score?: number;
              } = {
                phoneme_match:
                  typeof aiResult.metrics?.phoneme_match === 'boolean'
                    ? aiResult.metrics.phoneme_match
                    : true,
                confidence,
              };
              if (typeof aiResult.metrics?.smoothness_score === 'number') {
                metricsToSave.smoothness_score = aiResult.metrics.smoothness_score;
              }

              await saveSnakeAttempt({
                userId: auth.currentUser!.uid,
                level,
                gameMetrics: metrics,
                aiResult: {
                  stars: awardedStars,
                  feedback: aiResult.feedback,
                  metrics: metricsToSave,
                },
                starsAwarded: awardedStars,
                xpEarned: adjustedXp,
              });

              await updateUserSnakeProgressAggregate(
                auth.currentUser!.uid,
                adjustedXp,
                finalStars
              );
            } catch (logErr) {
              console.error('[SnakeSession] Failed to log attempt:', logErr);
            }
          }

          // Determine next level based on AI confidence
          const awardedStars: 1 | 3 = normalizeStars(finalStars);
          const nextLevel = await getNextLevel(
            level,
            savedProgress || userProgress,
            confidence,
            awardedStars
          );

          return {
            aiResult,
            xp: adjustedXp,
            nextLevel,
            savedProgress,
          };
        } catch (err) {
          console.error('[SnakeSession] Analysis failed:', err);
          // Fallback to optimistic values
          return {
            aiResult: null,
            xp: calculateXpReward(
              level.xpReward,
              optimisticStars,
              metrics.completionPercentage
            ),
            nextLevel: null,
            savedProgress: null,
          };
        } finally {
          setIsAnalyzing(false);
        }
      })();

      return { optimisticStars, analysisPromise };
    },
    [level, userProgress]
  );

  /**
   * Handle failure (timeout/manual quit)
   */
  const handleFailure = useCallback(() => {
    console.log('[SnakeSession] Level failed - no XP awarded');
    // Could log failed attempt here if desired
  }, []);

  // Load level on mount or when levelId changes (only once per levelId)
  useEffect(() => {
    loadLevel(initialLevelId);
  }, [initialLevelId]);

  return {
    level,
    userProgress,
    isLoading,
    isAnalyzing,
    loadLevel,
    completeLevel,
    handleFailure,
  };
}
