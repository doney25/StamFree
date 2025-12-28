// Backend configuration
// Prefer Expo public env override, then legacy REACT_APP_ fallback, else Cloud Run default.
const BACKEND_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_PUBLIC_REACT_APP_BACKEND_URL ||
  'https://stamfree-api-101158410052.us-central1.run.app';

// Centralized route map for clarity and reuse
export const BACKEND_ROUTES = {
  health: `${BACKEND_BASE_URL}/health`,
  analyzeSnake: `${BACKEND_BASE_URL}/analyze/snake`,
  analyzeTurtle: `${BACKEND_BASE_URL}/analyze/turtle`,
  analyzeBalloon: `${BACKEND_BASE_URL}/analyze/balloon`,
  analyzeOneTap: `${BACKEND_BASE_URL}/analyze/onetap`,
  analyzeAudio: `${BACKEND_BASE_URL}/analyze_audio`,
} as const;

export function getHealthUrl() {
  return BACKEND_ROUTES.health;
}

export function getAnalyzeUrl(kind: 'turtle' | 'snake' | 'balloon' | 'onetap') {
  switch (kind) {
    case 'snake':
      return BACKEND_ROUTES.analyzeSnake;
    case 'turtle':
      return BACKEND_ROUTES.analyzeTurtle;
    case 'balloon':
      return BACKEND_ROUTES.analyzeBalloon;
    case 'onetap':
      return BACKEND_ROUTES.analyzeOneTap;
    default:
      return `${BACKEND_BASE_URL}/analyze/${kind}`;
  }
}

export function getAnalyzeAudioUrl() {
  return BACKEND_ROUTES.analyzeAudio;
}
