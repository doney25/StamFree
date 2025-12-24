// Backend configuration
// Prefer Expo env override `EXPO_PUBLIC_BACKEND_URL` for local/dev, then REACT_APP_ fallback, else Cloud Run default.
const BACKEND_BASE_URL =
  // process.env.EXPO_PUBLIC_BACKEND_URL ||
  'http://10.227.4.246:5000' 
  // 'https://stamfree-api-101158410052.us-central1.run.app';

export function getHealthUrl() {
  return `${BACKEND_BASE_URL}/health`;
}

export function getAnalyzeUrl(kind: 'turtle' | 'snake' | 'balloon' | 'onetap') {
  return `${BACKEND_BASE_URL}/analyze/${kind}`;
}

export function getAnalyzeAudioUrl() {
  return `${BACKEND_BASE_URL}/analyze_audio`;
}
