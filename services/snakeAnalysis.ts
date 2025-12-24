/**
 * Snake Game - AI Backend Integration
 * 
 * Sends recorded audio to Flask /analyze/snake endpoint for post-game AI analysis.
 * Handles stutter detection (repetition, block, fluency) and star calculation.
 * 
 * Related: FR-007, FR-008, T026
 */

import { getAnalyzeUrl } from '@/config/backend';
import { auth } from '@/config/firebaseConfig';
import { SNAKE_CONFIG } from '@/constants/snakeConfig';
import type { GameMetrics } from '@/hooks/useSnakeGame';
import { createFormData, uploadAudioWithTimeout, type UploadResult } from '@/services/audio';
import { normalizeSnake, type SnakeResponse } from '@/services/clinicalLogic';
import { saveExerciseAttempt } from '@/services/firestore';

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
 * Send audio to Flask backend for post-game analysis
 * 
 * - Fluent → 3 stars (no stuttering detected)
 * - Prolongation → 3 stars (desired behavior in this game)
 * - Repetition → 1 star (stuttering detected)
 * - Block → 1 star (but usually handled by client silence detection)
 * 
 * FR-007: Records and sends full audio session to backend
 * FR-008: Awards stars based on AI result
 * 
 * @param audioUri - URI of recorded audio file
 * @param gameMetrics - Metrics from game loop (duration, completion %, pauses)
 * @returns Star rating and feedback, or null if upload fails
 */
export async function analyzeSnakeAudio(
  audioUri: string,
  gameMetrics: GameMetrics,
  promptPhoneme?: string
): Promise<SnakeAnalysisResult | null> {
  try {
    console.log('[SnakeAnalysis] Starting analysis for', audioUri);
    
    const formData = createFormData(audioUri);
    if (promptPhoneme) {
      try {
        formData.append('prompt_phoneme', promptPhoneme);
      } catch (_) {
        // Ignore if form append fails
      }
    }
    const url = getAnalyzeUrl('snake');
    
    // Upload with 10 second timeout
    const result: UploadResult = await uploadAudioWithTimeout(url, formData, 10000);
    
    if (!result.ok || !result.json) {
      console.error('[SnakeAnalysis] Upload failed:', result.error);
      return null;
    }

    const snakeRes = result.json as SnakeResponse;
    console.log('[SnakeAnalysis] Backend result:', snakeRes);

    // Normalize to unified format
    const unified = normalizeSnake(snakeRes);

    // Calculate stars from AI result
    // Repetition detected → 1 star (not smooth)
    // Otherwise → 3 stars (fluent or prolongation, which is desired)
    let stars: 1 | 2 | 3;
    if (snakeRes.repetition_detected) {
      stars = 1;
    } else {
      // If backend indicates phoneme mismatch and strict policy is on, reduce stars
      const mismatch = typeof snakeRes.phoneme_match === 'boolean' && snakeRes.phoneme_match === false;
      stars = mismatch && SNAKE_CONFIG.STRICT_PHONEME_REQUIRED ? 1 : 3;
    }

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

    return {
      stars,
      feedback: unified.feedback,
      confidence: unified.confidence,
      metrics: unified.metrics,
      gamePass: unified.game_pass,
      clinicalPass: unified.clinical_pass,
    };
  } catch (error) {
    console.error('[SnakeAnalysis] Error:', error);
    return null;
  }
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
