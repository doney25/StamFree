export type TurtleResponse = {
  wpm: number;
  game_pass: boolean;
  stutter_detected: boolean;
  block_detected: boolean;
  clinical_pass: boolean;
  confidence: number;
  feedback: string;
};

export type SnakeResponse = {
  duration_sec: number;
  amplitude_sustained: boolean;
  game_pass: boolean;
  repetition_detected: boolean;
  clinical_pass: boolean;
  confidence: number;
  feedback: string;
  phoneme_match?: boolean; // optional backend field indicating match to prompted phoneme
  voiced_detected?: boolean;
  noise_suspected?: boolean;
  pitched_ratio?: number;
  zcr_mean?: number;
  centroid_mean?: number;
  speech_prob?: number;
  breath_noise_prob?: number;
};

export type BalloonResponse = {
  breath_detected: boolean;
  amplitude_onset: number;
  game_pass: boolean;
  hard_attack_detected: boolean;
  clinical_pass: boolean;
  confidence: number;
  feedback: string;
};

export type OneTapResponse = {
  repetition_detected: boolean;
  repetition_prob: number;
  clinical_pass: boolean;
  confidence: number;
  feedback: string;
};

export type UnifiedResult = {
  game_pass: boolean;
  clinical_pass: boolean;
  feedback: string;
  confidence: number;
  metrics: Record<string, number | boolean>;
};

export function normalizeTurtle(res: TurtleResponse): UnifiedResult {
  return {
    game_pass: res.game_pass,
    clinical_pass: res.clinical_pass,
    feedback: res.feedback,
    confidence: res.confidence,
    metrics: {
      wpm: res.wpm,
      stutter_detected: res.stutter_detected,
      block_detected: res.block_detected,
    },
  };
}

export function normalizeSnake(res: SnakeResponse): UnifiedResult {
  return {
    game_pass: res.game_pass,
    clinical_pass: res.clinical_pass,
    feedback: res.feedback,
    confidence: res.confidence,
    metrics: {
      duration_sec: res.duration_sec,
      amplitude_sustained: res.amplitude_sustained,
      repetition_detected: res.repetition_detected,
      ...(typeof res.phoneme_match === 'boolean' ? { phoneme_match: res.phoneme_match } : {}),
      ...(typeof res.voiced_detected === 'boolean' ? { voiced_detected: res.voiced_detected } : {}),
      ...(typeof res.noise_suspected === 'boolean' ? { noise_suspected: res.noise_suspected } : {}),
      ...(typeof res.pitched_ratio === 'number' ? { pitched_ratio: res.pitched_ratio } : {}),
      ...(typeof res.zcr_mean === 'number' ? { zcr_mean: res.zcr_mean } : {}),
      ...(typeof res.centroid_mean === 'number' ? { centroid_mean: res.centroid_mean } : {}),
      ...(typeof res.speech_prob === 'number' ? { speech_prob: res.speech_prob } : {}),
      ...(typeof res.breath_noise_prob === 'number' ? { breath_noise_prob: res.breath_noise_prob } : {}),
    },
  };
}

export function normalizeBalloon(res: BalloonResponse): UnifiedResult {
  return {
    game_pass: res.game_pass,
    clinical_pass: res.clinical_pass,
    feedback: res.feedback,
    confidence: res.confidence,
    metrics: {
      breath_detected: res.breath_detected,
      amplitude_onset: res.amplitude_onset,
      hard_attack_detected: res.hard_attack_detected,
    },
  };
}

export function normalizeOneTap(res: OneTapResponse): UnifiedResult {
  return {
    game_pass: true, // AI-only; no game logic
    clinical_pass: res.clinical_pass,
    feedback: res.feedback,
    confidence: res.confidence,
    metrics: {
      repetition_detected: res.repetition_detected,
      repetition_prob: res.repetition_prob,
    },
  };
}
