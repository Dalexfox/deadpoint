import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { gymName, fetchGyms } from '../../lib/gyms';
import ProblemCard, { type Problem } from '../../components/ProblemCard';

const BG      = '#ffffff';
const CARD    = '#f4f1eb';
const SURFACE = '#ece8df';
const SAND    = '#c8a84a';
const SAND_DIM = 'rgba(200,168,74,0.12)';
const INK     = '#1a1408';
const INK2    = '#3d3320';
const INK3    = '#8a7a50';
const DIVIDER = 'rgba(26,20,8,0.08)';

type QueryState = 'loading' | 'matches' | 'close' | 'none' | 'error';

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

// Subtle dot-grid motif — 3×3 dots in SAND above the celebration headline
function DotGrid() {
  const dots = Array.from({ length: 9 });
  return (
    <View style={dg.grid}>
      {dots.map((_, i) => <View key={i} style={dg.dot} />)}
    </View>
  );
}
const dg = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 40, gap: 6, marginBottom: 16 },
  dot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: SAND, opacity: 0.5 },
});

export default function MatchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    gymId: string;
    gymName: string;
    holdColor: string;
    wallSection: string;
    grade: string;
  }>();
  const { gymId, gymName: passedGymName, holdColor, wallSection, grade } = params;

  const [queryState, setQueryState] = useState<QueryState>('loading');
  const [exactMatches, setExactMatches] = useState<Problem[]>([]);
  const [closeMatches, setCloseMatches] = useState<Problem[]>([]);
  const [selected, setSelected] = useState<Problem | null>(null);
  // Resolved gym name — falls back to the passed param, then fetches from gyms table
  const [resolvedGymName, setResolvedGymName] = useState(passedGymName ?? '');

  useEffect(() => {
    if (!passedGymName) {
      fetchGyms().then(gyms => {
        const name = gymName(gyms, gymId);
        if (name) setResolvedGymName(name);
      });
    }
  }, [gymId, passedGymName]);

  const runQuery = () => {
    setQueryState('loading');
    setSelected(null);

    Promise.all([
      supabase
        .from('problems')
        .select('*')
        .eq('gym_id', gymId)
        .eq('hold_color', holdColor)
        .eq('grade', grade)
        .eq('wall_section', wallSection)
        .order('created_at', { ascending: false }),
      supabase
        .from('problems')
        .select('*')
        .eq('gym_id', gymId)
        .eq('hold_color', holdColor)
        .eq('grade', grade)
        .order('created_at', { ascending: false }),
    ])
      .then(([exactRes, allRes]) => {
        if (exactRes.error || allRes.error) {
          setQueryState('error');
          return;
        }

        const exact = exactRes.data ?? [];
        const exactIds = new Set(exact.map(p => p.id));
        // Close matches: same gym+color+grade but different wall section
        const close = (allRes.data ?? []).filter(p => !exactIds.has(p.id));

        setExactMatches(exact);
        setCloseMatches(close);

        if (exact.length > 0) {
          setQueryState('matches');
        } else if (close.length > 0) {
          setQueryState('close');
        } else {
          setQueryState('none');
        }
      })
      .catch(() => setQueryState('error'));
  };

  useEffect(() => { runQuery(); }, [gymId, holdColor, grade, wallSection]);

  const goToSend = (p: Problem) => {
    const sendParams = new URLSearchParams({
      gymId,
      gymName:      resolvedGymName,
      holdColor,
      wallSection,
      grade,
      problemId:    p.id,
      problemName:  p.name,
      problemGrade: p.grade,
    });
    router.push(`/log-flow/send?${sendParams.toString()}`);
  };

  const goNewClimb = (focusNickname = false) => {
    const sendParams = new URLSearchParams({
      gymId,
      gymName:    resolvedGymName,
      holdColor,
      wallSection,
      grade,
      newProblem: 'true',
    });
    if (focusNickname) sendParams.set('focusNickname', 'true');
    router.push(`/log-flow/send?${sendParams.toString()}`);
  };

  const hasAnyMatches = exactMatches.length > 0 || closeMatches.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StepIndicator current={2} />

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backLabel}>Back</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.heading}>Is This Your{'\n'}Climb?</Text>
        <Text style={styles.subheading}>
          {resolvedGymName}{holdColor ? ` · ${holdColor} holds` : ''}{wallSection ? ` · ${wallSection}` : ''}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, queryState === 'none' && styles.scrollCentered]}
        showsVerticalScrollIndicator={false}>

        {queryState === 'loading' && (
          <ActivityIndicator color={SAND} style={{ marginTop: 40 }} />
        )}

        {queryState === 'error' && (
          <View style={styles.errorState}>
            <Text style={styles.errorTitle}>Couldn't check the catalog</Text>
            <Text style={styles.errorBody}>Check your connection and try again.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={runQuery} activeOpacity={0.8}>
              <Text style={styles.retryLabel}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── First-to-log celebration ── */}
        {queryState === 'none' && (
          <View style={styles.firstState}>
            <DotGrid />
            <Text style={styles.firstTag}>NEW PROBLEM</Text>
            <Text style={styles.firstHeadline}>You're the first.</Text>
            <Text style={styles.firstBody}>
              No one has logged this climb yet. Name it and it joins the {resolvedGymName} catalog.
            </Text>
          </View>
        )}

        {/* ── Exact matches ── */}
        {(queryState === 'matches' || queryState === 'close') && exactMatches.length > 0 && (
          <View style={styles.cardList}>
            {exactMatches.map(p => (
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

        {/* ── Close matches (different wall section) ── */}
        {closeMatches.length > 0 && (
          <View style={styles.closeSection}>
            <Text style={styles.sectionLabel}>CLOSE MATCHES</Text>
            <Text style={styles.closeSectionNote}>Same color & grade, different wall section</Text>
            <View style={styles.cardList}>
              {closeMatches.map(p => (
                <ProblemCard
                  key={p.id}
                  problem={p}
                  selected={selected?.id === p.id}
                  onPress={() => setSelected(prev => prev?.id === p.id ? null : p)}
                  height={160}
                />
              ))}
            </View>
          </View>
        )}

      </ScrollView>

      {/* ── Footer ── */}
      {(queryState === 'matches' || queryState === 'close') && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.yesBtn, !selected && styles.yesBtnDisabled]}
            onPress={() => selected && goToSend(selected)}
            disabled={!selected}
            activeOpacity={0.85}>
            <Text style={styles.yesBtnLabel}>YES — LOG MY SEND</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newBtn} onPress={() => goNewClimb(false)} activeOpacity={0.85}>
            <Text style={styles.newBtnLabel}>NO — IT'S A NEW CLIMB</Text>
          </TouchableOpacity>
        </View>
      )}

      {queryState === 'none' && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.yesBtn} onPress={() => goNewClimb(true)} activeOpacity={0.85}>
            <Text style={styles.yesBtnLabel}>NAME YOUR CLIMB</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logWithoutNamingRow} onPress={() => goNewClimb(false)} activeOpacity={0.7}>
            <Text style={styles.logWithoutNamingLabel}>Log without naming</Text>
          </TouchableOpacity>
        </View>
      )}
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

  header: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16 },
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

  scroll: { paddingHorizontal: 16, paddingBottom: 16, gap: 14, flexGrow: 1 },
  scrollCentered: { justifyContent: 'center', alignItems: 'center' },

  cardList: { gap: 12 },

  // ── Close matches section ──────────────────────────────────────────
  closeSection: { gap: 8 },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  closeSectionNote: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK3,
    marginTop: -4,
  },

  // ── Error state ────────────────────────────────────────────────────
  errorState: { marginTop: 40, alignItems: 'center', gap: 8, paddingHorizontal: 20 },
  errorTitle: {
    fontSize: 16,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.4,
  },
  errorBody: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK3,
    textAlign: 'center',
    lineHeight: 19,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: SURFACE,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: DIVIDER,
  },
  retryLabel: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK2,
  },

  // ── First-to-log celebration ───────────────────────────────────────
  firstState: {
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 0,
  },
  firstTag: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  firstHeadline: {
    fontSize: 34,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -1.2,
    textAlign: 'center',
    marginBottom: 12,
  },
  firstBody: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK2,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Footer ────────────────────────────────────────────────────────
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
  logWithoutNamingRow: { alignItems: 'center', paddingVertical: 4 },
  logWithoutNamingLabel: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    textDecorationLine: 'underline',
  },
});
