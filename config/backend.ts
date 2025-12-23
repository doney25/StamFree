// Backend configuration for render.com hosted Flask server
// Override REACT_APP_BACKEND_URL in env if needed for development
const BACKEND_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://stamfree-api.onrender.com';

export function getHealthUrl() {
  return `${BACKEND_BASE_URL}/health`;
}

export function getAnalyzeUrl(kind: 'turtle' | 'snake' | 'balloon' | 'onetap') {
  return `${BACKEND_BASE_URL}/analyze/${kind}`;
}
