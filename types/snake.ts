// Shared Snake Sound Trail types (consolidated for UI, services, and hooks)

// --------------------------------------------------------
// 1. Level Configuration (content_bank / levels)
// --------------------------------------------------------
export interface ContentBankItem {
  id: string;
  text: string;
  phoneme: string;
  phonemeCode: string;
  tier: 1 | 2 | 3;
  type: 'word' | 'phrase' | 'sentence';
  syllables: number;
  compatibleGames: ('snake' | 'turtle' | 'balloon' | 'onetap')[];
  ipa?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SnakeLevel {
  levelId: string; // e.g., "tier1_level1_word"
  tier: 1 | 2 | 3;
  type: 'word' | 'phrase' | 'sentence';
  contentExample: string; // display text, e.g., "Moon"
  targetPhonemes: string[];
  targetDurationSec: number;
  xpReward: number; // base XP (e.g., 10)
  allowPauses: boolean;
  maxPauseDuration?: number; // optional for configs that include it
}

// --------------------------------------------------------
// 2. User Progress (users/{uid}/snake_progress)
// --------------------------------------------------------
export interface UserSnakeProgress {
  userId: string;
  totalXP: number;
  currentTier: 1 | 2 | 3;
  completedLevels: string[];
  lastLevelAttempted?: string;
  lastStarsAwarded?: 1 | 2 | 3;
  updatedAt: Date | any; // Firestore Timestamp or Date
  lastAnalysis?: {
    confidence: number; // 0.0 - 1.0
    phonemeMatch: boolean;
  };
}

// --------------------------------------------------------
// 3. Game Runtime Metrics (Engine → Brain)
// --------------------------------------------------------
export interface GameMetrics {
  durationAchieved: number;
  targetDuration: number;
  completionPercentage: number; // 0 - 100
  pauseCount: number;
  totalPauseDuration: number;
}

// --------------------------------------------------------
// 4. AI Analysis Results (Flask / Offline)
// --------------------------------------------------------
export interface AnalysisResult {
  stars: 1 | 3;
  feedback: string;
  metrics: {
    phoneme_match: boolean; // explicit boolean required by spec and logging
    confidence: number; // 0.0 - 1.0
    smoothness_score?: number;
  };
}

// --------------------------------------------------------
// 5. Offline Queue (AsyncStorage)
// --------------------------------------------------------
export interface OfflineAttempt {
  id: string; // uuid
  audioUri: string;
  metrics: GameMetrics;
  targetPhoneme: string;
  retryCount: number;
  createdAt: number; // Date.now()
  expiresAt: number;
}

// --------------------------------------------------------
// 6. Session Return Object (Hook result)
// --------------------------------------------------------
export interface SessionCompletionResult {
  optimisticStars: 1 | 2 | 3;
  analysisPromise: Promise<{
    aiResult: AnalysisResult | null;
    xp: number;
    nextLevel: SnakeLevel | null;
  } | null>;
}

// --------------------------------------------------------
// Legacy / supplemental types (kept for compatibility)
// --------------------------------------------------------
export type StutterType = 'Fluent' | 'Repetition' | 'Block' | 'Prolongation';

export interface SnakeAttempt {
  attemptId: string;
  userId: string;
  levelId: string;
  tier: 1 | 2 | 3;
  type: 'word' | 'phrase' | 'sentence';
  createdAt: Date | null;
  gameMetrics: GameMetrics;
  aiResult: AnalysisResult;
  outcome: 'success' | 'timeout';
  starsAwarded: 1 | 3;
  xpEarned: number;
}

export interface UserProgress {
  userId: string;
  currentTier: 1 | 2 | 3;
  totalXP: number;
  tier1Completed?: boolean;
  tier2Completed?: boolean;
  totalGamesPlayed: number;
  lastPlayedAt?: Date | null;
}
