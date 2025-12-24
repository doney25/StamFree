/**
 * Confetti Animation Component
 * 
 * Displays celebratory confetti when user completes a level successfully.
 * Uses react-native-reanimated for smooth 60 FPS animation.
 * 
 * Related: FR-016, NFR-005
 * Task: T024
 */

import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Confetti piece count
const CONFETTI_COUNT = 30;

// Colors for confetti pieces
const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];

interface ConfettiPiece {
  id: number;
  startX: number;
  startY: number;
  delay: number;
  duration: number;
  color: string;
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
    // Fall animation
    translateY.value = withDelay(
      piece.delay,
      withTiming(SCREEN_HEIGHT + 100, {
        duration: piece.duration,
        easing: Easing.in(Easing.ease),
      })
    );

    // Horizontal drift
    const driftAmount = (Math.random() - 0.5) * 100;
    translateX.value = withDelay(
      piece.delay,
      withTiming(driftAmount, {
        duration: piece.duration,
        easing: Easing.linear,
      })
    );

    // Fade out
    opacity.value = withDelay(
      piece.delay + piece.duration * 0.7,
      withTiming(0, {
        duration: piece.duration * 0.3,
        easing: Easing.in(Easing.ease),
      },
      () => {
        if (onComplete) {
          runOnJS(onComplete)();
        }
      })
    );

    // Rotation
    rotation.value = withDelay(
      piece.delay,
      withTiming(Math.random() * 720 - 360, {
        duration: piece.duration,
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
        },
        animatedStyle,
      ]}
    />
  );
};

export const ConfettiAnimation: React.FC<ConfettiAnimationProps> = ({
  onComplete,
  duration = 3000,
}) => {
  const [confetti, setConfetti] = React.useState<ConfettiPiece[]>([]);
  const completedCount = React.useRef(0);

  useEffect(() => {
    // Generate confetti pieces
    const pieces = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      id: i,
      startX: Math.random() * SCREEN_WIDTH,
      startY: -50,
      delay: Math.random() * 200, // Stagger start times
      duration: duration,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    setConfetti(pieces);
  }, [duration]);

  const handlePieceComplete = React.useCallback(() => {
    completedCount.current += 1;
    if (completedCount.current === CONFETTI_COUNT && onComplete) {
      onComplete();
    }
  }, [onComplete]);

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
  },
  confettiPiece: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
