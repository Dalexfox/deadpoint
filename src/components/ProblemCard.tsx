import { StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const SAND    = '#c8a84a';
const SAND_LT = '#e8c87a';
const INK3    = '#8a7a50';
const DIVIDER = 'rgba(26,20,8,0.08)';

export const HOLD_COLOR_SWATCHES: Record<string, string> = {
  red:    '#e8383c',
  orange: '#f07030',
  yellow: '#f0c030',
  green:  '#40a060',
  blue:   '#3070c0',
  purple: '#8050c0',
  pink:   '#e070a0',
  black:  '#2a2010',
  white:  '#f4f1eb',
};

export type Problem = {
  id: string;
  name: string;
  custom_name?: string | null;
  hold_color: string;
  grade: string;
  wall_section?: string | null;
  media_url?: string | null;
  start_photo_url?: string | null;  // first-logger's recognition photo (the start-hold reference)
  map_x?: number | null;            // start-hold position on start_photo_url (0–1)
  map_y?: number | null;
};

type Props = {
  problem: Problem;
  selected?: boolean;
  onPress?: () => void;
  height?: number;
};

export default function ProblemCard({ problem, selected, onPress, height = 160 }: Props) {
  const swatch = HOLD_COLOR_SWATCHES[problem.hold_color] ?? '#888';

  // If the problem has a start-hold reference photo + coords, show THAT photo with
  // the start ring (so climbers can disambiguate same-colour problems). Otherwise
  // fall back to the cover photo.
  const hasStart = !!(problem.start_photo_url && problem.map_x != null && problem.map_y != null);
  const bgUri = hasStart ? problem.start_photo_url : problem.media_url;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { height },
        selected && styles.cardSelected,
      ]}
      onPress={onPress}
      activeOpacity={0.85}>

      {bgUri ? (
        <Image
          source={{ uri: bgUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={['#2a2010', '#1a1408']}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Start-hold ring (only when we have the reference photo + coords) */}
      {hasStart && (
        <>
          <View
            style={[styles.startRing, { left: `${problem.map_x! * 100}%`, top: `${problem.map_y! * 100}%` }]}
            pointerEvents="none"
          />
          <View style={styles.startTag} pointerEvents="none">
            <Text style={styles.startTagText}>START</Text>
          </View>
        </>
      )}

      {/* Bottom overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.72)']}
        style={styles.overlay}
        pointerEvents="none"
      />

      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.problemName} numberOfLines={1}>{problem.name}</Text>
          {problem.custom_name ? (
            <Text style={styles.customName} numberOfLines={1}>{problem.custom_name}</Text>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.grade}>{problem.grade}</Text>
          <View style={styles.rightMeta}>
            <View style={[styles.colorDot, { backgroundColor: swatch }]} />
            {problem.wall_section ? (
              <Text style={styles.wallSection}>{problem.wall_section}</Text>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: DIVIDER,
    justifyContent: 'flex-end',
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: SAND,
    shadowColor: SAND,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '40%',
  },
  startRing: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    marginLeft: -17,
    marginTop: -17,
    borderWidth: 3,
    borderColor: SAND,
    backgroundColor: 'rgba(200,168,74,0.18)',
  },
  startTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  startTagText: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: SAND_LT,
    letterSpacing: 1.5,
  },
  content: {
    padding: 12,
    gap: 4,
  },
  nameRow: {
    gap: 2,
  },
  problemName: {
    fontSize: 13,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  customName: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: 'rgba(255,255,255,0.6)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  grade: {
    fontSize: 22,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND_LT,
    letterSpacing: -0.5,
  },
  rightMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  wallSection: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
});
