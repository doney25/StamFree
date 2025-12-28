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
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Image as SvgImage } from 'react-native-svg';

const snakeHeadImage = require('@/assets/images/snake.png');
const appleImage = require('@/assets/images/apple.png');

const AnimatedSvgImage = Animated.createAnimatedComponent(SvgImage);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Pre-defined smooth letter-shaped paths (normalized 0-100 coordinate system)
const PATH_LIBRARY = [
  "M 80,12 C 20,12 82,44 18,44 C 82,56 18,88 80,88", // S-Shape (more amplitude)
  "M 50,10 C 60,30 40,70 50,90",                     // I-Shape (Wavy vertical)
  "M 80,20 C 12,20 12,82 78,82",                     // C-Shape
  "M 15,10 C 15,100 85,100 85,10",                   // U-Shape
  "M 10,10 C 45,110 55,110 90,10",                   // V-Shape
  "M 25,10 L 25,60 Q 25,90 80,85",                   // L-Shape
  "M 65,12 L 65,55 Q 65,90 40,90 Q 25,90 25,72",     // J-Shape (centered hook)
];
// Path footprint fractions (screen-relative)
const PATH_WIDTH_FRACTION = 0.80;  // 35% of screen width
const PATH_HEIGHT_FRACTION = 0.55; // 55% of screen height
const PATH_OFFSET_X = (SCREEN_WIDTH * (1 - PATH_WIDTH_FRACTION)) / 2;
const PATH_OFFSET_Y = SCREEN_HEIGHT * 0.25; // push down a bit

// Animation constants
const WIGGLE_DURATION = 300; // ms per wiggle cycle
const WIGGLE_AMPLITUDE = 3; // pixels
const WIGGLE_AMPLITUDE_PAUSED = 0.6; // pixels when paused
const SNAKE_SIZE = 30;
const PATH_STROKE_WIDTH = 10;
const APPLE_SIZE = 45;
const APPLE_EAT_DURATION = 400; // ms for eating animation
const STAR_BURST_DURATION = 600; // ms for star burst animation
const HEAD_SHADOW_OPACITY = 0.18;
const TANGENT_DELTA = 0.002;

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
  /** Changes to this key will regenerate the randomized path */
  variationKey?: string | number;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedGHead = Animated.createAnimatedComponent(G);
const AnimatedImage = Animated.createAnimatedComponent(Image);

export const SnakePath: React.FC<SnakePathProps> = ({
  position,
  isMoving,
  showSleepOverlay = false,
  pathLength,
  showBackground = true,
  triggerAppleEat = false,
  variationKey,
}) => {
  // Wiggle animation
  const wiggleOffset = useSharedValue(0);
  
  // Apple-eating animation states
  const mouthOpenScale = useSharedValue(1); // Mouth opening effect
  const appleOpacity = useSharedValue(1); // Apple disappearing
  const applePulse = useSharedValue(1);
  const arrivalGlow = useSharedValue(0);
  const headX = useSharedValue(0);
  const headY = useSharedValue(0);
  const headAngle = useSharedValue(0);
  const starOpacity1 = useSharedValue(0); // Star 1 burst
  const starOpacity2 = useSharedValue(0); // Star 2 burst
  const starOpacity3 = useSharedValue(0); // Star 3 burst
  const starScale1 = useSharedValue(1);
  const starScale2 = useSharedValue(1);
  const starScale3 = useSharedValue(1);

  // Trigger apple-eating animation when apple is reached
  React.useEffect(() => {
    if (triggerAppleEat && position >= 0.98) {
      // Gulp animation - scale up to 1.2 and back to 1.0
      mouthOpenScale.value = withSequence(
        withTiming(1.2, { duration: APPLE_EAT_DURATION / 2, easing: Easing.out(Easing.ease) }),
        withTiming(1.0, { duration: APPLE_EAT_DURATION / 2, easing: Easing.in(Easing.ease) })
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

  React.useEffect(() => {
    if (position > 0.8 && !triggerAppleEat) {
      applePulse.value = withRepeat(withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      applePulse.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) });
    }
    arrivalGlow.value = withTiming(position > 0.9 ? 0.6 : 0, { duration: 220, easing: Easing.out(Easing.ease) });
    
    // Reset apple opacity when not at the end (for retry scenarios)
    if (!triggerAppleEat && position < 0.98) {
      appleOpacity.value = withTiming(1, { duration: 220 });
    }
  }, [position, triggerAppleEat]);

  // Wiggle animation
  React.useEffect(() => {
    const amp = isMoving ? WIGGLE_AMPLITUDE : WIGGLE_AMPLITUDE_PAUSED;
    wiggleOffset.value = withRepeat(
      withSequence(
        withTiming(amp, { duration: WIGGLE_DURATION / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(-amp, { duration: WIGGLE_DURATION / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: WIGGLE_DURATION / 2, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [isMoving]);

  // Select and generate path based on variationKey
  const svgPath = useMemo(() => {
    const seedInput = typeof variationKey === 'number'
      ? variationKey
      : variationKey
      ? Array.from(String(variationKey)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
      : Math.floor(Math.random() * 1e9);

    // Mulberry32 PRNG for better distribution than modulo
    const mulberry32 = (a: number) => {
      return () => {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    };

    const rand = mulberry32(seedInput || 1);
    const pathIndex = Math.floor(rand() * PATH_LIBRARY.length);
    return PATH_LIBRARY[pathIndex];
  }, [variationKey]);

  // Helper to sample a point on the SVG path for any t in [0,1]
  const getPointAt = useMemo(() => {
    // Parse the SVG path to extract cubic bezier control points
    // Our paths follow the format: M x,y C cx1,cy1, cx2,cy2, x2,y2 C cx3,cy3, cx4,cy4, x3,y3 ...
    const parsePath = (pathString: string) => {
      const segments: Array<{type: 'M' | 'C' | 'Q' | 'L', points: number[]}> = [];
      const parts = pathString.trim().split(/\s+/);
      
      let i = 0;
      while (i < parts.length) {
        const cmd = parts[i];
        if (cmd === 'M') {
          const coords = parts[i + 1].split(',').map(Number);
          segments.push({ type: 'M', points: coords });
          i += 2;
        } else if (cmd === 'C') {
          const points: number[] = [];
          for (let j = 0; j < 3; j++) {
            const coords = parts[i + 1 + j].split(',').map(Number);
            points.push(...coords);
          }
          segments.push({ type: 'C', points });
          i += 4;
        } else if (cmd === 'Q') {
          const points: number[] = [];
          for (let j = 0; j < 2; j++) {
            const coords = parts[i + 1 + j].split(',').map(Number);
            points.push(...coords);
          }
          segments.push({ type: 'Q', points });
          i += 3;
        } else if (cmd === 'L') {
          const coords = parts[i + 1].split(',').map(Number);
          segments.push({ type: 'L', points: coords });
          i += 2;
        } else {
          i++;
        }
      }
      return segments;
    };
    
    // Calculate point on cubic bezier curve
    const cubicBezier = (t: number, p0: number, p1: number, p2: number, p3: number) => {
      const mt = 1 - t;
      return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
    };

    const quadraticBezier = (t: number, p0: number, p1: number, p2: number) => {
      const mt = 1 - t;
      return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
    };
    
    const segments = parsePath(svgPath);
    
    return (t: number) => {
      const clamped = Math.max(0, Math.min(1, t));
      
      // Find starting point (M command)
      const startSeg = segments.find(s => s.type === 'M');
      if (!startSeg) return { x: 0, y: 0 };
      
      let currentX = startSeg.points[0];
      let currentY = startSeg.points[1];
      
      // Collect drawable segments (C, Q, L)
      const drawSegments = segments.filter(s => s.type === 'C' || s.type === 'Q' || s.type === 'L');
      if (drawSegments.length === 0) return { x: currentX, y: currentY };

      const segmentIndex = Math.min(
        Math.floor(clamped * drawSegments.length),
        drawSegments.length - 1
      );
      const localT = (clamped * drawSegments.length) - segmentIndex;

      let startX = currentX;
      let startY = currentY;

      for (let i = 0; i <= segmentIndex; i++) {
        const seg = drawSegments[i];
        if (seg.type === 'C') {
          const [cx1, cy1, cx2, cy2, ex, ey] = seg.points;
          if (i < segmentIndex) {
            startX = ex;
            startY = ey;
          } else {
            const x = cubicBezier(localT, startX, cx1, cx2, ex);
            const y = cubicBezier(localT, startY, cy1, cy2, ey);
            const scaleX = SCREEN_WIDTH * PATH_WIDTH_FRACTION;
            const scaleY = SCREEN_HEIGHT * PATH_HEIGHT_FRACTION;
            return {
              x: PATH_OFFSET_X + (x / 100) * scaleX,
              y: PATH_OFFSET_Y + (y / 100) * scaleY,
            };
          }
        } else if (seg.type === 'Q') {
          const [qx, qy, ex, ey] = seg.points;
          if (i < segmentIndex) {
            startX = ex;
            startY = ey;
          } else {
            const x = quadraticBezier(localT, startX, qx, ex);
            const y = quadraticBezier(localT, startY, qy, ey);
            const scaleX = SCREEN_WIDTH * PATH_WIDTH_FRACTION;
            const scaleY = SCREEN_HEIGHT * PATH_HEIGHT_FRACTION;
            return {
              x: PATH_OFFSET_X + (x / 100) * scaleX,
              y: PATH_OFFSET_Y + (y / 100) * scaleY,
            };
          }
        } else if (seg.type === 'L') {
          const [ex, ey] = seg.points;
          if (i < segmentIndex) {
            startX = ex;
            startY = ey;
          } else {
            const x = startX + (ex - startX) * localT;
            const y = startY + (ey - startY) * localT;
            const scaleX = SCREEN_WIDTH * PATH_WIDTH_FRACTION;
            const scaleY = SCREEN_HEIGHT * PATH_HEIGHT_FRACTION;
            return {
              x: PATH_OFFSET_X + (x / 100) * scaleX,
              y: PATH_OFFSET_Y + (y / 100) * scaleY,
            };
          }
        }
      }

      return { x: startX, y: startY };
    };
  }, [svgPath]);

  // Calculate snake position on path
  const snakePosition = useMemo(() => getPointAt(position), [getPointAt, position]);

  // Apple position (at end of path)
  const applePosition = useMemo(() => getPointAt(1), [getPointAt]);

  // Tail start position (at beginning of path)
  const tailPosition = useMemo(() => getPointAt(0), [getPointAt]);

  // Body segments for trailing effect
  const bodySegments = useMemo(() => {
    const segments = [] as { x: number; y: number; r: number; opacity: number }[];
    for (let i = 1; i <= 30; i++) {
      const t = position - i * 0.008;
      const point = getPointAt(t);
      segments.push({
        x: point.x,
        y: point.y,
        r: (SNAKE_SIZE / 2) * Math.max(0.65, 1 - i * 0.015),
        opacity: Math.max(0.2, 0.85 - i * 0.025),
      });
    }
    return segments;
  }, [getPointAt, position]);

  // Head transform (position + slight rotation along tangent)
  React.useEffect(() => {
    headX.value = snakePosition.x;
    headY.value = snakePosition.y;

    const aheadT = Math.min(1, position + TANGENT_DELTA);
    const behindT = Math.max(0, position - TANGENT_DELTA);
    const p1 = getPointAt(behindT);
    const p2 = getPointAt(aheadT);
    const angleRad = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const angleDeg = (angleRad * 180) / Math.PI + 270; // Add 270 degree rotation (90 + 180)
    headAngle.value = withTiming(angleDeg, { duration: 140, easing: Easing.out(Easing.cubic) });
  }, [getPointAt, position, snakePosition.x, snakePosition.y, headX, headY, headAngle]);

  // Animated snake props with wiggle and mouth scale
  const animatedSnakeProps = useAnimatedProps(() => {
    return {
      cx: snakePosition.x + wiggleOffset.value,
      cy: snakePosition.y,
      r: (SNAKE_SIZE / 2) * mouthOpenScale.value,
    };
  });

  const animatedHeadTransform = useAnimatedProps(() => {
    const tx = headX.value + wiggleOffset.value;
    const ty = headY.value;
    const angle = headAngle.value;
    const scale = mouthOpenScale.value;
    return {
      transform: [
        { translateX: tx },
        { translateY: ty },
        { scale: scale },
        { rotate: `${angle}deg` },
      ],
    } as any;
  });

  // Animated style for head image (fixes Reanimated warning)
  const animatedHeadImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: headX.value + wiggleOffset.value - SNAKE_SIZE },
        { translateY: headY.value - SNAKE_SIZE },
        { scale: mouthOpenScale.value },
        { rotate: `${headAngle.value}deg` },
      ],
    };
  });

  // Animated apple opacity for image
  const animatedAppleImageStyle = useAnimatedStyle(() => {
    return {
      opacity: appleOpacity.value,
      transform: [
        { translateX: applePosition.x - APPLE_SIZE / 2 },
        { translateY: applePosition.y - APPLE_SIZE / 2 },
        { scale: applePulse.value },
      ],
    };
  });

  // Animated apple props (opacity for disappearing effect)
  const animatedAppleProps = useAnimatedProps(() => {
    return {
      opacity: appleOpacity.value,
    };
  });

  const animatedAppleGlowProps = useAnimatedProps(() => {
    return {
      r: (APPLE_SIZE / 2) * 1.6 * applePulse.value,
      opacity: 0.18 + arrivalGlow.value * 0.4,
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
      <Svg width="100%" height="100%" viewBox={`0 0 ${SCREEN_WIDTH} ${SCREEN_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
        <Defs>
          {/* Path gradients */}
          <LinearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#8B5A2B" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#A0522D" stopOpacity="0.9" />
          </LinearGradient>
          <LinearGradient id="pathGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#8B5A2B" stopOpacity="0.22" />
            <Stop offset="100%" stopColor="#A0522D" stopOpacity="0.12" />
          </LinearGradient>
          <LinearGradient id="snakeBody" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#a0c432" stopOpacity="0.95" />
            <Stop offset="100%" stopColor="#8aa82b" stopOpacity="0.85" />
          </LinearGradient>
        </Defs>

        {/* Path visualization (optional debug - uses normalized coordinates) */}
        <G transform={`translate(${PATH_OFFSET_X} ${PATH_OFFSET_Y}) scale(${(SCREEN_WIDTH * PATH_WIDTH_FRACTION) / 100} ${(SCREEN_HEIGHT * PATH_HEIGHT_FRACTION) / 100})`}>
          <Path d={svgPath} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} fill="none" strokeDasharray="2,2" />

          {/* Path trail */}
          <Path
            d={svgPath}
            stroke="url(#pathGlow)"
            strokeWidth={PATH_STROKE_WIDTH + 14}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d={svgPath}
            stroke="url(#pathGradient)"
            strokeWidth={PATH_STROKE_WIDTH}
            fill="none"
            strokeLinecap="round"
          />
        </G>

        {/* Apple glow effect (FR-016) */}
        <AnimatedCircle
          animatedProps={animatedAppleGlowProps}
          cx={applePosition.x}
          cy={applePosition.y}
          fill="rgba(255, 107, 107, 0.2)"
        />
        
        {/* Apple Image */}
        <AnimatedG animatedProps={animatedAppleProps}>
          <SvgImage
            href={appleImage}
            x={applePosition.x - APPLE_SIZE / 2}
            y={applePosition.y - APPLE_SIZE / 2}
            width={APPLE_SIZE}
            height={APPLE_SIZE}
            preserveAspectRatio="xMidYMid meet"
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
          {/* Tail cap - rounds off the tail end */}
          <Circle
            cx={tailPosition.x}
            cy={tailPosition.y}
            r={(SNAKE_SIZE / 2) * 0.7}
            fill="#2E8B57"
            opacity={0.95}
          />

          {/* Body trail */}
          {bodySegments.map((segment, idx) => (
            <Circle
              key={`segment-${idx}`}
              cx={segment.x}
              cy={segment.y}
              r={segment.r}
              fill="url(#snakeBody)"
              opacity={segment.opacity}
            />
          ))}

          {/* Scales pattern overlay */}
          {bodySegments.map((segment, idx) => (
            <Circle
              key={`scale-${idx}`}
              cx={segment.x}
              cy={segment.y}
              r={segment.r * 0.95}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={2}
              strokeDasharray="3, 8"
              fill="none"
              opacity={segment.opacity * 0.8}
            />
          ))}

          {/* Head - Snake image with rotation */}
          <AnimatedGHead animatedProps={animatedHeadTransform}>
            <Circle
              cx={0}
              cy={0}
              r={(SNAKE_SIZE / 2) * 1.2}
              fill="rgba(0,0,0,0.12)"
              opacity={HEAD_SHADOW_OPACITY}
            />
            <AnimatedSvgImage
              href={snakeHeadImage}
              x={-SNAKE_SIZE}
              y={-SNAKE_SIZE}
              width={SNAKE_SIZE * 2}
              height={SNAKE_SIZE * 2}
              preserveAspectRatio="xMidYMid meet"
            />
          </AnimatedGHead>
          
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
    backgroundColor: 'transparent', // Transparent to show background image
  },
});
