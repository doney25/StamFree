import { db } from '@/config/firebaseConfig';
import type {
    AnalysisResult,
    GameMetrics,
    SnakeAttempt,
    SnakeLevel,
    UserProgress,
} from '@/types/snake';
import {
    collection,
    doc,
    runTransaction,
    serverTimestamp,
    setDoc
} from 'firebase/firestore';

export type SessionPayload = {
  uid: string;
  phonemeId: string;
  durationMs: number;
  sentenceId?: string;
  targetPhonemes?: string[];
  level?: number;
  createdAt?: string;
};

export async function saveSession(payload: SessionPayload) {
  const { uid, phonemeId, durationMs} = payload;
  const sessionId = `${Date.now()}`;
  const sessionRef = doc(db, 'users', uid, 'sessions', sessionId);

  await setDoc(sessionRef, {
    phonemeId,
    durationMs,
    sentenceId: payload.sentenceId,
    targetPhonemes: payload.targetPhonemes,
    level: payload.level,
    createdAt: payload.createdAt ?? new Date().toISOString(),
  });

  return { sessionId };
}

export type ExerciseAttemptPayload = {
  uid: string;
  exerciseType: 'turtle' | 'snake' | 'balloon' | 'onetap';
  gamePass: boolean;
  clinicalPass: boolean;
  confidence: number;
  feedback: string;
  metrics: Record<string, number | boolean>;
  createdAt?: string;
};

export async function saveExerciseAttempt(payload: ExerciseAttemptPayload) {
  const { uid, exerciseType } = payload;
  const attemptId = `${Date.now()}`;
  const attemptRef = doc(db, 'users', uid, 'activity_logs', attemptId);

  await setDoc(attemptRef, {
    exerciseType,
    gamePass: payload.gamePass,
    clinicalPass: payload.clinicalPass,
    confidence: payload.confidence,
    feedback: payload.feedback,
    metrics: payload.metrics,
    createdAt: payload.createdAt ?? new Date().toISOString(),
  });

  return { attemptId };
}

type SnakeAttemptInput = {
  userId: string;
  level: SnakeLevel;
  gameMetrics: GameMetrics;
  aiResult: AnalysisResult;
  starsAwarded: 1 | 3;
  xpEarned: number;
};

const defaultUserProgress = (userId: string): UserProgress => ({
  userId,
  currentTier: 1,
  totalXP: 0,
  totalGamesPlayed: 0,
  tier1Completed: false,
  tier2Completed: false,
  lastPlayedAt: null,
});

export async function saveSnakeAttempt(input: SnakeAttemptInput) {
  const { userId, level, gameMetrics, aiResult, starsAwarded, xpEarned } = input;
  const attemptsRef = collection(db, 'user_progress', userId, 'snake_attempts');
  const attemptRef = doc(attemptsRef);

  const outcome: SnakeAttempt['outcome'] =
    gameMetrics.completionPercentage >= 100 ? 'success' : 'timeout';

  const payload: SnakeAttempt = {
    attemptId: attemptRef.id,
    userId,
    levelId: level.levelId,
    tier: level.tier,
    type: level.type,
    createdAt: null,
    gameMetrics,
    aiResult,
    outcome,
    starsAwarded,
    xpEarned,
  };

  await setDoc(attemptRef, {
    ...payload,
    createdAt: serverTimestamp(),
  });

  return attemptRef.id;
}

export async function updateUserSnakeProgressAggregate(
  userId: string,
  xpEarned: number,
  starsAwarded: number,
): Promise<UserProgress> {
  const progressRef = doc(db, 'user_progress', userId);

  return runTransaction(db, async (tx) => {
    const snapshot = await tx.get(progressRef);
    const current = snapshot.exists()
      ? (snapshot.data() as UserProgress)
      : defaultUserProgress(userId);

    const totalXP = current.totalXP + xpEarned;
    const totalGamesPlayed = (current.totalGamesPlayed || 0) + 1;
    const currentTier = totalXP >= 80 ? 2 : current.currentTier || 1;

    const updated: UserProgress = {
      ...current,
      totalXP,
      totalGamesPlayed,
      currentTier,
      tier1Completed: current.tier1Completed ?? false,
      tier2Completed: current.tier2Completed ?? totalXP >= 80,
      lastPlayedAt: null,
    };

    tx.set(
      progressRef,
      {
        ...updated,
        lastPlayedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return updated;
  });
}
