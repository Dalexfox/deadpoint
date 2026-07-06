/**
 * Problem Page — /problem/[id]
 *
 * One page per community climb: the identity photo (start-hold ring), grade +
 * send stats, ALL THE BETA (every public send of this problem, videos first),
 * who's sent it, and a pre-filled "LOG THIS CLIMB" CTA — the fastest fully-
 * attributed log in the app.
 *
 * Entry points: gym Current Climbs (problems grid), tappable climb nicknames
 * on feed cards + session detail. Quiet sends never appear here for other
 * users — RLS filters them out of the sessions read server-side.
 *
 * Map-agnostic by design: problems already carry map_x/map_y/map_wall_id, so a
 * future gym floor plan just becomes another entry point to this same page.
 */
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { fetchGyms, gymName as resolveGymName } from '../../lib/gyms';
import { track } from '../../lib/analytics';
import { ClimbThumb } from '../../components/ClimbThumb';
import { HOLD_COLOR_SWATCHES } from '../../components/ProblemCard';

const BG      = '#ffffff';
const CARD    = '#f4f1eb';
const SAND    = '#c8a84a';
const SAND_LT = '#e8c87a';
const INK     = '#1a1408';
const INK2    = '#3d3320';
const INK3    = '#8a7a50';
const DIVIDER = 'rgba(26,20,8,0.08)';

const VIDEO_RE = /\.(mp4|mov|m4v|avi)$/i;

type ProblemRow = {
  id: string;
  gym_id: string | null;
  name: string;
  custom_name: string | null;
  hold_color: string;
  grade: string;
  wall_section: string | null;
  media_url: string | null;
  start_photo_url: string | null;
  map_x: number | null;
  map_y: number | null;
  created_at: string;
  archived_at: string | null;   // null = on the wall; set = stripped/reset
};

type SendRow = {
  sessionId: string;
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  mediaUrl: string | null;
  posterUrl: string | null;   // pre-generated video cover (sessions.media_poster_url)
  isVideo: boolean;
  sendStyle: 'flash' | 'send' | 'project' | null;
  createdAt: string;
};

function toInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('') || '?';
}

function fmtShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function timeAgo(dateStr: string) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (hours < 1)  return 'just now';
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ProblemScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [loading,       setLoading]       = useState(true);
  const [notFound,      setNotFound]      = useState(false);
  const [problem,       setProblem]       = useState<ProblemRow | null>(null);
  const [sends,         setSends]         = useState<SendRow[]>([]);
  const [gymLabel,      setGymLabel]      = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // True once a load has succeeded — a failed REFETCH (offline refocus) must
  // never flip an already-loaded page to "Climb not found".
  const loadedRef = useRef(false);

  // Re-fetch on every focus so a send logged from this page shows up on return.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [{ data: prob }, { data: { user } }, gyms] = await Promise.all([
            supabase.from('problems').select('*').eq('id', id).single(),
            supabase.auth.getUser(),
            fetchGyms(),
          ]);
          if (!active) return;
          if (!prob) { if (!loadedRef.current) setNotFound(true); return; }
          loadedRef.current = true;
          setProblem(prob as ProblemRow);
          setCurrentUserId(user?.id ?? null);
          setGymLabel(prob.gym_id ? resolveGymName(gyms, prob.gym_id) : '');

          // Every log of this problem: climbs → sessions (RLS hides others'
          // quiet sends) → profiles. Never join sessions↔profiles server-side.
          const { data: climbs } = await supabase
            .from('climbs')
            .select('session_id, send_style')
            .eq('problem_id', id);
          const styleBySession: Record<string, SendRow['sendStyle']> = {};
          (climbs ?? []).forEach((c: any) => { styleBySession[c.session_id] = c.send_style ?? null; });
          const sessionIds = Object.keys(styleBySession);
          if (sessionIds.length === 0) { if (active) setSends([]); return; }

          const { data: sessions } = await supabase
            .from('sessions')
            .select('id, user_id, media_url, media_poster_url, created_at')
            .in('id', sessionIds)
            .order('created_at', { ascending: false });
          const userIds = [...new Set((sessions ?? []).map((s: any) => s.user_id as string))];
          const { data: profiles } = userIds.length
            ? await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', userIds)
            : { data: [] };
          if (!active) return;

          const profileMap: Record<string, any> = {};
          (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });

          setSends((sessions ?? []).map((s: any) => {
            const p = profileMap[s.user_id];
            return {
              sessionId: s.id,
              userId:    s.user_id,
              name:      p?.full_name ?? 'Climber',
              username:  p?.username ?? null,
              avatarUrl: p?.avatar_url ?? null,
              mediaUrl:  s.media_url ?? null,
              posterUrl: s.media_poster_url ?? null,
              isVideo:   !!s.media_url && VIDEO_RE.test(s.media_url),
              sendStyle: styleBySession[s.id] ?? null,
              createdAt: s.created_at,
            };
          }));
        } catch {
          if (active && !loadedRef.current) setNotFound(true);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])
  );

  const openProfile = (userId: string) => {
    if (userId === currentUserId) router.push('/(tabs)/profile');
    else router.push(`/user/${userId}`);
  };

  // ── Set rotation: archive / restore ────────────────────────────────
  // "Sends are forever, problems are seasonal." Archiving hides this problem
  // from the live browse, identify matching, and the shortlist — the page and
  // every send stay. The RPC allows the creator or anyone who has logged it.
  const setArchived = async (archived: boolean) => {
    if (!problem) return;
    const { error } = await supabase.rpc('archive_problem', {
      p_problem_id: problem.id,
      p_archived:   archived,
    });
    if (error) {
      Alert.alert("Couldn't update", error.message);
      return;
    }
    setProblem({ ...problem, archived_at: archived ? new Date().toISOString() : null });
    track(archived ? 'problem_archived' : 'problem_unarchived', { problem_id: problem.id });
  };

  const handleOverflow = () => {
    if (!problem) return;
    const t = problem.custom_name ?? problem.name;
    if (problem.archived_at) {
      Alert.alert(t, 'This climb is marked as off the wall.', [
        { text: "It's back on the wall", onPress: () => setArchived(false) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert(t, undefined, [
        {
          text: 'This climb was reset (off the wall)',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Mark as off the wall?',
              "It disappears from the gym's live browse and climb matching. Every send stays in climbers' history, and this page stays viewable.",
              [
                { text: 'Mark as reset', style: 'destructive', onPress: () => setArchived(true) },
                { text: 'Cancel', style: 'cancel' },
              ],
            ),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleLog = () => {
    if (!problem) return;
    router.push({
      pathname: '/log-flow/send',
      params: {
        quick:        'true',
        gymId:        problem.gym_id ?? '',
        gymName:      gymLabel,
        problemId:    problem.id,
        problemName:  problem.custom_name ?? problem.name,
        problemGrade: problem.grade,
        holdColor:    problem.hold_color,
        wallSection:  problem.wall_section ?? '',
      },
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={SAND} size="large" />
      </View>
    );
  }

  if (notFound || !problem) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emptyTitle}>Climb not found</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.emptyBack}>‹ Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const swatch     = HOLD_COLOR_SWATCHES[problem.hold_color] ?? '#888';
  const heroUri    = problem.start_photo_url ?? problem.media_url;
  const hasStart   = !!(problem.start_photo_url && problem.map_x != null && problem.map_y != null);
  const title      = problem.custom_name ?? problem.name;
  const realSends  = sends.filter(s => s.sendStyle !== 'project');
  const climbers   = new Set(sends.map(s => s.userId)).size;
  const first      = [...realSends].reverse()[0] ?? [...sends].reverse()[0] ?? null;
  const beta       = [...sends.filter(s => s.isVideo), ...sends.filter(s => s.mediaUrl && !s.isVideo)];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>

        {/* ── Hero — the problem's identity photo + start-hold ring ───────── */}
        <View style={styles.hero}>
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#2a2010', '#1a1408']} style={StyleSheet.absoluteFill} />
          )}
          {hasStart && (
            <>
              <View style={[styles.startRing, { left: `${problem.map_x! * 100}%`, top: `${problem.map_y! * 100}%` }]} />
              <View style={[styles.startTag, { left: `${problem.map_x! * 100}%`, top: `${problem.map_y! * 100}%` }]}>
                <Text style={styles.startTagText}>START</Text>
              </View>
            </>
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={styles.heroScrim} pointerEvents="none" />
          <TouchableOpacity
            style={[styles.heroBtn, { top: insets.top + 8, left: 12 }]}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={20} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.heroBtn, { top: insets.top + 8, right: 12, paddingRight: 0 }]}
            onPress={handleOverflow}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.8}>
            <Ionicons name="ellipsis-horizontal" size={18} color="#ffffff" />
          </TouchableOpacity>
          {problem.archived_at && (
            <View style={styles.archivedRow}>
              <View style={styles.archivedPill}>
                <Text style={styles.archivedPillText}>OFF THE WALL</Text>
              </View>
            </View>
          )}
          <View style={styles.heroTitleRow}>
            <View style={[styles.colorDot, { backgroundColor: swatch }]} />
            <Text style={styles.heroTitle} numberOfLines={1}>{title}</Text>
          </View>
          <Text style={styles.heroSub} numberOfLines={1}>
            {problem.archived_at
              ? `On the wall ${fmtShort(problem.created_at)} – ${fmtShort(problem.archived_at)}${gymLabel ? ` · ${gymLabel}` : ''}`
              : [gymLabel, problem.wall_section].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: SAND }]}>{problem.grade}</Text>
            <Text style={styles.statLabel}>GRADE</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{realSends.length}</Text>
            <Text style={styles.statLabel}>SENDS</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{climbers}</Text>
            <Text style={styles.statLabel}>CLIMBERS</Text>
          </View>
          {first && (
            <TouchableOpacity style={styles.statBlock} onPress={() => openProfile(first.userId)} activeOpacity={0.7}>
              <Text style={styles.statFirst} numberOfLines={1}>
                {first.username ? `@${first.username}` : first.name}
              </Text>
              <Text style={styles.statLabel}>FIRST</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── The beta — every send with media, videos first ──────────────── */}
        <Text style={styles.sectionLabel}>
          {beta.length > 0 ? `THE BETA — ${beta.length} ${beta.length === 1 ? 'CLIP' : 'CLIPS'}` : 'THE BETA'}
        </Text>
        {beta.length > 0 ? (
          <View style={styles.grid}>
            {beta.map((s) => (
              <TouchableOpacity
                key={s.sessionId}
                style={styles.betaCard}
                onPress={() => router.push(`/session/${s.sessionId}`)}
                activeOpacity={0.88}>
                <ClimbThumb uri={s.mediaUrl} posterUri={s.posterUrl} grade={problem.grade} style={StyleSheet.absoluteFill} />
                <View style={styles.betaOverlay} pointerEvents="none">
                  <Text style={styles.betaHandle} numberOfLines={1}>
                    {s.username ? `@${s.username}` : s.name}
                  </Text>
                  {s.sendStyle && s.sendStyle !== 'project' && (
                    <Text style={styles.betaStyle}>{s.sendStyle === 'flash' ? 'Flash' : 'Send'}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyBeta}>
            No videos yet — log your send with a clip and yours is the beta.
          </Text>
        )}

        {/* ── Sent by ──────────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>SENT BY</Text>
        {sends.length === 0 ? (
          <Text style={styles.emptyBeta}>No one's logged this yet — be the first.</Text>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {sends.map((s, i) => (
              <TouchableOpacity
                key={s.sessionId}
                style={[styles.sendRow, i < sends.length - 1 && styles.sendRowBorder]}
                onPress={() => openProfile(s.userId)}
                activeOpacity={0.7}>
                {s.avatarUrl ? (
                  <Image source={{ uri: s.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitials}>{toInitials(s.name)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.sendName} numberOfLines={1}>{s.name}</Text>
                  <Text style={styles.sendMeta} numberOfLines={1}>
                    {[s.username ? `@${s.username}` : null, timeAgo(s.createdAt)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {s.sendStyle && (
                  <Text style={[styles.sendTag, s.sendStyle === 'project' && styles.sendTagProject]}>
                    {s.sendStyle === 'flash' ? 'FLASH' : s.sendStyle === 'send' ? 'SEND' : 'PROJ'}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Footer CTA — pre-filled, fully-attributed quick log ───────────── */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.logBtn} onPress={handleLog} activeOpacity={0.85}>
          <Text style={styles.logBtnLabel}>LOG THIS CLIMB</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center:    { alignItems: 'center', justifyContent: 'center', gap: 12 },

  emptyTitle: { fontSize: 18, fontFamily: 'Syne_800ExtraBold', color: INK },
  emptyBack:  { fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', color: INK3, padding: 8 },

  // ── Hero ─────────────────────────────────────────────────────────
  hero: {
    height: 300,
    backgroundColor: '#241a0c',
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  heroScrim: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 120,
  },
  heroBtn: {
    position: 'absolute',
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
    paddingRight: 2,
  },
  startRing: {
    position: 'absolute',
    width: 34, height: 34,
    marginLeft: -17, marginTop: -17,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: SAND,
  },
  startTag: {
    position: 'absolute',
    marginLeft: -21, marginTop: 21,
    backgroundColor: SAND,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  startTagText: { fontSize: 9, fontFamily: 'SpaceGrotesk_700Bold', color: INK, letterSpacing: 1 },
  archivedRow: { paddingHorizontal: 16, marginBottom: 6 },
  archivedPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  archivedPillText: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.5,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  colorDot: { width: 12, height: 12, borderRadius: 3, flexShrink: 0 },
  heroTitle: {
    flex: 1,
    fontSize: 24,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.8,
  },
  heroSub: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 16,
    marginTop: 3,
  },

  // ── Stats ────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  statBlock: { flex: 1, gap: 3 },
  statValue: { fontSize: 22, fontFamily: 'Syne_800ExtraBold', color: INK, letterSpacing: -0.8 },
  statFirst: { fontSize: 13, fontFamily: 'Syne_800ExtraBold', color: INK, paddingTop: 7 },
  statLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // ── Sections ─────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  emptyBeta: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK3,
    paddingHorizontal: 16,
    lineHeight: 19,
  },

  // ── Beta grid ────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    rowGap: 8,
  },
  betaCard: {
    width: '48.5%',
    aspectRatio: 0.82,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: CARD,
  },
  betaOverlay: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  betaHandle: { flex: 1, fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', color: '#ffffff' },
  betaStyle:  { fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', color: SAND_LT },

  // ── Sent by ──────────────────────────────────────────────────────
  sendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  sendRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  avatar: { width: 34, height: 34, borderRadius: 9, backgroundColor: CARD },
  avatarFallback: { backgroundColor: '#2a2010', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold', color: SAND_LT },
  sendName: { fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold', color: INK },
  sendMeta: { fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', color: INK3, marginTop: 1 },
  sendTag: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: SAND,
    letterSpacing: 1.5,
  },
  sendTagProject: { color: INK3 },

  // ── Footer ───────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
  },
  logBtn: {
    backgroundColor: SAND,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  logBtnLabel: {
    fontSize: 14,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
});
