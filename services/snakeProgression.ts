/**
 * Snake Progression Helpers - Firestore Integration
 * 
 * Loads level definitions from unified content_bank collection,
 * manages user progression (XP/tier unlocks).
 * 
 * Architecture: Queries content_bank filtered by compatibleGames: ['snake'],
 * then derives SnakeLevel properties at runtime.
 * 
 * Implements FR-009, FR-010, FR-013.
 * Task: T018, T028, T029
 * Related: Clarifications 2025-12-24
 */

import { db } from '@/config/firebaseConfig';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    runTransaction,
    setDoc,
    where
} from 'firebase/firestore';

/**
 * Content Bank Item from Firestore
 * Primary entity in unified content_bank collection
 */
export interface ContentBankItem {
  id: string;
  text: string;
  phoneme: string;
  phonemeCode: string;
  tier: 1 | 2 | 3;
  type: 'word' | 'phrase' | 'sentence';
  syllables: number;
  compatibleGames: string[];
  ipa?: string;
  createdAt: string;
}

/**
 * Snake Level Definition (Derived from ContentBankItem)
 * Corresponds to SnakeLevel entity in spec
 */
export interface SnakeLevel {
  levelId: string;
  tier: 1 | 2 | 3;
  type: 'word' | 'phrase' | 'sentence';
  targetPhonemes: string[];
  targetDurationSec: number;
  allowPauses: boolean;
  maxPauseDuration: number;
  xpReward: number;
  contentExample: string;
  instruction?: string; // e.g., "Say Sssssss-un" for fricatives, "Say B-aaaaaa-ll" for stops
}

/**
 * Duration formula (linear scaling)
 * Clarifications 2025-12-24: word=2s, phrase=4s, sentence=6s
 */
const DURATION_MAP: Record<'word' | 'phrase' | 'sentence', number> = {
  word: 2,
  phrase: 4,
  sentence: 6,
};

/**
 * Base XP by content type
 */
const BASE_XP_MAP: Record<'word' | 'phrase' | 'sentence', number> = {
  word: 10,
  phrase: 20,
  sentence: 50,
};

/**
 * Tier multiplier for XP calculation
 */
const TIER_MULTIPLIER_MAP: Record<1 | 2 | 3, number> = {
  1: 1.0,
  2: 1.2,
  3: 1.5,
};

/**
 * Derive SnakeLevel properties from ContentBankItem
 * Applies duration/XP formulas from spec
 */
export function deriveSnakeLevel(item: ContentBankItem): SnakeLevel {
  const targetDurationSec = DURATION_MAP[item.type];
  const baseXP = BASE_XP_MAP[item.type];
  const tierMultiplier = TIER_MULTIPLIER_MAP[item.tier];
  const xpReward = Math.round(baseXP * tierMultiplier);

  return {
    levelId: item.id,
    tier: item.tier,
    type: item.type,
    targetPhonemes: [item.phoneme],
    targetDurationSec,
    allowPauses: item.tier > 1, // Tier 1 = no pauses, Tier 2/3 = allow pauses
    maxPauseDuration: 0.5,
    xpReward,
    contentExample: item.text,
  };
}

/**
 * Snake Tier Definition
 * Corresponds to SnakeTier entity in spec
 */
export interface SnakeTier {
  tierId: 1 | 2 | 3;
  name: string;
  phonemes: string[];
  description: string;
  unlockedAt: number; // XP threshold to unlock
  minLevel?: number; // Minimum XP before unlocking (default 0)
}

/**
 * User Progress in Snake game
 * Corresponds to UserProgress entity in spec
 */
export interface UserProgress {
  userId: string;
  currentTier: 1 | 2 | 3;
  totalXP: number;
  unlockedTiers: number[]; // [1] by default, [1, 2] after 80 XP, [1, 2, 3] after 180 XP
  completedLevels: string[]; // levelIds
  totalGamesPlayed: number;
  createdAt: string;
  lastPlayedAt: string;
}

/**
 * Tier unlock thresholds (FR-010)
 */
export const TIER_UNLOCK_THRESHOLDS = {
  1: 0,    // Always unlocked
  2: 80,   // Unlock Tier 2 at 80 XP
  3: 180,  // Unlock Tier 3 at 180 XP
};

/**
 * Confidence threshold for adaptive progression (FR-022)
 * ≥0.75 = high confidence → advance
 * <0.75 = low confidence → repeat or downgrade
 */
export const PROGRESSION_CONFIDENCE_THRESHOLD = 0.75;

/**
 * Load all levels for a specific tier from Firestore
 * FR-009: Query content_bank filtered by compatibleGames: ['snake'], tier
 * 
 * Snake-compatible phonemes (Tier 1+2 only):
 * - Tier 1: M, N, L, R, W, Y + vowels (A, E, I, O, U)
 * - Tier 2: S, Z, F, V, SH, TH, H
 * - Tier 3: NOT snake-compatible (stops cannot be prolonged)
 */
export async function getSnakeLevelsByTier(tier: 1 | 2 | 3): Promise<SnakeLevel[]> {
  try {
    const contentBankRef = collection(db, 'content_bank');
    const q = query(
      contentBankRef,
      where('compatibleGames', 'array-contains', 'snake'),
      where('tier', '==', tier)
    );
    const snapshot = await getDocs(q);
    
    // Map ContentBankItem → SnakeLevel
    const levels = snapshot.docs.map((doc) => {
      const item = { id: doc.id, ...doc.data() } as ContentBankItem;
      return deriveSnakeLevel(item);
    });

    // Sort by level order (word < phrase < sentence)
    const typeOrder = { word: 0, phrase: 1, sentence: 2 };
    levels.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

    console.log(`[SnakeProgression] Loaded ${levels.length} snake-compatible levels for tier ${tier}`);
    return levels;
  } catch (error) {
    console.error('[SnakeProgression] Error loading levels:', error);
    return [];
  }
}

/**
 * Load a specific level by ID from content_bank
 */
export async function getSnakeLevel(levelId: string): Promise<SnakeLevel | null> {
  try {
    const itemRef = doc(db, 'content_bank', levelId);
    const snapshot = await getDoc(itemRef);
    
    if (!snapshot.exists()) {
      console.warn('[SnakeProgression] Content item not found:', levelId);
      return null;
    }

    const item = { id: snapshot.id, ...snapshot.data() } as ContentBankItem;
    
    // Verify snake compatibility
    if (!item.compatibleGames?.includes('snake')) {
      console.warn('[SnakeProgression] Content item not snake-compatible:', levelId);
      return null;
    }

    return deriveSnakeLevel(item);
  } catch (error) {
    console.error('[SnakeProgression] Error loading level:', error);
    return null;
  }
}

/**
 * Get next level after completing current level
 * Implements adaptive progression based on AI confidence (FR-022)
 * 
 * @param currentLevel - Level just completed
 * @param userProgress - User's current progress
 * @param confidence - AI confidence score (0.0-1.0)
 * @param starsAwarded - Stars from AI analysis (1 or 3)
 * @returns Next level to play, or null if none available
 */
export async function getNextLevel(
  currentLevel: SnakeLevel,
  userProgress: UserProgress,
  confidence?: number,
  starsAwarded?: number
): Promise<SnakeLevel | null> {
  try {
    const levelsInTier = await getSnakeLevelsByTier(currentLevel.tier);
    const typeOrder = { word: 0, phrase: 1, sentence: 2 };
    const currentTypeIndex = typeOrder[currentLevel.type];

    // Determine progression path based on performance
    const highConfidence = confidence !== undefined && confidence >= PROGRESSION_CONFIDENCE_THRESHOLD;
    const success = starsAwarded === 3;

    // Case 1: High confidence + 3 stars → Advance to next level
    if (highConfidence && success) {
      // Try next level in same tier
      const nextInTier = levelsInTier.find(
        (l) => typeOrder[l.type] > currentTypeIndex && !userProgress.completedLevels.includes(l.levelId)
      );

      if (nextInTier) {
        console.log('[SnakeProgression] Advancing to next level:', nextInTier.levelId);
        return nextInTier;
      }

      // Current tier complete - check if next tier is unlocked
      if (currentLevel.tier < 3) {
        const nextTier = (currentLevel.tier + 1) as 1 | 2 | 3;
        const nextTierThreshold = TIER_UNLOCK_THRESHOLDS[nextTier];

        if (userProgress.totalXP >= nextTierThreshold) {
          const nextTierLevels = await getSnakeLevelsByTier(nextTier);
          console.log('[SnakeProgression] Tier complete! Moving to Tier', nextTier);
          return nextTierLevels[0] || null;
        } else {
          console.log(`[SnakeProgression] Tier complete but next tier locked. Need ${nextTierThreshold - userProgress.totalXP} more XP.`);
          return null;
        }
      }

      console.log('[SnakeProgression] All tiers completed!');
      return null;
    }

    // Case 2: Low confidence or failure → Repeat similar difficulty
    if (!highConfidence || !success) {
      // Find another level at same tier/type that hasn't been completed recently
      const similarLevels = levelsInTier.filter(
        (l) => l.type === currentLevel.type && l.levelId !== currentLevel.levelId
      );

      if (similarLevels.length > 0) {
        // Pick random similar level
        const randomLevel = similarLevels[Math.floor(Math.random() * similarLevels.length)];
        console.log('[SnakeProgression] Low confidence - repeating similar level:', randomLevel.levelId);
        return randomLevel;
      }

      // No similar levels available - repeat current level
      console.log('[SnakeProgression] No similar levels - suggesting retry of current level');
      return currentLevel;
    }

    // Fallback: sequential progression
    const nextInTier = levelsInTier.find(
      (l) => typeOrder[l.type] > currentTypeIndex
    );
    return nextInTier || null;
  } catch (error) {
    console.error('[SnakeProgression] Error getting next level:', error);
    return null;
  }
}

/**
 * Load user's Snake progression
 */
export async function getUserSnakeProgress(userId: string): Promise<UserProgress> {
  try {
    const progressRef = doc(db, 'users', userId, 'progress', 'snake');
    const snapshot = await getDoc(progressRef);

    if (snapshot.exists()) {
      return snapshot.data() as UserProgress;
    }

    // Create initial progress doc
    const initialProgress: UserProgress = {
      userId,
      currentTier: 1,
      totalXP: 0,
      unlockedTiers: [1],
      completedLevels: [],
      totalGamesPlayed: 0,
      createdAt: new Date().toISOString(),
      lastPlayedAt: new Date().toISOString(),
    };

    await setDoc(progressRef, initialProgress);
    console.log('[SnakeProgression] Initialized progress for user:', userId);
    return initialProgress;
  } catch (error) {
    console.error('[SnakeProgression] Error loading progress:', error);
    // Return default progress if load fails
    return {
      userId,
      currentTier: 1,
      totalXP: 0,
      unlockedTiers: [1],
      completedLevels: [],
      totalGamesPlayed: 0,
      createdAt: new Date().toISOString(),
      lastPlayedAt: new Date().toISOString(),
    };
  }
}

/**
 * Save game completion: award XP, track completed level, check tier unlocks
 * Uses Firestore transaction to prevent race conditions on concurrent writes
 * FR-010: Track XP and unlock next tier
 * FR-013: Save attempt logs
 */
export async function saveSnakeProgress(
  userId: string,
  levelId: string,
  starsAwarded: number,
  xpGained: number
): Promise<UserProgress | null> {
  try {
    const progressRef = doc(db, 'users', userId, 'progress', 'snake');
    
    // Use transaction to atomically read and write progress
    const progress = await runTransaction(db, async (transaction) => {
      // Read current progress within transaction
      const snapshot = await transaction.get(progressRef);
      
      let progress: UserProgress;
      if (snapshot.exists()) {
        progress = snapshot.data() as UserProgress;
      } else {
        // Create initial progress if doesn't exist
        progress = {
          userId,
          currentTier: 1,
          totalXP: 0,
          unlockedTiers: [1],
          completedLevels: [],
          totalGamesPlayed: 0,
          createdAt: new Date().toISOString(),
          lastPlayedAt: new Date().toISOString(),
        };
      }

      // Modify within transaction
      const previousXP = progress.totalXP;
      progress.totalXP += xpGained;

      // Track completed level
      if (!progress.completedLevels.includes(levelId)) {
        progress.completedLevels.push(levelId);
      }

      // Increment games played
      progress.totalGamesPlayed += 1;

      // Check for tier unlocks
      const previousUnlockedTiers = progress.unlockedTiers;
      const newUnlockedTiers = [1];

      if (progress.totalXP >= TIER_UNLOCK_THRESHOLDS[2]) {
        newUnlockedTiers.push(2);
      }
      if (progress.totalXP >= TIER_UNLOCK_THRESHOLDS[3]) {
        newUnlockedTiers.push(3);
      }

      progress.unlockedTiers = newUnlockedTiers;

      // Update current tier (highest unlocked)
      progress.currentTier = Math.max(...newUnlockedTiers) as 1 | 2 | 3;
      progress.lastPlayedAt = new Date().toISOString();

      // Write within transaction (atomic)
      transaction.set(progressRef, {
        userId: progress.userId,
        totalXP: progress.totalXP,
        unlockedTiers: progress.unlockedTiers,
        currentTier: progress.currentTier,
        completedLevels: progress.completedLevels,
        totalGamesPlayed: progress.totalGamesPlayed,
        lastPlayedAt: progress.lastPlayedAt,
        createdAt: progress.createdAt,
      });

      // Log tier unlock
      const tierUnlocked = newUnlockedTiers.filter(
        (t) => !previousUnlockedTiers.includes(t)
      );
      if (tierUnlocked.length > 0) {
        console.log(`[SnakeProgression] 🎉 Tier ${tierUnlocked} unlocked! XP: ${previousXP} → ${progress.totalXP}`);
      } else {
        console.log(`[SnakeProgression] XP: ${previousXP} → ${progress.totalXP}`);
      }

      return progress;
    });

    return progress;
  } catch (error) {
    console.error('[SnakeProgression] Error saving progress:', error);
    return null;
  }
}

/**
 * Get instruction text for a level
 * FR-011: Display appropriate instruction based on tier and phoneme type
 * 
 * Tier 1 (Vowels/Glides): Simple prolongation - "Say /a/ smoothly"
 * Tier 2 (Fricatives): Emphasize friction/hissing - "Say /s/ like a snake"
 * Tier 3 (Stops): Prolong vowel AFTER stop - "Say /b/-aaa (hold the vowel)"
 * 
 * Related: FR-011, US2 Acceptance Scenario 3
 */
export function getInstructionText(level: SnakeLevel): string {
  if (level.instruction) {
    return level.instruction;
  }

  const phoneme = level.targetPhonemes?.[0] || 'sound';
  const displayPhoneme = phoneme.toUpperCase();

  switch (level.tier) {
    case 1: {
      // Tier 1: Vowels/Glides (A, E, I, O, U, Y)
      // Instruction: Smooth, continuous prolongation
      const vowelInstructions: { [key: string]: string } = {
        A: 'Say "AAAA" smoothly - like a yawn',
        E: 'Say "EEEE" smoothly - like a whistle',
        I: 'Say "IIII" smoothly - like a smile',
        O: 'Say "OOOO" smoothly - like surprise',
        U: 'Say "UUUU" smoothly - like a hoot',
        Y: 'Say "YEEEE" smoothly - like a slide',
      };
      return vowelInstructions[displayPhoneme] || `Say "${displayPhoneme}" smoothly`;
    }

    case 2: {
      // Tier 2: Fricatives (S, Z, SH, TH, F, V)
      // Instruction: Emphasize friction/hissing, like a snake
      const fricativeInstructions: { [key: string]: string } = {
        S: 'Say "SSSSS" like a snake - feel the air flow',
        Z: 'Say "ZZZZZ" like a buzz - feel the vibration',
        SH: 'Say "SHHH" like shushing - soft and smooth',
        TH: 'Say "THHH" - put your tongue between your teeth',
        F: 'Say "FFFF" - put your bottom lip under your top teeth',
        V: 'Say "VVVV" - like "F" but with voice',
      };
      return fricativeInstructions[displayPhoneme] || `Say "${displayPhoneme}" like a snake - hold it smooth`;
    }

    case 3: {
      // Tier 3: Stops (P, B, T, D, K, G)
      // Instruction: Prolong the vowel AFTER the stop consonant
      const stopInstructions: { [key: string]: string } = {
        P: 'Say "P-AAAAAA" - hold the vowel long',
        B: 'Say "B-AAAAAA" - hold the vowel long',
        T: 'Say "T-AAAAAA" - hold the vowel long',
        D: 'Say "D-AAAAAA" - hold the vowel long',
        K: 'Say "K-AAAAAA" - hold the vowel long',
        G: 'Say "G-AAAAAA" - hold the vowel long',
      };
      return stopInstructions[displayPhoneme] || `Say "${displayPhoneme}-AAAAAA" - hold the vowel`;
    }

    default:
      return `Say "${displayPhoneme}" smoothly`;
  }
}

/**
 * Calculate XP reward based on performance
 */
export function calculateXpReward(
  baseXp: number,
  starsAwarded: number,
  completionPercentage: number
): number {
  let multiplier = 1.0;

  // Star bonus
  if (starsAwarded === 3) {
    multiplier += 0.5; // 50% bonus for 3 stars
  } else if (starsAwarded === 2) {
    multiplier += 0.25; // 25% bonus for 2 stars
  }
  // 1 star = no bonus

  // Completion bonus (if applicable)
  if (completionPercentage >= 100) {
    multiplier += 0.1; // 10% bonus for 100% completion
  }

  return Math.round(baseXp * multiplier);
}
