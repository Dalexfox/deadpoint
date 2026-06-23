/**
 * GymLeaderboard — "The Scene" at a gym: a this-week leaderboard of climbers
 * (rank by sends or top grade) + a recent-sends activity strip. Pure render from
 * existing data (sessions + climbs + profiles), public sends only — no schema.
 *
 * Drives the local competition / FOMO that makes a single-gym seed feel alive.
 */
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { gradeValue } from '../lib/stats';

const SURFACE = '#ece8df';
const INK     = '#1a1408';
const INK2    = '#3d3320';
const INK3    = '#8a7a50';
const SAND    = '#c8a84a';
const SAND_LT = '#e8c87a';
const DIVIDER = 'rgba(26,20,8,0.08)';

type Row = {
  userId: string;
  name: string;
  username: string | null;
  avatar: string | null;
  sends: number;
  topGrade: string | null;
  topVal: number;
};
type Recent = {
  sessionId: string;
  userId: string;
  name: string;
  username: string | null;
  avatar: string | null;
  grade: string | null;
  createdAt: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1)  return 'now';
  if (mins < 60) return `${mins}m`;
  if (hrs < 24)  return `${hrs}h`;
  return `${days}d`;
}

function toInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('') || '?';
}

export function GymLeaderboard({ gymId }: { gymId: string }) {
  const router = useRouter();
  const [loading, setLoading]   = useState(true);
  const [rows, setRows]         = useState<Row[]>([]);
  const [recent, setRecent]     = useState<Recent[]>([]);
  const [meId, setMeId]         = useState<string | null>(null);
  const [sort, setSort]         = useState<'sends' | 'grade'>('sends');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setMeId(user?.id ?? null);

      // This week (since Monday, local).
      const now = new Date();
      const daysFromMon = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - daysFromMon);
      weekStart.setHours(0, 0, 0, 0);

      // Public sends at this gym this week (quiet never counts on a public board).
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, user_id, created_at, climbs(grade, send_style)')
        .eq('gym_id', gymId)
        .eq('visibility', 'public')
        .gte('created_at', weekStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(300);

      const sends = (sessions ?? []).map((s) => {
        const climb = ((s.climbs ?? []) as { grade: string; send_style: string | null }[])[0];
        return { sessionId: s.id, userId: s.user_id, createdAt: s.created_at, grade: climb?.grade ?? null, style: climb?.send_style ?? null };
      }).filter((s) => s.grade && s.style !== 'project'); // projects aren't sends

      const userIds = [...new Set(sends.map((s) => s.userId))];
      const { data: profiles } = userIds.length
        ? await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', userIds)
        : { data: [] as any[] };
      const pm = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      // Aggregate per user.
      const byUser = new Map<string, Row>();
      sends.forEach((s) => {
        const p: any = pm.get(s.userId);
        const cur = byUser.get(s.userId) ?? {
          userId: s.userId,
          name: p?.full_name || p?.username || 'Climber',
          username: p?.username ?? null,
          avatar: p?.avatar_url ?? null,
          sends: 0, topGrade: null, topVal: -1,
        };
        cur.sends += 1;
        const v = s.grade ? gradeValue(s.grade) : -1;
        if (v > cur.topVal) { cur.topVal = v; cur.topGrade = s.grade; }
        byUser.set(s.userId, cur);
      });
      setRows([...byUser.values()]);

      // Recent sends strip (latest few).
      setRecent(sends.slice(0, 8).map((s) => {
        const p: any = pm.get(s.userId);
        return {
          sessionId: s.sessionId, userId: s.userId,
          name: p?.full_name || p?.username || 'Climber',
          username: p?.username ?? null, avatar: p?.avatar_url ?? null,
          grade: s.grade, createdAt: s.createdAt,
        };
      }));
    } catch {
      setRows([]); setRecent([]);
    } finally {
      setLoading(false);
    }
  }, [gymId]);

  useEffect(() => { load(); }, [load]);

  const openUser = (id: string) => router.push(meId === id ? '/(tabs)/profile' : `/user/${id}`);

  const sorted = [...rows].sort((a, b) =>
    sort === 'sends'
      ? (b.sends - a.sends) || (b.topVal - a.topVal)
      : (b.topVal - a.topVal) || (b.sends - a.sends),
  );
  const totalSends = rows.reduce((sum, r) => sum + r.sends, 0);

  if (loading) {
    return <View style={st.center}><ActivityIndicator color={SAND} /></View>;
  }

  if (rows.length === 0) {
    return (
      <View style={st.center}>
        <Text style={st.emptyTitle}>Quiet week so far</Text>
        <Text style={st.emptySub}>No public sends here yet this week — log one and you&apos;re on the board.</Text>
      </View>
    );
  }

  const Avatar = ({ uri, name, size = 36 }: { uri: string | null; name: string; size?: number }) => {
    const radius = Math.round(size * 0.26); // soft-square chips, matching the app's square-avatar convention
    return uri ? (
      <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#2a2010' }} />
    ) : (
      <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#2a2010', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size * 0.36, fontFamily: 'Syne_800ExtraBold', color: SAND_LT }}>{toInitials(name)}</Text>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
      {/* Headline */}
      <Text style={st.kicker}>THIS WEEK</Text>
      <Text style={st.headline}>{rows.length} climber{rows.length !== 1 ? 's' : ''} · {totalSends} send{totalSends !== 1 ? 's' : ''}</Text>

      {/* Sort toggle */}
      <View style={st.toggle}>
        {(['sends', 'grade'] as const).map((k) => (
          <TouchableOpacity key={k} style={[st.toggleChip, sort === k && st.toggleChipActive]} onPress={() => setSort(k)} activeOpacity={0.8}>
            <Text style={[st.toggleText, sort === k && st.toggleTextActive]}>{k === 'sends' ? 'Sends' : 'Top grade'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Leaderboard — flat rows, hairline separators, #1 in SAND. The right-hand
          value is whatever you're ranking by (sends count or top grade); the
          secondary metric sits under the name. */}
      <View style={st.board}>
        {sorted.map((r, i) => {
          const last = i === sorted.length - 1;
          return (
            <TouchableOpacity
              key={r.userId}
              style={[st.row, last && st.rowLast]}
              activeOpacity={0.7}
              onPress={() => openUser(r.userId)}>
              <Text style={[st.rank, i === 0 && st.rankTop]}>{i + 1}</Text>
              <Avatar uri={r.avatar} name={r.name} />
              <View style={st.rowBody}>
                <Text style={st.rowName} numberOfLines={1}>{r.username ? `@${r.username}` : r.name}</Text>
                <Text style={st.rowMeta} numberOfLines={1}>
                  {sort === 'sends'
                    ? (r.topGrade ? `Top ${r.topGrade}` : '—')
                    : `${r.sends} send${r.sends !== 1 ? 's' : ''}`}
                </Text>
              </View>
              <Text style={[st.rowVal, i === 0 && st.rowValTop]}>
                {sort === 'sends' ? r.sends : (r.topGrade ?? '—')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Recent sends */}
      {recent.length > 0 && (
        <>
          <Text style={[st.kicker, { marginTop: 26 }]}>RECENT SENDS</Text>
          <View style={st.recent}>
            {recent.map((r) => (
              <TouchableOpacity key={r.sessionId} style={st.recentRow} activeOpacity={0.7} onPress={() => router.push(`/session/${r.sessionId}`)}>
                <Avatar uri={r.avatar} name={r.name} size={32} />
                <Text style={st.recentText} numberOfLines={1}>
                  <Text style={st.recentName}>{r.username ? `@${r.username}` : r.name}</Text>
                  <Text style={st.recentVerb}> sent </Text>
                  <Text style={st.recentGrade}>{r.grade}</Text>
                </Text>
                <Text style={st.recentTime}>{timeAgo(r.createdAt)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 60 },
  center: { paddingVertical: 60, paddingHorizontal: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: 'Syne_800ExtraBold', color: INK },
  emptySub: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: INK3, textAlign: 'center', lineHeight: 19 },
  kicker: { fontSize: 9, fontFamily: 'SpaceGrotesk_600SemiBold', letterSpacing: 2.5, color: INK3 },
  headline: { fontSize: 26, fontFamily: 'Syne_800ExtraBold', letterSpacing: -1, color: INK, marginTop: 6, marginBottom: 16 },
  toggle: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  toggleChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: SURFACE },
  toggleChipActive: { backgroundColor: INK },
  toggleText: { fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold', color: INK3 },
  toggleTextActive: { color: '#ffffff' },
  board: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DIVIDER },
  rowLast: { borderBottomWidth: 0 },
  rank: { width: 16, fontSize: 14, fontFamily: 'Syne_800ExtraBold', color: INK3, textAlign: 'center' },
  rankTop: { color: SAND },
  rowBody: { flex: 1 },
  rowName: { fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold', color: INK },
  rowMeta: { fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', color: INK3, marginTop: 1 },
  rowVal: { fontSize: 18, fontFamily: 'Syne_800ExtraBold', color: INK, letterSpacing: -0.5 },
  rowValTop: { color: SAND },
  recent: { marginTop: 8, gap: 2 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  recentText: { flex: 1, fontSize: 14, color: INK2 },
  recentName: { fontFamily: 'SpaceGrotesk_700Bold', color: INK },
  recentVerb: { fontFamily: 'SpaceGrotesk_400Regular', color: INK3 },
  recentGrade: { fontFamily: 'Syne_800ExtraBold', color: SAND },
  recentTime: { fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK3 },
});
