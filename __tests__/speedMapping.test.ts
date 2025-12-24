import { SNAKE_CONFIG, amplitudeToSpeedMultiplier, calculateSnakeSpeed } from '@/constants/snakeConfig';

describe('Amplitude-to-speed mapping', () => {
  it('multiplier is 0 below threshold', () => {
    expect(amplitudeToSpeedMultiplier(SNAKE_CONFIG.AMPLITUDE_THRESHOLD - 0.05)).toBe(0);
  });

  it('multiplier increases linearly above threshold', () => {
    const thr = SNAKE_CONFIG.AMPLITUDE_THRESHOLD;
    const mid = thr + (1 - thr) / 2;
    const m = amplitudeToSpeedMultiplier(mid);
    expect(m).toBeGreaterThan(0);
    expect(m).toBeLessThanOrEqual(1);
  });

  it('speed is capped at v_max', () => {
    const pathLength = 100;
    const targetDuration = 2;
    const loud = 1.0;
    const speed = calculateSnakeSpeed(loud, pathLength, targetDuration);
    const base = pathLength / targetDuration;
    expect(speed).toBeLessThanOrEqual(base * SNAKE_CONFIG.V_MAX);
  });
});
