/**
 * SplashGate — the animated "two doors" launch reveal.
 *
 * The native splash (expo-splash-screen) is a STATIC icon on #0d0a05 shown while
 * the app boots. The moment it hides, this overlay is already underneath showing
 * the same icon on the same background — so there's no flash. It then splits down
 * the middle: two panels (each holding half the icon) slide apart to reveal the
 * app, and unmounts itself via onDone.
 *
 * Plays once per cold start. pointerEvents="none" so it never traps input.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';

const BG = '#0d0a05'; // sampled from the icon's corners → seamless behind the logo
const HOLD_MS = 600;  // how long the closed logo holds before the doors open
const OPEN_MS = 650;

export function SplashGate({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const halfW = width / 2;
  const icon = Math.min(width * 0.55, 220);

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
      {/* Left door — shows the LEFT half of the centered icon */}
      <Animated.View
        style={[
          styles.door,
          { left: 0, width: halfW, height, transform: [{ translateX: leftX }] },
        ]}>
        <Image
          source={require('../../assets/images/icon.png')}
          style={{ position: 'absolute', width: icon, height: icon, left: halfW - icon / 2, top: height / 2 - icon / 2 }}
        />
      </Animated.View>

      {/* Right door — shows the RIGHT half of the centered icon */}
      <Animated.View
        style={[
          styles.door,
          { left: halfW, width: width - halfW, height, transform: [{ translateX: rightX }] },
        ]}>
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
