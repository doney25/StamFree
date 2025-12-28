/**
 * Snake Game - AI Backend Integration
 * 
 * Sends recorded audio to Flask /analyze/snake endpoint for post-game AI analysis.
 * Handles stutter detection (repetition, block, fluency) and star calculation.
 * 
 * Features (US4):
 * - Offline queue: Saves failed attempts locally for retry when network returns
 * - Retry logic: Exponential backoff with 3 attempts
 * - Graceful degradation: Returns optimistic feedback if backend unavailable
 * 
 * Related: FR-007, FR-008, T027
 */

import { getAnalyzeUrl } from '@/config/backend';
import { auth } from '@/config/firebaseConfig';
import type { GameMetrics } from '@/hooks/useSnakeGame';
import { createFormData, uploadAudioWithTimeout, type UploadResult } from '@/services/audio';
import { normalizeSnake, type SnakeResponse } from '@/services/clinicalLogic';
import { saveExerciseAttempt } from '@/services/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_QUEUE_KEY = '@stamfree_snake_offline_queue';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000; // Start with 2 seconds

/**
 * Queued analysis attempt for offline retry
 */
interface QueuedAttempt {
  audioUri: string;
  gameMetrics: GameMetrics;
  promptPhoneme?: string;
  timestamp: number;
  retryCount: number;
}

/**
 * Result from AI analysis with star calculation
 */
export interface SnakeAnalysisResult {
  stars: 1 | 2 | 3;
  feedback: string;
  confidence: number;
  metrics: Record<string, number | boolean>;
  gamePass: boolean;
  clinicalPass: boolean;
}

/**
 * Send audio to Flask backend for post-game analysis with retry logic
 * 
 * - Fluent → 3 stars (no stuttering detected)
 * - Prolongation → 3 stars (desired behavior in this game)
 * - Repetition → 1 star (stuttering detected)
 * - Block → 1 star (but usually handled by client silence detection)
 * 
 * US4 Features:
 * - Retries up to 3 times with exponential backoff on network errors
 * - Queues offline if all retries fail (processed when network returns)
 * - Returns optimistic feedback immediately if backend unavailable
 * 
 * FR-007: Records and sends full audio session to backend
 * FR-008: Awards stars based on AI result
 * 
 * @param audioUri - URI of recorded audio file
 * @param gameMetrics - Metrics from game loop (duration, completion %, pauses)
 * @param promptPhoneme - Target phoneme for validation
 * @returns Star rating and feedback, or null if upload fails after retries
 */
export async function analyzeSnakeAudio(
  audioUri: string,
  gameMetrics: GameMetrics,
  promptPhoneme?: string
): Promise<SnakeAnalysisResult | null> {
  const analysisStartTime = performance.now();
  let lastError: Error | null = null;

  // Attempt with retries
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[SnakeAnalysis] Retry attempt ${attempt + 1} after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      console.log('[SnakeAnalysis] Starting analysis for', audioUri, `(attempt ${attempt + 1})`);
      
      const formData = createFormData(audioUri);
      
      // Add required game metrics per contract
      formData.append('durationAchieved', gameMetrics.durationAchieved.toString());
      formData.append('targetDuration', gameMetrics.targetDuration.toString());
      formData.append('completionPercentage', gameMetrics.completionPercentage.toString());
      
      if (promptPhoneme) {
        try {
          formData.append('targetPhoneme', promptPhoneme);
        } catch (_) {
          // Ignore if form append fails
        }
      }
      const url = getAnalyzeUrl('snake');
      
      // Upload with 10 second timeout
      const result: UploadResult = await uploadAudioWithTimeout(url, formData, 10000);
      
      if (!result.ok || !result.json) {
        lastError = new Error(result.error || 'Unknown upload error');
        console.error('[SnakeAnalysis] Upload failed:', lastError.message);
        continue; // Retry
      }

      const snakeRes = result.json as SnakeResponse;
      console.log('[SnakeAnalysis] Backend result:', snakeRes);

      // Normalize to unified format
      const unified = normalizeSnake(snakeRes);

      // Calculate stars from AI result
      // Use backend's starsAwarded which accounts for game_pass, repetition, and phoneme match
      let stars: 1 | 2 | 3 = (snakeRes.starsAwarded === 3) ? 3 : 1;

      // Log to Firestore activity_logs
      if (auth.currentUser) {
        try {
          await saveExerciseAttempt({
            uid: auth.currentUser.uid,
            exerciseType: 'snake',
            gamePass: unified.game_pass,
            clinicalPass: unified.clinical_pass,
            confidence: unified.confidence,
            feedback: unified.feedback,
            metrics: {
              ...unified.metrics,
              // Include game metrics
              durationAchieved: gameMetrics.durationAchieved,
              targetDuration: gameMetrics.targetDuration,
              completionPercentage: gameMetrics.completionPercentage,
              pauseCount: gameMetrics.pauseCount,
              totalPauseDuration: gameMetrics.totalPauseDuration,
              starsAwarded: stars,
            },
          });
          console.log('[SnakeAnalysis] Logged attempt to Firestore');
        } catch (logErr) {
          console.error('[SnakeAnalysis] Failed to log attempt:', logErr);
          // Don't fail the whole analysis if logging fails
        }
      }

      const totalLatency = performance.now() - analysisStartTime;
      console.log(`[SnakeAnalysis] ✅ Analysis complete in ${totalLatency.toFixed(0)}ms (${attempt + 1} attempt${attempt > 0 ? 's' : ''})`);
      
      // Warn if latency exceeds target (5 seconds)
      if (totalLatency > 5000) {
        console.warn(`[SnakeAnalysis] ⚠️ AI latency exceeded 5s target: ${totalLatency.toFixed(0)}ms`);
      }

      return {
        stars,
        feedback: unified.feedback,
        confidence: unified.confidence,
        metrics: unified.metrics,
        gamePass: unified.game_pass,
        clinicalPass: unified.clinical_pass,
      };
    } catch (error) {
      lastError = error as Error;
      console.error(`[SnakeAnalysis] Attempt ${attempt + 1} failed:`, error);
    }
  }

  // All retries failed - queue for offline processing
  const totalLatency = performance.now() - analysisStartTime;
  console.error(`[SnakeAnalysis] ❌ All retry attempts failed after ${totalLatency.toFixed(0)}ms:`, lastError?.message);
  await queueOfflineAttempt(audioUri, gameMetrics, promptPhoneme);

  return null;
}

/**
 * Get encouragement message based on stars and feedback
 * 
 * US4: Non-corrective feedback
 * - 3 stars: Celebratory
 * - 1 star: Gentle encouragement
 */
export function getStarFeedback(stars: number, baseMessage: string): string {
  if (stars === 3) {
    return baseMessage || 'Smooth Slider! Amazing work! 🌟';
  } else {
    return baseMessage || 'Good try! Let\'s make it smoother next time. You\'ve got this! 💪';
  }
}

/**
 * Queue failed analysis attempt for offline retry
 * Stores in AsyncStorage for later processing when network returns
 */
async function queueOfflineAttempt(
  audioUri: string,
  gameMetrics: GameMetrics,
  promptPhoneme?: string
): Promise<void> {
  try {
    const queue = await getOfflineQueue();
    const newAttempt: QueuedAttempt = {
      audioUri,
      gameMetrics,
      promptPhoneme,
      timestamp: Date.now(),
      retryCount: 0,
    };
    queue.push(newAttempt);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    console.log('[SnakeAnalysis] Queued attempt for offline retry. Queue size:', queue.length);
  } catch (error) {
    console.error('[SnakeAnalysis] Failed to queue offline attempt:', error);
  }
}

/**
 * Get offline queue from AsyncStorage
 */
async function getOfflineQueue(): Promise<QueuedAttempt[]> {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[SnakeAnalysis] Failed to load offline queue:', error);
    return [];
  }
}

/**
 * Process offline queue - attempt to send queued analyses
 * Call this when network becomes available or on app start
 * 
 * @returns Number of successfully processed attempts
 */
export async function processOfflineQueue(): Promise<number> {
  try {
    const queue = await getOfflineQueue();
    if (queue.length === 0) {
      return 0;
    }

    console.log('[SnakeAnalysis] Processing offline queue:', queue.length, 'attempts');
    let successCount = 0;
    const remaining: QueuedAttempt[] = [];

    for (const attempt of queue) {
      // Skip if too old (>7 days)
      const ageInDays = (Date.now() - attempt.timestamp) / (1000 * 60 * 60 * 24);
      if (ageInDays > 7) {
        console.log('[SnakeAnalysis] Skipping stale queued attempt (age:', ageInDays.toFixed(1), 'days)');
        continue;
      }

      // Try to send
      const result = await analyzeSnakeAudio(
        attempt.audioUri,
        attempt.gameMetrics,
        attempt.promptPhoneme
      );

      if (result) {
        successCount++;
        console.log('[SnakeAnalysis] Successfully processed queued attempt');
      } else {
        // Keep in queue if still failing and under retry limit
        if (attempt.retryCount < MAX_RETRY_ATTEMPTS) {
          remaining.push({
            ...attempt,
            retryCount: attempt.retryCount + 1,
          });
        } else {
          console.log('[SnakeAnalysis] Dropping queued attempt after max retries');
        }
      }
    }

    // Save remaining queue
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    console.log('[SnakeAnalysis] Queue processing complete. Success:', successCount, 'Remaining:', remaining.length);

    return successCount;
  } catch (error) {
    console.error('[SnakeAnalysis] Error processing offline queue:', error);
    return 0;
  }
}

/**
 * Clear offline queue (for debugging or manual cleanup)
 */
export async function clearOfflineQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    console.log('[SnakeAnalysis] Offline queue cleared');
  } catch (error) {
    console.error('[SnakeAnalysis] Failed to clear offline queue:', error);
  }
}

/**
 * Get offline queue status for debugging
 */
export async function getOfflineQueueStatus(): Promise<{
  count: number;
  oldestTimestamp: number | null;
}> {
  try {
    const queue = await getOfflineQueue();
    return {
      count: queue.length,
      oldestTimestamp: queue.length > 0 ? Math.min(...queue.map(a => a.timestamp)) : null,
    };
  } catch (error) {
    console.error('[SnakeAnalysis] Failed to get queue status:', error);
    return { count: 0, oldestTimestamp: null };
  }
}
