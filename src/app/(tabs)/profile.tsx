import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  getProfileAvatar,
  uploadProfileAvatar,
  getProfileBanner,
  saveProfileBanner,
  saveUserPost,
} from '../../lib/store';
import { supabase } from '../../lib/supabase';

// V-scale order used to determine hardest grade sent
const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];

const SCREEN_WIDTH = Dimensions.get('window').width;

// Chart width = screen width minus card margins (20px × 2) and card padding (16px × 2)
const CHART_WIDTH = SCREEN_WIDTH - 72;

// Carousel card — wide enough to fill the screen with the next card peeking in from the right
const CARD_GAP   = 12;
const CARD_PEEK  = 28;  // how many px of the next card are visible
const CARD_WIDTH = SCREEN_WIDTH - 20 - CARD_GAP - CARD_PEEK; // 20 = left margin

// Shared chart config — teal bars / lines on the card background
const BASE_CHART_CONFIG = {
  backgroundColor:         '#d8eaf0',
  backgroundGradientFrom:  '#d8eaf0',
  backgroundGradientTo:    '#d8eaf0',
  decimalPlaces:           0,
  labelColor:              () => '#8bb5c4',      // TEXT_MUTED
  propsForBackgroundLines: { stroke: '#c8dde8' }, // DIVIDER
};

const PRIMARY_CHART_CONFIG = {
  ...BASE_CHART_CONFIG,
  color: (opacity = 1) => `rgba(46, 122, 150, ${opacity})`, // PRIMARY teal
};

const ACCENT_CHART_CONFIG = {
  ...BASE_CHART_CONFIG,
  color: (opacity = 1) => `rgba(255, 80, 124, ${opacity})`, // ACCENT pink
};

// Maps sessions.gym_id → human-readable gym name
const GYM_NAMES: Record<string, string> = {
  '1': 'Vital Climbing LES',
  '2': 'Vital Climbing Brooklyn',
  '3': 'Vital Climbing UES',
  '4': 'Vital Climbing UWS',
};

// Derived datasets fed into the three charts
type ChartData = {
  weeklyIntensity:   number[];  // problems per day, Mon–Sun of current week
  gradeDistribution: number[];  // total climb count per grade, V0–V10
  maxGradeIndex:     number;    // index of the most-climbed grade (highlighted pink)
  monthlyVolume:     number[];  // total problems per week for last 12 weeks
  weekLabels:        string[];  // e.g. ['Apr 7', '', 'Apr 21', '', ...]
};

// A single climb row joined with its session's gym + date — used for grade drill-down
type ClimbEntry = {
  sessionId: string;
  grade:     string;
  count:     number;
  gymName:   string;
  date:      string;
};

// Shape of a session card built from Supabase data
type SupabaseSession = {
  id:            string;
  gymName:       string;
  gradesSummary: string;  // e.g. "V3 ×2  ·  V4 ×3  ·  V5 ×1"
  totalProblems: number;
  date:          string;  // e.g. "May 27, 2026"
  createdAt:     string;  // ISO string — used to filter sessions by day for chart drill-down
};

// Active profile tab
type ProfileTab = 'overview' | 'sessions' | 'settings';

const BG        = '#ffffff';
const CARD      = '#d8eaf0';
const SURFACE   = '#d8eaf0';
const ACCENT    = '#ff507c';
const PRIMARY   = '#2E7A96';
const TEXT      = '#0d2b36';
const TEXT_SUB  = '#3d7a8a';
const TEXT_MUTED = '#8bb5c4';
const DIVIDER   = '#c8dde8';

const USER = {
  name:     'Alex Fox',
  username: '@alexfox',
  initials: 'AF',
};

const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'overview',  label: 'Overview'  },
  { key: 'sessions',  label: 'Sessions'  },
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

function CarouselCard({ session }: { session: SupabaseSession }) {
  return (
    <View style={styles.carouselCard}>
      <View style={styles.carouselPill}>
        <Text style={styles.carouselPillText}>▲  VITAL</Text>
      </View>
      <Text style={styles.carouselGymName}>{session.gymName}</Text>
      <Text style={styles.carouselDate}>{session.date}</Text>
      <View style={styles.carouselDivider} />
      <Text style={styles.carouselGrades} numberOfLines={2}>
        {session.gradesSummary}
      </Text>
      <View style={styles.carouselBadgeRow}>
        <View style={styles.carouselBadge}>
          <Text style={styles.carouselBadgeValue}>{session.totalProblems}</Text>
          <Text style={styles.carouselBadgeLabel}>PROBLEMS</Text>
        </View>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();

  const [avatarUri, setAvatarUri]   = useState<string | null>(null);
  const [bannerUri, setBannerUri]   = useState<string | null>(null);
  const [sessions,  setSessions]    = useState<SupabaseSession[]>([]);
  const [chartData, setChartData]   = useState<ChartData | null>(null);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [selectedWeekDay, setSelectedWeekDay] = useState<number | null>(null);
  const [climbEntries, setClimbEntries]       = useState<ClimbEntry[]>([]);
  const [selectedGrade, setSelectedGrade]     = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<ProfileTab>('overview');
  const [activeSession, setActiveSession] = useState(0);
  const carouselRef = useRef<ScrollView>(null);

  const [stats, setStats] = useState<{
    totalClimbs: number;
    gymsVisited: number;
    topGrade:    string;
  }>({ totalClimbs: 0, gymsVisited: 0, topGrade: '—' });

  const handleCarouselScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_GAP));
    setActiveSession(Math.min(Math.max(index, 0), sessions.length - 1));
  };

  useEffect(() => {
    getProfileAvatar().then(setAvatarUri);
    getProfileBanner().then(setBannerUri);
  }, []);

  // Every time the Profile tab gains focus, fetch sessions + climbs fresh from
  // Supabase then derive all stats and chart data — no extra round-trips.
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // ── 1. Sessions ─────────────────────────────────────────
          const { data: rawSessions, error: sessionsError } = await supabase
            .from('sessions')
            .select('id, gym_id, total_problems, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

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
            .select('session_id, grade, count')
            .in('session_id', sessionIds);

          const allClimbs = climbs ?? [];

          const climbsBySession: Record<string, Array<{ grade: string; count: number }>> = {};
          allClimbs.forEach((c) => {
            if (!climbsBySession[c.session_id]) climbsBySession[c.session_id] = [];
            climbsBySession[c.session_id].push({ grade: c.grade, count: c.count });
          });

          // ── 3. Session cards ────────────────────────────────────
          const formatted: SupabaseSession[] = rawSessions.map((s) => {
            const gymName      = GYM_NAMES[s.gym_id] ?? `Gym ${s.gym_id}`;
            const sessionClimbs = (climbsBySession[s.id] ?? [])
              .sort((a, b) => GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade));
            const gradesSummary =
              sessionClimbs.length > 0
                ? sessionClimbs.map((c) => `${c.grade} ×${c.count}`).join('  ·  ')
                : `${s.total_problems} problems`;
            const date = new Date(s.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            });
            return { id: s.id, gymName, gradesSummary, totalProblems: s.total_problems, date, createdAt: s.created_at };
          });
          setSessions(formatted);

          // ── 4. Stats ────────────────────────────────────────────
          const uniqueGyms   = new Set(rawSessions.map((s) => s.gym_id)).size;
          const totalClimbs  = allClimbs.reduce((sum, c) => sum + (c.count ?? 0), 0);
          let topGradeIndex  = -1;
          allClimbs.forEach((c) => {
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
              if (idx < 7) dailyCounts[idx] += s.total_problems;
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
                .reduce((sum, s) => sum + s.total_problems, 0)
            );
            weekLabels.push(
              i % 2 === 0
                ? wStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : ''
            );
          }

          setChartData({ weeklyIntensity: dailyCounts, gradeDistribution: gradeCounts, maxGradeIndex, monthlyVolume: weeklyTotals, weekLabels });

          // ── 6. Climb entries for grade drill-down ───────────────
          const sessionMetaById: Record<string, { gymName: string; date: string }> = {};
          rawSessions.forEach((s) => {
            sessionMetaById[s.id] = {
              gymName: GYM_NAMES[s.gym_id] ?? `Gym ${s.gym_id}`,
              date: new Date(s.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              }),
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
      uploadProfileAvatar(uri).then((url) => { if (url) setAvatarUri(url); });
    }
  };

  const takeAvatarPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      uploadProfileAvatar(uri).then((url) => { if (url) setAvatarUri(url); });
    }
  };

  const handleBannerPress = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [3, 1], quality: 0.85,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setBannerUri(uri);
      saveProfileBanner(uri);
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
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.85 });
    if (!result.canceled) await publishPost(result.assets[0].uri, 'image');
  };

  const publishPost = async (uri: string, mediaType: 'image' | 'video') => {
    await saveUserPost({
      id: Date.now().toString(), name: USER.name, initials: USER.initials,
      avatarBg: PRIMARY, timestamp: 'Just now', likes: 0, comments: 0,
      liked: false, postType: 'photo', media: [{ type: mediaType, uri }],
    });
    Alert.alert('Posted!', 'Your photo is now live on the feed.');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Top header row (always visible) ────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleShare} activeOpacity={0.7}>
            <SymbolView name="plus.circle" size={24} tintColor={ACCENT} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} hitSlop={12}>
            <SymbolView name="gearshape" size={22} tintColor={TEXT_SUB} />
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
            <SymbolView name="camera.fill" size={15} tintColor="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Identity */}
        <View style={styles.identitySection}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={handleAvatarPress} activeOpacity={0.85}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarInitials}>{USER.initials}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditIcon}>＋</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.nameRow}>
            <View>
              <Text style={styles.name}>{USER.name}</Text>
              <Text style={styles.username}>{USER.username}</Text>
            </View>
            <TouchableOpacity style={styles.addFriendBtn} activeOpacity={0.7}>
              <Text style={styles.addFriendLabel}>Add Friend</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatColumn label="Total Climbs" value={stats.totalClimbs} />
          <View style={styles.statDivider} />
          <StatColumn label="Gyms Visited" value={stats.gymsVisited} />
          <View style={styles.statDivider} />
          <StatColumn label="Top Grade" value={stats.topGrade} />
        </View>
        </View>

      {/* ── Overview tab — charts ───────────────────────────────── */}
      {activeTab === 'overview' && (
        <View style={styles.tabContentView}>

          {chartsLoading ? (
            <View style={styles.chartsLoadingContainer}>
              <ActivityIndicator size="small" color={PRIMARY} />
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
                            ? '#2E7A96'
                            : 'rgba(46, 122, 150, 0.3)'
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
                              <Text style={styles.dayDetailGrades}>{s.gradesSummary}</Text>
                            </View>
                            <Text style={styles.dayDetailProblems}>
                              {s.totalProblems}{'\n'}
                              <Text style={styles.dayDetailProblemsLabel}>problems</Text>
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  );
                })()}
              </View>

              {/* Grade Distribution */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Grade Distribution</Text>
                <Text style={styles.chartSubtitle}>Your climbs by V-grade · tap a grade to drill down</Text>

                {/* Custom View-based bar chart — no chart-kit clipping */}
                {(() => {
                  const maxVal = Math.max(...chartData.gradeDistribution, 1);
                  return (
                    <View style={styles.gradeBarChart}>
                      {GRADES.map((grade, i) => {
                        const val  = chartData.gradeDistribution[i];
                        const barH = val > 0 ? Math.max((val / maxVal) * 130, 5) : 0;
                        const isPeak     = i === chartData.maxGradeIndex;
                        const isSelected = selectedGrade === grade;
                        return (
                          <TouchableOpacity
                            key={grade}
                            style={styles.gradeBarSlot}
                            onPress={() => setSelectedGrade(isSelected ? null : grade)}
                            activeOpacity={val > 0 ? 0.7 : 1}
                            disabled={val === 0}>
                            <View style={styles.gradeBarArea}>
                              {val > 0 && (
                                <View
                                  style={[
                                    styles.gradeBar,
                                    {
                                      height: barH,
                                      backgroundColor: isPeak ? ACCENT : PRIMARY,
                                      opacity: selectedGrade !== null && !isSelected ? 0.35 : 1,
                                    },
                                  ]}
                                />
                              )}
                            </View>
                            <Text
                              style={[styles.gradeBarLabel, isSelected && styles.gradeBarLabelActive]}
                              numberOfLines={1}>
                              {grade}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })()}

                {/* Grade chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.gradeChipScroll}
                  contentContainerStyle={styles.gradeChipScrollContent}>
                  {GRADES.map((grade, i) => {
                    const total     = chartData.gradeDistribution[i];
                    const hasClimbs = total > 0;
                    const isSelected = selectedGrade === grade;
                    const isPeak     = i === chartData.maxGradeIndex;
                    return (
                      <TouchableOpacity
                        key={grade}
                        style={[
                          styles.gradeChip,
                          isSelected && (isPeak ? styles.gradeChipActivePeak : styles.gradeChipActive),
                          !hasClimbs && styles.gradeChipEmpty,
                        ]}
                        onPress={() => setSelectedGrade(isSelected ? null : grade)}
                        activeOpacity={0.7}
                        disabled={!hasClimbs}>
                        <Text style={[styles.gradeChipLabel, isSelected && styles.gradeChipLabelActive]}>
                          {grade}
                        </Text>
                        {hasClimbs && (
                          <Text style={[styles.gradeChipCount, isSelected && styles.gradeChipCountActive]}>
                            ×{total}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Grade drill-down */}
                {selectedGrade !== null && (() => {
                  const entries    = climbEntries.filter((e) => e.grade === selectedGrade);
                  const totalSends = entries.reduce((sum, e) => sum + e.count, 0);
                  return (
                    <View style={styles.dayDetail}>
                      <Text style={styles.dayDetailHeading}>
                        {selectedGrade} · {totalSends} total send{totalSends !== 1 ? 's' : ''}
                      </Text>
                      {entries.map((e, idx) => (
                        <View key={`${e.sessionId}-${idx}`} style={styles.dayDetailCard}>
                          <View style={[styles.dayDetailAccentBar, { backgroundColor: ACCENT }]} />
                          <View style={styles.dayDetailBody}>
                            <Text style={styles.dayDetailGym}>{e.gymName}</Text>
                            <Text style={styles.dayDetailGrades}>{e.date}</Text>
                          </View>
                          <Text style={styles.dayDetailProblems}>
                            ×{e.count}{'\n'}
                            <Text style={styles.dayDetailProblemsLabel}>sends</Text>
                          </Text>
                        </View>
                      ))}
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

      {/* ── Sessions tab — carousel ──────────────────────────────── */}
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
              <View style={styles.carouselHeader}>
                <Text style={styles.sectionTitle}>Your Sessions</Text>
                <Text style={styles.carouselCounter}>
                  {activeSession + 1} / {sessions.length}
                </Text>
              </View>

              <ScrollView
                ref={carouselRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + CARD_GAP}
                snapToAlignment="start"
                decelerationRate="fast"
                onMomentumScrollEnd={handleCarouselScroll}
                contentContainerStyle={styles.carouselContent}>
                {sessions.map((session) => (
                  <CarouselCard key={session.id} session={session} />
                ))}
              </ScrollView>

              {sessions.length > 1 && (
                <View style={styles.dotRow}>
                  {sessions.slice(0, Math.min(sessions.length, 7)).map((_, i) => (
                    <View key={i} style={[styles.dot, i === activeSession && styles.dotActive]} />
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* ── Settings tab — placeholder ───────────────────────────── */}
      {activeTab === 'settings' && (
        <View style={styles.tabContentView}>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
            <Text style={styles.signOutLabel}>Log Out</Text>
          </TouchableOpacity>
        </View>
      )}

      </ScrollView>
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
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 1,
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
    backgroundColor: PRIMARY,
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
    backgroundColor: PRIMARY,
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
    fontFamily: 'DMSans_800ExtraBold',
    color: '#ffffff',
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
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 1,
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_SUB,
    letterSpacing: 0.1,
  },
  addFriendBtn: {
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addFriendLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: ACCENT,
    letterSpacing: 0.2,
  },

  // ─── Stats ────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: SURFACE,
    borderRadius: 16,
    paddingVertical: 20,
    marginBottom: 16,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 26,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: TEXT_MUTED,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: DIVIDER,
    marginVertical: 4,
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
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT_MUTED,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tabLabelActive: {
    color: PRIMARY,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: PRIMARY,
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
    overflow: 'hidden',
  },
  chartTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  chartSubtitle: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_MUTED,
    letterSpacing: 0.2,
    marginBottom: 12,
  },
  chart: {
    borderRadius: 14,
    marginLeft: -16,
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
    fontFamily: 'DMSans_700Bold',
    color: TEXT_MUTED,
    letterSpacing: 0.2,
    marginTop: 4,
  },
  gradeBarLabelActive: {
    color: TEXT,
    fontFamily: 'DMSans_800ExtraBold',
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
    backgroundColor: TEXT,
  },
  dayChipEmpty: {
    opacity: 0.35,
  },
  dayChipLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: TEXT,
    letterSpacing: 0.3,
  },
  dayChipLabelActive: {
    color: '#ffffff',
  },
  dayChipCount: {
    fontSize: 13,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
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
    backgroundColor: TEXT,
  },
  gradeChipActivePeak: {
    backgroundColor: TEXT,
  },
  gradeChipEmpty: {
    opacity: 0.3,
  },
  gradeChipLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: 0.2,
  },
  gradeChipLabelActive: {
    color: '#ffffff',
  },
  gradeChipCount: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: TEXT_MUTED,
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
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  dayDetailEmpty: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_MUTED,
  },
  dayDetailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  dayDetailAccentBar: {
    width: 4,
    height: 36,
    backgroundColor: PRIMARY,
    borderRadius: 2,
  },
  dayDetailBody: {
    flex: 1,
    gap: 2,
  },
  dayDetailGym: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: TEXT,
    letterSpacing: -0.2,
  },
  dayDetailGrades: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_SUB,
  },
  dayDetailProblems: {
    fontSize: 18,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  dayDetailProblemsLabel: {
    fontSize: 9,
    fontFamily: 'DMSans_700Bold',
    color: TEXT_MUTED,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ─── Sessions carousel ────────────────────────────────────────
  sectionTitle: {
    fontSize: 26,
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 1,
  },
  carouselHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  carouselCounter: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_MUTED,
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
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#b0cdd8',
  },
  carouselPill: {
    alignSelf: 'flex-start',
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  carouselPillText: {
    fontSize: 9,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  carouselGymName: {
    fontSize: 26,
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 0.5,
    lineHeight: 30,
  },
  carouselDate: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_MUTED,
    letterSpacing: 0.2,
  },
  carouselDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DIVIDER,
    marginVertical: 4,
  },
  carouselGrades: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_SUB,
    letterSpacing: 0.1,
    lineHeight: 20,
  },
  carouselBadgeRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  carouselBadge: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  carouselBadgeValue: {
    fontSize: 22,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  carouselBadgeLabel: {
    fontSize: 8,
    fontFamily: 'DMSans_800ExtraBold',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1.2,
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
    backgroundColor: DIVIDER,
  },
  dotActive: {
    width: 18,
    borderRadius: 3,
    backgroundColor: PRIMARY,
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
    backgroundColor: PRIMARY,
    borderRadius: 2,
    marginRight: 12,
  },
  cardBody: { flex: 1 },
  cardGym: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: TEXT,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  cardDetail: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_SUB,
  },
  cardDate: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: TEXT_MUTED,
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
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 1.5,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_SUB,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // ─── Settings ─────────────────────────────────────────────────
  signOutBtn: {
    marginHorizontal: 20,
    backgroundColor: SURFACE,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signOutLabel: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: ACCENT,
    letterSpacing: 0.2,
  },
});
