import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  getProfileAvatar,
  saveProfileAvatar,
  saveUserPost,
} from '../../lib/store';
import { supabase } from '../../lib/supabase';

// V-scale order used to determine hardest grade sent
const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];

// Maps sessions.gym_id → human-readable gym name
const GYM_NAMES: Record<string, string> = {
  '1': 'Vital Climbing LES',
  '2': 'Vital Climbing Brooklyn',
  '3': 'Vital Climbing UES',
  '4': 'Vital Climbing UWS',
};

// Shape of a session card built from Supabase data
type SupabaseSession = {
  id: string;
  gymName: string;
  gradesSummary: string; // e.g. "V3 ×2  ·  V4 ×3  ·  V5 ×1"
  totalProblems: number;
  date: string;          // e.g. "May 27, 2026"
};

const BG = '#0c1e21';
const CARD = '#142829';
const SURFACE = '#1a3235';
const ACCENT = '#ff507c';
const TEXT = '#ffffff';
const TEXT_SUB = '#7ab4b8';
const TEXT_MUTED = '#3d6b6f';

const USER = {
  name: 'Alex Fox',
  username: '@alexfox',
  initials: 'AF',
};

function StatColumn({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statColumn}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SessionCard({ session }: { session: SupabaseSession }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.accentBar} />
        <View style={styles.cardBody}>
          <Text style={styles.cardGym}>{session.gymName}</Text>
          <Text style={styles.cardDetail}>{session.gradesSummary}</Text>
        </View>
        <Text style={styles.cardDate}>{session.date}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SupabaseSession[]>([]);

  // Stats derived from the same Supabase fetch — default while loading
  const [stats, setStats] = useState<{
    totalClimbs: number;
    gymsVisited: number;
    topGrade: string;
  }>({ totalClimbs: 0, gymsVisited: 0, topGrade: '—' });

  useEffect(() => {
    getProfileAvatar().then(setAvatarUri);
  }, []);

  // Every time the Profile tab gains focus, fetch sessions + climbs fresh from
  // Supabase in two queries, then derive both the session cards and the stats
  // from the same data so there is no stale cache and no extra round-trips.
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // ── 1. Sessions ──────────────────────────────────────────
          const { data: rawSessions, error: sessionsError } = await supabase
            .from('sessions')
            .select('id, gym_id, total_problems, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (sessionsError || !rawSessions) return;

          if (rawSessions.length === 0) {
            setSessions([]);
            setStats({ totalClimbs: 0, gymsVisited: 0, topGrade: '—' });
            return;
          }

          // ── 2. Climbs for all sessions in one query ──────────────
          const sessionIds = rawSessions.map((s) => s.id);
          const { data: climbs } = await supabase
            .from('climbs')
            .select('session_id, grade, count')
            .in('session_id', sessionIds);

          const allClimbs = climbs ?? [];

          // Group climbs by session ID so each card gets its own grade list
          const climbsBySession: Record<string, Array<{ grade: string; count: number }>> = {};
          allClimbs.forEach((c) => {
            if (!climbsBySession[c.session_id]) climbsBySession[c.session_id] = [];
            climbsBySession[c.session_id].push({ grade: c.grade, count: c.count });
          });

          // ── 3. Build session cards ───────────────────────────────
          const formatted: SupabaseSession[] = rawSessions.map((s) => {
            const gymName = GYM_NAMES[s.gym_id] ?? `Gym ${s.gym_id}`;

            // Sort grades low → high, build "V3 ×2  ·  V4 ×3" summary
            const sessionClimbs = (climbsBySession[s.id] ?? [])
              .sort((a, b) => GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade));
            const gradesSummary =
              sessionClimbs.length > 0
                ? sessionClimbs.map((c) => `${c.grade} ×${c.count}`).join('  ·  ')
                : `${s.total_problems} problems`;

            const date = new Date(s.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return { id: s.id, gymName, gradesSummary, totalProblems: s.total_problems, date };
          });
          setSessions(formatted);

          // ── 4. Derive stats from the same data — no extra queries ─
          const uniqueGyms = new Set(rawSessions.map((s) => s.gym_id)).size;
          const totalClimbs = allClimbs.reduce((sum, c) => sum + (c.count ?? 0), 0);
          let topGradeIndex = -1;
          allClimbs.forEach((c) => {
            const idx = GRADES.indexOf(c.grade);
            if (idx > topGradeIndex) topGradeIndex = idx;
          });
          const topGrade = topGradeIndex >= 0 ? GRADES[topGradeIndex] : '—';

          setStats({ totalClimbs, gymsVisited: uniqueGyms, topGrade });
        } catch {
          // fail silently — UI keeps showing last known values
        }
      };

      loadData();
    }, [])
  );

  const handleAvatarPress = () => {
    Alert.alert('Profile Photo', 'Choose a photo for your profile', [
      { text: 'Choose from Library', onPress: pickAvatar },
      { text: 'Take Photo', onPress: takeAvatarPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      saveProfileAvatar(uri);
    }
  };

  const takeAvatarPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      saveProfileAvatar(uri);
    }
  };

  const handleShare = () => {
    Alert.alert('Share to Feed', 'Add a photo or video to your feed', [
      { text: 'Choose Photo', onPress: () => shareMedia('images') },
      { text: 'Choose Video', onPress: () => shareMedia('videos') },
      { text: 'Take Photo', onPress: shareFromCamera },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const shareMedia = async (type: 'images' | 'videos') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [type],
      allowsEditing: true,
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      await publishPost(asset.uri, asset.type === 'video' ? 'video' : 'image');
    }
  };

  const shareFromCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.85 });
    if (!result.canceled) {
      await publishPost(result.assets[0].uri, 'image');
    }
  };

  const publishPost = async (uri: string, mediaType: 'image' | 'video') => {
    await saveUserPost({
      id: Date.now().toString(),
      name: USER.name,
      initials: USER.initials,
      avatarBg: ACCENT,
      timestamp: 'Just now',
      likes: 0,
      comments: 0,
      liked: false,
      postType: 'photo',
      media: [{ type: mediaType, uri }],
    });
    Alert.alert('Posted!', 'Your photo is now live on the feed.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Avatar — square */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.85}>
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
          <Text style={styles.name}>{USER.name}</Text>
          <Text style={styles.username}>{USER.username}</Text>
        </View>

        {/* Stats — live from Supabase */}
        <View style={styles.statsRow}>
          <StatColumn label="Total Climbs" value={stats.totalClimbs} />
          <View style={styles.statDivider} />
          <StatColumn label="Gyms Visited" value={stats.gymsVisited} />
          <View style={styles.statDivider} />
          <StatColumn label="Top Grade" value={stats.topGrade} />
        </View>

        {/* Sessions — live from Supabase */}
        {sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🧗</Text>
            <Text style={styles.emptyTitle}>NO SESSIONS YET</Text>
            <Text style={styles.emptySub}>Log a climb at any gym to see your sessions here</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Your Sessions</Text>
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </>
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
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // ─── Avatar — square ──────────────────────────────────────────
  avatarSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 16,          // Square with soft corners
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 16,          // Square with soft corners
  },
  avatarInitials: {
    fontSize: 34,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: -0.5,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 8,           // Also square to match
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: BG,
  },
  avatarEditIcon: {
    fontSize: 16,
    color: TEXT,
    lineHeight: 18,
  },
  name: {
    fontSize: 30,
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_SUB,
    letterSpacing: 0.1,
  },

  // ─── Stats ────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: SURFACE,
    borderRadius: 16,
    paddingVertical: 20,
    marginBottom: 32,
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
    backgroundColor: '#1e3840',
    marginVertical: 4,
  },
  sectionTitle: {
    fontSize: 26,
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 1,
    marginHorizontal: 20,
    marginBottom: 12,
  },

  // ─── Activity cards ───────────────────────────────────────────
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
    backgroundColor: ACCENT,
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
});
