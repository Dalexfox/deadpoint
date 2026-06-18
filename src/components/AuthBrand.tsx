/**
 * AuthBrand — the Deadpoint wordmark + dot-grid motif shown at the top of the
 * auth screens (login / signup). Kept as one component so both screens stay
 * identical. The wordmark is its own clean mark here — NEVER cram "DEADPOINT"
 * into the big 58px heading (it overflows the screen and splits mid-word).
 */
import { View, Text, StyleSheet } from 'react-native';

const SAND = '#c8a84a';

export function AuthBrand({ label = 'DEADPOINT' }: { label?: string }) {
  return (
    <View style={s.brand}>
      <View style={s.dotGrid}>
        {Array.from({ length: 9 }).map((_, i) => (
          <View key={i} style={[s.dot, i === 4 && s.dotCenter]} />
        ))}
      </View>
      <Text style={s.wordmark}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 44 },
  dotGrid: { width: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  dot: { width: 4, height: 4, borderRadius: 2, marginBottom: 2, backgroundColor: 'rgba(200,168,74,0.5)' },
  dotCenter: { backgroundColor: SAND },
  wordmark: { fontSize: 18, fontFamily: 'Syne_800ExtraBold', color: SAND, letterSpacing: 4 },
});
