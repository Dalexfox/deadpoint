/**
 * ShareCard — the branded, Instagram-ready card rendered for a climb so it can be
 * captured (react-native-view-shot) and shared. Portrait 4:5 (versatile for IG
 * feed + story). The hero is the climb's still (photo, or a frame pulled from the
 * video); media-less climbs fall back to the warm ink gradient. The Deadpoint mark
 * + Grade / Gym / Date overlay so every share is on-brand.
 *
 * The parent attaches a ref to capture this exact view — see ShareCardSheet.
 */
import { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const SAND    = '#c8a84a';
const SAND_LT = '#e8c87a';

export type ShareCardData = {
  grade: string;
  gym: string;
  date: string;
  username: string | null;
  stillUri: string | null;   // photo URI, generated video-frame URI, or null (branded)
};

export const ShareCard = forwardRef<View, { data: ShareCardData; width: number }>(
  ({ data, width }, ref) => {
    const height = Math.round(width * 1.25); // 4:5 portrait
    return (
      <View ref={ref} collapsable={false} style={[st.card, { width, height }]}>
        {data.stillUri ? (
          <Image source={{ uri: data.stillUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={['#2a2010', '#1a1408']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}

        {/* legibility scrim */}
        <LinearGradient
          colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(0,0,0,0.82)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* top brand row */}
        <View style={st.topRow}>
          <View style={st.dotGrid}>
            {Array.from({ length: 9 }).map((_, i) => (
              <View key={i} style={[st.dot, i === 4 && st.dotCenter]} />
            ))}
          </View>
          <Text style={st.wordmark}>DEADPOINT</Text>
        </View>

        {/* bottom content */}
        <View style={st.bottom}>
          <Text style={st.gradeLabel}>SENT</Text>
          <Text style={st.grade}>{data.grade}</Text>
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

ShareCard.displayName = 'ShareCard';

const st = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#1a1408',
  },
  topRow: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dotGrid: {
    width: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginBottom: 2.5,
    backgroundColor: 'rgba(232,200,122,0.6)',
  },
  dotCenter: { backgroundColor: SAND_LT },
  wordmark: {
    fontSize: 12,
    fontFamily: 'Syne_800ExtraBold',
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.92)',
  },
  bottom: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 22,
  },
  gradeLabel: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
  },
  grade: {
    fontSize: 76,
    fontFamily: 'Syne_800ExtraBold',
    letterSpacing: -3,
    color: SAND_LT,
    lineHeight: 80,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  metaBar: {
    width: 3,
    height: 34,
    borderRadius: 2,
    backgroundColor: SAND,
  },
  gym: {
    fontSize: 19,
    fontFamily: 'Syne_800ExtraBold',
    letterSpacing: -0.4,
    color: '#ffffff',
  },
  date: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
});
