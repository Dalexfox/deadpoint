/**
 * DefaultCover — the branded fallback "cover" for a logged climb that has no
 * photo/video yet. Instead of a plain dark gradient, it composes the climb's
 * Grade, Gym and Date over the warm ink gradient with a small Deadpoint
 * dot-grid motif + wordmark, so a media-less post still feels designed.
 *
 * Used by the feed FullScreenCard and session/[id] in their no-media branch.
 * It's a full-bleed background (StyleSheet.absoluteFill); the card's own
 * overlays (right rail, username, stats bar) still render on top.
 */
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const SAND    = '#c8a84a';
const SAND_LT = '#e8c87a';

export function DefaultCover({ grade, gym, date }: { grade?: string; gym?: string; date?: string }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#2a2010', '#1a1408']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <View style={st.center} pointerEvents="none">
        {/* Deadpoint dot-grid motif (brand marker) */}
        <View style={st.dotGrid}>
          {Array.from({ length: 9 }).map((_, i) => (
            <View key={i} style={[st.dot, i === 4 && st.dotCenter]} />
          ))}
        </View>

        <Text style={st.gradeLabel}>GRADE</Text>
        <Text style={st.grade}>{grade ?? '—'}</Text>

        <View style={st.divider} />

        {gym ? <Text style={st.gym} numberOfLines={1}>{gym}</Text> : null}
        {date ? <Text style={st.date}>{date}</Text> : null}

        <Text style={st.wordmark}>DEADPOINT</Text>
      </View>
    </View>
  );
}

const DOT = 7;
const st = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 90,        // lift clear of the bottom username/stats overlays
  },
  dotGrid: {
    width: DOT * 3 + 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
    opacity: 0.9,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    marginBottom: 3,
    backgroundColor: 'rgba(200,168,74,0.45)',
  },
  dotCenter: { backgroundColor: SAND },
  gradeLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
  },
  grade: {
    fontSize: 92,
    fontFamily: 'Syne_800ExtraBold',
    letterSpacing: -3,
    color: SAND_LT,
    lineHeight: 96,
  },
  divider: {
    width: 34,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginVertical: 14,
  },
  gym: {
    fontSize: 17,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#ffffff',
    letterSpacing: 0.2,
    maxWidth: 260,
    textAlign: 'center',
  },
  date: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: 'rgba(255,255,255,0.55)',
    marginTop: 3,
  },
  wordmark: {
    position: 'absolute',
    bottom: 0,
    fontSize: 11,
    fontFamily: 'Syne_800ExtraBold',
    letterSpacing: 3,
    color: 'rgba(200,168,74,0.55)',
  },
});
