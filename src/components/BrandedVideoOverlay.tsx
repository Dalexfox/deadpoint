/**
 * BrandedVideoOverlay — the TRANSPARENT branding that gets composited onto a
 * climb video (grade / gym / date + Deadpoint mark over a subtle bottom scrim).
 * Captured as a PNG (alpha preserved) by react-native-view-shot and handed to the
 * BrandedVideo native module, which burns it onto every frame.
 *
 * Rendered at the VIDEO's aspect ratio (width × height) so it aligns full-frame.
 * Background is transparent — only the scrim + text/mark are drawn.
 */
import { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ShareCardData } from './ShareCard';

const SAND    = '#c8a84a';
const SAND_LT = '#e8c87a';

export const BrandedVideoOverlay = forwardRef<View, { data: ShareCardData; width: number; height: number }>(
  ({ data, width, height }, ref) => {
    const pad = Math.round(width * 0.055);
    return (
      <View ref={ref} collapsable={false} style={{ width, height, backgroundColor: 'transparent' }}>
        {/* bottom scrim for legibility over any footage */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.72)']}
          locations={[0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* top brand row */}
        <View style={[st.topRow, { top: pad, left: pad, right: pad }]}>
          <View style={st.dotGrid}>
            {Array.from({ length: 9 }).map((_, i) => (
              <View key={i} style={[st.dot, i === 4 && st.dotCenter]} />
            ))}
          </View>
          <Text style={st.wordmark}>DEADPOINT</Text>
        </View>

        {/* bottom content */}
        <View style={[st.bottom, { left: pad + 2, right: pad + 2, bottom: pad + 2 }]}>
          <Text style={st.gradeLabel}>SENT</Text>
          <Text style={[st.grade, { fontSize: Math.round(width * 0.23), lineHeight: Math.round(width * 0.24) }]}>
            {data.grade}
          </Text>
          <View style={st.metaRow}>
            <View style={st.metaBar} />
            <View style={{ flex: 1 }}>
              <Text style={st.gym} numberOfLines={1}>{data.gym}</Text>
              <Text style={st.date}>{data.date}{data.username ? `  ·  @${data.username}` : ''}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  },
);

BrandedVideoOverlay.displayName = 'BrandedVideoOverlay';

const st = StyleSheet.create({
  topRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dotGrid: { width: 22, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginBottom: 2.5, backgroundColor: 'rgba(232,200,122,0.6)' },
  dotCenter: { backgroundColor: SAND_LT },
  wordmark: { fontSize: 12, fontFamily: 'Syne_800ExtraBold', letterSpacing: 3, color: 'rgba(255,255,255,0.92)' },
  bottom: { position: 'absolute' },
  gradeLabel: { fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 3, color: 'rgba(255,255,255,0.65)', marginBottom: 2 },
  grade: { fontFamily: 'Syne_800ExtraBold', letterSpacing: -3, color: SAND_LT },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  metaBar: { width: 3, height: 32, borderRadius: 2, backgroundColor: SAND },
  gym: { fontSize: 18, fontFamily: 'Syne_800ExtraBold', letterSpacing: -0.4, color: '#ffffff' },
  date: { fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
});
