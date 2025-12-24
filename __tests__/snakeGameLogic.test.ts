/**
 * Snake Game Logic Tests
 * 
 * Unit tests for snakeGameLogic pure functions
 * Related: T019, T020, T055-T058
 */

import { SNAKE_CONFIG } from '@/constants/snakeConfig';
import {
    calculateNewPosition,
    getCompletionPercentage,
    isSilent,
    shouldHaltMovement,
} from '@/services/snakeGameLogic';

describe('snakeGameLogic', () => {
  describe('calculateNewPosition', () => {
    it('returns 0 when deltaTime is 0', () => {
      const newPos = calculateNewPosition(0, 0.5, 100, 2, 0);
      expect(newPos).toBe(0);
    });

    it('increments position when amplitude is above threshold', () => {
      const newPos = calculateNewPosition(50, 0.5, 100, 2, 0.1);
      expect(newPos).toBeGreaterThan(50);
    });

    it('does not exceed pathLength', () => {
      const newPos = calculateNewPosition(95, 1.0, 100, 2, 0.1);
      expect(newPos).toBeLessThanOrEqual(100);
    });

    it('stays at same position when amplitude is below threshold', () => {
      const newPos = calculateNewPosition(50, 0.05, 100, 2, 0.1);
      expect(newPos).toBeLessThanOrEqual(50);
    });

    it('calculates correct position for typical scenario', () => {
      // Tier 1 word: 2 second duration, amplitude 0.5, 0.1 seconds elapsed
      const newPos = calculateNewPosition(0, 0.5, 100, 2, 0.1);
      expect(newPos).toBeGreaterThan(0);
      expect(newPos).toBeLessThanOrEqual(100);
    });
  });

  describe('getCompletionPercentage', () => {
    it('returns 0 when position is 0', () => {
      const percent = getCompletionPercentage(0, 100);
      expect(percent).toBe(0);
    });

    it('returns 100 when position equals pathLength', () => {
      const percent = getCompletionPercentage(100, 100);
      expect(percent).toBe(100);
    });

    it('returns proportional percentage', () => {
      const percent = getCompletionPercentage(50, 100);
      expect(percent).toBe(50);
    });

    it('clamps to 100 when position exceeds pathLength', () => {
      const percent = getCompletionPercentage(110, 100);
      expect(percent).toBe(100);
    });
  });

  describe('SNAKE_CONFIG constants', () => {
    it('has valid amplitude threshold', () => {
      expect(SNAKE_CONFIG.AMPLITUDE_THRESHOLD).toBeGreaterThan(0);
      expect(SNAKE_CONFIG.AMPLITUDE_THRESHOLD).toBeLessThan(0.5);
    });

    it('has valid silence grace period', () => {
      expect(SNAKE_CONFIG.SILENCE_GRACE_PERIOD).toBeGreaterThan(0);
      expect(SNAKE_CONFIG.SILENCE_GRACE_PERIOD).toBeLessThan(1);
    });

    it('has valid V_MAX', () => {
      expect(SNAKE_CONFIG.V_MAX).toBeGreaterThan(0);
    });

    it('has valid FPS target', () => {
      expect(SNAKE_CONFIG.TARGET_FPS).toBeGreaterThan(0);
      expect(SNAKE_CONFIG.TARGET_FPS).toBeLessThanOrEqual(120);
    });

    it('has valid sleep overlay delay', () => {
      expect(SNAKE_CONFIG.SLEEP_OVERLAY_DELAY).toBeGreaterThan(SNAKE_CONFIG.SILENCE_GRACE_PERIOD);
      expect(SNAKE_CONFIG.SLEEP_OVERLAY_DELAY).toBeLessThan(5);
    });
  });

  describe('silence detection', () => {
    it('isSilent true below threshold', () => {
      expect(isSilent(SNAKE_CONFIG.AMPLITUDE_THRESHOLD - 0.05)).toBe(true);
    });

    it('isSilent false above threshold', () => {
      expect(isSilent(SNAKE_CONFIG.AMPLITUDE_THRESHOLD + 0.05)).toBe(false);
    });

    it('shouldHaltMovement true after grace period', () => {
      expect(shouldHaltMovement(SNAKE_CONFIG.SILENCE_GRACE_PERIOD + 0.01)).toBe(true);
    });

    it('shouldHaltMovement false within grace period', () => {
      expect(shouldHaltMovement(SNAKE_CONFIG.SILENCE_GRACE_PERIOD - 0.01)).toBe(false);
    });
  });
});
