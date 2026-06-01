import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
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
const CARD       = '#f4f1eb';
const SURFACE    = '#ece8df';
const SAND       = '#c8a84a';
const SAND_LT    = '#e8c87a';
const INK        = '#1a1408';
const INK2       = '#3d3320';
const INK3       = '#8a7a50';
const DIVIDER    = 'rgba(26,20,8,0.08)';

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

type FollowUser = {
  id:        string;
  fullName:  string;
  username:  string | null;
  avatarUrl: string | null;
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

  const [isFollowing,        setIsFollowing]        = useState(false);
  const [followerCount,      setFollowerCount]       = useState(0);
  const [followingCount,     setFollowingCount]      = useState(0);
  const [followersVisible,   setFollowersVisible]    = useState(false);
  const [followingVisible,   setFollowingVisible]    = useState(false);
  const [followersList,      setFollowersList]       = useState<FollowUser[]>([]);
  const [followingList,      setFollowingList]       = useState<FollowUser[]>([]);
  const [followListLoading,  setFollowListLoading]   = useState(false);
  const [followActionLoading, setFollowActionLoading] = useState(false);
  const [currentUserId,      setCurrentUserId]       = useState<string | null>(null);

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
      .select('gym_id, climbs(grade)')
      .eq('user_id', userId);

    // Compute stats from sessions
    let totalClimbs = 0;
    const gradeCounts: Record<string, number> = {};
    const gymSet = new Set<string>();

    (sessions ?? []).forEach((session) => {
      gymSet.add(session.gym_id);
      const grade = ((session.climbs ?? []) as { grade: string }[])[0]?.grade;
      if (grade) {
        totalClimbs += 1;
        gradeCounts[grade] = (gradeCounts[grade] ?? 0) + 1;
      }
    });

    // Top grade = highest V-scale grade across all sessions
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

    // Follow data (graceful — follows table may not exist yet)
    try {
      const { data: { user: me } } = await supabase.auth.getUser();
      if (me) {
        setCurrentUserId(me.id);
        const [{ count: fc }, { count: fgc }] = await Promise.all([
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
        ]);
        setFollowerCount(fc ?? 0);
        setFollowingCount(fgc ?? 0);
        if (me.id !== userId) {
          const { count: alreadyFollowing } = await supabase
            .from('follows').select('*', { count: 'exact', head: true })
            .eq('follower_id', me.id).eq('following_id', userId);
          setIsFollowing((alreadyFollowing ?? 0) > 0);
        }
      }
    } catch { /* follows table may not exist yet */ }

    setLoading(false);
  }

  const handleFollowToggle = async () => {
    if (!currentUserId || !id) return;
    setFollowActionLoading(true);
    try {
      if (isFollowing) {
        await supabase.from('follows').delete()
          .eq('follower_id', currentUserId).eq('following_id', id);
        setIsFollowing(false);
        setFollowerCount((prev) => Math.max(0, prev - 1));
      } else {
        await supabase.from('follows').insert({ follower_id: currentUserId, following_id: id });
        setIsFollowing(true);
        setFollowerCount((prev) => prev + 1);
      }
    } catch { /* silent */ } finally {
      setFollowActionLoading(false);
    }
  };

  const handleOpenFollowers = async () => {
    setFollowersVisible(true);
    setFollowListLoading(true);
    try {
      const { data: followsData } = await supabase
        .from('follows').select('follower_id').eq('following_id', id);
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
      const { data: followsData } = await supabase
        .from('follows').select('following_id').eq('follower_id', id);
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
          <ActivityIndicator size="large" color={SAND} />
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

            {/* Follow / Following toggle — hidden when viewing own profile */}
            {currentUserId && currentUserId !== id && (
              <TouchableOpacity
                style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                onPress={handleFollowToggle}
                disabled={followActionLoading}
                activeOpacity={0.8}>
                <Text style={[styles.followBtnLabel, isFollowing && styles.followBtnLabelActive]}>
                  {followActionLoading ? '…' : isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Follower / following counts */}
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
                    <View key={u.id} style={styles.sheetUserRow}>
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
                    </View>
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
                    <View key={u.id} style={styles.sheetUserRow}>
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
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
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
    color: INK,
    fontFamily: 'SpaceGrotesk_300Light',
    lineHeight: 38,
    marginTop: -4,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
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
    backgroundColor: SAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 34,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  fullName: {
    fontSize: 26,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  username: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK2,
    textAlign: 'center',
  },
  bio: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK3,
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
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK3,
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: DIVIDER,
    marginHorizontal: 8,
  },

  // ── Follow button ─────────────────────────────────────────────────────────────
  followBtn: {
    backgroundColor: SAND,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 10,
    marginTop: 4,
  },
  followBtnActive: {
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: DIVIDER,
  },
  followBtnLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  followBtnLabelActive: {
    color: INK,
  },
  followCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
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

  // ── Follow sheet ──────────────────────────────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheetPanel: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    paddingTop: 12,
    paddingBottom: 32,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: DIVIDER,
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
    letterSpacing: -0.3,
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
    borderBottomColor: DIVIDER,
  },
  sheetAvatar: {
    width: 44,
    height: 44,
    borderRadius: 11,
  },
  sheetAvatarFallback: {
    backgroundColor: SAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetAvatarInitials: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#ffffff',
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
});
