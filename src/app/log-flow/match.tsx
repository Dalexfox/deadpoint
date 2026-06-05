import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import ProblemCard, { type Problem } from '../../components/ProblemCard';

const BG      = '#ffffff';
const SURFACE = '#ece8df';
const SAND    = '#c8a84a';
const INK     = '#1a1408';
const INK2    = '#3d3320';
const INK3    = '#8a7a50';
const DIVIDER = 'rgba(26,20,8,0.08)';

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <View style={si.row}>
      {([1, 2, 3] as const).map((step, i) => (
        <View key={step} style={si.stepGroup}>
          {i > 0 && <View style={si.line} />}
          <View style={[si.dot, step <= current ? si.dotActive : si.dotFuture, step === current && si.dotCurrent]} />
        </View>
      ))}
      <Text style={si.label}>Step 2 of 3 — Match climb</Text>
    </View>
  );
}

const si = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, gap: 0 },
  stepGroup:  { flexDirection: 'row', alignItems: 'center' },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  dotActive:  { backgroundColor: SAND },
  dotFuture:  { backgroundColor: 'rgba(26,20,8,0.15)' },
  dotCurrent: { width: 10, height: 10, borderRadius: 5 },
  line:       { width: 24, height: 1, backgroundColor: 'rgba(26,20,8,0.15)', marginHorizontal: 4 },
  label:      { fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK3, marginLeft: 10 },
});

export default function MatchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    gymId: string;
    gymName: string;
    holdColor: string;
    wallSection: string;
  }>();
  const { gymId, gymName: resolvedGymName, holdColor, wallSection } = params;

  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Problem | null>(null);

  useEffect(() => {
    supabase
      .from('problems')
      .select('*')
      .eq('gym_id', gymId)
      .eq('hold_color', holdColor)
      .eq('wall_section', wallSection)
      .then(({ data, error }) => {
        if (error) Alert.alert('Error', error.message);
        setProblems(data ?? []);
        setLoading(false);
      });
  }, [gymId, holdColor, wallSection]);

  const goToSend = (p: Problem) => {
    const sendParams = new URLSearchParams({
      gymId,
      gymName: resolvedGymName,
      holdColor,
      wallSection,
      problemId:   p.id,
      problemName: p.name,
      problemGrade: p.grade,
    });
    router.push(`/log-flow/send?${sendParams.toString()}`);
  };

  const goNewClimb = () => {
    const sendParams = new URLSearchParams({
      gymId,
      gymName: resolvedGymName,
      holdColor,
      wallSection,
      newProblem: 'true',
    });
    router.push(`/log-flow/send?${sendParams.toString()}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StepIndicator current={2} />

      {/* Nav */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backLabel}>Back</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.heading}>Is This Your{'\n'}Climb?</Text>
        <Text style={styles.subheading}>
          {resolvedGymName} · {holdColor} holds · {wallSection}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>

        {loading ? (
          <ActivityIndicator color={SAND} style={{ marginTop: 40 }} />
        ) : problems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No matches found</Text>
            <Text style={styles.emptyBody}>This looks like a new climb — tap below to log it.</Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {problems.map(p => (
              <ProblemCard
                key={p.id}
                problem={p}
                selected={selected?.id === p.id}
                onPress={() => setSelected(prev => prev?.id === p.id ? null : p)}
                height={160}
              />
            ))}
          </View>
        )}

      </ScrollView>

      {/* Footer actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.yesBtn, !selected && styles.yesBtnDisabled]}
          onPress={() => selected && goToSend(selected)}
          disabled={!selected}
          activeOpacity={0.85}>
          <Text style={styles.yesBtnLabel}>YES — LOG MY SEND</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.newBtn}
          onPress={goNewClimb}
          activeOpacity={0.85}>
          <Text style={styles.newBtnLabel}>NO — IT'S A NEW CLIMB</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    gap: 2,
  },
  backArrow: { fontSize: 22, fontFamily: 'SpaceGrotesk_300Light', color: INK2, lineHeight: 24, marginTop: -1 },
  backLabel: { fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', color: INK2 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 16,
  },
  heading: {
    fontSize: 26,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -1,
    lineHeight: 30,
  },
  subheading: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK3,
    marginTop: 6,
    lineHeight: 18,
  },

  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 14,
    flexGrow: 1,
  },
  cardList: { gap: 12 },

  emptyState: {
    marginTop: 40,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.5,
  },
  emptyBody: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK3,
    textAlign: 'center',
    lineHeight: 19,
  },

  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
    gap: 10,
  },
  yesBtn: {
    backgroundColor: SAND,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  yesBtnDisabled: { opacity: 0.35 },
  yesBtnLabel: {
    fontSize: 14,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  newBtn: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: DIVIDER,
  },
  newBtnLabel: {
    fontSize: 13,
    fontFamily: 'Syne_800ExtraBold',
    color: INK2,
  },
});
