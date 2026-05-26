import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

const BG = '#0c1e21';
const CARD = '#142829';
const SURFACE = '#1a3235';
const ACCENT = '#ff507c';
const TEAL = '#4da8ae';
const TEXT = '#ffffff';
const TEXT_SUB = '#7ab4b8';
const TEXT_MUTED = '#3d6b6f';
const DIVIDER = '#1e3840';

const GYMS: Record<string, { name: string; neighborhood: string; city: string }> = {
  '1': { name: 'Vital Climbing LES', neighborhood: 'Lower East Side', city: 'NYC' },
  '2': { name: 'Vital Climbing Brooklyn', neighborhood: 'Brooklyn', city: 'NYC' },
  '3': { name: 'Vital Climbing UES', neighborhood: 'Upper East Side', city: 'NYC' },
  '4': { name: 'Vital Climbing UWS', neighborhood: 'Upper West Side', city: 'NYC' },
};

const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];

type Counts = Record<string, number>;

export default function GymDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const gym = GYMS[id as string] ?? null;

  const [counts, setCounts] = useState<Counts>(
    Object.fromEntries(GRADES.map((g) => [g, 0]))
  );

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  const increment = (grade: string) =>
    setCounts((prev) => ({ ...prev, [grade]: prev[grade] + 1 }));

  const decrement = (grade: string) =>
    setCounts((prev) => ({ ...prev, [grade]: Math.max(0, prev[grade] - 1) }));

  if (!gym) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>Gyms</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.gymHeader}>
        <View style={styles.gymPill}>
          <Text style={styles.gymPillMarker}>▲</Text>
          <Text style={styles.gymPillText}>Vital</Text>
        </View>
        <Text style={styles.gymName}>{gym.name}</Text>
        <Text style={styles.gymLocation}>
          {gym.neighborhood} · {gym.city}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>LOG YOUR CLIMBS</Text>

        {GRADES.map((grade) => {
          const count = counts[grade];
          return (
            <View key={grade} style={styles.gradeRow}>
              <View style={styles.gradeLeft}>
                <Text style={styles.gradeLabel}>{grade}</Text>
                {count > 0 && (
                  <View style={styles.gradeBadge}>
                    <Text style={styles.gradeBadgeText}>{count}</Text>
                  </View>
                )}
              </View>
              <View style={styles.counter}>
                <TouchableOpacity
                  style={[styles.counterBtn, count === 0 && styles.counterBtnMuted]}
                  onPress={() => decrement(grade)}
                  activeOpacity={0.7}
                  disabled={count === 0}>
                  <Text style={[styles.counterBtnText, count === 0 && styles.counterBtnTextMuted]}>
                    −
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.countText, count > 0 && styles.countTextActive]}>
                  {count}
                </Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => increment(grade)}
                  activeOpacity={0.7}>
                  <Text style={styles.counterBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, total === 0 && styles.submitBtnDisabled]}
          activeOpacity={0.85}
          disabled={total === 0}
          onPress={() => {}}>
          <Text style={styles.submitLabel}>
            {total > 0 ? `Submit Session · ${total} Problem${total === 1 ? '' : 's'}` : 'Submit Session'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  nav: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  backArrow: {
    fontSize: 28,
    fontFamily: 'DMSans_300Light',
    color: TEXT,
    lineHeight: 28,
    marginTop: -2,
  },
  backLabel: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: TEXT,
    letterSpacing: 0.1,
  },
  gymHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
    gap: 6,
  },
  gymPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: SURFACE,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  gymPillMarker: {
    fontSize: 8,
    color: TEAL,
  },
  gymPillText: {
    fontSize: 11,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEAL,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  gymName: {
    fontSize: 40,
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 1,
    lineHeight: 44,
  },
  gymLocation: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_SUB,
    letterSpacing: 0.1,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT_MUTED,
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SURFACE,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  gradeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gradeLabel: {
    fontSize: 18,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: -0.3,
    width: 36,
  },
  gradeBadge: {
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  gradeBadgeText: {
    fontSize: 12,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnMuted: {
    opacity: 0.3,
  },
  counterBtnText: {
    fontSize: 20,
    fontFamily: 'DMSans_400Regular',
    color: TEXT,
    lineHeight: 20,
  },
  counterBtnTextMuted: {
    color: TEXT_MUTED,
  },
  countText: {
    fontSize: 18,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT_MUTED,
    width: 32,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  countTextActive: {
    color: TEXT,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
  },
  submitBtn: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.35,
    shadowOpacity: 0,
  },
  submitLabel: {
    fontSize: 17,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: 0.2,
  },
});
