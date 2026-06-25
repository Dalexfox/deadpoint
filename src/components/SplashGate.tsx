/**
 * SplashGate — the animated "two doors" launch reveal.
 *
 * The native splash (expo-splash-screen) is a STATIC icon on #0d0a05 shown while
 * the app boots. The moment it hides, this overlay is already underneath showing
 * the SAME look — so there's no flash. The WHOLE screen is the Deadpoint speckled
 * gold-dot pattern (a jittered grid of SAND dots on warm-black), with the "D" mark
 * drawn from brighter dots in the centre — so the logo emerges FROM the speckle
 * rather than sitting on an opaque square. It then splits down the middle: two
 * panels each carry their half of the full-screen pattern and slide apart to
 * reveal the app, then unmount via onDone.
 *
 * The dot field + logo dots are generated ONCE (memoised) and BOTH doors render
 * the identical SVG, each clipped to its half — so the seam is seamless when
 * closed. Everything is react-native-svg (already used by the charts).
 *
 * Plays once per cold start. pointerEvents="none" so it never traps input.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

const BG      = '#0d0a05'; // sampled from the icon's corners → seamless behind the logo
const GOLD    = '#c8a84a'; // SAND — the field dots
const GOLD_LT = '#e8c87a'; // SAND_LT — the brighter logo dots + a few field speckles
const SPACING = 32;        // gap between field dots
const HOLD_MS = 650;       // how long the closed pattern holds before the doors open
const OPEN_MS = 700;

// The "D" as a dot grid (X = a bright logo dot). Flat left edge, curved right.
const D_PATTERN = ['XXXXX.', 'X...XX', 'X....X', 'X....X', 'X....X', 'X....X', 'X...XX', 'XXXXX.'];

type Dot = { x: number; y: number; s: number; o: number; c: string };

// A jittered grid of gold speckles covering the whole screen — the brand pattern.
function buildField(width: number, height: number): Dot[] {
  const cols = Math.ceil(width / SPACING) + 1;
  const rows = Math.ceil(height / SPACING) + 1;
  const offX = (width - (cols - 1) * SPACING) / 2;
  const offY = (height - (rows - 1) * SPACING) / 2;
  const dots: Dot[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push({
        x: offX + c * SPACING + (Math.random() - 0.5) * 8,   // slight jitter → organic
        y: offY + r * SPACING + (Math.random() - 0.5) * 8,
        s: 6 + Math.random() * 4.5,                            // 6–10.5px dots
        o: 0.4 + Math.random() * 0.5,                          // varied opacity → speckled
        c: Math.random() < 0.2 ? GOLD_LT : GOLD,
      });
    }
  }
  return dots;
}

// The centred D — brighter, bigger dots drawn on top of the field.
function buildLogo(width: number, height: number): Dot[] {
  const rows = D_PATTERN.length;
  const cols = D_PATTERN[0].length;
  const cell = Math.min(width * 0.5, 200) / rows;
  const x0 = width / 2 - ((cols - 1) * cell) / 2;
  const y0 = height / 2 - ((rows - 1) * cell) / 2;
  const dots: Dot[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (D_PATTERN[r][c] === 'X') {
        dots.push({ x: x0 + c * cell, y: y0 + r * cell, s: cell * 0.66, o: 1, c: GOLD_LT });
      }
    }
  }
  return dots;
}

// The full-screen pattern as one SVG. `shift` slides it so each door shows the
// correct half (left door shift 0, right door shift -halfW).
function Pattern({ width, height, dots, shift }: { width: number; height: number; dots: Dot[]; shift: number }) {
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: shift, top: 0 }}>
      {dots.map((d, i) => (
        <Rect key={i} x={d.x - d.s / 2} y={d.y - d.s / 2} width={d.s} height={d.s} rx={d.s * 0.32} fill={d.c} opacity={d.o} />
      ))}
    </Svg>
  );
}

export function SplashGate({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const halfW = width / 2;

  // Field dots first, logo dots on top (brighter) — one combined array per door.
  const dots = useMemo(
    () => [...buildField(width, height), ...buildLogo(width, height)],
    [width, height],
  );

  const leftX  = useRef(new Animated.Value(0)).current;
  const rightX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(leftX,  { toValue: -halfW - 2, duration: OPEN_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(rightX, { toValue:  halfW + 2, duration: OPEN_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) onDone(); });
    }, HOLD_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="none">
      {/* Left door — left half of the full-screen pattern */}
      <Animated.View style={[styles.door, { left: 0, width: halfW, height, transform: [{ translateX: leftX }] }]}>
        <Pattern width={width} height={height} dots={dots} shift={0} />
      </Animated.View>

      {/* Right door — right half of the same pattern */}
      <Animated.View style={[styles.door, { left: halfW, width: width - halfW, height, transform: [{ translateX: rightX }] }]}>
        <Pattern width={width} height={height} dots={dots} shift={-halfW} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 9999 },
  door: { position: 'absolute', top: 0, backgroundColor: BG, overflow: 'hidden' },
});
