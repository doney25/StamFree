/**
 * Snake Visualizer Component
 * 
 * Real-time bar visualizer showing voice amplitude at bottom of screen.
 * Optimized for 60 FPS with color-blind friendly visual cues.
 * 
 * Related: FR-005, NFR-001, NFR-007
 * Tasks: T017, T034, T049
 */

import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedProps,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Visualizer constants
const BAR_COUNT = 20;
const BAR_SPACING = 4;
const BAR_WIDTH = (SCREEN_WIDTH - (BAR_COUNT + 1) * BAR_SPACING) / BAR_COUNT;
const VISUALIZER_HEIGHT = 80;
const MIN_BAR_HEIGHT = 4;
const MAX_BAR_HEIGHT = VISUALIZER_HEIGHT - 10;

// Color-blind friendly colors (T049)
const ACTIVE_COLOR = '#00C853'; // Green (high contrast)
const INACTIVE_COLOR = '#BDBDBD'; // Gray
const THRESHOLD_COLOR = '#FF6F00'; // Orange (warning)

export interface SnakeVisualizerProps {
  /** Current amplitude (0-1) */
  amplitude: number;
  /** Amplitude threshold for movement (default 0.1) */
  threshold?: number;
  /** Whether to show threshold indicator */
  showThreshold?: boolean;
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export const SnakeVisualizer: React.FC<SnakeVisualizerProps> = ({
  amplitude,
  threshold = 0.1,
  showThreshold = true,
}) => {
  // Shared value for amplitude with spring animation (60 FPS optimized)
  const amplitudeValue = useSharedValue(0);

  React.useEffect(() => {
    // Use spring for smooth transitions, optimized for 60 FPS (T034)
    amplitudeValue.value = withSpring(amplitude, {
      damping: 20,
      stiffness: 300,
      mass: 0.5,
    });
  }, [amplitude]);

  // Generate bars with varying heights based on amplitude
  const bars = useMemo(() => {
    return Array.from({ length: BAR_COUNT }, (_, index) => {
      // Create wave-like pattern with center emphasis
      const centerDistance = Math.abs(index - BAR_COUNT / 2) / (BAR_COUNT / 2);
      const heightMultiplier = 1 - centerDistance * 0.5; // Center bars taller
      
      return {
        id: index,
        x: BAR_SPACING + index * (BAR_WIDTH + BAR_SPACING),
        heightMultiplier,
      };
    });
  }, []);

  // Calculate threshold line position
  const thresholdY = VISUALIZER_HEIGHT - (threshold * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT) + MIN_BAR_HEIGHT);

  return (
    <View style={styles.container}>
      <Svg width={SCREEN_WIDTH} height={VISUALIZER_HEIGHT}>
        {/* Render bars */}
        {bars.map((bar) => {
          const AnimatedBar = () => {
            const animatedProps = useAnimatedProps(() => {
              const baseHeight = amplitudeValue.value * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT) * bar.heightMultiplier + MIN_BAR_HEIGHT;
              const barHeight = Math.max(MIN_BAR_HEIGHT, baseHeight);
              const yPosition = VISUALIZER_HEIGHT - barHeight - 5; // 5px padding from bottom
              
              return {
                y: yPosition,
                height: barHeight,
                fill: amplitudeValue.value > threshold ? ACTIVE_COLOR : INACTIVE_COLOR,
              };
            });

            return (
              <AnimatedRect
                x={bar.x}
                animatedProps={animatedProps}
                width={BAR_WIDTH}
                rx={2} // Rounded corners
              />
            );
          };

          return <AnimatedBar key={bar.id} />;
        })}

        {/* Threshold indicator line (color-blind friendly) */}
        {showThreshold && (
          <Rect
            x={0}
            y={thresholdY}
            width={SCREEN_WIDTH}
            height={2}
            fill={THRESHOLD_COLOR}
            opacity={0.6}
          />
        )}
      </Svg>
      
      {/* Background with subtle gradient */}
      <View style={styles.background} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: VISUALIZER_HEIGHT,
    width: SCREEN_WIDTH,
    position: 'absolute',
    bottom: 0,
    left: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    overflow: 'hidden',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F5F5F5',
    zIndex: -1,
  },
});
