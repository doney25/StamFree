/**
 * Confetti Animation Component
 * 
 * Displays celebratory confetti when user completes a level successfully.
 * Uses react-native-reanimated for smooth 60 FPS animation.
 * Detects device frame rate and reduces animation complexity on low-end devices.
 * 
 * Related: FR-016, NFR-005, US4
 * Task: T030
 */

import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Confetti piece count (adjusted based on device performance)
const CONFETTI_COUNT_HIGH = 30;
const CONFETTI_COUNT_LOW = 15;
const FPS_THRESHOLD = 50; // Below this, reduce animation complexity

// Colors for confetti pieces
const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];

interface ConfettiPiece {
  id: number;
  startX: number;
  startY: number;
  delay: number;
  color: string;
  side: 'left' | 'right';
  shootHeight: number;
  shootDuration: number;
  fallDuration: number;
}

export interface ConfettiAnimationProps {
  /** Called when animation completes */
  onComplete?: () => void;
  /** Duration of animation in milliseconds */
  duration?: number;
}

const AnimatedConfettiPiece: React.FC<{
  piece: ConfettiPiece;
  onComplete?: () => void;
}> = ({ piece, onComplete }) => {
  // Animated values
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotation = useSharedValue(0);

  useEffect(() => {
    // Two-phase vertical motion: shoot up, then fall
    translateY.value = withDelay(
      piece.delay,
      withTiming(-piece.shootHeight, {
        duration: piece.shootDuration,
        easing: Easing.out(Easing.cubic),
      }, () => {
        translateY.value = withTiming(piece.shootHeight + 140, {
          duration: piece.fallDuration,
          easing: Easing.in(Easing.cubic),
        });
      })
    );

    // Horizontal drift (left cannon drifts right, right cannon drifts left)
    const driftMagnitude = Math.random() * 140 + 60;
    const driftAmount = piece.side === 'left' ? driftMagnitude : -driftMagnitude;
    translateX.value = withDelay(
      piece.delay,
      withTiming(driftAmount, {
        duration: piece.shootDuration + piece.fallDuration,
        easing: Easing.linear,
      })
    );

    // Fade out near end of fall
    opacity.value = withDelay(
      piece.delay + piece.shootDuration + piece.fallDuration * 0.7,
      withTiming(0, {
        duration: piece.fallDuration * 0.3,
        easing: Easing.in(Easing.ease),
      }, () => {
        if (onComplete) {
          runOnJS(onComplete)();
        }
      })
    );

    // Rotation across full flight
    rotation.value = withDelay(
      piece.delay,
      withTiming(Math.random() * 720 - 360, {
        duration: piece.shootDuration + piece.fallDuration,
        easing: Easing.linear,
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { translateX: translateX.value },
        { rotate: `${rotation.value}deg` },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        {
          backgroundColor: piece.color,
          left: piece.startX,
          top: piece.startY,
        },
        animatedStyle,
      ]}
    />
  );
};

export const ConfettiAnimation: React.FC<ConfettiAnimationProps> = ({
  onComplete,
  duration = 3500,
}) => {
  const [confetti, setConfetti] = React.useState<ConfettiPiece[]>([]);
  const [confettiCount, setConfettiCount] = useState(CONFETTI_COUNT_HIGH);
  const completedCount = React.useRef(0);
  const fpsFrames = useSharedValue(0);
  const fpsStartTime = useSharedValue(0);

  // FPS detection - measure for first 1 second
  useFrameCallback((frameInfo) => {
    'worklet';
    if (fpsStartTime.value === 0) {
      fpsStartTime.value = frameInfo.timestamp;
    }
    
    const elapsed = (frameInfo.timestamp - fpsStartTime.value) / 1000;
    if (elapsed < 1.0) {
      fpsFrames.value += 1;
    } else if (elapsed >= 1.0 && fpsFrames.value > 0) {
      const measuredFps = fpsFrames.value / elapsed;
      if (measuredFps < FPS_THRESHOLD) {
        runOnJS(setConfettiCount)(CONFETTI_COUNT_LOW);
      }
      // Stop measuring after first check
      fpsFrames.value = 0;
      fpsStartTime.value = -1;
    }
  }, true);

  useEffect(() => {
    // Generate confetti pieces (count adjusted based on performance)
    const pieces = Array.from({ length: confettiCount }, (_, i) => {
      const side: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right';
      const launchBand = SCREEN_WIDTH * 0.2;
      const startX = side === 'left'
        ? Math.random() * launchBand + 12
        : SCREEN_WIDTH - (Math.random() * launchBand + 12);
      const startY = SCREEN_HEIGHT - 60;
      const shootDuration = 300 + Math.random() * 300; // 300-600ms
      const fallDuration = 900 + Math.random() * 600; // 900-1500ms
      const shootHeight = 220 + Math.random() * 180; // 220-400px
      return {
        id: i,
        startX,
        startY,
        delay: Math.random() * 200,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        side,
        shootHeight,
        shootDuration,
        fallDuration,
      } as ConfettiPiece;
    });
    setConfetti(pieces);
    completedCount.current = 0; // Reset on confettiCount change
  }, [duration, confettiCount]);

  const handlePieceComplete = React.useCallback(() => {
    completedCount.current += 1;
    if (completedCount.current === confettiCount && onComplete) {
      onComplete();
    }
  }, [onComplete, confettiCount]);

  return (
    <View style={styles.container} pointerEvents="none">
      {confetti.map((piece) => (
        <AnimatedConfettiPiece
          key={piece.id}
          piece={piece}
          onComplete={handlePieceComplete}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 999,
    elevation: 999,
  },
  confettiPiece: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
