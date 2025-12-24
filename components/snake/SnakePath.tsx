/**
 * Snake Path Component
 * 
 * Renders the winding S-shaped SVG path with animated snake avatar.
 * Supports background layer, position-based avatar placement, and wiggle animation.
 * 
 * Related: FR-001, FR-003, FR-015, FR-018
 * Tasks: T016, T037, T053
 */

import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedProps,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Animation constants
const WIGGLE_DURATION = 300; // ms per wiggle cycle
const WIGGLE_AMPLITUDE = 3; // pixels
const SNAKE_SIZE = 32;
const PATH_STROKE_WIDTH = 40;
const APPLE_SIZE = 36;
const APPLE_EAT_DURATION = 400; // ms for eating animation
const STAR_BURST_DURATION = 600; // ms for star burst animation

export interface SnakePathProps {
  /** Snake position along path (0-1) */
  position: number;
  /** Whether snake is actively moving */
  isMoving: boolean;
  /** Whether to show sleep overlay (Zzz) */
  showSleepOverlay?: boolean;
  /** Path length in units */
  pathLength: number;
  /** Optional background layer elements */
  showBackground?: boolean;
  /** Whether to trigger apple-eating animation (position >= 100%) */
  triggerAppleEat?: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

export const SnakePath: React.FC<SnakePathProps> = ({
  position,
  isMoving,
  showSleepOverlay = false,
  pathLength,
  showBackground = true,
  triggerAppleEat = false,
}) => {
  // Wiggle animation
  const wiggleOffset = useSharedValue(0);
  
  // Apple-eating animation states
  const mouthOpenScale = useSharedValue(1); // Mouth opening effect
  const appleOpacity = useSharedValue(1); // Apple disappearing
  const starOpacity1 = useSharedValue(0); // Star 1 burst
  const starOpacity2 = useSharedValue(0); // Star 2 burst
  const starOpacity3 = useSharedValue(0); // Star 3 burst
  const starScale1 = useSharedValue(1);
  const starScale2 = useSharedValue(1);
  const starScale3 = useSharedValue(1);

  // Trigger apple-eating animation when apple is reached
  React.useEffect(() => {
    if (triggerAppleEat && position >= 0.98) {
      // Mouth opens (scale down the snake to show opening)
      mouthOpenScale.value = withSequence(
        withTiming(0.85, { duration: APPLE_EAT_DURATION / 2, easing: Easing.out(Easing.ease) }),
        withTiming(0.95, { duration: APPLE_EAT_DURATION / 2, easing: Easing.in(Easing.ease) })
      );
      
      // Apple disappears
      appleOpacity.value = withTiming(0, { duration: APPLE_EAT_DURATION });
      
      // Star burst - staggered animation
      starOpacity1.value = withSequence(
        withTiming(1, { duration: 100 }),
        withRepeat(
          withSequence(
            withTiming(0.7, { duration: 200 }),
            withTiming(0, { duration: 200 })
          ),
          1,
          false
        )
      );
      
      starScale1.value = withSequence(
        withTiming(1.5, { duration: 300, easing: Easing.out(Easing.ease) }),
        withTiming(0.5, { duration: 300, easing: Easing.in(Easing.ease) })
      );
      
      // Star 2 and 3 with slight delays
      setTimeout(() => {
        starOpacity2.value = withSequence(
          withTiming(1, { duration: 100 }),
          withRepeat(
            withSequence(
              withTiming(0.7, { duration: 200 }),
              withTiming(0, { duration: 200 })
            ),
            1,
            false
          )
        );
        
        starScale2.value = withSequence(
          withTiming(1.5, { duration: 300, easing: Easing.out(Easing.ease) }),
          withTiming(0.5, { duration: 300, easing: Easing.in(Easing.ease) })
        );
      }, 100);
      
      setTimeout(() => {
        starOpacity3.value = withSequence(
          withTiming(1, { duration: 100 }),
          withRepeat(
            withSequence(
              withTiming(0.7, { duration: 200 }),
              withTiming(0, { duration: 200 })
            ),
            1,
            false
          )
        );
        
        starScale3.value = withSequence(
          withTiming(1.5, { duration: 300, easing: Easing.out(Easing.ease) }),
          withTiming(0.5, { duration: 300, easing: Easing.in(Easing.ease) })
        );
      }, 200);
    }
  }, [triggerAppleEat, position]);

  // Wiggle animation
  React.useEffect(() => {
    if (isMoving) {
      wiggleOffset.value = withRepeat(
        withSequence(
          withTiming(WIGGLE_AMPLITUDE, { duration: WIGGLE_DURATION / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(-WIGGLE_AMPLITUDE, { duration: WIGGLE_DURATION / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: WIGGLE_DURATION / 2, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // infinite
        false
      );
    } else {
      wiggleOffset.value = withTiming(0, { duration: 200 });
    }
  }, [isMoving]);

  // Generate S-shaped path
  const svgPath = useMemo(() => {
    const startX = SCREEN_WIDTH * 0.15;
    const startY = SCREEN_HEIGHT * 0.2;
    const endX = SCREEN_WIDTH * 0.85;
    const endY = SCREEN_HEIGHT * 0.65;
    
    const controlPoint1X = SCREEN_WIDTH * 0.7;
    const controlPoint1Y = SCREEN_HEIGHT * 0.25;
    const controlPoint2X = SCREEN_WIDTH * 0.3;
    const controlPoint2Y = SCREEN_HEIGHT * 0.6;

    return `M ${startX} ${startY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${endX} ${endY}`;
  }, []);

  // Helper to sample a point on the bezier for any t in [0,1]
  const getPointAt = useMemo(() => {
    const startX = SCREEN_WIDTH * 0.15;
    const startY = SCREEN_HEIGHT * 0.2;
    const endX = SCREEN_WIDTH * 0.85;
    const endY = SCREEN_HEIGHT * 0.65;
    const controlPoint1X = SCREEN_WIDTH * 0.7;
    const controlPoint1Y = SCREEN_HEIGHT * 0.25;
    const controlPoint2X = SCREEN_WIDTH * 0.3;
    const controlPoint2Y = SCREEN_HEIGHT * 0.6;

    return (t: number) => {
      const clamped = Math.max(0, Math.min(1, t));
      const t2 = clamped * clamped;
      const t3 = t2 * clamped;
      const mt = 1 - clamped;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;

      const x = mt3 * startX + 3 * mt2 * clamped * controlPoint1X + 3 * mt * t2 * controlPoint2X + t3 * endX;
      const y = mt3 * startY + 3 * mt2 * clamped * controlPoint1Y + 3 * mt * t2 * controlPoint2Y + t3 * endY;
      return { x, y };
    };
  }, []);

  // Calculate snake position on path
  const snakePosition = useMemo(() => getPointAt(position), [getPointAt, position]);

  // Apple position (at end of path)
  const applePosition = useMemo(() => getPointAt(1), [getPointAt]);

  const bodySegments = useMemo(() => {
    const segments = [] as { x: number; y: number; r: number; opacity: number }[];
    for (let i = 1; i <= 6; i++) {
      const t = position - i * 0.04;
      const point = getPointAt(t);
      segments.push({
        x: point.x,
        y: point.y,
        r: (SNAKE_SIZE / 2) * Math.max(0.6, 1 - i * 0.08),
        opacity: Math.max(0.15, 0.6 - i * 0.08),
      });
    }
    return segments;
  }, [getPointAt, position]);

  // Animated snake props with wiggle and mouth scale
  const animatedSnakeProps = useAnimatedProps(() => {
    return {
      cx: snakePosition.x + wiggleOffset.value,
      cy: snakePosition.y,
      r: (SNAKE_SIZE / 2) * mouthOpenScale.value,
    };
  });

  // Animated apple props (opacity for disappearing effect)
  const animatedAppleProps = useAnimatedProps(() => {
    return {
      opacity: appleOpacity.value,
    };
  });

  // Star burst animations
  const animatedStarProps1 = useAnimatedProps(() => {
    return {
      opacity: starOpacity1.value,
      r: (APPLE_SIZE / 3) * starScale1.value,
    };
  });

  const animatedStarProps2 = useAnimatedProps(() => {
    return {
      opacity: starOpacity2.value,
      r: (APPLE_SIZE / 3) * starScale2.value,
    };
  });

  const animatedStarProps3 = useAnimatedProps(() => {
    return {
      opacity: starOpacity3.value,
      r: (APPLE_SIZE / 3) * starScale3.value,
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
        <Defs>
          {/* Jungle background gradient */}
          <LinearGradient id="jungleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#87CEEB" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#228B22" stopOpacity="0.2" />
          </LinearGradient>
          
          {/* Path gradient */}
          <LinearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#8B4513" stopOpacity="0.6" />
            <Stop offset="100%" stopColor="#CD853F" stopOpacity="0.4" />
          </LinearGradient>
        </Defs>

        {/* Background layer (T053) */}
        {showBackground && (
          <G>
            <Rect width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#jungleGradient)" />
            {/* Simple foliage decoration */}
            <Circle cx={SCREEN_WIDTH * 0.1} cy={SCREEN_HEIGHT * 0.15} r={25} fill="#228B22" opacity={0.3} />
            <Circle cx={SCREEN_WIDTH * 0.9} cy={SCREEN_HEIGHT * 0.75} r={30} fill="#2E8B57" opacity={0.3} />
            <Circle cx={SCREEN_WIDTH * 0.2} cy={SCREEN_HEIGHT * 0.8} r={20} fill="#3CB371" opacity={0.3} />
          </G>
        )}

        {/* Path trail */}
        <Path
          d={svgPath}
          stroke="url(#pathGradient)"
          strokeWidth={PATH_STROKE_WIDTH}
          fill="none"
          strokeLinecap="round"
        />

        {/* Apple target with fade-out animation (FR-016) */}
        <AnimatedG animatedProps={animatedAppleProps}>
          <Circle cx={applePosition.x} cy={applePosition.y} r={APPLE_SIZE / 2} fill="#FF0000" />
          <Circle cx={applePosition.x} cy={applePosition.y} r={APPLE_SIZE / 2.5} fill="#FF6B6B" opacity={0.6} />
          {/* Simple leaf */}
          <Path
            d={`M ${applePosition.x} ${applePosition.y - APPLE_SIZE / 2} Q ${applePosition.x + 5} ${applePosition.y - APPLE_SIZE / 2 - 8}, ${applePosition.x + 10} ${applePosition.y - APPLE_SIZE / 2 - 2}`}
            stroke="#228B22"
            strokeWidth={3}
            fill="none"
          />
        </AnimatedG>

        {/* Star burst animation on apple eat (FR-016) */}
        {/* Star 1 - upper left */}
        <AnimatedCircle
          animatedProps={animatedStarProps1}
          cx={applePosition.x - 25}
          cy={applePosition.y - 25}
          fill="#FFD700"
        />
        
        {/* Star 2 - upper right */}
        <AnimatedCircle
          animatedProps={animatedStarProps2}
          cx={applePosition.x + 25}
          cy={applePosition.y - 25}
          fill="#FFD700"
        />
        
        {/* Star 3 - below */}
        <AnimatedCircle
          animatedProps={animatedStarProps3}
          cx={applePosition.x}
          cy={applePosition.y + 30}
          fill="#FFD700"
        />

        {/* Snake avatar (FR-015 wiggle animation) */}
        <G>
          {/* Body trail */}
          {bodySegments.map((segment, idx) => (
            <Circle
              key={`segment-${idx}`}
              cx={segment.x}
              cy={segment.y}
              r={segment.r}
              fill="#2E8B57"
              opacity={segment.opacity}
            />
          ))}

          {/* Head */}
          <AnimatedCircle
            animatedProps={animatedSnakeProps}
            fill="#32CD32"
            stroke="#0B5A2A"
            strokeWidth={2}
          />
          <AnimatedCircle
            animatedProps={animatedSnakeProps}
            r={SNAKE_SIZE / 3}
            fill="#90EE90"
            opacity={0.7}
          />
          {/* Snake eyes */}
          <Circle cx={snakePosition.x - 6} cy={snakePosition.y - 4} r={3} fill="#000000" />
          <Circle cx={snakePosition.x + 6} cy={snakePosition.y - 4} r={3} fill="#000000" />
          
          {/* Sleep overlay (Zzz) - FR-015 */}
          {showSleepOverlay && (
            <G>
              {/* Zzz text approximation using circles (simplified) */}
              <Circle cx={snakePosition.x + 15} cy={snakePosition.y - 25} r={2} fill="#4B0082" opacity={0.8} />
              <Circle cx={snakePosition.x + 20} cy={snakePosition.y - 30} r={2.5} fill="#4B0082" opacity={0.7} />
              <Circle cx={snakePosition.x + 25} cy={snakePosition.y - 35} r={3} fill="#4B0082" opacity={0.6} />
            </G>
          )}
        </G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FFF0', // Light mint background
  },
});
