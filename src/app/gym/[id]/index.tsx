import { useCallback, useState } from 'react';
import {
  Dimensions,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';

const BG        = '#ffffff';
const CARD      = '#d8eaf0';
const SURFACE   = '#d8eaf0';
const ACCENT    = '#ff507c';
const PRIMARY   = '#2E7A96';
const TEXT_CLR  = '#0d2b36';
const TEXT_SUB  = '#3d7a8a';
const TEXT_MUTED = '#8bb5c4';
const DIVIDER   = '#c8dde8';

const SCREEN_W = Dimensions.get('window').width;

type GymData = {
  name: string;
  neighborhood: string;
  city: string;
  address: string;
  hours: string;
  about: string;
  amenities: string[];
  clubs: { name: string; members: number }[];
  events: { title: string; date: string; description: string }[];
  coords: { lat: number; lng: number };
};

const GYMS: Record<string, GymData> = {
  '1': {
    name: 'Vital Climbing LES',
    neighborhood: 'Lower East Side',
    city: 'NYC',
    address: '62 Rivington St, New York, NY 10002',
    hours: 'Mon–Fri 7am–11pm · Sat–Sun 8am–10pm',
    about: 'Vital LES is a premier bouldering gym in the heart of the Lower East Side. Featuring 14,000 sq ft of climbing terrain with problems for all levels, regularly reset by world-class routesetters.',
    amenities: ['Bouldering Walls', 'Training Area', 'Yoga Studio', 'Lounge', 'Gear Shop', 'Showers'],
    clubs: [
      { name: 'LES Crushers', members: 48 },
      { name: 'Women Who Wall', members: 32 },
    ],
    events: [
      { title: 'Tuesday Night Comp', date: 'Every Tuesday · 7pm', description: 'Weekly informal bouldering competition. All levels welcome.' },
      { title: 'Summer Send Fest', date: 'Jun 14 · 12pm', description: 'End-of-season send party with prizes, food, and music.' },
    ],
    coords: { lat: 40.7204, lng: -73.9885 },
  },
  '2': {
    name: 'Vital Climbing Brooklyn',
    neighborhood: 'Brooklyn',
    city: 'NYC',
    address: '221 N 10th St, Brooklyn, NY 11211',
    hours: 'Mon–Fri 7am–11pm · Sat–Sun 8am–10pm',
    about: 'Vital Brooklyn brings world-class bouldering to Williamsburg. Over 16,000 sq ft of climbing surface with a dedicated training zone, community events, and a rooftop hangout space.',
    amenities: ['Bouldering Walls', 'Training Area', 'Fitness Room', 'Rooftop Deck', 'Café', 'Showers'],
    clubs: [
      { name: 'BK Boulder Club', members: 61 },
      { name: 'Williamsburg Senders', members: 27 },
    ],
    events: [
      { title: 'Moonlight Bouldering', date: 'Every Friday · 9pm', description: 'Late-night session with dim lighting and DJ sets.' },
      { title: 'Beginner Clinic', date: 'Jun 7 · 10am', description: 'Free intro session for first-time climbers.' },
    ],
    coords: { lat: 40.7182, lng: -73.9569 },
  },
  '3': {
    name: 'Vital Climbing UES',
    neighborhood: 'Upper East Side',
    city: 'NYC',
    address: '1635 Lexington Ave, New York, NY 10029',
    hours: 'Mon–Fri 6:30am–11pm · Sat–Sun 8am–9pm',
    about: 'Vital UES is a modern bouldering facility on the Upper East Side. Features 12,000 sq ft of climbing terrain, a full fitness area, and regular community programming.',
    amenities: ['Bouldering Walls', 'Training Area', 'Fitness Room', 'Lounge', 'Gear Shop', 'Showers'],
    clubs: [
      { name: 'Uptown Slab Crew', members: 35 },
    ],
    events: [
      { title: 'Saturday Projecting', date: 'Every Saturday · 11am', description: 'Group projecting session with coaching tips.' },
      { title: 'Youth Comp', date: 'Jun 21 · 9am', description: 'Competition for climbers ages 8–16.' },
    ],
    coords: { lat: 40.7916, lng: -73.9445 },
  },
  '4': {
    name: 'Vital Climbing UWS',
    neighborhood: 'Upper West Side',
    city: 'NYC',
    address: '750 Columbus Ave, New York, NY 10025',
    hours: 'Mon–Fri 6:30am–11pm · Sat–Sun 8am–9pm',
    about: 'Vital UWS brings the climbing experience to the Upper West Side. A 13,000 sq ft facility with diverse wall angles, a strength training zone, and a welcoming community.',
    amenities: ['Bouldering Walls', 'Training Area', 'Yoga Studio', 'Fitness Room', 'Lounge', 'Showers'],
    clubs: [
      { name: 'West Side Dyno', members: 42 },
      { name: 'Morning Senders', members: 19 },
    ],
    events: [
      { title: 'Wednesday Workshop', date: 'Every Wednesday · 6pm', description: 'Technique workshop covering footwork, body position, and reading routes.' },
      { title: 'Pride Climb', date: 'Jun 28 · 12pm', description: 'Celebrate Pride Month with a community climb and social.' },
    ],
    coords: { lat: 40.7923, lng: -73.9665 },
  },
};

const AMENITY_ICONS: Record<string, string> = {
  'Bouldering Walls': '🧗',
  'Training Area': '💪',
  'Yoga Studio': '🧘',
  'Fitness Room': '🏋️',
  'Lounge': '☕',
  'Café': '☕',
  'Gear Shop': '🎒',
  'Showers': '🚿',
  'Rooftop Deck': '🌇',
};

export default function GymDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const gym = GYMS[id as string] ?? null;

  const [totalSessions, setTotalSessions] = useState(0);
  const [totalClimbers, setTotalClimbers] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const { data } = await supabase
          .from('sessions')
          .select('id, user_id')
          .eq('gym_id', id);
        if (!active || !data) return;
        setTotalSessions(data.length);
        setTotalClimbers(new Set(data.map((s: any) => s.user_id)).size);
      })();
      return () => { active = false; };
    }, [id])
  );

  if (!gym) return null;

  const openMaps = () => {
    Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(gym.name)}&ll=${gym.coords.lat},${gym.coords.lng}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Nav */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>Gyms</Text>
        </TouchableOpacity>
      </View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // ── Nav ─────────────────────────────────────────────────────
  nav: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backArrow: { fontSize: 28, fontFamily: 'DMSans_300Light', color: TEXT_CLR, lineHeight: 28, marginTop: -2 },
  backLabel: { fontSize: 16, fontFamily: 'DMSans_700Bold', color: TEXT_CLR, letterSpacing: 0.1 },

  // ── Hero ────────────────────────────────────────────────────
  hero: {
    marginHorizontal: 16,
    height: 180,
    borderRadius: 20,
    backgroundColor: PRIMARY,
    overflow: 'hidden',
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
    backgroundColor: 'rgba(13,43,54,0.35)',
  },
  gymPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  gymPillMarker: { fontSize: 8, color: '#ffffff' },
  gymPillText: { fontSize: 11, fontFamily: 'DMSans_800ExtraBold', color: '#ffffff', letterSpacing: 0.5, textTransform: 'uppercase' },
  heroName: { fontSize: 34, fontFamily: 'BebasNeue_400Regular', color: '#ffffff', letterSpacing: 1, lineHeight: 38 },
  heroLocation: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.1, marginTop: 2 },

  // ── Stats row ───────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: SURFACE,
    borderRadius: 16,
    paddingVertical: 16,
  },
  statBlock: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 22, fontFamily: 'DMSans_800ExtraBold', color: TEXT_CLR },
  statLabel: { fontSize: 10, fontFamily: 'DMSans_700Bold', color: TEXT_MUTED, letterSpacing: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: DIVIDER },

  // ── Log CTA ─────────────────────────────────────────────────
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 4,
  },
  logBtnLabel: { fontSize: 17, fontFamily: 'DMSans_800ExtraBold', color: '#ffffff', letterSpacing: 0.2 },
  logBtnArrow: { fontSize: 18, fontFamily: 'DMSans_700Bold', color: '#ffffff' },

  // ── Sections ────────────────────────────────────────────────
  scroll: { paddingTop: 12, paddingBottom: 8 },
  section: { marginTop: 28, paddingHorizontal: 20, gap: 12 },
  sectionTitle: { fontSize: 11, fontFamily: 'DMSans_800ExtraBold', color: TEXT_MUTED, letterSpacing: 1.4 },

  // ── About ───────────────────────────────────────────────────
  aboutText: { fontSize: 15, fontFamily: 'DMSans_400Regular', color: TEXT_CLR, lineHeight: 22, letterSpacing: -0.1 },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: SURFACE, borderRadius: 12, padding: 12 },
  hoursIcon: { fontSize: 14 },
  hoursText: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: TEXT_SUB, flex: 1 },

  // ── Location ────────────────────────────────────────────────
  mapCard: { borderRadius: 16, backgroundColor: SURFACE, overflow: 'hidden', borderWidth: 1.5, borderColor: DIVIDER },
  mapPlaceholder: { height: 120, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', gap: 6 },
  mapPin: { fontSize: 28 },
  mapLabel: { fontSize: 13, fontFamily: 'DMSans_600SemiBold', color: 'rgba(255,255,255,0.85)' },
  addressRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  addressText: { flex: 1, fontSize: 14, fontFamily: 'DMSans_600SemiBold', color: TEXT_CLR, letterSpacing: -0.1 },
  addressChevron: { fontSize: 20, color: TEXT_MUTED },

  // ── Amenities ───────────────────────────────────────────────
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  amenityIcon: { fontSize: 16 },
  amenityLabel: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: TEXT_CLR, letterSpacing: -0.1 },

  // ── Clubs ───────────────────────────────────────────────────
  clubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 14,
  },
  clubAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubAvatarText: { fontSize: 18, fontFamily: 'DMSans_800ExtraBold', color: '#ffffff' },
  clubInfo: { flex: 1, gap: 1 },
  clubName: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: TEXT_CLR, letterSpacing: -0.2 },
  clubMembers: { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: TEXT_SUB },
  clubJoinBtn: {
    backgroundColor: BG,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: DIVIDER,
  },
  clubJoinLabel: { fontSize: 13, fontFamily: 'DMSans_700Bold', color: TEXT_CLR },

  // ── Events ──────────────────────────────────────────────────
  eventCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 14,
  },
  eventDateBadge: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDateText: { fontSize: 11, fontFamily: 'DMSans_800ExtraBold', color: '#ffffff', textAlign: 'center', letterSpacing: 0.2 },
  eventBody: { flex: 1, gap: 2 },
  eventTitle: { fontSize: 15, fontFamily: 'DMSans_700Bold', color: TEXT_CLR, letterSpacing: -0.2 },
  eventTime: { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: PRIMARY, letterSpacing: 0.1 },
  eventDesc: { fontSize: 13, fontFamily: 'DMSans_400Regular', color: TEXT_SUB, lineHeight: 18, marginTop: 2 },
});
