import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG         = '#ffffff';
const CARD       = '#d8eaf0';
const SURFACE    = '#d8eaf0';
const PRIMARY    = '#2E7A96';
const TEXT       = '#0d2b36';
const TEXT_SUB   = '#3d7a8a';
const TEXT_MUTED = '#8bb5c4';
const DIVIDER    = '#c8dde8';

const GRADE_ORDER = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10'];

// ─── Types ────────────────────────────────────────────────────────────────────

type UserProfile = {
  fullName: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

type UserStats = {
  totalClimbs: number;
  topGrade: string;
  gymsVisited: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadProfile(id);
  }, [id]);

  async function loadProfile(userId: string) {
    setLoading(true);

    // Fetch profile row
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, username, avatar_url, bio')
      .eq('id', userId)
      .single();

    // Fetch this user's sessions + their climbs for stat computation
    const { data: sessions } = await supabase
      .from('sessions')
      .select('gym_id, climbs(grade, count)')
      .eq('user_id', userId);

    // Compute stats from sessions
    let totalClimbs = 0;
    const gradeCounts: Record<string, number> = {};
    const gymSet = new Set<string>();

    (sessions ?? []).forEach((session) => {
      gymSet.add(session.gym_id);
      ((session.climbs ?? []) as { grade: string; count: number }[]).forEach((climb) => {
        if (climb.count > 0) {
          totalClimbs += climb.count;
          gradeCounts[climb.grade] = (gradeCounts[climb.grade] ?? 0) + climb.count;
        }
      });
    });

    // Top grade = highest grade in V-scale order that the user has climbed
    const topGrade =
      [...GRADE_ORDER].reverse().find((g) => (gradeCounts[g] ?? 0) > 0) ?? '—';

    setProfile({
      fullName: profileData?.full_name ?? 'Climber',
      username: profileData?.username ?? null,
      avatarUrl: profileData?.avatar_url ?? null,
      bio: profileData?.bio ?? null,
    });

    setStats({
      totalClimbs,
      topGrade,
      gymsVisited: gymSet.size,
    });

    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PROFILE</Text>
        {/* Spacer keeps title centred */}
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>

          {/* ── Identity block ── */}
          <View style={styles.identityBlock}>
            {/* Avatar */}
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>
                  {toInitials(profile?.fullName ?? 'Climber')}
                </Text>
              </View>
            )}

            <Text style={styles.fullName}>{profile?.fullName}</Text>

            {profile?.username ? (
              <Text style={styles.username}>@{profile.username}</Text>
            ) : null}

            {profile?.bio ? (
              <Text style={styles.bio}>{profile.bio}</Text>
            ) : null}
          </View>

          {/* ── Stats bar ── */}
          <View style={styles.statsBlock}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{stats?.totalClimbs ?? 0}</Text>
              <Text style={styles.statLabel}>TOTAL CLIMBS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{stats?.topGrade ?? '—'}</Text>
              <Text style={styles.statLabel}>TOP GRADE</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{stats?.gymsVisited ?? 0}</Text>
              <Text style={styles.statLabel}>GYMS VISITED</Text>
            </View>
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
  },
  backChevron: {
    fontSize: 34,
    color: TEXT,
    fontFamily: 'DMSans_300Light',
    lineHeight: 38,
    marginTop: -4,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 1.5,
  },

  // ── Loading ──────────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Content ──────────────────────────────────────────────────────────────────
  content: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 48,
    gap: 28,
  },

  // ── Identity ─────────────────────────────────────────────────────────────────
  identityBlock: {
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 16,
    marginBottom: 4,
  },
  avatarFallback: {
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 34,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  fullName: {
    fontSize: 26,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  username: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_SUB,
    textAlign: 'center',
  },
  bio: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 2,
  },

  // ── Stats ─────────────────────────────────────────────────────────────────────
  statsBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: DIVIDER,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 26,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: 'DMSans_700Bold',
    color: TEXT_MUTED,
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: DIVIDER,
    marginHorizontal: 8,
  },
});
