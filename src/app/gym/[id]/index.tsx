import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';

// ── Design tokens ────────────────────────────────────────────
const BG         = '#ffffff';
const SURFACE    = '#d8eaf0';
const ACCENT     = '#ff507c';
const PRIMARY    = '#2E7A96';
const TEXT_CLR   = '#0d2b36';
const TEXT_SUB   = '#3d7a8a';
const TEXT_MUTED = '#8bb5c4';
const DIVIDER    = '#c8dde8';
const CARD_BDR   = '#b0cdd8';

const SCREEN_W = Dimensions.get('window').width;

// V-scale grades — all 11 steps
const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];

// Card dimensions for the problem card grid
const PROB_CARD_W  = 100;
const PROB_CARD_H  = 110;
const PROB_CARD_GAP = 8;

// ── Types ────────────────────────────────────────────────────
type TabKey = 'log' | 'climbs';

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

// Gym names also available as a simple map (used by log.tsx and other screens)
export const GYM_NAMES: Record<string, string> = {
  '1': 'Vital Climbing LES',
  '2': 'Vital Climbing Brooklyn',
  '3': 'Vital Climbing UES',
  '4': 'Vital Climbing UWS',
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

/** Convert a full name to 1–2 uppercase initials. */
function toInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
}

/**
 * Split a flat array into consecutive pairs for 2-row column layout.
 * [[a, b], [c, d], [e]] — each sub-array is one column (top row + bottom row).
 */
function toPairs<T>(arr: T[]): T[][] {
  const pairs: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) {
    pairs.push(arr.slice(i, i + 2));
  }
  return pairs;
}

// ── Main component ───────────────────────────────────────────
export default function GymDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const gym     = GYMS[id as string] ?? null;

  // ── Tab ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>('log');

  // ── Log tab: gym stats ───────────────────────────────────────
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalClimbers, setTotalClimbers] = useState(0);

  // ── Current Climbs tab ───────────────────────────────────────
  const [gradeGroups,   setGradeGroups]   = useState<GradeGroup[]>([]);
  const [climbsLoading, setClimbsLoading] = useState(false);
  // Index into the gradeGroups array (only grades that have data)
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(0);
  // Bottom-sheet modal for the video grid
  const [modalGroup,    setModalGroup]    = useState<GradeGroup | null>(null);

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
          setSelectedGroupIdx(0); // always start on the first grade that has data
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

  /** Tap a grade dot on the slider → filter sections to that group */
  const handleSliderGrade = (idx: number) => {
    setSelectedGroupIdx(idx);
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
        {(['log', 'climbs'] as TabKey[]).map((tab) => {
          const label   = tab === 'log' ? 'Log a Climb' : 'Current Climbs';
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
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
                <View style={styles.clubJoinBtn}>
                  <Text style={styles.clubJoinLabel}>View</Text>
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

          {/* ── Grade step-slider — only shows grades that have data ── */}
          {!climbsLoading && gradeGroups.length > 0 && (() => {
            const lastIdx = gradeGroups.length - 1;
            const activeGroup = gradeGroups[selectedGroupIdx] ?? gradeGroups[0];
            return (
              <View style={styles.sliderCard}>
                {/* Selected grade in ACCENT pink */}
                <Text style={styles.sliderValue}>{activeGroup.grade}</Text>
                {/* Step track */}
                <View style={styles.stepTrack}>
                  <View style={styles.stepTrackLine} />
                  <View
                    style={[
                      styles.stepTrackLineFilled,
                      { width: lastIdx === 0 ? '100%' : `${(selectedGroupIdx / lastIdx) * 100}%` },
                    ]}
                  />
                  {gradeGroups.map((group, i) => {
                    const pct = lastIdx === 0 ? 50 : (i / lastIdx) * 100;
                    const active = i === selectedGroupIdx;
                    return (
                      <TouchableOpacity
                        key={group.grade}
                        style={[styles.stepHitArea, { left: `${pct}%` }]}
                        onPress={() => handleSliderGrade(i)}
                        activeOpacity={0.7}>
                        <View style={[styles.stepDot, active && styles.stepDotActive]} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {/* Grade labels */}
                <View style={styles.stepLabels}>
                  {gradeGroups.map((group, i) => (
                    <Text
                      key={group.grade}
                      style={[styles.stepLabelText, i === selectedGroupIdx && styles.stepLabelActive]}>
                      {group.grade}
                    </Text>
                  ))}
                </View>
              </View>
            );
          })()}

          {/* ── Single grade section (filtered by slider) ────── */}
          {climbsLoading ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator color={PRIMARY} size="large" />
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
          ) : (
            <ScrollView
              contentContainerStyle={styles.climbsScroll}
              showsVerticalScrollIndicator={false}>

              {/* Only show the grade group selected by the slider */}
              {[gradeGroups[selectedGroupIdx] ?? gradeGroups[0]].map((group) => (
                <View key={group.grade}>

                  {/* Section header: grade pill + counts */}
                  <View style={styles.gradeSectionHeader}>
                    <View style={styles.gradePill}>
                      <Text style={styles.gradePillText}>{group.grade}</Text>
                    </View>
                    <Text style={styles.gradeSectionMeta}>
                      {group.sendCount} send{group.sendCount !== 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.gradeSectionLikes}>
                      ♥ {group.totalLikes}
                    </Text>
                  </View>

                  {/* Horizontally scrollable 2-row grid of problem cards.
                      Currently one aggregated card per grade (future: one card per named problem). */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.probRow}>

                    {/* Split sessions into pairs of 2 for the column layout */}
                    {toPairs([group]).map((pair, colIdx) => (
                      <View key={colIdx} style={styles.probColumn}>
                        {pair.map((g) => (
                          <TouchableOpacity
                            key={g.grade + colIdx}
                            style={styles.probCard}
                            onPress={() => setModalGroup(g)}
                            activeOpacity={0.85}>

                            {/* Cover photo */}
                            {g.coverMediaUrl ? (
                              <Image
                                source={{ uri: g.coverMediaUrl }}
                                style={styles.probCardImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={[styles.probCardImage, styles.probCardNoPhoto]}>
                                <Text style={styles.probCardNoPhotoIcon}>🧗</Text>
                              </View>
                            )}

                            {/* Like count overlay — bottom left */}
                            <View style={styles.probCardLikeOverlay}>
                              <Text style={styles.probCardLikeText}>♥ {g.totalLikes}</Text>
                            </View>

                            {/* Send count label */}
                            <View style={styles.probCardFooter}>
                              <Text style={styles.probCardSends}>
                                {g.sendCount} send{g.sendCount !== 1 ? 's' : ''}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ))}

              <View style={{ height: 32 }} />
            </ScrollView>
          )}
        </View>
      )}

      {/* ══════════════════════════════════════════════════════
          VIDEO GRID MODAL
          Conditionally rendered so it fully unmounts on close
          and never blocks touches on the screen behind it.
      ══════════════════════════════════════════════════════ */}
      {modalGroup !== null && (
        <Modal
          visible
          animationType="slide"
          transparent
          onRequestClose={() => setModalGroup(null)}>
          <View style={styles.modalBackdrop}>
            {/* Tap backdrop to close */}
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setModalGroup(null)}
            />

            <View style={styles.modalPanel}>
              {/* Handle */}
              <View style={styles.modalHandle} />

              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={{ gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.modalGradePill}>
                      <Text style={styles.modalGradePillText}>{modalGroup.grade}</Text>
                    </View>
                    <Text style={styles.modalGymName}>{gym.name}</Text>
                  </View>
                  <Text style={styles.modalSendCount}>
                    {modalGroup.sendCount} send{modalGroup.sendCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setModalGroup(null)} activeOpacity={0.7}>
                  <Text style={styles.modalCloseBtn}>×</Text>
                </TouchableOpacity>
              </View>

              {/* 3-column session grid — sorted by most liked (already sorted in gradeGroup) */}
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.videoGrid}>
                {/* Chunk sessions into rows of 3 */}
                {modalGroup.sessions
                  .reduce<SessionData[][]>((rows, s, i) => {
                    const rowIdx = Math.floor(i / 3);
                    if (!rows[rowIdx]) rows[rowIdx] = [];
                    rows[rowIdx].push(s);
                    return rows;
                  }, [])
                  .map((row, rowIdx) => (
                    <View key={rowIdx} style={styles.videoGridRow}>
                      {row.map((session) => {
                        const name = session.profile?.full_name ?? '';
                        const initials = name ? toInitials(name) : '?';
                        return (
                          // TODO: wire tap to open this session in the feed
                          <View key={session.id} style={styles.videoCell}>
                            {session.media_url ? (
                              <Image
                                source={{ uri: session.media_url }}
                                style={styles.videoCellImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={[styles.videoCellImage, styles.videoCellNoPhoto]}>
                                <Text style={styles.videoCellNoPhotoGrade}>{session.grade}</Text>
                              </View>
                            )}

                            {/* Climber initials chip — top left */}
                            <View style={styles.videoCellInitials}>
                              <Text style={styles.videoCellInitialsText}>{initials}</Text>
                            </View>

                            {/* Like count — bottom left */}
                            <View style={styles.videoCellLike}>
                              <Text style={styles.videoCellLikeText}>♥ {session.likeCount}</Text>
                            </View>
                          </View>
                        );
                      })}
                      {/* Pad incomplete rows so the last row aligns left */}
                      {row.length < 3 &&
                        Array.from({ length: 3 - row.length }).map((_, i) => (
                          <View key={`pad-${i}`} style={styles.videoCellPad} />
                        ))}
                    </View>
                  ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
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
  backArrow: { fontSize: 28, fontFamily: 'DMSans_300Light', color: TEXT_CLR, lineHeight: 28, marginTop: -2 },
  backLabel: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: TEXT_CLR, letterSpacing: 0.1 },

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
    position: 'relative',
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT_MUTED,
    letterSpacing: 0.2,
  },
  tabLabelActive: { color: PRIMARY },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: PRIMARY,
    borderRadius: 2,
  },

  // ── Log tab scroll ───────────────────────────────────────────
  scroll: { paddingTop: 12, paddingBottom: 8 },
  section: { marginTop: 28, paddingHorizontal: 20, gap: 12 },
  sectionTitle: { fontSize: 11, fontFamily: 'DMSans_800ExtraBold', color: TEXT_MUTED, letterSpacing: 1.4 },

  // Hero
  hero: { marginHorizontal: 16, height: 180, borderRadius: 20, backgroundColor: PRIMARY, overflow: 'hidden' },
  heroOverlay: { flex: 1, justifyContent: 'flex-end', padding: 20, backgroundColor: 'rgba(13,43,54,0.35)' },
  gymPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8,
  },
  gymPillMarker: { fontSize: 8, color: '#ffffff' },
  gymPillText: { fontSize: 11, fontFamily: 'DMSans_800ExtraBold', color: '#ffffff', letterSpacing: 0.5, textTransform: 'uppercase' },
  heroName: { fontSize: 34, fontFamily: 'BebasNeue_400Regular', color: '#ffffff', letterSpacing: 1, lineHeight: 38 },
  heroLocation: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.1, marginTop: 2 },

  // Stats row
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: SURFACE, borderRadius: 16, paddingVertical: 16,
  },
  statBlock: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 22, fontFamily: 'DMSans_800ExtraBold', color: TEXT_CLR },
  statLabel: { fontSize: 10, fontFamily: 'DMSans_700Bold', color: TEXT_MUTED, letterSpacing: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: DIVIDER },

  // Log CTA
  logBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 16,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 4,
  },
  logBtnLabel: { fontSize: 17, fontFamily: 'DMSans_800ExtraBold', color: '#ffffff', letterSpacing: 0.2 },
  logBtnArrow: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: '#ffffff' },

  // About
  aboutText: { fontSize: 15, fontFamily: 'DMSans_400Regular', color: TEXT_CLR, lineHeight: 22, letterSpacing: -0.1 },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: SURFACE, borderRadius: 12, padding: 12 },
  hoursIcon: { fontSize: 14 },
  hoursText: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: TEXT_SUB, flex: 1 },

  // Location
  mapCard: { borderRadius: 16, backgroundColor: SURFACE, overflow: 'hidden', borderWidth: 1.5, borderColor: DIVIDER },
  mapPlaceholder: { height: 120, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', gap: 6 },
  mapPin: { fontSize: 28 },
  mapLabel: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: 'rgba(255,255,255,0.85)' },
  addressRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  addressText: { flex: 1, fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: TEXT_CLR, letterSpacing: -0.1 },
  addressChevron: { fontSize: 20, color: TEXT_MUTED },

  // Amenities
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: SURFACE, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  amenityIcon: { fontSize: 16 },
  amenityLabel: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: TEXT_CLR, letterSpacing: -0.1 },

  // Clubs
  clubCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: SURFACE, borderRadius: 14, padding: 14 },
  clubAvatar: { width: 40, height: 40, borderRadius: 10, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  clubAvatarText: { fontSize: 18, fontFamily: 'DMSans_800ExtraBold', color: '#ffffff' },
  clubInfo: { flex: 1, gap: 1 },
  clubName: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: TEXT_CLR, letterSpacing: -0.2 },
  clubMembers: { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: TEXT_SUB },
  clubJoinBtn: { backgroundColor: BG, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7, borderWidth: 1.5, borderColor: DIVIDER },
  clubJoinLabel: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: TEXT_CLR },

  // Events
  eventCard: { flexDirection: 'row', gap: 14, backgroundColor: SURFACE, borderRadius: 14, padding: 14 },
  eventDateBadge: { width: 52, height: 52, borderRadius: 12, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  eventDateText: { fontSize: 11, fontFamily: 'DMSans_800ExtraBold', color: '#ffffff', textAlign: 'center', letterSpacing: 0.2 },
  eventBody: { flex: 1, gap: 2 },
  eventTitle: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: TEXT_CLR, letterSpacing: -0.2 },
  eventTime: { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: PRIMARY, letterSpacing: 0.1 },
  eventDesc: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: TEXT_SUB, lineHeight: 18, marginTop: 2 },

  // ── Current Climbs: grade step-slider ────────────────────────
  sliderCard: {
    backgroundColor: SURFACE,
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 14, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    alignItems: 'center',
  },
  sliderValue: {
    fontSize: 28,
    fontFamily: 'DMSans_800ExtraBold',
    color: ACCENT,      // selected grade in ACCENT pink per spec
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  stepTrack: { width: '100%', height: 32, justifyContent: 'center', marginBottom: 6 },
  stepTrackLine: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: '#c2d9e3', borderRadius: 2 },
  stepTrackLineFilled: { position: 'absolute', left: 0, height: 3, backgroundColor: PRIMARY, borderRadius: 2 },
  stepHitArea: {
    position: 'absolute', width: 32, height: 32,
    marginLeft: -16, alignItems: 'center', justifyContent: 'center',
  },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#c2d9e3', borderWidth: 2, borderColor: '#ffffff' },
  stepDotActive: { width: 20, height: 20, borderRadius: 10, backgroundColor: PRIMARY, borderWidth: 3, borderColor: '#ffffff' },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  stepLabelText: { fontSize: 10, fontFamily: 'DMSans_600SemiBold', color: TEXT_MUTED, textAlign: 'center' },
  stepLabelActive: { color: ACCENT, fontFamily: 'DMSans_800ExtraBold' },

  // ── Current Climbs: loading / empty ─────────────────────────
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, fontFamily: 'DMSans_600SemiBold', color: TEXT_MUTED, textAlign: 'center' },
  emptyLogBtn: {
    backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12,
  },
  emptyLogBtnLabel: { fontSize: 15, fontFamily: 'DMSans_800ExtraBold', color: '#ffffff' },

  // ── Current Climbs: grade sections ──────────────────────────
  climbsScroll: { paddingTop: 8, paddingBottom: 16 },

  gradeSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, marginTop: 20, marginBottom: 10,
  },
  gradePill: {
    backgroundColor: ACCENT, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  gradePillText: { fontSize: 14, fontFamily: 'DMSans_800ExtraBold', color: '#ffffff', letterSpacing: 0.2 },
  gradeSectionMeta: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: TEXT_SUB },
  gradeSectionLikes: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: ACCENT, marginLeft: 'auto' as any },

  // Problem card grid
  probRow: { paddingHorizontal: 16, gap: PROB_CARD_GAP },
  probColumn: { gap: PROB_CARD_GAP, flexDirection: 'column' },
  probCard: {
    width: PROB_CARD_W, height: PROB_CARD_H,
    borderRadius: 14, overflow: 'hidden',
    backgroundColor: SURFACE,
    borderWidth: 1.5, borderColor: CARD_BDR,
  },
  probCardImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  probCardNoPhoto: { alignItems: 'center', justifyContent: 'center' },
  probCardNoPhotoIcon: { fontSize: 28 },
  probCardLikeOverlay: {
    position: 'absolute', bottom: 28, left: 6,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  probCardLikeText: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: ACCENT },
  probCardFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.50)',
    paddingHorizontal: 6, paddingVertical: 5,
  },
  probCardSends: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: '#ffffff' },

  // ── Video grid modal ─────────────────────────────────────────
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalPanel: {
    backgroundColor: BG,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 32,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: DIVIDER, alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DIVIDER,
  },
  modalGradePill: {
    backgroundColor: ACCENT, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  modalGradePillText: { fontSize: 13, fontFamily: 'DMSans_800ExtraBold', color: '#ffffff' },
  modalGymName: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: TEXT_CLR, letterSpacing: -0.2 },
  modalSendCount: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: TEXT_MUTED, marginTop: 2 },
  modalCloseBtn: { fontSize: 26, color: TEXT_MUTED, lineHeight: 28, fontFamily: 'DMSans_300Light' },

  // 3-column video grid
  videoGrid: { paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  videoGridRow: { flexDirection: 'row', gap: 4 },
  videoCell: {
    flex: 1,
    aspectRatio: 0.75,     // portrait thumbnail (3:4)
    borderRadius: 10, overflow: 'hidden',
    backgroundColor: SURFACE,
  },
  videoCellImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  videoCellNoPhoto: { alignItems: 'center', justifyContent: 'center' },
  videoCellNoPhotoGrade: { fontSize: 22, fontFamily: 'DMSans_800ExtraBold', color: TEXT_MUTED },
  // Climber initials chip — top left
  videoCellInitials: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: 'rgba(0,0,0,0.50)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  videoCellInitialsText: { fontSize: 11, fontFamily: 'DMSans_800ExtraBold', color: '#ffffff' },
  // Like count — bottom left
  videoCellLike: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  videoCellLikeText: { fontSize: 11, fontFamily: 'DMSans_700Bold', color: ACCENT },
  videoCellPad: { flex: 1 },
});
