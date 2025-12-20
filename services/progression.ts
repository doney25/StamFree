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
  level: 'word' | 'phrase' | 'sentence' = 'word'
): { didSucceed: boolean; rawScore: number } {
  const tierConfig = rules?.tiers?.[tier]?.[level] ?? {};
  switch (game) {
    case 'turtle': {
      const wpm = (metrics as TurtleMetrics).wpm;
      const target = tierConfig.targetWPM ?? defaults.turtle.targetWPM;
      const tol = tierConfig.tolerance ?? defaults.turtle.tolerance;
      const rangeMin = target - tol;
      const rangeMax = target + tol;
      const didSucceed = wpm >= rangeMin && wpm <= rangeMax;
      return { didSucceed, rawScore: wpm };
    }
    case 'snake': {
      const duration = (metrics as SnakeMetrics).duration_sec;
      const minDur = tierConfig.minDurationSec ?? defaults.snake.minDurationSec;
      const didSucceed = duration >= minDur;
      return { didSucceed, rawScore: duration };
    }
    case 'balloon': {
      const amp = (metrics as BalloonMetrics).amplitude_start;
      const maxAmp = tierConfig.maxAmplitudeStart ?? defaults.balloon.maxAmplitudeStart;
      const didSucceed = amp <= maxAmp;
      return { didSucceed, rawScore: amp };
    }
    case 'onetap': {
      const p = (metrics as OneTapMetrics).repetition_prob;
      const maxP = tierConfig.maxRepetitionProb ?? defaults.onetap.maxRepetitionProb;
      const didSucceed = p < maxP;
      return { didSucceed, rawScore: p };
    }
    default:
      return { didSucceed: false, rawScore: 0 };
  }
}
