export type GameId = 'turtle' | 'snake' | 'balloon' | 'onetap';

export type TurtleMetrics = { wpm: number };
export type SnakeMetrics = { duration_sec: number };
export type BalloonMetrics = { amplitude_start: number; soft_onset?: boolean };
export type OneTapMetrics = { repetition_prob: number };

export type Metrics = TurtleMetrics | SnakeMetrics | BalloonMetrics | OneTapMetrics;

export type RuleTierLevel = {
  targetWPM?: number;
  tolerance?: number;
  minDurationSec?: number;
  maxAmplitudeStart?: number;
  passRatio?: number;
  maxRepetitionProb?: number; // onetap
};

export type GameRules = {
  gameId: GameId;
  tiers: Record<string, {
    word?: RuleTierLevel;
    phrase?: RuleTierLevel;
    sentence?: RuleTierLevel;
  }>;
};

const defaults = {
  turtle: { targetWPM: 100, tolerance: 20 },
  snake: { minDurationSec: 1.5 },
  balloon: { maxAmplitudeStart: 0.3 },
  onetap: { maxRepetitionProb: 0.2 },
};

export function computeHitMiss(
  game: GameId,
  metrics: Metrics,
  rules?: GameRules,
  tier: string = '1',
  level: 'word' | 'phrase' | 'sentence' = 'word',
  game_pass?: boolean,
  clinical_pass?: boolean
): { didSucceed: boolean; rawScore: number } {
  const tierConfig = rules?.tiers?.[tier]?.[level] ?? {};
  switch (game) {
    case 'turtle': {
      // Prefer combined pass flags if provided
      if (typeof game_pass === 'boolean' && typeof clinical_pass === 'boolean') {
        const didSucceed = game_pass && clinical_pass;
        const wpmCombined = (metrics as TurtleMetrics).wpm ?? 0;
        return { didSucceed, rawScore: wpmCombined };
      }
      const wpm = (metrics as TurtleMetrics).wpm;
      const target = tierConfig.targetWPM ?? defaults.turtle.targetWPM;
      const tol = tierConfig.tolerance ?? defaults.turtle.tolerance;
      const rangeMin = target - tol;
      const rangeMax = target + tol;
      const didSucceed = wpm >= rangeMin && wpm <= rangeMax;
      return { didSucceed, rawScore: wpm };
    }
    case 'snake': {
      if (typeof game_pass === 'boolean' && typeof clinical_pass === 'boolean') {
        const didSucceed = game_pass && clinical_pass;
        const durationCombined = (metrics as SnakeMetrics).duration_sec ?? 0;
        return { didSucceed, rawScore: durationCombined };
      }
      const duration = (metrics as SnakeMetrics).duration_sec;
      const minDur = tierConfig.minDurationSec ?? defaults.snake.minDurationSec;
      const didSucceed = duration >= minDur;
      return { didSucceed, rawScore: duration };
    }
    case 'balloon': {
      if (typeof game_pass === 'boolean' && typeof clinical_pass === 'boolean') {
        const didSucceed = game_pass && clinical_pass;
        const onsetAmp = (metrics as BalloonMetrics).amplitude_start ?? 0;
        return { didSucceed, rawScore: onsetAmp };
      }
      const amp = (metrics as BalloonMetrics).amplitude_start;
      const maxAmp = tierConfig.maxAmplitudeStart ?? defaults.balloon.maxAmplitudeStart;
      const didSucceed = amp <= maxAmp;
      return { didSucceed, rawScore: amp };
    }
    case 'onetap': {
      // One-Tap: clinical_pass only if provided
      if (typeof clinical_pass === 'boolean') {
        const p = (metrics as OneTapMetrics).repetition_prob ?? 0;
        return { didSucceed: clinical_pass, rawScore: p };
      }
      const p = (metrics as OneTapMetrics).repetition_prob;
      const maxP = tierConfig.maxRepetitionProb ?? defaults.onetap.maxRepetitionProb;
      const didSucceed = p < maxP;
      return { didSucceed, rawScore: p };
    }
    default:
      return { didSucceed: false, rawScore: 0 };
  }
}
