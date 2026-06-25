/**
 * SplashGate — the animated "two doors" launch reveal.
 *
 * The native splash (expo-splash-screen) is a STATIC icon on #0d0a05 shown while
 * the app boots. The moment it hides, this overlay is already underneath showing
 * the SAME look — so there's no flash. The screen is the Deadpoint speckled
 * gold-dot pattern (a jittered grid of SAND dots on warm-black, via
 * react-native-svg) that softly CLEARS toward the centre, where the REAL logo
 * (`icon.png`, so it matches the app icon exactly) sits. It then splits down the
 * middle: two panels each carry their half of the full-screen pattern + logo and
 * slide apart to reveal the app, then unmount via onDone.
 *
 * The clear-toward-centre fade means the bright field never collides with the
 * logo as a hard square — the icon's dark edges (#0d0a05) melt into the cleared
 * middle while the speckle fills the rest of the screen.
 *
 * The field is generated ONCE (memoised) and BOTH doors render the identical SVG,
 * each clipped to its half — so the seam is seamless when closed.
 *
 * Plays once per cold start. pointerEvents="none" so it never traps input.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

const BG      = '#0d0a05'; // sampled from the icon's corners → seamless behind the logo
const GOLD    = '#c8a84a'; // SAND — the field dots
const GOLD_LT = '#e8c87a'; // SAND_LT — a few brighter speckles
const SPACING = 32;        // gap between field dots
const HOLD_MS = 650;       // how long the closed pattern holds before the doors open
const OPEN_MS = 700;

type Dot = { x: number; y: number; s: number; o: number; c: string };

// A jittered grid of gold speckles covering the screen, fading to nothing toward
// the centre so the centred logo sits in a clean clearing (no hard square edge).
function buildField(width: number, height: number, icon: number): Dot[] {
  const cols = Math.ceil(width / SPACING) + 1;
  const rows = Math.ceil(height / SPACING) + 1;
  const offX = (width - (cols - 1) * SPACING) / 2;
  const offY = (height - (rows - 1) * SPACING) / 2;
  const cx = width / 2;
  const cy = height / 2;
  const clear = icon * 0.6;      // fully clear within ~the logo
  const full  = clear + 130;     // dots reach full strength beyond this radius
  const dots: Dot[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = offX + c * SPACING + (Math.random() - 0.5) * 8;
      const y = offY + r * SPACING + (Math.random() - 0.5) * 8;
      const dist = Math.hypot(x - cx, y - cy);
      const k = Math.max(0, Math.min(1, (dist - clear) / (full - clear)));
      if (k <= 0) continue;       // skip cleared dots (also trims the dot count)
      dots.push({
        x, y,
        s: 6 + Math.random() * 4.5,
        o: (0.4 + Math.random() * 0.5) * k,
        c: Math.random() < 0.2 ? GOLD_LT : GOLD,
      });
    }
  }
  return dots;
}

// The full-screen field as one SVG. `shift` slides it so each door shows the
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
  const icon  = Math.min(width * 0.55, 220);
  const dots  = useMemo(() => buildField(width, height, icon), [width, height, icon]);

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
      {/* Left door — left half of the speckle + the LEFT half of the real logo */}
      <Animated.View style={[styles.door, { left: 0, width: halfW, height, transform: [{ translateX: leftX }] }]}>
        <Pattern width={width} height={height} dots={dots} shift={0} />
        <Image
          source={require('../../assets/images/icon.png')}
          style={{ position: 'absolute', width: icon, height: icon, left: halfW - icon / 2, top: height / 2 - icon / 2 }}
        />
      </Animated.View>

      {/* Right door — right half of the speckle + the RIGHT half of the real logo */}
      <Animated.View style={[styles.door, { left: halfW, width: width - halfW, height, transform: [{ translateX: rightX }] }]}>
        <Pattern width={width} height={height} dots={dots} shift={-halfW} />
        <Image
          source={require('../../assets/images/icon.png')}
          style={{ position: 'absolute', width: icon, height: icon, left: -icon / 2, top: height / 2 - icon / 2 }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 9999 },
  door: { position: 'absolute', top: 0, backgroundColor: BG, overflow: 'hidden' },
});
