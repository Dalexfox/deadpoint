import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { GymLeaderboard } from '../../../components/GymLeaderboard';
import { ClimbReel } from '../../../components/ClimbReel';

// ── Design tokens ────────────────────────────────────────────
const BG         = '#ffffff';
const CARD       = '#f4f1eb';
const SURFACE    = '#ece8df';
const ACCENT     = '#e8383c';
const SAND       = '#c8a84a';
const SAND_LT    = '#e8c87a';
const INK        = '#1a1408';
const INK2       = '#3d3320';
const INK3       = '#8a7a50';
const DIVIDER    = 'rgba(26,20,8,0.08)';

const SCREEN_W = Dimensions.get('window').width;

// V-scale grades — all 11 steps
const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];


// ── Types ────────────────────────────────────────────────────
type TabKey = 'log' | 'climbs' | 'scene';

type SessionData = {
  id: string;
  user_id: string;
  media_url: string | null;
  created_at: string;
  grade: string;
  likeCount: number;
  profile: {
    full_name: string;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

type GradeGroup = {
  grade: string;
  sessions: SessionData[];          // sorted by likeCount desc
  coverMediaUrl: string | null;     // media_url from the most-liked session with a photo
  totalLikes: number;
  sendCount: number;
};

// ── Gym static data ──────────────────────────────────────────
type GymData = {
  name: string; neighborhood: string; city: string;
  address: string; hours: string; about: string;
  amenities: string[];
  clubs: { name: string; members: number }[];
  events: { title: string; date: string; description: string }[];
  coords: { lat: number; lng: number };
};


const GYMS: Record<string, GymData> = {
  '1': {
    name: 'Vital Climbing LES', neighborhood: 'Lower East Side', city: 'NYC',
    address: '62 Rivington St, New York, NY 10002',
    hours: 'Mon–Fri 7am–11pm · Sat–Sun 8am–10pm',
    about: 'Vital LES is a premier bouldering gym in the heart of the Lower East Side. Featuring 14,000 sq ft of climbing terrain with problems for all levels, regularly reset by world-class routesetters.',
    amenities: ['Bouldering Walls', 'Training Area', 'Yoga Studio', 'Lounge', 'Gear Shop', 'Showers'],
    clubs: [{ name: 'LES Crushers', members: 48 }, { name: 'Women Who Wall', members: 32 }],
    events: [
      { title: 'Tuesday Night Comp', date: 'Every Tuesday · 7pm', description: 'Weekly informal bouldering competition. All levels welcome.' },
      { title: 'Summer Send Fest', date: 'Jun 14 · 12pm', description: 'End-of-season send party with prizes, food, and music.' },
    ],
    coords: { lat: 40.7204, lng: -73.9885 },
  },
  '2': {
    name: 'Vital Climbing Brooklyn', neighborhood: 'Brooklyn', city: 'NYC',
    address: '221 N 10th St, Brooklyn, NY 11211',
    hours: 'Mon–Fri 7am–11pm · Sat–Sun 8am–10pm',
    about: 'Vital Brooklyn brings world-class bouldering to Williamsburg. Over 16,000 sq ft of climbing surface with a dedicated training zone, community events, and a rooftop hangout space.',
    amenities: ['Bouldering Walls', 'Training Area', 'Fitness Room', 'Rooftop Deck', 'Café', 'Showers'],
    clubs: [{ name: 'BK Boulder Club', members: 61 }, { name: 'Williamsburg Senders', members: 27 }],
    events: [
      { title: 'Moonlight Bouldering', date: 'Every Friday · 9pm', description: 'Late-night session with dim lighting and DJ sets.' },
      { title: 'Beginner Clinic', date: 'Jun 7 · 10am', description: 'Free intro session for first-time climbers.' },
    ],
    coords: { lat: 40.7182, lng: -73.9569 },
  },
  '3': {
    name: 'Vital Climbing UES', neighborhood: 'Upper East Side', city: 'NYC',
    address: '1635 Lexington Ave, New York, NY 10029',
    hours: 'Mon–Fri 6:30am–11pm · Sat–Sun 8am–9pm',
    about: 'Vital UES is a modern bouldering facility on the Upper East Side. Features 12,000 sq ft of climbing terrain, a full fitness area, and regular community programming.',
    amenities: ['Bouldering Walls', 'Training Area', 'Fitness Room', 'Lounge', 'Gear Shop', 'Showers'],
    clubs: [{ name: 'Uptown Slab Crew', members: 35 }],
    events: [
      { title: 'Saturday Projecting', date: 'Every Saturday · 11am', description: 'Group projecting session with coaching tips.' },
      { title: 'Youth Comp', date: 'Jun 21 · 9am', description: 'Competition for climbers ages 8–16.' },
    ],
    coords: { lat: 40.7916, lng: -73.9445 },
  },
  '4': {
    name: 'Vital Climbing UWS', neighborhood: 'Upper West Side', city: 'NYC',
    address: '750 Columbus Ave, New York, NY 10025',
    hours: 'Mon–Fri 6:30am–11pm · Sat–Sun 8am–9pm',
    about: 'Vital UWS brings the climbing experience to the Upper West Side. A 13,000 sq ft facility with diverse wall angles, a strength training zone, and a welcoming community.',
    amenities: ['Bouldering Walls', 'Training Area', 'Yoga Studio', 'Fitness Room', 'Lounge', 'Showers'],
    clubs: [{ name: 'West Side Dyno', members: 42 }, { name: 'Morning Senders', members: 19 }],
    events: [
      { title: 'Wednesday Workshop', date: 'Every Wednesday · 6pm', description: 'Technique workshop covering footwork, body position, and reading routes.' },
      { title: 'Pride Climb', date: 'Jun 28 · 12pm', description: 'Celebrate Pride Month with a community climb and social.' },
    ],
    coords: { lat: 40.7923, lng: -73.9665 },
  },
};

const AMENITY_ICONS: Record<string, string> = {
  'Bouldering Walls': '🧗', 'Training Area': '💪', 'Yoga Studio': '🧘',
  'Fitness Room': '🏋️', 'Lounge': '☕', 'Café': '☕',
  'Gear Shop': '🎒', 'Showers': '🚿', 'Rooftop Deck': '🌇',
};

// ── Helpers ──────────────────────────────────────────────────

// ── Main component ───────────────────────────────────────────
export default function GymDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const gym     = GYMS[id as string] ?? null;

  // ── Tab ─────────────────────────────────────────────────────
  // Default to The Scene — the community/leaderboard is the "is this gym alive?"
  // surface, so it leads when you open a gym (beta strategy: surface the local FOMO).
  const [activeTab, setActiveTab] = useState<TabKey>('scene');

  // ── Log tab: gym stats ───────────────────────────────────────
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalClimbers, setTotalClimbers] = useState(0);

  // ── Current Climbs tab ───────────────────────────────────────
  const [gradeGroups,   setGradeGroups]   = useState<GradeGroup[]>([]);
  const [climbsLoading, setClimbsLoading] = useState(false);
  // Index into the full GRADES array (V0–V10); slider always shows all 11
  const [sliderIndex,   setSliderIndex]   = useState(0);
  // Bottom-sheet modal for the video grid
  // Immersive viewer (B): the selected grade's sessions + which one was tapped.
  const [reel, setReel] = useState<{ sessions: SessionData[]; start: number } | null>(null);

  // ── Data loading ─────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      let active = true;

      // Gym stats (Log tab header)
      supabase
        .from('sessions')
        .select('id, user_id')
        .eq('gym_id', id)
        .then(({ data }) => {
          if (!active || !data) return;
          setTotalSessions(data.length);
          setTotalClimbers(new Set(data.map((s: any) => s.user_id)).size);
        });

      // Current Climbs data
      setClimbsLoading(true);
      (async () => {
        try {
          // Step 1 — sessions at this gym
          const { data: sessions } = await supabase
            .from('sessions')
            .select('id, user_id, media_url, created_at')
            .eq('gym_id', id);

          if (!active) return;
          if (!sessions || sessions.length === 0) {
            setGradeGroups([]);
            return;
          }

          const sessionIds = sessions.map((s: any) => s.id);
          const userIds    = [...new Set(sessions.map((s: any) => s.user_id as string))];

          // Steps 2-4 in parallel — climbs, likes, profiles
          const [climbsRes, likesRes, profilesRes] = await Promise.all([
            supabase.from('climbs').select('session_id, grade').in('session_id', sessionIds),
            supabase.from('likes').select('session_id').in('session_id', sessionIds),
            supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', userIds),
          ]);

          if (!active) return;

          // Build lookup maps
          const climbMap: Record<string, string> = {};
          (climbsRes.data ?? []).forEach((c: any) => { climbMap[c.session_id] = c.grade; });

          const likeCounts: Record<string, number> = {};
          (likesRes.data ?? []).forEach((l: any) => {
            likeCounts[l.session_id] = (likeCounts[l.session_id] ?? 0) + 1;
          });

          const profileMap: Record<string, any> = {};
          (profilesRes.data ?? []).forEach((p: any) => { profileMap[p.id] = p; });

          // Enrich sessions — skip any that have no climb grade recorded
          const enriched: SessionData[] = sessions
            .filter((s: any) => climbMap[s.id])
            .map((s: any) => {
              const p = profileMap[s.user_id];
              return {
                id:         s.id,
                user_id:    s.user_id,
                media_url:  s.media_url ?? null,
                created_at: s.created_at,
                grade:      climbMap[s.id],
                likeCount:  likeCounts[s.id] ?? 0,
                profile: p ? {
                  full_name:  p.full_name  ?? '',
                  username:   p.username   ?? null,
                  avatar_url: p.avatar_url ?? null,
                } : null,
              };
            });

          // Group by grade
          const byGrade: Record<string, SessionData[]> = {};
          enriched.forEach((s) => {
            if (!byGrade[s.grade]) byGrade[s.grade] = [];
            byGrade[s.grade].push(s);
          });

          // Sort sessions in each group by likes desc
          Object.values(byGrade).forEach((arr) => arr.sort((a, b) => b.likeCount - a.likeCount));

          // Build ordered grade groups (V0 → V10 order, skip empty grades)
          const groups: GradeGroup[] = GRADES
            .filter((g) => byGrade[g]?.length)
            .map((g) => ({
              grade:        g,
              sessions:     byGrade[g],
              coverMediaUrl: byGrade[g].find((s) => s.media_url)?.media_url ?? null,
              totalLikes:   byGrade[g].reduce((sum, s) => sum + s.likeCount, 0),
              sendCount:    byGrade[g].length,
            }));

          setGradeGroups(groups);
          // Snap to the first grade WITH climbs only if the current selection is
          // empty — never land on an empty grade, but keep the user's pick across
          // refocus when it's still valid.
          if (groups.length) {
            setSliderIndex((cur) =>
              groups.some((g) => g.grade === GRADES[cur]) ? cur : GRADES.indexOf(groups[0].grade));
          }
        } catch (err) {
          console.error('CurrentClimbs load error:', err);
        } finally {
          if (active) setClimbsLoading(false);
        }
      })();

      return () => { active = false; };
    }, [id])
  );

  if (!gym) return null;

  // ── Handlers ─────────────────────────────────────────────────

  const openMaps = () =>
    Linking.openURL(
      `https://maps.apple.com/?q=${encodeURIComponent(gym.name)}&ll=${gym.coords.lat},${gym.coords.lng}`
    );

  /** Tap a grade dot on the slider → show that grade's section (or empty state) */
  const handleSliderGrade = (idx: number) => {
    setSliderIndex(idx);
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

      {/* ── Nav ────────────────────────────────────────────── */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>Gyms</Text>
        </TouchableOpacity>
      </View>

      {/* ── Tab bar ─────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        {(['log', 'climbs', 'scene'] as TabKey[]).map((tab) => {
          const label   = tab === 'log' ? 'Log a Climb' : tab === 'climbs' ? 'Current Climbs' : 'The Scene';
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}>
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                numberOfLines={1}
                adjustsFontSizeToFit>
                {label}
              </Text>
              {isActive && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ══════════════════════════════════════════════════════
          LOG A CLIMB TAB
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'log' && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroOverlay}>
              <View style={styles.gymPill}>
                <Text style={styles.gymPillMarker}>▲</Text>
                <Text style={styles.gymPillText}>Vital</Text>
              </View>
              <Text style={styles.heroName}>{gym.name}</Text>
              <Text style={styles.heroLocation}>{gym.neighborhood} · {gym.city}</Text>
            </View>
          </View>

          {/* Quick stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{totalSessions}</Text>
              <Text style={styles.statLabel}>SESSIONS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{totalClimbers}</Text>
              <Text style={styles.statLabel}>CLIMBERS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{gym.clubs.reduce((s, c) => s + c.members, 0)}</Text>
              <Text style={styles.statLabel}>COMMUNITY</Text>
            </View>
          </View>

          {/* Log CTA */}
          <TouchableOpacity
            style={styles.logBtn}
            onPress={() => router.push(`/gym/${id}/log`)}
            activeOpacity={0.85}>
            <Text style={styles.logBtnLabel}>Log a Climb</Text>
            <Text style={styles.logBtnArrow}>→</Text>
          </TouchableOpacity>

          {/* About */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ABOUT</Text>
            <Text style={styles.aboutText}>{gym.about}</Text>
            <View style={styles.hoursRow}>
              <Text style={styles.hoursIcon}>🕐</Text>
              <Text style={styles.hoursText}>{gym.hours}</Text>
            </View>
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>LOCATION</Text>
            <TouchableOpacity style={styles.mapCard} onPress={openMaps} activeOpacity={0.8}>
              <View style={styles.mapPlaceholder}>
                <Text style={styles.mapPin}>📍</Text>
                <Text style={styles.mapLabel}>Tap to open in Maps</Text>
              </View>
              <View style={styles.addressRow}>
                <Text style={styles.addressText}>{gym.address}</Text>
                <Text style={styles.addressChevron}>›</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Amenities */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AMENITIES</Text>
            <View style={styles.amenitiesGrid}>
              {gym.amenities.map((a) => (
                <View key={a} style={styles.amenityChip}>
                  <Text style={styles.amenityIcon}>{AMENITY_ICONS[a] ?? '✦'}</Text>
                  <Text style={styles.amenityLabel}>{a}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Social Clubs */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CLIMBING CLUBS</Text>
            {gym.clubs.map((club) => (
              <View key={club.name} style={styles.clubCard}>
                <View style={styles.clubAvatar}>
                  <Text style={styles.clubAvatarText}>{club.name[0]}</Text>
                </View>
                <View style={styles.clubInfo}>
                  <Text style={styles.clubName}>{club.name}</Text>
                  <Text style={styles.clubMembers}>{club.members} members</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Upcoming Events */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>UPCOMING EVENTS</Text>
            {gym.events.map((event) => (
              <View key={event.title} style={styles.eventCard}>
                <View style={styles.eventDateBadge}>
                  <Text style={styles.eventDateText}>{event.date.split('·')[0].trim()}</Text>
                </View>
                <View style={styles.eventBody}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventTime}>{event.date}</Text>
                  <Text style={styles.eventDesc}>{event.description}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ══════════════════════════════════════════════════════
          CURRENT CLIMBS TAB
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'climbs' && (
        <View style={{ flex: 1 }}>

          {/* ── Grade chips — big tap targets; grades with no climbs are dimmed ── */}
          {!climbsLoading && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}>
              {GRADES.map((grade, i) => {
                const has    = gradeGroups.some((g) => g.grade === grade);
                const active = i === sliderIndex;
                return (
                  <TouchableOpacity
                    key={grade}
                    style={[styles.chip, active && styles.chipActive, !has && !active && styles.chipEmpty]}
                    onPress={() => handleSliderGrade(i)}
                    activeOpacity={0.8}>
                    <Text style={[styles.chipText, active && styles.chipTextActive, !has && !active && styles.chipTextEmpty]}>
                      {grade}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* ── Selected grade → 2-up photo grid of logged climbs ── */}
          {climbsLoading ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator color={SAND} size="large" />
            </View>
          ) : gradeGroups.length === 0 ? (
            <View style={styles.loadingCenter}>
              <Text style={styles.emptyText}>No climbs logged at this gym yet.</Text>
              <TouchableOpacity
                style={styles.emptyLogBtn}
                onPress={() => router.push(`/gym/${id}/log`)}
                activeOpacity={0.85}>
                <Text style={styles.emptyLogBtnLabel}>Be the first → Log a Climb</Text>
              </TouchableOpacity>
            </View>
          ) : (() => {
            const selectedGrade = GRADES[sliderIndex];
            const activeGroup = gradeGroups.find((g) => g.grade === selectedGrade) ?? null;
            if (!activeGroup) {
              return (
                <View style={styles.gradeEmptyState}>
                  <Text style={styles.gradeEmptyGrade}>{selectedGrade}</Text>
                  <Text style={styles.gradeEmptyText}>No climbs logged at this grade yet.</Text>
                </View>
              );
            }
            return (
              <ScrollView style={styles.gridFill} contentContainerStyle={styles.gridScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.gridCount}>
                  <Text style={styles.gridCountGrade}>{selectedGrade}</Text>
                  {`  ·  ${activeGroup.sendCount} climb${activeGroup.sendCount !== 1 ? 's' : ''} on the wall`}
                </Text>
                <View style={styles.grid}>
                  {activeGroup.sessions.map((s, idx) => {
                    const handle = s.profile?.username
                      ? `@${s.profile.username}`
                      : (s.profile?.full_name || 'Climber');
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={styles.gcard}
                        activeOpacity={0.88}
                        onPress={() => setReel({ sessions: activeGroup.sessions, start: idx })}>
                        {s.media_url ? (
                          <Image source={{ uri: s.media_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                        ) : (
                          <LinearGradient colors={['#2a2010', '#1a1408']} style={StyleSheet.absoluteFill} />
                        )}
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.72)']}
                          style={StyleSheet.absoluteFill}
                          pointerEvents="none"
                        />
                        <View style={styles.gcardOverlay} pointerEvents="none">
                          <View style={styles.gcardInfo}>
                            <Text style={styles.gcardGrade}>{s.grade}</Text>
                            <Text style={styles.gcardHandle} numberOfLines={1}>{handle}</Text>
                          </View>
                          <Text style={styles.gcardLike}>♥ {s.likeCount}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={{ height: 32 }} />
              </ScrollView>
            );
          })()}
        </View>
      )}

      {/* ══════════════════════════════════════════════════════
          THE SCENE TAB — this-week leaderboard + recent sends
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'scene' && <GymLeaderboard gymId={id as string} />}

      {/* ══════════════════════════════════════════════════════
          IMMERSIVE VIEWER (B) — swipe through the selected grade's climbs.
          Conditionally rendered so it fully unmounts on close.
      ══════════════════════════════════════════════════════ */}
      {reel && (
        <ClimbReel
          visible
          gymName={gym.name}
          sessions={reel.sessions}
          startIndex={reel.start}
          onClose={() => setReel(null)}
        />
      )}

    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // ── Nav ─────────────────────────────────────────────────────
  nav: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backArrow: { fontSize: 28, fontFamily: 'SpaceGrotesk_300Light', color: INK, lineHeight: 28, marginTop: -2 },
  backLabel: { fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', color: INK, letterSpacing: 0.1 },

  // ── Tab bar ──────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
    backgroundColor: BG,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,        // guaranteed gap so adjacent labels never touch
    position: 'relative',
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: 'Syne_800ExtraBold',
    color: INK3,
    letterSpacing: 0,
    textAlign: 'center',
    alignSelf: 'stretch',        // fill the column so adjustsFontSizeToFit has a width bound
  },
  tabLabelActive: { color: SAND },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: SAND,
    borderRadius: 2,
  },

  // ── Log tab scroll ───────────────────────────────────────────
  scroll: { paddingTop: 12, paddingBottom: 8 },
  section: { marginTop: 28, paddingHorizontal: 20, gap: 12 },
  sectionTitle: { fontSize: 11, fontFamily: 'Syne_800ExtraBold', color: INK3, letterSpacing: 1.4 },

  // Hero
  hero: { marginHorizontal: 16, height: 180, borderRadius: 20, backgroundColor: SAND, overflow: 'hidden' },
  heroOverlay: { flex: 1, justifyContent: 'flex-end', padding: 20, backgroundColor: 'rgba(13,43,54,0.35)' },
  gymPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8,
  },
  gymPillMarker: { fontSize: 8, color: '#ffffff' },
  gymPillText: { fontSize: 11, fontFamily: 'Syne_800ExtraBold', color: '#ffffff', letterSpacing: 0.5, textTransform: 'uppercase' },
  heroName: { fontSize: 34, fontFamily: 'Syne_800ExtraBold', color: '#ffffff', letterSpacing: 1, lineHeight: 38 },
  heroLocation: { fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.1, marginTop: 2 },

  // Stats row
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: SURFACE, borderRadius: 16, paddingVertical: 16,
  },
  statBlock: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 22, fontFamily: 'Syne_800ExtraBold', color: INK },
  statLabel: { fontSize: 10, fontFamily: 'SpaceGrotesk_700Bold', color: INK3, letterSpacing: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: DIVIDER },

  // Log CTA
  logBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 16,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 4,
  },
  logBtnLabel: { fontSize: 17, fontFamily: 'Syne_800ExtraBold', color: '#ffffff', letterSpacing: 0.2 },
  logBtnArrow: { fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold', color: '#ffffff' },

  // About
  aboutText: { fontSize: 15, fontFamily: 'SpaceGrotesk_400Regular', color: INK, lineHeight: 22, letterSpacing: -0.1 },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: SURFACE, borderRadius: 12, padding: 12 },
  hoursIcon: { fontSize: 14 },
  hoursText: { fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK2, flex: 1 },

  // Location
  mapCard: { borderRadius: 16, backgroundColor: SURFACE, overflow: 'hidden', borderWidth: 1.5, borderColor: DIVIDER },
  mapPlaceholder: { height: 120, backgroundColor: SAND, alignItems: 'center', justifyContent: 'center', gap: 6 },
  mapPin: { fontSize: 28 },
  mapLabel: { fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold', color: 'rgba(255,255,255,0.85)' },
  addressRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  addressText: { flex: 1, fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK, letterSpacing: -0.1 },
  addressChevron: { fontSize: 20, color: INK3 },

  // Amenities
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: SURFACE, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  amenityIcon: { fontSize: 16 },
  amenityLabel: { fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold', color: INK, letterSpacing: -0.1 },

  // Clubs
  clubCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: SURFACE, borderRadius: 14, padding: 14 },
  clubAvatar: { width: 40, height: 40, borderRadius: 10, backgroundColor: SAND, alignItems: 'center', justifyContent: 'center' },
  clubAvatarText: { fontSize: 18, fontFamily: 'Syne_800ExtraBold', color: '#ffffff' },
  clubInfo: { flex: 1, gap: 1 },
  clubName: { fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold', color: INK, letterSpacing: -0.2 },
  clubMembers: { fontSize: 12, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK2 },
  clubJoinBtn: { backgroundColor: BG, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7, borderWidth: 1.5, borderColor: DIVIDER },
  clubJoinLabel: { fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold', color: INK },

  // Events
  eventCard: { flexDirection: 'row', gap: 14, backgroundColor: SURFACE, borderRadius: 14, padding: 14 },
  eventDateBadge: { width: 52, height: 52, borderRadius: 12, backgroundColor: SAND, alignItems: 'center', justifyContent: 'center' },
  eventDateText: { fontSize: 11, fontFamily: 'Syne_800ExtraBold', color: '#ffffff', textAlign: 'center', letterSpacing: 0.2 },
  eventBody: { flex: 1, gap: 2 },
  eventTitle: { fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold', color: INK, letterSpacing: -0.2 },
  eventTime: { fontSize: 12, fontFamily: 'SpaceGrotesk_600SemiBold', color: SAND, letterSpacing: 0.1 },
  eventDesc: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: INK2, lineHeight: 18, marginTop: 2 },

  // ── Current Climbs: grade chips ──────────────────────────────
  chipsRow: { paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  chip: {
    height: 38, paddingHorizontal: 18, borderRadius: 19,
    backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center',
  },
  chipActive: { backgroundColor: INK },
  chipEmpty: { backgroundColor: 'transparent', borderWidth: 0.5, borderColor: DIVIDER },
  chipText: { fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', color: INK, letterSpacing: 0.2 },
  chipTextActive: { color: '#ffffff' },
  chipTextEmpty: { color: INK3 },

  // ── Current Climbs: loading / empty ─────────────────────────
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK3, textAlign: 'center' },
  // Per-grade empty state (shown when selected grade has no logged climbs)
  gradeEmptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 48, paddingHorizontal: 32, gap: 10 },
  gradeEmptyGrade: { fontSize: 52, fontFamily: 'Syne_800ExtraBold', color: SURFACE, letterSpacing: 1 },
  gradeEmptyText: { fontSize: 15, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK3, textAlign: 'center' },
  emptyLogBtn: {
    backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12,
  },
  emptyLogBtnLabel: { fontSize: 15, fontFamily: 'Syne_800ExtraBold', color: '#ffffff' },

  // ── Current Climbs: 2-up photo grid ─────────────────────────
  gridFill: { flex: 1 },   // bound the ScrollView to remaining height so it scrolls
  gridScroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  gridCount: { fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium', color: INK3, marginBottom: 14 },
  gridCountGrade: { fontSize: 15, fontFamily: 'Syne_800ExtraBold', color: INK },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gcard: {
    width: '48.5%', aspectRatio: 0.82,
    borderRadius: 14, overflow: 'hidden',
    backgroundColor: SURFACE, marginBottom: 12,
  },
  gcardOverlay: {
    position: 'absolute', left: 10, right: 10, bottom: 9,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  gcardInfo: { flex: 1, marginRight: 6 },
  gcardGrade: { fontSize: 18, fontFamily: 'Syne_800ExtraBold', color: SAND_LT },
  gcardHandle: { fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold', color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  gcardLike: { fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold', color: '#ffffff' },
});
