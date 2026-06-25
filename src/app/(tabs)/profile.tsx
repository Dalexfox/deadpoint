import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Share,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  getProfileAvatar,
  saveProfileAvatar,
  uploadProfileAvatar,
  getProfileBanner,
  uploadProfileBanner,
  saveUserPost,
  NOTIF_LAST_SEEN_KEY,
} from '../../lib/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { fetchGyms, gymName as resolveGymName } from '../../lib/gyms';
import { monthStats, highestGrade, weekStreak } from '../../lib/stats';
import { ensureCameraPermission } from '../../lib/permissions';
import { ClimbDatePicker, climbDayKey } from '../../components/ClimbDatePicker';

// V-scale order used to determine hardest grade sent
const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];

const SCREEN_WIDTH  = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

// Chart width = screen width minus card margins (20px × 2) and card padding (16px × 2)
const CHART_WIDTH = SCREEN_WIDTH - 72;

// Carousel card — wide enough to fill the screen with the next card peeking in from the right
const CARD_GAP   = 12;
const CARD_PEEK  = 28;  // how many px of the next card are visible
const CARD_WIDTH = SCREEN_WIDTH - 20 - CARD_GAP - CARD_PEEK; // 20 = left margin

// Shared chart config — warm cream background
const BASE_CHART_CONFIG = {
  backgroundColor:         '#f4f1eb',
  backgroundGradientFrom:  '#f4f1eb',
  backgroundGradientTo:    '#f4f1eb',
  decimalPlaces:           0,
  labelColor:              () => '#8a7a50',       // INK3
  propsForBackgroundLines: { stroke: 'rgba(26,20,8,0.08)' }, // DIVIDER
};

const PRIMARY_CHART_CONFIG = {
  ...BASE_CHART_CONFIG,
  color: (opacity = 1) => `rgba(26, 20, 8, ${opacity})`, // INK
};

const ACCENT_CHART_CONFIG = {
  ...BASE_CHART_CONFIG,
  color: (opacity = 1) => `rgba(200, 168, 74, ${opacity})`, // SAND
};


// Derived datasets fed into the three charts
type ChartData = {
  weeklyIntensity:   number[];  // problems per day, Mon–Sun of current week
  gradeDistribution: number[];  // total climb count per grade, V0–V10
  maxGradeIndex:     number;    // index of the most-climbed grade (highlighted pink)
  monthlyVolume:     number[];  // total problems per week for last 12 weeks
  weekLabels:        string[];  // e.g. ['Apr 7', '', 'Apr 21', '', ...]
  terrain:           { section: string; count: number; pct: number }[]; // climbs by wall section, sorted desc
};

// A single climb row joined with its session's gym + date — used for grade drill-down
type ClimbEntry = {
  sessionId: string;
  grade:     string;
  count:     number;
  gymName:   string;
  date:      string;
  createdAt: string;
  mediaUrl:  string | null;
  visibility: 'public' | 'quiet';
  sendStyle: 'flash' | 'send' | 'project' | null;
};

// Shape of a session card built from Supabase data
type SupabaseSession = {
  id:        string;
  gymName:   string;
  grade:     string | null;  // climbs[0].grade — every session is exactly one climb
  date:      string;  // e.g. "May 27, 2026"
  createdAt: string;  // ISO string — used to filter sessions by day for chart drill-down
  mediaUrl:  string | null;  // Supabase Storage URL for attached photo / video
  notes:     string | null;  // optional description/notes from the log form
};

// A user shown in the followers / following bottom sheet
type FollowUser = {
  id:        string;
  fullName:  string;
  username:  string | null;
  avatarUrl: string | null;
};

// Active profile tab
type ProfileTab   = 'overview' | 'sessions' | 'settings';
type MyClimbsSort = 'date' | 'gym';

const BG        = '#ffffff';
const CARD      = '#f4f1eb';
const SURFACE   = '#ece8df';
const ACCENT    = '#e8383c';
const SAND      = '#c8a84a';
const SAND_LT   = '#e8c87a';
const INK       = '#1a1408';
const INK2      = '#3d3320';
const INK3      = '#8a7a50';
const DIVIDER   = 'rgba(26,20,8,0.08)';

function toInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');
}

const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'overview',  label: 'Overview'  },
  { key: 'sessions',  label: 'My Climbs'  },
  { key: 'settings',  label: 'Settings'  },
];

function StatColumn({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statColumn}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Split array into consecutive pairs — used for the 2-row column grid layout. */
/** Chunk an array into rows of `size` — used for the 3-column grid. */
function toRows<T>(arr: T[], size = 3): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size));
  return rows;
}

const CLIMB_CARD_GAP = 8;

function ClimbGridCard({ entry }: { entry: ClimbEntry }) {
  return (
    <View style={styles.gridCard}>
      {entry.mediaUrl ? (
        <Image source={{ uri: entry.mediaUrl }} style={styles.gridCardThumb} resizeMode="cover" />
      ) : (
        <View style={styles.gridCardThumbEmpty}>
          <Text style={styles.gridCardEmptyIcon}>🧗</Text>
        </View>
      )}
      {entry.visibility === 'quiet' && (
        <View style={styles.gridCardQuiet}>
          <Ionicons name="eye-off-outline" size={12} color="#ffffff" />
        </View>
      )}
      {entry.sendStyle && (
        <View style={[styles.gridCardStyleTag, entry.sendStyle === 'project' && styles.gridCardStyleTagMuted]}>
          <Text style={[styles.gridCardStyleTagText, entry.sendStyle === 'project' && styles.gridCardStyleTagTextMuted]}>
            {entry.sendStyle === 'flash' ? 'FLASH' : entry.sendStyle === 'send' ? 'SEND' : 'PROJ'}
          </Text>
        </View>
      )}
      <View style={styles.gridCardBody}>
        <Text style={styles.gridCardGrade}>{entry.grade}</Text>
        <Text style={styles.gridCardGym} numberOfLines={1}>{entry.gymName}</Text>
        <Text style={styles.gridCardDate}>{entry.date}</Text>
        <View style={styles.gridCardPill}>
          <Text style={styles.gridCardPillText}>▲ VITAL</Text>
        </View>
      </View>
    </View>
  );
}

function CarouselCard({ session }: { session: SupabaseSession }) {
  return (
    <View style={styles.carouselCard}>
      {/* Left: text content */}
      <View style={styles.carouselLeft}>
        {session.grade && (
          <Text style={styles.carouselTopGrade}>{session.grade}</Text>
        )}
        {session.notes ? (
          <Text style={styles.carouselNotes} numberOfLines={3}>{session.notes}</Text>
        ) : null}
        <View style={styles.carouselDivider} />
        <Text style={styles.carouselGymName}>{session.gymName}</Text>
        <Text style={styles.carouselDate}>{session.date}</Text>
        <View style={styles.carouselPill}>
          <Text style={styles.carouselPillText}>▲  VITAL</Text>
        </View>
      </View>

      {/* Right: image absolutely centered to the full card height */}
      {session.mediaUrl && (
        <View style={styles.carouselThumbWrapper}>
          <Image
            source={{ uri: session.mediaUrl }}
            style={styles.carouselThumb}
            resizeMode="cover"
          />
        </View>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();

  const [avatarUri, setAvatarUri]   = useState<string | null>(null);
  const [bannerUri, setBannerUri]   = useState<string | null>(null);
  const [hasUnreadNotif, setHasUnreadNotif] = useState(false);
  const [sessions,  setSessions]    = useState<SupabaseSession[]>([]);
  const [chartData, setChartData]   = useState<ChartData | null>(null);
  const [chartsLoading, setChartsLoading] = useState(true);

  // Progress stats — all derived client-side from the user's own sessions via
  // pure helpers in src/lib/stats.ts (no schema, no extra query).
  const progress = useMemo(() => {
    const stat = sessions.map(s => ({ createdAt: s.createdAt, grade: s.grade }));
    return {
      month:     monthStats(stat),
      highPoint: highestGrade(stat),
      streak:    weekStreak(stat),
    };
  }, [sessions]);
  const [selectedWeekDay, setSelectedWeekDay] = useState<number | null>(null);
  const [climbEntries, setClimbEntries]       = useState<ClimbEntry[]>([]);
  const [selectedGrade, setSelectedGrade]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');

  // ── My Climbs tab state ──────────────────────────────────────
  const [myClimbsSlider,   setMyClimbsSlider]   = useState<number | null>(null); // null = no dot highlighted
  const [myClimbsFilter,   setMyClimbsFilter]   = useState<string | null>(null); // null = show all
  const [myClimbsSort,     setMyClimbsSort]     = useState<MyClimbsSort>('date');
  const [myClimbsDropdown, setMyClimbsDropdown] = useState(false);
  const [myClimbsSelectedDay, setMyClimbsSelectedDay] = useState<Date | null>(null);
  const [myClimbsDatePickerOpen, setMyClimbsDatePickerOpen] = useState(false);

  const myClimbsMarkedDays = new Set(climbEntries.map((e) => climbDayKey(new Date(e.createdAt))));

  // Grade-grouped sections for My Climbs — filtered by active grade + date, sorted within each group
  const filteredGroups = (() => {
    let source = myClimbsFilter
      ? climbEntries.filter((e) => e.grade === myClimbsFilter)
      : climbEntries;
    if (myClimbsSelectedDay) {
      const key = climbDayKey(myClimbsSelectedDay);
      source = source.filter((e) => climbDayKey(new Date(e.createdAt)) === key);
    }
    const byGrade: Record<string, ClimbEntry[]> = {};
    source.forEach((e) => {
      if (!byGrade[e.grade]) byGrade[e.grade] = [];
      byGrade[e.grade].push(e);
    });
    Object.keys(byGrade).forEach((grade) => {
      if (myClimbsSort === 'gym') byGrade[grade].sort((a, b) => a.gymName.localeCompare(b.gymName));
    });
    return GRADES.filter((g) => byGrade[g]?.length).map((g) => ({
      grade: g,
      entries: byGrade[g],
    }));
  })();

  const [editName, setEditName]         = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio]           = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Committed header values — only update after a successful Save Changes
  const [displayName,     setDisplayName]     = useState('');
  const [displayUsername, setDisplayUsername] = useState('');
  const [displayBio,      setDisplayBio]      = useState('');

  const [stats, setStats] = useState<{
    totalClimbs: number;
    gymsVisited: number;
    topGrade:    string;
  }>({ totalClimbs: 0, gymsVisited: 0, topGrade: '—' });

  const [currentUserId,      setCurrentUserId]      = useState<string | null>(null);
  const [followerCount,      setFollowerCount]      = useState(0);
  const [followingCount,     setFollowingCount]     = useState(0);
  const [followersVisible,   setFollowersVisible]   = useState(false);
  const [followingVisible,   setFollowingVisible]   = useState(false);
  const [followersList,      setFollowersList]      = useState<FollowUser[]>([]);
  const [followingList,      setFollowingList]      = useState<FollowUser[]>([]);
  const [followListLoading,  setFollowListLoading]  = useState(false);

  /** Grade slider tap → set active filter to that grade */
  const handleMyClimbsSlider = (idx: number) => {
    setMyClimbsSlider(idx);
    setMyClimbsFilter(GRADES[idx]);
  };

  useEffect(() => {
    getProfileAvatar().then(setAvatarUri);
    getProfileBanner().then(setBannerUri);
  }, []);

  // Unread-notification dot: is the latest activity on my content newer than the
  // last time I opened the Notifications screen? (Lightweight: 3 limit-1 queries.)
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { data: mySess } = await supabase.from('sessions').select('id').eq('user_id', user.id);
          const ids = (mySess ?? []).map((s) => s.id);
          const [lk, cm, fl] = await Promise.all([
            ids.length ? supabase.from('likes').select('created_at').in('session_id', ids).neq('user_id', user.id).order('created_at', { ascending: false }).limit(1) : Promise.resolve({ data: [] as any[] }),
            ids.length ? supabase.from('comments').select('created_at').in('session_id', ids).neq('user_id', user.id).order('created_at', { ascending: false }).limit(1) : Promise.resolve({ data: [] as any[] }),
            supabase.from('follows').select('created_at').eq('following_id', user.id).order('created_at', { ascending: false }).limit(1),
          ]);
          const times = [lk.data?.[0]?.created_at, cm.data?.[0]?.created_at, fl.data?.[0]?.created_at].filter(Boolean) as string[];
          if (times.length === 0) { if (active) setHasUnreadNotif(false); return; }
          const latest = Math.max(...times.map((t) => +new Date(t)));
          const seen = await AsyncStorage.getItem(NOTIF_LAST_SEEN_KEY);
          const seenMs = seen ? +new Date(seen) : 0;
          if (active) setHasUnreadNotif(latest > seenMs);
        } catch { /* ignore — dot just won't show */ }
      })();
      return () => { active = false; };
    }, [])
  );

  // Every time the Profile tab gains focus, fetch sessions + climbs fresh from
  // Supabase then derive all stats and chart data — no extra round-trips.
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          setCurrentUserId(user.id);

          // ── 0. Profile fields (for Settings edit form) ──────────
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('full_name, username, bio, avatar_url')
            .eq('id', user.id)
            .single();
          if (profileRow) {
            setEditName(profileRow.full_name ?? '');
            setEditUsername(profileRow.username ?? '');
            setEditBio(profileRow.bio ?? '');
            setDisplayName(profileRow.full_name ?? '');
            setDisplayUsername(profileRow.username ?? '');
            setDisplayBio(profileRow.bio ?? '');
            // avatar_url is the SOURCE OF TRUTH (survives reinstalls / new devices).
            // The AsyncStorage cache is only a fast first paint; the DB value wins.
            if (profileRow.avatar_url) {
              setAvatarUri(profileRow.avatar_url);
              saveProfileAvatar(profileRow.avatar_url); // keep the local cache in sync
            }
          }

          // ── Follow counts ─────────────────────────────────────────
          try {
            const [{ count: fc }, { count: fgc }] = await Promise.all([
              supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
              supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
            ]);
            setFollowerCount(fc ?? 0);
            setFollowingCount(fgc ?? 0);
          } catch { /* follows table may not exist yet */ }

          // ── 1. Sessions ─────────────────────────────────────────
          const [gyms, { data: rawSessions, error: sessionsError }] = await Promise.all([
            fetchGyms(),
            supabase
            .from('sessions')
              .select('id, gym_id, created_at, media_url, notes, visibility')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false }),
          ]);

          if (sessionsError || !rawSessions) return;

          if (rawSessions.length === 0) {
            setSessions([]);
            setStats({ totalClimbs: 0, gymsVisited: 0, topGrade: '—' });
            setChartsLoading(false);
            return;
          }

          // ── 2. Climbs ───────────────────────────────────────────
          const sessionIds = rawSessions.map((s) => s.id);
          const { data: climbs } = await supabase
            .from('climbs')
            .select('session_id, grade, count, problem_id, send_style')
            .in('session_id', sessionIds);

          const allClimbs = climbs ?? [];

          // ── Terrain breakdown — climbs by wall section (via the linked problem) ──
          const climbProblemIds = [...new Set(allClimbs.map((c) => (c as any).problem_id).filter(Boolean))] as string[];
          const wallById: Record<string, string | null> = {};
          if (climbProblemIds.length > 0) {
            const { data: probs } = await supabase
              .from('problems')
              .select('id, wall_section')
              .in('id', climbProblemIds);
            (probs ?? []).forEach((p: { id: string; wall_section: string | null }) => { wallById[p.id] = p.wall_section; });
          }
          const sectionCounts: Record<string, number> = {};
          allClimbs.forEach((c) => {
            const ws = (c as any).problem_id ? wallById[(c as any).problem_id] : null;
            if (ws) sectionCounts[ws] = (sectionCounts[ws] ?? 0) + c.count;
          });
          const terrainTotal = Object.values(sectionCounts).reduce((a, b) => a + b, 0);
          const terrain = Object.entries(sectionCounts)
            .map(([section, count]) => ({ section, count, pct: terrainTotal ? Math.round((count / terrainTotal) * 100) : 0 }))
            .sort((a, b) => b.count - a.count);

          const climbsBySession: Record<string, Array<{ grade: string; count: number }>> = {};
          allClimbs.forEach((c) => {
            if (!climbsBySession[c.session_id]) climbsBySession[c.session_id] = [];
            climbsBySession[c.session_id].push({ grade: c.grade, count: c.count });
          });

          // ── 3. Session cards ────────────────────────────────────
          const formatted: SupabaseSession[] = rawSessions.map((s) => {
            const gymName = resolveGymName(gyms, s.gym_id);
            const grade   = (climbsBySession[s.id]?.[0]?.grade) ?? null;
            const date    = new Date(s.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            });
            return { id: s.id, gymName, grade, date, createdAt: s.created_at, mediaUrl: s.media_url ?? null, notes: s.notes ?? null };
          });
          setSessions(formatted);

          // ── 4. Stats ────────────────────────────────────────────
          const uniqueGyms  = new Set(rawSessions.map((s) => s.gym_id)).size;
          const totalClimbs = allClimbs.length; // one climb row per session
          // Overall top grade: hardest V-scale grade across all SENDS.
          // Projects (still being worked) aren't sends → excluded from your top grade.
          let topGradeIndex = -1;
          allClimbs.forEach((c) => {
            if ((c as any).send_style === 'project') return;
            const idx = GRADES.indexOf(c.grade);
            if (idx > topGradeIndex) topGradeIndex = idx;
          });
          setStats({ totalClimbs, gymsVisited: uniqueGyms, topGrade: topGradeIndex >= 0 ? GRADES[topGradeIndex] : '—' });

          // ── 5. Chart data ───────────────────────────────────────
          const now          = new Date();
          const daysFromMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
          const weekStart    = new Date(now);
          weekStart.setDate(now.getDate() - daysFromMonday);
          weekStart.setHours(0, 0, 0, 0);

          const dailyCounts = [0, 0, 0, 0, 0, 0, 0];
          rawSessions.forEach((s) => {
            const d = new Date(s.created_at);
            if (d >= weekStart) {
              const idx = (d.getDay() + 6) % 7;
              if (idx < 7) dailyCounts[idx] += 1;
            }
          });

          const gradeCounts = new Array(11).fill(0);
          allClimbs.forEach((c) => {
            const idx = GRADES.indexOf(c.grade);
            if (idx >= 0) gradeCounts[idx] += c.count;
          });
          const maxGradeVal   = Math.max(...gradeCounts);
          const maxGradeIndex = maxGradeVal > 0 ? gradeCounts.indexOf(maxGradeVal) : -1;

          const weeklyTotals: number[] = [];
          const weekLabels:   string[] = [];
          for (let i = 11; i >= 0; i--) {
            const wEnd = new Date(now);
            wEnd.setDate(now.getDate() - i * 7);
            wEnd.setHours(23, 59, 59, 999);
            const wStart = new Date(wEnd);
            wStart.setDate(wEnd.getDate() - 6);
            wStart.setHours(0, 0, 0, 0);
            weeklyTotals.push(
              rawSessions
                .filter((s) => { const d = new Date(s.created_at); return d >= wStart && d <= wEnd; })
                .reduce((sum) => sum + 1, 0)
            );
            weekLabels.push(
              i % 2 === 0
                ? wStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : ''
            );
          }

          setChartData({ weeklyIntensity: dailyCounts, gradeDistribution: gradeCounts, maxGradeIndex, monthlyVolume: weeklyTotals, weekLabels, terrain });

          // ── 6. Climb entries for grade drill-down ───────────────
          const sessionMetaById: Record<string, { gymName: string; date: string; createdAt: string; mediaUrl: string | null; visibility: 'public' | 'quiet' }> = {};
          rawSessions.forEach((s) => {
            sessionMetaById[s.id] = {
              gymName: resolveGymName(gyms, s.gym_id),
              date: new Date(s.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              }),
              createdAt: s.created_at,
              mediaUrl: s.media_url ?? null,
              visibility: ((s as any).visibility ?? 'public') as 'public' | 'quiet',
            };
          });
          setClimbEntries(
            allClimbs
              .filter((c) => c.count > 0)
              .map((c) => ({
                sessionId: c.session_id,
                grade:     c.grade,
                count:     c.count,
                gymName:   sessionMetaById[c.session_id]?.gymName ?? 'Unknown Gym',
                date:      sessionMetaById[c.session_id]?.date ?? '',
                createdAt: sessionMetaById[c.session_id]?.createdAt ?? '',
                mediaUrl:  sessionMetaById[c.session_id]?.mediaUrl ?? null,
                visibility: sessionMetaById[c.session_id]?.visibility ?? 'public',
                sendStyle: ((c as any).send_style ?? null) as ClimbEntry['sendStyle'],
              }))
          );

          setChartsLoading(false);
        } catch {
          setChartsLoading(false);
        }
      };
      loadData();
    }, [])
  );

  // ── Image handlers ───────────────────────────────────────────────
  const handleAvatarPress = () => {
    Alert.alert('Profile Photo', 'Choose a photo for your profile', [
      { text: 'Choose from Library', onPress: pickAvatar },
      { text: 'Take Photo', onPress: takeAvatarPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      uploadProfileAvatar(uri).then(({ url, error }) => {
        if (url) setAvatarUri(url);
        else Alert.alert("Photo didn't save", error ?? 'Check your connection and try again.');
      });
    }
  };

  const takeAvatarPhoto = async () => {
    if (!(await ensureCameraPermission())) return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      uploadProfileAvatar(uri).then(({ url, error }) => {
        if (url) setAvatarUri(url);
        else Alert.alert("Photo didn't save", error ?? 'Check your connection and try again.');
      });
    }
  };

  const handleBannerPress = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [3, 1], quality: 0.85,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setBannerUri(uri); // optimistic; swap to the durable storage URL once uploaded
      uploadProfileBanner(uri).then((url) => { if (url) setBannerUri(url); });
    }
  };

  const handleShare = () => {
    Alert.alert('Share to Feed', 'Add a photo or video to your feed', [
      { text: 'Choose Photo', onPress: () => shareMedia('images') },
      { text: 'Choose Video', onPress: () => shareMedia('videos') },
      { text: 'Take Photo',   onPress: shareFromCamera },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const shareMedia = async (type: 'images' | 'videos') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [type], allowsEditing: true, quality: 0.85, videoMaxDuration: 60,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      await publishPost(asset.uri, asset.type === 'video' ? 'video' : 'image');
    }
  };

  const shareFromCamera = async () => {
    if (!(await ensureCameraPermission())) return;
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.85 });
    if (!result.canceled) await publishPost(result.assets[0].uri, 'image');
  };

  const publishPost = async (uri: string, mediaType: 'image' | 'video') => {
    await saveUserPost({
      id: Date.now().toString(), name: displayName, initials: toInitials(displayName),
      avatarBg: INK, timestamp: 'Just now', likes: 0, comments: 0,
      liked: false, postType: 'photo', media: [{ type: mediaType, uri }],
    });
    Alert.alert('Posted!', 'Your photo is now live on the feed.');
  };

  const handleSignOut = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const handleInviteFriends = async () => {
    await Share.share({
      message: 'Join me on Deadpoint! 🧗 Track your climbing sessions and share them with friends.',
    });
  };

  const handleOpenFollowers = async () => {
    setFollowersVisible(true);
    setFollowListLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setFollowListLoading(false); return; }
      const { data: followsData } = await supabase
        .from('follows').select('follower_id').eq('following_id', user.id);
      const ids = (followsData ?? []).map((f: { follower_id: string }) => f.follower_id);
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, full_name, username, avatar_url').in('id', ids);
        setFollowersList((profiles ?? []).map((p: { id: string; full_name: string | null; username: string | null; avatar_url: string | null }) => ({
          id: p.id, fullName: p.full_name ?? 'Climber',
          username: p.username ?? null, avatarUrl: p.avatar_url ?? null,
        })));
      } else {
        setFollowersList([]);
      }
    } catch {
      setFollowersList([]);
    } finally {
      setFollowListLoading(false);
    }
  };

  const handleOpenFollowing = async () => {
    setFollowingVisible(true);
    setFollowListLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setFollowListLoading(false); return; }
      const { data: followsData } = await supabase
        .from('follows').select('following_id').eq('follower_id', user.id);
      const ids = (followsData ?? []).map((f: { following_id: string }) => f.following_id);
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, full_name, username, avatar_url').in('id', ids);
        setFollowingList((profiles ?? []).map((p: { id: string; full_name: string | null; username: string | null; avatar_url: string | null }) => ({
          id: p.id, fullName: p.full_name ?? 'Climber',
          username: p.username ?? null, avatarUrl: p.avatar_url ?? null,
        })));
      } else {
        setFollowingList([]);
      }
    } catch {
      setFollowingList([]);
    } finally {
      setFollowListLoading(false);
    }
  };

  const handleUnfollow = async (targetId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('follows').delete()
        .eq('follower_id', user.id).eq('following_id', targetId);
      setFollowingList((prev) => prev.filter((u) => u.id !== targetId));
      setFollowingCount((prev) => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editName.trim(),
          username:  editUsername.trim().replace(/^@/, ''),
          bio:       editBio.trim(),
        })
        .eq('id', user.id);
      if (error) {
        Alert.alert('Error', 'Could not save changes. Please try again.');
      } else {
        setDisplayName(editName.trim());
        setDisplayUsername(editUsername.trim().replace(/^@/, ''));
        setDisplayBio(editBio.trim());
        Alert.alert('Saved', 'Your profile has been updated.');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Top header row (always visible) ────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} hitSlop={8} onPress={() => router.push('/notifications')} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={23} color={INK} />
            {hasUnreadNotif && <View style={styles.notifDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleShare} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={24} color={SAND} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} hitSlop={12} onPress={() => setActiveTab('settings')}>
            <Ionicons name="settings-outline" size={22} color={INK3} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Tab bar — fixed, always visible ────────────────────── */}
      <View style={styles.tabBar}>
        {TABS.map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              style={styles.tabItem}
              onPress={() => setActiveTab(key)}
              activeOpacity={0.7}>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {label}
              </Text>
              {isActive && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Stats bar — fixed below tab bar, Overview tab only ───── */}
      {activeTab === 'overview' && <View style={styles.statsRow}>
        <StatColumn label="Total Climbs" value={stats.totalClimbs} />
        <View style={styles.statDivider} />
        <StatColumn label="Gyms Visited" value={stats.gymsVisited} />
        <View style={styles.statDivider} />
        <StatColumn label="Top Grade" value={stats.topGrade} />
      </View>}

      {/* ── Single scroll: profile header + active tab content ──── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Profile section — scrolls with the page */}
        <View>
        {/* Banner */}
        <View style={styles.bannerSection}>
          {bannerUri ? (
            <Image source={{ uri: bannerUri }} style={styles.bannerImage} resizeMode="cover" />
          ) : (
            <View style={styles.bannerPlaceholder} />
          )}
          <TouchableOpacity style={styles.bannerCameraBtn} onPress={handleBannerPress} activeOpacity={0.8}>
            <Ionicons name="camera" size={15} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Identity */}
        <View style={styles.identitySection}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={handleAvatarPress} activeOpacity={0.85}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarInitials}>{toInitials(displayName)}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditIcon}>＋</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.nameRow}>
            <View>
              <Text style={styles.name}>{displayName}</Text>
              {displayUsername ? (
                <Text style={styles.username}>@{displayUsername}</Text>
              ) : null}
              {displayBio ? <Text style={styles.headerBio}>{displayBio}</Text> : null}
            </View>
            <TouchableOpacity style={styles.inviteFriendsBtn} onPress={handleInviteFriends} activeOpacity={0.7}>
              <Text style={styles.inviteFriendsLabel}>Invite Friends</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.followCountRow}>
            <TouchableOpacity onPress={handleOpenFollowers} activeOpacity={0.7}>
              <Text style={styles.followCountText}>
                <Text style={styles.followCountNum}>{followerCount}</Text>
                {' '}<Text style={styles.followCountLabel}>followers</Text>
              </Text>
            </TouchableOpacity>
            <Text style={styles.followCountDot}> · </Text>
            <TouchableOpacity onPress={handleOpenFollowing} activeOpacity={0.7}>
              <Text style={styles.followCountText}>
                <Text style={styles.followCountNum}>{followingCount}</Text>
                {' '}<Text style={styles.followCountLabel}>following</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>

</View>

      {/* ── Overview tab — charts ───────────────────────────────── */}
      {activeTab === 'overview' && (
        <View style={styles.tabContentView}>

          {chartsLoading ? (
            <View style={styles.chartsLoadingContainer}>
              <ActivityIndicator size="small" color={SAND} />
            </View>
          ) : chartData ? (
            <>
              {/* Weekly Intensity */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Weekly Intensity</Text>
                <Text style={styles.chartSubtitle}>Problems logged this week · tap a day to drill down</Text>
                <BarChart
                  data={{
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                      data: chartData.weeklyIntensity,
                      colors: chartData.weeklyIntensity.map((_, i) =>
                        (_opacity: number) =>
                          selectedWeekDay === null || selectedWeekDay === i
                            ? '#1a1408'
                            : '#ece8df'
                      ),
                    }],
                  }}
                  width={CHART_WIDTH}
                  height={180}
                  chartConfig={PRIMARY_CHART_CONFIG}
                  style={styles.chart}
                  withCustomBarColorFromData
                  flatColor
                  fromZero
                  showValuesOnTopOfBars={false}
                  withInnerLines={false}
                  yAxisLabel=""
                  yAxisSuffix=""
                />

                {/* Day chips */}
                <View style={styles.dayChipRow}>
                  {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map((label, i) => {
                    const hasClimbs = chartData.weeklyIntensity[i] > 0;
                    const isSelected = selectedWeekDay === i;
                    return (
                      <TouchableOpacity
                        key={label}
                        style={[
                          styles.dayChip,
                          isSelected && styles.dayChipActive,
                          !hasClimbs && styles.dayChipEmpty,
                        ]}
                        onPress={() => setSelectedWeekDay(isSelected ? null : i)}
                        activeOpacity={0.7}
                        disabled={!hasClimbs}>
                        <Text style={[styles.dayChipLabel, isSelected && styles.dayChipLabelActive]}>
                          {label}
                        </Text>
                        {hasClimbs && (
                          <Text style={[styles.dayChipCount, isSelected && styles.dayChipCountActive]}>
                            {chartData.weeklyIntensity[i]}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Day drill-down */}
                {selectedWeekDay !== null && (() => {
                  const now = new Date();
                  const daysFromMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
                  const monday = new Date(now);
                  monday.setDate(now.getDate() - daysFromMonday);
                  monday.setHours(0, 0, 0, 0);
                  const targetDay = new Date(monday);
                  targetDay.setDate(monday.getDate() + selectedWeekDay);

                  const daySessions = sessions.filter((s) => {
                    const d = new Date(s.createdAt);
                    return d.toDateString() === targetDay.toDateString();
                  });

                  const dayLabel = targetDay.toLocaleDateString('en-US', {
                    weekday: 'long', month: 'short', day: 'numeric',
                  });

                  return (
                    <View style={styles.dayDetail}>
                      <Text style={styles.dayDetailHeading}>{dayLabel}</Text>
                      {daySessions.length === 0 ? (
                        <Text style={styles.dayDetailEmpty}>No climbs logged this day.</Text>
                      ) : (
                        daySessions.map((s) => (
                          <View key={s.id} style={styles.dayDetailCard}>
                            <View style={styles.dayDetailAccentBar} />
                            <View style={styles.dayDetailBody}>
                              <Text style={styles.dayDetailGym}>{s.gymName}</Text>
                              {s.grade && <Text style={styles.dayDetailGrades}>{s.grade}</Text>}
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  );
                })()}
              </View>

              {/* Progress — single-player stats. Own profile only (this screen is
                  always the owner's; /user/[id] never renders this section). */}
              <View style={styles.chartCard}>
                <Text style={styles.progressLabel}>PROGRESS</Text>
                <View style={styles.progressRow}>

                  {/* This month */}
                  <View style={styles.progressBlock}>
                    <Text style={styles.progressValue}>{progress.month.sends}</Text>
                    <Text style={styles.progressBlockLabel}>
                      {progress.month.sends === 1 ? 'send' : 'sends'} this month
                    </Text>
                    <Text style={styles.progressSub}>
                      {progress.month.daysClimbed} {progress.month.daysClimbed === 1 ? 'day' : 'days'} climbed
                    </Text>
                  </View>

                  <View style={styles.progressDivider} />

                  {/* High point — reuses the existing grade chip style */}
                  <View style={styles.progressBlock}>
                    <View style={[styles.gradeChip, styles.gradeChipActive]}>
                      <Text style={[styles.gradeChipLabel, styles.gradeChipLabelActive]}>
                        {progress.highPoint ?? '—'}
                      </Text>
                    </View>
                    <Text style={styles.progressBlockLabel}>high point</Text>
                  </View>

                  <View style={styles.progressDivider} />

                  {/* Streak */}
                  <View style={styles.progressBlock}>
                    {progress.streak >= 2 ? (
                      <>
                        <Text style={styles.progressValue}>{progress.streak}</Text>
                        <Text style={styles.progressBlockLabel}>week streak</Text>
                      </>
                    ) : (
                      <Text style={styles.progressStreakHint}>
                        Log a climb every week to build a streak
                      </Text>
                    )}
                  </View>

                </View>
              </View>

              {/* Terrain — climbs by wall section (Arc'teryx editorial) */}
              <View style={styles.chartCard}>
                <Text style={styles.terrainLabel}>TERRAIN</Text>
                {chartData.terrain.length === 0 ? (
                  <Text style={styles.terrainEmpty}>Log climbs with a wall section to see your terrain.</Text>
                ) : (
                  <>
                    <Text style={styles.terrainHero}>{chartData.terrain[0].section}</Text>
                    <Text style={styles.terrainHeroSub}>your ground · {chartData.terrain[0].pct}% of sends</Text>

                    <View style={styles.terrainList}>
                      {chartData.terrain.map((t, i) => (
                        <View key={t.section} style={styles.terrainRow}>
                          <Text style={styles.terrainName} numberOfLines={1}>{t.section}</Text>
                          <View style={styles.terrainTrack}>
                            <View style={[styles.terrainFill, {
                              // scale bars relative to the dominant terrain → punchier, dominant fills the track
                              width: `${chartData.terrain[0].pct ? Math.max((t.pct / chartData.terrain[0].pct) * 100, 4) : 0}%`,
                              opacity: i === 0 ? 1 : 0.45,
                            }]} />
                          </View>
                          <Text style={styles.terrainPct}>{t.pct}%</Text>
                          <Text style={styles.terrainCount}>{t.count}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>

              {/* Grade Pyramid — centered bars, hardest on top (apex), easy grades = wide base */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Grade Pyramid</Text>
                <Text style={styles.chartSubtitle}>Your sends stacked by grade · tap a grade to drill down</Text>

                {(() => {
                  const maxVal = Math.max(...chartData.gradeDistribution, 1);
                  const rows = GRADES
                    .map((grade, i) => ({ grade, count: chartData.gradeDistribution[i], isPeak: i === chartData.maxGradeIndex }))
                    .filter((r) => r.count > 0)
                    .reverse(); // hardest grade on top → easy grades form the wide base
                  if (rows.length === 0) {
                    return <Text style={styles.pyramidEmpty}>Log a climb to build your pyramid.</Text>;
                  }
                  return (
                    <View style={styles.pyramidWrap}>
                      {rows.map((r) => {
                        const isSel = selectedGrade === r.grade;
                        return (
                          <TouchableOpacity
                            key={r.grade}
                            style={styles.pyramidRow}
                            onPress={() => setSelectedGrade(isSel ? null : r.grade)}
                            activeOpacity={0.7}>
                            <Text style={[styles.pyramidGrade, isSel && styles.pyramidGradeActive]}>{r.grade}</Text>
                            <View style={styles.pyramidTrack}>
                              <View style={[styles.pyramidBar, {
                                width: `${Math.max((r.count / maxVal) * 100, 7)}%`,
                                backgroundColor: r.isPeak ? ACCENT : SAND,
                                opacity: selectedGrade !== null && !isSel ? 0.3 : 1,
                              }]} />
                            </View>
                            <Text style={styles.pyramidCount}>{r.count}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })()}

                {/* Grade drill-down — rows are tappable to open media */}
                {selectedGrade !== null && (() => {
                  const entries    = climbEntries.filter((e) => e.grade === selectedGrade);
                  const totalSends = entries.reduce((sum, e) => sum + e.count, 0);
                  if (entries.length === 0) return null;
                  return (
                    <View style={styles.dayDetail}>
                      <Text style={styles.dayDetailHeading}>
                        {selectedGrade} · {totalSends} total send{totalSends !== 1 ? 's' : ''}
                      </Text>
                      {entries.map((e, idx) => {
                        return (
                          <TouchableOpacity
                            key={`${e.sessionId}-${idx}`}
                            style={styles.dayDetailCard}
                            onPress={() => router.push(`/session/${e.sessionId}`)}
                            activeOpacity={0.75}>
                            <View style={[styles.dayDetailAccentBar, { backgroundColor: SAND }]} />
                            <View style={styles.dayDetailBody}>
                              <Text style={styles.dayDetailGym}>{e.gymName}</Text>
                              <Text style={styles.dayDetailGrades}>{e.date}</Text>
                            </View>
                            <Text style={styles.dayDetailProblems}>
                              ×{e.count}{'\n'}
                              <Text style={styles.dayDetailProblemsLabel}>sends</Text>
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>

              {/* Monthly Volume */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Monthly Volume</Text>
                <Text style={styles.chartSubtitle}>Problems logged over time</Text>
                <LineChart
                  data={{
                    labels: chartData.weekLabels,
                    datasets: [{ data: chartData.monthlyVolume }],
                  }}
                  width={CHART_WIDTH}
                  height={180}
                  chartConfig={ACCENT_CHART_CONFIG}
                  style={styles.chart}
                  bezier
                  fromZero
                  withInnerLines={false}
                  withDots
                  withShadow={false}
                />
              </View>
            </>
          ) : null}
        </View>
      )}

      {/* ── My Climbs tab — grade-grouped grid ──────────────────── */}
      {activeTab === 'sessions' && (
        <View style={styles.tabContentView}>

          {sessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🧗</Text>
              <Text style={styles.emptyTitle}>NO SESSIONS YET</Text>
              <Text style={styles.emptySub}>Log a climb at any gym to see your sessions here</Text>
            </View>
          ) : (
            <>
              {/* Clarify feed vs. logged climbs — they're the same thing unless quiet (beta #6) */}
              <Text style={styles.myClimbsHint}>
                Everything you&apos;ve logged lives here. Public climbs also appear on your feed; &ldquo;Only You&rdquo; climbs don&apos;t.
              </Text>
              {/* ── Date picker trigger ── */}
              <Text style={styles.myClimbsSearchTitle}>Choose a Date:</Text>
              <TouchableOpacity
                style={styles.myClimbsSearchWrap}
                onPress={() => setMyClimbsDatePickerOpen(true)}
                activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={16} color={myClimbsSelectedDay ? SAND : INK3} />
                <Text style={[styles.myClimbsSearchText, myClimbsSelectedDay && styles.myClimbsSearchTextActive]}>
                  {myClimbsSelectedDay
                    ? myClimbsSelectedDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Pick a date'}
                </Text>
                {myClimbsSelectedDay && (
                  <TouchableOpacity onPress={() => setMyClimbsSelectedDay(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color={INK3} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {/* ── Header row: slider left, clear/all + sort right ── */}
              <View style={styles.myClimbsHeader}>

                {/* Grade step-slider */}
                <View style={styles.myClimbsSliderWrap}>
                  {myClimbsSlider !== null && (
                    <Text style={styles.myClimbsSliderValue}>{GRADES[myClimbsSlider]}</Text>
                  )}
                  <View style={styles.stepTrack}>
                    <View style={styles.stepTrackLine} />
                    {myClimbsSlider !== null && (
                      <View style={[styles.stepTrackLineFilled, { width: `${(myClimbsSlider / (GRADES.length - 1)) * 100}%` }]} />
                    )}
                    {GRADES.map((grade, i) => {
                      const hasData = climbEntries.some((e) => e.grade === grade);
                      return (
                        <TouchableOpacity
                          key={grade}
                          style={[styles.stepHitArea, { left: `${(i / (GRADES.length - 1)) * 100}%` }]}
                          onPress={() => handleMyClimbsSlider(i)}
                          activeOpacity={0.7}>
                          <View style={[
                            styles.stepDot,
                            i === myClimbsSlider && styles.stepDotActive,
                            !hasData && styles.stepDotEmpty,
                          ]} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.stepLabels}>
                    {GRADES.map((grade, i) => (
                      <Text key={grade} style={[styles.stepLabelText, i === myClimbsSlider && styles.stepLabelActive]}>
                        {grade}
                      </Text>
                    ))}
                  </View>
                </View>

                {/* Right column: Clear/All button + sort hamburger */}
                <View style={styles.myClimbsRightCol}>
                  {/* Clear / All button */}
                  {myClimbsFilter !== null ? (
                    <TouchableOpacity
                      style={styles.myClimbsClearBtn}
                      onPress={() => { setMyClimbsFilter(null); setMyClimbsSlider(null); }}
                      activeOpacity={0.7}>
                      <Text style={styles.myClimbsClearBtnText}>✕  Clear</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.myClimbsAllBtn}>
                      <Text style={styles.myClimbsAllBtnText}>All</Text>
                    </View>
                  )}

                  {/* Sort hamburger button */}
                  <TouchableOpacity
                    style={styles.myClimbsMenuBtn}
                    onPress={() => setMyClimbsDropdown((v) => !v)}
                    activeOpacity={0.7}>
                    <Ionicons name="menu" size={22} color={INK} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sort dropdown — closes on option select or outside tap */}
              {myClimbsDropdown && (
                <>
                  <TouchableOpacity
                    style={styles.dropdownBackdrop}
                    activeOpacity={1}
                    onPress={() => setMyClimbsDropdown(false)}
                  />
                  <View style={styles.dropdown}>
                    {([
                      { key: 'date', label: 'Date' },
                      { key: 'gym',  label: 'Gym'  },
                    ] as { key: MyClimbsSort; label: string }[]).map(({ key, label }) => (
                      <TouchableOpacity
                        key={key}
                        style={styles.dropdownItem}
                        onPress={() => { setMyClimbsSort(key); setMyClimbsDropdown(false); }}
                        activeOpacity={0.7}>
                        <Text style={[styles.dropdownLabel, myClimbsSort === key && styles.dropdownLabelActive]}>
                          {label}
                        </Text>
                        {myClimbsSort === key && (
                          <Ionicons name="checkmark" size={15} color={SAND} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* ── Grade-grouped sections ───────────────────────── */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.myClimbsSections}>

                {filteredGroups.length === 0 ? (
                  <Text style={styles.myClimbsEmpty}>
                    {myClimbsSelectedDay
                      ? 'No climbs on that date'
                      : myClimbsFilter
                        ? `No ${myClimbsFilter} climbs logged yet`
                        : 'No climbs logged yet'}
                  </Text>
                ) : (
                  filteredGroups.map((group) => (
                    <View key={group.grade}>
                      {/* Section header: grade pill + send count */}
                      <View style={styles.myClimbsSectionHeader}>
                        <View style={styles.myClimbsGradePill}>
                          <Text style={styles.myClimbsGradePillText}>{group.grade}</Text>
                        </View>
                        <Text style={styles.myClimbsSectionMeta}>
                          {group.entries.length} send{group.entries.length !== 1 ? 's' : ''}
                        </Text>
                      </View>

                      <View style={styles.myClimbsGrid}>
                        {toRows(group.entries).map((row, rowIdx) => (
                          <View key={rowIdx} style={styles.myClimbsGridRow}>
                            {row.map((entry, idx) => (
                              <TouchableOpacity
                                key={`${entry.sessionId}-${entry.grade}-${idx}`}
                                style={{ flex: 1 }}
                                activeOpacity={0.75}
                                onPress={() => router.push(`/session/${entry.sessionId}`)}>
                                <ClimbGridCard entry={entry} />
                              </TouchableOpacity>
                            ))}
                            {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => (
                              <View key={`pad-${i}`} style={styles.myClimbsGridPad} />
                            ))}
                          </View>
                        ))}
                      </View>
                    </View>
                  ))
                )}

                <View style={{ height: 32 }} />
              </ScrollView>
            </>
          )}
        </View>
      )}

      {/* ── Settings tab ─────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <View style={styles.tabContentView}>

          {/* Edit Profile */}
          <Text style={styles.settingsSectionLabel}>Edit Profile</Text>
          <View style={styles.settingsCard}>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.textInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your full name"
              placeholderTextColor={INK3}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={styles.inputLabel}>Username</Text>
            <View style={styles.usernameRow}>
              <Text style={styles.usernameAt}>@</Text>
              <TextInput
                style={styles.usernameInput}
                value={editUsername}
                onChangeText={setEditUsername}
                placeholder="username"
                placeholderTextColor={INK3}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={styles.bioInput}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Tell the community about yourself…"
              placeholderTextColor={INK3}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.saveBtn, savingProfile && { opacity: 0.6 }]}
              onPress={handleSaveProfile}
              activeOpacity={0.8}
              disabled={savingProfile}>
              <Text style={styles.saveBtnLabel}>
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </Text>
            </TouchableOpacity>

          </View>

          {/* Log Out */}
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
            <Text style={styles.signOutLabel}>Log Out</Text>
          </TouchableOpacity>

        </View>
      )}

      </ScrollView>


      {/* ── Followers bottom sheet ────────────────────────────────── */}
      {followersVisible && (
        <Modal visible animationType="slide" transparent onRequestClose={() => setFollowersVisible(false)}>
          <View style={styles.sheetBackdrop}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setFollowersVisible(false)} />
            <View style={styles.sheetPanel}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeaderRow}>
                <Text style={styles.sheetTitle}>Followers</Text>
                <TouchableOpacity onPress={() => setFollowersVisible(false)} activeOpacity={0.7}>
                  <Text style={styles.sheetCloseBtn}>×</Text>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetList}>
                {followListLoading ? (
                  <ActivityIndicator color={SAND} style={{ paddingVertical: 32 }} />
                ) : followersList.length === 0 ? (
                  <Text style={styles.sheetEmpty}>No followers yet</Text>
                ) : (
                  followersList.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      style={styles.sheetUserRow}
                      activeOpacity={0.7}
                      onPress={() => {
                        setFollowersVisible(false);
                        if (u.id === currentUserId) {
                          router.push('/(tabs)/profile');
                        } else {
                          router.push(`/user/${u.id}`);
                        }
                      }}>
                      {u.avatarUrl ? (
                        <Image source={{ uri: u.avatarUrl }} style={styles.sheetAvatar} />
                      ) : (
                        <View style={[styles.sheetAvatar, styles.sheetAvatarFallback]}>
                          <Text style={styles.sheetAvatarInitials}>
                            {u.fullName.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('')}
                          </Text>
                        </View>
                      )}
                      <View style={styles.sheetUserInfo}>
                        <Text style={styles.sheetUserName}>{u.fullName}</Text>
                        {u.username ? <Text style={styles.sheetUserUsername}>@{u.username}</Text> : null}
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Following bottom sheet ────────────────────────────────── */}
      {followingVisible && (
        <Modal visible animationType="slide" transparent onRequestClose={() => setFollowingVisible(false)}>
          <View style={styles.sheetBackdrop}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setFollowingVisible(false)} />
            <View style={styles.sheetPanel}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeaderRow}>
                <Text style={styles.sheetTitle}>Following</Text>
                <TouchableOpacity onPress={() => setFollowingVisible(false)} activeOpacity={0.7}>
                  <Text style={styles.sheetCloseBtn}>×</Text>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetList}>
                {followListLoading ? (
                  <ActivityIndicator color={SAND} style={{ paddingVertical: 32 }} />
                ) : followingList.length === 0 ? (
                  <Text style={styles.sheetEmpty}>No one followed yet</Text>
                ) : (
                  followingList.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      style={styles.sheetUserRow}
                      activeOpacity={0.7}
                      onPress={() => {
                        setFollowingVisible(false);
                        if (u.id === currentUserId) {
                          router.push('/(tabs)/profile');
                        } else {
                          router.push(`/user/${u.id}`);
                        }
                      }}>
                      {u.avatarUrl ? (
                        <Image source={{ uri: u.avatarUrl }} style={styles.sheetAvatar} />
                      ) : (
                        <View style={[styles.sheetAvatar, styles.sheetAvatarFallback]}>
                          <Text style={styles.sheetAvatarInitials}>
                            {u.fullName.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('')}
                          </Text>
                        </View>
                      )}
                      <View style={styles.sheetUserInfo}>
                        <Text style={styles.sheetUserName}>{u.fullName}</Text>
                        {u.username ? <Text style={styles.sheetUserUsername}>@{u.username}</Text> : null}
                      </View>
                      <TouchableOpacity
                        style={styles.sheetUnfollowBtn}
                        onPress={() => handleUnfollow(u.id)}
                        activeOpacity={0.7}>
                        <Text style={styles.sheetUnfollowLabel}>Unfollow</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* ── My Climbs date picker ── */}
      {myClimbsDatePickerOpen && (
        <ClimbDatePicker
          onClose={() => setMyClimbsDatePickerOpen(false)}
          selected={myClimbsSelectedDay}
          markedDays={myClimbsMarkedDays}
          initialMonth={climbEntries[0] ? new Date(climbEntries[0].createdAt) : undefined}
          onSelect={setMyClimbsSelectedDay}
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  // ─── Top header row ───────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 36,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -1.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 5,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: SAND,
    borderWidth: 1.5,
    borderColor: BG,
  },

  // ─── Banner ───────────────────────────────────────────────────
  bannerSection: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: 140,
  },
  bannerPlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: INK,
  },
  bannerCameraBtn: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Identity ─────────────────────────────────────────────────
  identitySection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  avatarWrapper: {
    marginTop: -36,
    marginBottom: 12,
    alignSelf: 'flex-start',
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#2a2010',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: BG,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: BG,
  },
  avatarInitials: {
    fontSize: 34,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND_LT,
    letterSpacing: -0.5,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: BG,
  },
  avatarEditIcon: {
    fontSize: 16,
    color: '#ffffff',
    lineHeight: 18,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 28,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -1,
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK2,
    letterSpacing: 0.1,
  },
  headerBio: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK3,
    letterSpacing: 0.1,
    marginTop: 4,
  },
  inviteFriendsBtn: {
    borderWidth: 1.5,
    borderColor: SAND,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  inviteFriendsLabel: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: SAND,
    letterSpacing: 0.2,
  },
  followCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  followCountText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
  },
  followCountNum: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK,
  },
  followCountLabel: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
  },
  followCountDot: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
  },

  // ─── Stats ────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    backgroundColor: BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 26,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -1,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK3,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: DIVIDER,
    marginVertical: 4,
  },

  // ─── Progress section ─────────────────────────────────────────
  progressLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  progressValue: {
    fontSize: 30,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -1,
  },
  progressBlockLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK3,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  progressSub: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK3,
    textAlign: 'center',
  },
  progressDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: DIVIDER,
    marginVertical: 4,
  },
  progressStreakHint: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK3,
    textAlign: 'center',
    lineHeight: 16,
  },

  // ─── Tab bar ──────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: 'Syne_800ExtraBold',
    color: INK3,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tabLabelActive: {
    color: INK,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: SAND,
    borderRadius: 1,
  },

  // ─── Outer scroll + tab content ───────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  tabContentView: {
    paddingTop: 20,
  },

  // ─── Charts ───────────────────────────────────────────────────
  chartsLoadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  chartCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 16,
    // No overflow:hidden — it clips hit-testing on iOS and prevents tapping rows
    // inside an expanded card. Charts are sized correctly so nothing bleeds out.
  },
  chartTitle: {
    fontSize: 18,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.5,
    marginBottom: 2,
  },

  // ─── Terrain (Arc'teryx editorial) ────────────────────────────
  terrainLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  terrainHero: {
    fontSize: 32,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -1.2,
    marginTop: 8,
  },
  terrainHeroSub: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK3,
    marginTop: 2,
    marginBottom: 20,
  },
  terrainList: {
    gap: 2,
  },
  terrainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  terrainName: {
    width: 86,
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK,
    letterSpacing: 0.1,
  },
  terrainTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: SURFACE,
    overflow: 'hidden',
  },
  terrainFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: SAND,
  },
  terrainPct: {
    width: 40,
    textAlign: 'right',
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK,
  },
  terrainCount: {
    width: 26,
    textAlign: 'right',
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK3,
  },
  terrainEmpty: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK3,
    paddingVertical: 12,
    lineHeight: 19,
  },
  chartSubtitle: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 0.2,
    marginBottom: 12,
  },
  chart: {
    borderRadius: 14,
    marginLeft: -16,
  },

  // ─── Grade Pyramid (centered bars, hardest on top) ───────────
  pyramidWrap: {
    marginTop: 10,
    marginBottom: 2,
  },
  pyramidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  pyramidGrade: {
    width: 32,
    fontSize: 13,
    fontFamily: 'Syne_800ExtraBold',
    letterSpacing: -0.5,
    color: INK2,
  },
  pyramidGradeActive: {
    color: INK,
  },
  pyramidTrack: {
    flex: 1,
    height: 22,
    alignItems: 'center',     // centers the bar → builds the pyramid silhouette
    justifyContent: 'center',
  },
  pyramidBar: {
    height: 22,
    borderRadius: 6,
  },
  pyramidCount: {
    width: 26,
    textAlign: 'right',
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK3,
  },
  pyramidEmpty: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK3,
    paddingVertical: 18,
    textAlign: 'center',
  },

  // ─── Grade Distribution custom bar chart ─────────────────────
  gradeBarChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
    marginBottom: 4,
  },
  gradeBarSlot: {
    flex: 1,
    alignItems: 'center',
  },
  gradeBarArea: {
    height: 130,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  gradeBar: {
    width: '70%',
    borderRadius: 4,
  },
  gradeBarLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK3,
    letterSpacing: 0.2,
    marginTop: 4,
  },
  gradeBarLabelActive: {
    color: INK,
    fontFamily: 'Syne_800ExtraBold',
  },

  // ─── Day chip row (Weekly Intensity drill-down) ───────────────
  dayChipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 4,
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: SURFACE,
    gap: 2,
  },
  dayChipActive: {
    backgroundColor: INK,
  },
  dayChipEmpty: {
    opacity: 0.35,
  },
  dayChipLabel: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK,
    letterSpacing: 0.3,
  },
  dayChipLabelActive: {
    color: '#ffffff',
  },
  dayChipCount: {
    fontSize: 13,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.3,
  },
  dayChipCountActive: {
    color: '#ffffff',
  },

  // ─── Grade chip row (Grade Distribution drill-down) ───────────
  gradeChipScroll: {
    marginTop: 12,
    marginLeft: -4,
  },
  gradeChipScrollContent: {
    paddingHorizontal: 4,
    gap: 6,
    flexDirection: 'row',
  },
  gradeChip: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: SURFACE,
    minWidth: 48,
    gap: 1,
  },
  gradeChipActive: {
    backgroundColor: INK,
  },
  gradeChipActivePeak: {
    backgroundColor: INK,
  },
  gradeChipEmpty: {
    opacity: 0.3,
  },
  gradeChipLabel: {
    fontSize: 11,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: 0.2,
  },
  gradeChipLabelActive: {
    color: '#ffffff',
  },
  gradeChipCount: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK3,
  },
  gradeChipCountActive: {
    color: 'rgba(255,255,255,0.85)',
  },

  // ─── Drill-down detail panel ──────────────────────────────────
  dayDetail: {
    marginTop: 16,
    gap: 8,
  },
  dayDetailHeading: {
    fontSize: 14,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  dayDetailEmpty: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
  },
  dayDetailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  dayDetailAccentBar: {
    width: 4,
    height: 36,
    backgroundColor: SAND,
    borderRadius: 2,
  },
  dayDetailBody: {
    flex: 1,
    gap: 2,
  },
  dayDetailGym: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK,
    letterSpacing: -0.2,
  },
  dayDetailGrades: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK2,
  },
  dayDetailProblems: {
    fontSize: 18,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  dayDetailProblemsLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK3,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ─── My Climbs grid ──────────────────────────────────────────

  // Header row: slider on left, hamburger on right
  myClimbsHint: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK3,
    lineHeight: 17,
    marginHorizontal: 16,
    marginTop: 14,
  },
  myClimbsSearchTitle: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 6,
  },
  myClimbsSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myClimbsSearchText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK3,
  },
  myClimbsSearchTextActive: {
    color: INK,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  myClimbsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  myClimbsSliderWrap: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
  },
  myClimbsSliderValue: {
    fontSize: 24,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND,
    letterSpacing: -1,
    marginBottom: 10,
  },
  // Shared step-track styles (same visual as Current Climbs / Log screen)
  stepTrack: { width: '100%', height: 28, justifyContent: 'center', marginBottom: 6 },
  stepTrackLine: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: DIVIDER, borderRadius: 2 },
  stepTrackLineFilled: { position: 'absolute', left: 0, height: 1.5, backgroundColor: INK, borderRadius: 2 },
  stepHitArea: { position: 'absolute', width: 32, height: 32, marginLeft: -16, alignItems: 'center', justifyContent: 'center' },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: SURFACE, borderWidth: 0.5, borderColor: 'rgba(26,20,8,0.1)' },
  stepDotActive: { width: 18, height: 18, borderRadius: 9, backgroundColor: INK, borderWidth: 3, borderColor: '#ffffff' },
  stepDotEmpty: { opacity: 0.4 },   // grades with no logged climbs are dimmed
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  stepLabelText: { fontSize: 9, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK3, textAlign: 'center' },
  stepLabelActive: { color: SAND, fontFamily: 'Syne_800ExtraBold' },

  // Right column: clear/all + hamburger stacked
  myClimbsRightCol: {
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },

  // "✕  Clear" button — active when filter is set
  myClimbsClearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(200,168,74,0.12)',
    borderWidth: 0.5,
    borderColor: SAND,
  },
  myClimbsClearBtnText: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 11,
    color: SAND,
  },

  // "All" label — passive when no filter
  myClimbsAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  myClimbsAllBtnText: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 11,
    color: 'rgba(26,20,8,0.3)',
  },

  // Grade section header (grade pill + send count)
  myClimbsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  myClimbsGradePill: {
    backgroundColor: SAND,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  myClimbsGradePillText: {
    fontSize: 14,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  myClimbsSectionMeta: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
  },

  // Empty state when filter finds no climbs
  myClimbsEmpty: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    color: 'rgba(26,20,8,0.35)',
    textAlign: 'center',
    marginTop: 40,
  },

  // Hamburger menu button
  myClimbsMenuBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sort dropdown
  dropdownBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9,
  },
  dropdown: {
    position: 'absolute',
    top: 70,   // below the header row
    right: 16,
    backgroundColor: BG,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: DIVIDER,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 10,
    minWidth: 130,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  dropdownLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK3,
    letterSpacing: 0.1,
  },
  dropdownLabelActive: { color: SAND },

  // Grade sections scroll container
  myClimbsSections: { paddingTop: 4, paddingBottom: 16 },


  // 3-column row grid
  myClimbsGrid: {
    paddingHorizontal: 16,
    gap: CLIMB_CARD_GAP,
  },
  myClimbsGridRow: {
    flexDirection: 'row',   // 3 cards side-by-side
    gap: CLIMB_CARD_GAP,
  },

  // Compact climb grid card — flex: 1 so 3 fill the row evenly
  gridCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    overflow: 'hidden',
  },
  // Invisible filler to keep last-row cards the same width as full rows
  myClimbsGridPad: { flex: 1 },
  gridCardThumb: {
    width: '100%',
    height: 80,
  },
  gridCardQuiet: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    padding: 4,
  },
  gridCardStyleTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(232,200,122,0.55)',
  },
  gridCardStyleTagMuted: {
    borderColor: 'rgba(255,255,255,0.32)',
  },
  gridCardStyleTagText: {
    fontSize: 8,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 1,
    color: SAND_LT,
  },
  gridCardStyleTagTextMuted: {
    color: 'rgba(255,255,255,0.75)',
  },
  gridCardThumbEmpty: {
    width: '100%',
    height: 80,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCardEmptyIcon: { fontSize: 22 },
  gridCardBody: {
    padding: 8,
    gap: 2,
  },
  gridCardGrade: {
    fontSize: 16,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND,
    letterSpacing: -0.3,
  },
  gridCardGym: {
    fontSize: 12,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: 0.3,
    lineHeight: 15,
  },
  gridCardDate: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 0.1,
  },
  gridCardPill: {
    alignSelf: 'flex-start',
    backgroundColor: INK,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  gridCardPillText: {
    fontSize: 8,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND_LT,
    letterSpacing: 0.8,
  },

  // ─── Sessions carousel (kept for reference / possible future use) ─
  sectionTitle: {
    fontSize: 26,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -1,
  },
  carouselHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 14,
  },
  sortPill: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  sortPillActive: {
    backgroundColor: INK,
  },
  sortPillLabel: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK3,
    letterSpacing: 0.3,
  },
  sortPillLabelActive: {
    color: '#ffffff',
  },
  carouselCounter: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 0.3,
  },
  carouselContent: {
    paddingLeft: 20,
    paddingRight: CARD_PEEK,
    gap: CARD_GAP,
  },
  carouselCard: {
    width: CARD_WIDTH,
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 20,
    borderWidth: 0.5,
    borderColor: DIVIDER,
  },
  carouselLeft: {
    gap: 6,
    paddingRight: 139,
  },
  carouselThumbWrapper: {
    position: 'absolute',
    right: 30,
    top: 20,
    bottom: 20,
    justifyContent: 'center',
  },
  carouselThumb: {
    width: 113,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
  },
  carouselPill: {
    alignSelf: 'flex-start',
    backgroundColor: INK,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  carouselPillText: {
    fontSize: 9,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND_LT,
    letterSpacing: 1,
  },
  carouselGymName: {
    fontSize: 26,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  carouselDate: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 0.2,
  },
  carouselDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DIVIDER,
    marginVertical: 4,
  },
  carouselTopGrade: {
    fontSize: 28,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND,
    letterSpacing: -0.5,
  },
  carouselNotes: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK3,
    lineHeight: 19,
  },

  // ─── Dot indicator ────────────────────────────────────────────
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    marginBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SURFACE,
  },
  dotActive: {
    width: 18,
    borderRadius: 3,
    backgroundColor: INK,
  },

  // ─── Session list card (legacy — kept for type safety) ────────
  card: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    overflow: 'hidden',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accentBar: {
    width: 4,
    height: 36,
    backgroundColor: SAND,
    borderRadius: 2,
    marginRight: 12,
  },
  cardBody: { flex: 1 },
  cardGym: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  cardDetail: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK2,
  },
  cardDate: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK3,
    letterSpacing: 0.2,
    marginLeft: 8,
  },

  // ─── Empty state ──────────────────────────────────────────────
  emptyState: {
    marginHorizontal: 20,
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
    backgroundColor: SURFACE,
    borderRadius: 20,
  },
  emptyIcon: { fontSize: 36, marginBottom: 4 },
  emptyTitle: {
    fontSize: 22,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.5,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK2,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // ─── Settings ─────────────────────────────────────────────────
  settingsSectionLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  settingsCard: {
    marginHorizontal: 20,
    marginBottom: 28,
    gap: 8,
  },
  inputLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 2,
  },
  textInput: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    paddingHorizontal: 16,
  },
  usernameAt: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK2,
    marginRight: 2,
  },
  usernameInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK,
  },
  bioInput: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK,
    minHeight: 90,
  },
  saveBtn: {
    backgroundColor: SAND,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnLabel: {
    fontSize: 15,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  signOutBtn: {
    marginHorizontal: 20,
    borderWidth: 1.5,
    borderColor: '#e53935',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signOutLabel: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#e53935',
    letterSpacing: 0.2,
  },

  // ─── Chart title row + expand button ─────────────────────────
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  chartExpandIcon: {
    fontSize: 18,
    color: INK3,
    lineHeight: 22,
  },
  chartCollapseIcon: {
    fontSize: 22,
    color: INK,
    lineHeight: 26,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  modalBarChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  modalBarSlot: {
    flex: 1,
    alignItems: 'center',
  },
  modalBarArea: {
    height: 180,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  modalBar: {
    width: '65%',
    borderRadius: 5,
  },
  modalBarLabel: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK3,
    letterSpacing: 0.2,
    marginTop: 5,
  },
  modalBarLabelActive: {
    color: INK,
    fontFamily: 'Syne_800ExtraBold',
  },
  modalChipScroll: {
    marginTop: 14,
    marginLeft: -4,
  },
  modalChipScrollContent: {
    paddingHorizontal: 4,
    gap: 8,
    flexDirection: 'row',
  },

  // ─── Layer 2 — session list inside modal ─────────────────────
  modalSessionList: {
    marginTop: 24,
    gap: 10,
  },
  modalSessionListHeading: {
    fontSize: 15,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  modalSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  modalSessionRowBody: {
    flex: 1,
    gap: 3,
  },
  modalSessionGym: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK,
    letterSpacing: -0.2,
  },
  modalSessionDate: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK2,
    letterSpacing: 0.1,
  },
  modalSessionCount: {
    fontSize: 14,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND,
    letterSpacing: -0.2,
  },
  modalSessionChevron: {
    fontSize: 20,
    color: INK3,
    lineHeight: 22,
  },

  // ─── Layer 3 — full-screen media viewer ──────────────────────
  mediaContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaCloseBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  mediaCloseIcon: {
    fontSize: 26,
    color: '#ffffff',
    lineHeight: 30,
    marginTop: -1,
  },
  mediaImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.25,
  },
  mediaVideoPlaceholder: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  mediaPlayIcon: {
    fontSize: 56,
    color: '#ffffff',
    lineHeight: 64,
  },
  mediaPlayLabel: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#ffffff',
    letterSpacing: 0.1,
  },
  mediaPlaySub: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: 'rgba(255,255,255,0.45)',
  },
  mediaPlaceholder: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 40,
  },
  mediaPlaceholderTitle: {
    fontSize: 22,
    fontFamily: 'Syne_800ExtraBold',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: -0.5,
  },
  mediaPlaceholderSub: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },
  mediaInfoStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 44,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    gap: 4,
  },
  mediaInfoGym: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  mediaInfoMeta: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.1,
  },

  // ─── Followers / Following bottom sheet ───────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheetPanel: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.6,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(26,20,8,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.5,
  },
  sheetCloseBtn: {
    fontSize: 26,
    color: INK3,
    lineHeight: 30,
    paddingHorizontal: 4,
  },
  sheetList: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sheetEmpty: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    textAlign: 'center',
    paddingVertical: 32,
  },
  sheetUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26,20,8,0.08)',
  },
  sheetAvatar: {
    width: 44,
    height: 44,
    borderRadius: 11,
  },
  sheetAvatarFallback: {
    backgroundColor: '#2a2010',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetAvatarInitials: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: SAND_LT,
  },
  sheetUserInfo: {
    flex: 1,
    gap: 2,
  },
  sheetUserName: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK,
    letterSpacing: -0.1,
  },
  sheetUserUsername: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK2,
  },
  sheetUnfollowBtn: {
    borderWidth: 1,
    borderColor: DIVIDER,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: SURFACE,
  },
  sheetUnfollowLabel: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK3,
    letterSpacing: 0.1,
  },
});
