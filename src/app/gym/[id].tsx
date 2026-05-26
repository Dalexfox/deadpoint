import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

const ACCENT = '#ff507c';

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
    backgroundColor: '#ffffff',
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
    fontWeight: '300',
    color: '#000000',
    lineHeight: 28,
    marginTop: -2,
  },
  backLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.1,
  },
  gymHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
    gap: 6,
  },
  gymPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#fff0f4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  gymPillMarker: {
    fontSize: 8,
    color: ACCENT,
  },
  gymPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  gymName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.8,
    lineHeight: 36,
  },
  gymLocation: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888888',
    letterSpacing: 0.1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#aaaaaa',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
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
    fontWeight: '800',
    color: '#0a0a0a',
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
    fontWeight: '800',
    color: '#ffffff',
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
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnMuted: {
    opacity: 0.3,
  },
  counterBtnText: {
    fontSize: 20,
    fontWeight: '400',
    color: '#0a0a0a',
    lineHeight: 20,
  },
  counterBtnTextMuted: {
    color: '#aaaaaa',
  },
  countText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#cccccc',
    width: 32,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  countTextActive: {
    color: '#0a0a0a',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
  },
  submitBtn: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
  },
  submitLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
});
