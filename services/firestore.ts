import { db } from '@/config/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';

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
