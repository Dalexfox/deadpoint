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
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { fetchGyms, gymName as resolveGymName } from '../../lib/gyms';
import { ClimbDatePicker, climbDayKey } from '../../components/ClimbDatePicker';

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

// A single public climb shown in the profile grid.
type ClimbCard = {
  sessionId: string;
  grade:     string | null;
  gymName:   string;
  date:      string;
  createdAt: string;
  mediaUrl:  string | null;
};

// Chunk a list into rows of 3 for the grid.
function toRows<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
  return rows;
}

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
  const [climbs, setClimbs] = useState<ClimbCard[]>([]);
  const [loading, setLoading] = useState(true);

  // Climb grid filter (grade slider) + sort (Date / Gym)
  const [gradeSlider, setGradeSlider] = useState<number | null>(null);
  const [gradeFilter, setGradeFilter] = useState<string | null>(null);
  const [sortBy,      setSortBy]      = useState<'date' | 'gym'>('date');
  const [sortOpen,    setSortOpen]    = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const handleGradeSlider = (i: number) => {
    if (gradeSlider === i) { setGradeSlider(null); setGradeFilter(null); } // tap again to clear
    else { setGradeSlider(i); setGradeFilter(GRADE_ORDER[i]); }
  };

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

    // Fetch this user's sessions + their climbs. RLS returns only PUBLIC sessions
    // for other users (and all of your own), so the grid + stats are public-only
    // when viewing someone else — quiet climbs never leak here.
    const [gyms, { data: sessions }] = await Promise.all([
      fetchGyms(),
      supabase
        .from('sessions')
        .select('id, gym_id, media_url, created_at, climbs(grade)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

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

    // Build the climb grid (already public-only via RLS, newest first).
    setClimbs(
      (sessions ?? []).map((s) => ({
        sessionId: String(s.id),
        grade:     ((s.climbs ?? []) as { grade: string }[])[0]?.grade ?? null,
        gymName:   resolveGymName(gyms, s.gym_id),
        date:      new Date(s.created_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        }),
        createdAt: s.created_at,
        mediaUrl:  s.media_url ?? null,
      })),
    );

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

  // Apply grade filter + sort. 'date' keeps the fetch order (newest first);
  // 'gym' sorts alphabetically by gym name.
  const markedDays = new Set(climbs.map((c) => climbDayKey(new Date(c.createdAt))));

  const visibleClimbs = (() => {
    let list = gradeFilter ? climbs.filter((c) => c.grade === gradeFilter) : climbs;
    if (selectedDay) {
      const key = climbDayKey(selectedDay);
      list = list.filter((c) => climbDayKey(new Date(c.createdAt)) === key);
    }
    return sortBy === 'gym'
      ? [...list].sort((a, b) => a.gymName.localeCompare(b.gymName))
      : list;
  })();

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

          {/* ── Climbs grid (public climbs only) ── */}
          <View style={styles.climbsSection}>
            <Text style={styles.climbsLabel}>CLIMBS</Text>

            {/* Date picker trigger */}
            {climbs.length > 0 && (
              <TouchableOpacity
                style={styles.dateSearchWrap}
                onPress={() => setDatePickerOpen(true)}
                activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={16} color={selectedDay ? SAND : INK3} />
                <Text style={[styles.dateSearchText, selectedDay && styles.dateSearchTextActive]}>
                  {selectedDay
                    ? selectedDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Pick a date'}
                </Text>
                {selectedDay && (
                  <TouchableOpacity onPress={() => setSelectedDay(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color={INK3} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )}

            {/* Filter (grade slider) + sort (Date / Gym) — only when there are climbs */}
            {climbs.length > 0 && (
              <>
                <View style={styles.controlsRow}>
                  {/* Grade step-slider */}
                  <View style={styles.sliderWrap}>
                    {gradeSlider !== null && (
                      <Text style={styles.sliderValue}>{GRADE_ORDER[gradeSlider]}</Text>
                    )}
                    <View style={styles.stepTrack}>
                      <View style={styles.stepTrackLine} />
                      {gradeSlider !== null && (
                        <View style={[styles.stepTrackLineFilled, { width: `${(gradeSlider / (GRADE_ORDER.length - 1)) * 100}%` }]} />
                      )}
                      {GRADE_ORDER.map((g, i) => {
                        const hasData = climbs.some((c) => c.grade === g);
                        return (
                          <TouchableOpacity
                            key={g}
                            style={[styles.stepHitArea, { left: `${(i / (GRADE_ORDER.length - 1)) * 100}%` }]}
                            onPress={() => handleGradeSlider(i)}
                            activeOpacity={0.7}>
                            <View style={[
                              styles.stepDot,
                              i === gradeSlider && styles.stepDotActive,
                              !hasData && styles.stepDotEmpty,
                            ]} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View style={styles.stepLabels}>
                      {GRADE_ORDER.map((g, i) => (
                        <Text key={g} style={[styles.stepLabelText, i === gradeSlider && styles.stepLabelActive]}>{g}</Text>
                      ))}
                    </View>
                  </View>

                  {/* Clear/All + sort menu */}
                  <View style={styles.rightCol}>
                    {gradeFilter !== null ? (
                      <TouchableOpacity
                        style={styles.clearBtn}
                        onPress={() => { setGradeFilter(null); setGradeSlider(null); }}
                        activeOpacity={0.7}>
                        <Text style={styles.clearBtnText}>✕  Clear</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.allBtn}><Text style={styles.allBtnText}>All</Text></View>
                    )}
                    <TouchableOpacity style={styles.menuBtn} onPress={() => setSortOpen((v) => !v)} activeOpacity={0.7}>
                      <Ionicons name="menu" size={22} color={INK} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Sort options (inline panel) */}
                {sortOpen && (
                  <View style={styles.sortPanel}>
                    {([{ key: 'date', label: 'Date' }, { key: 'gym', label: 'Gym' }] as const).map(({ key, label }) => (
                      <TouchableOpacity
                        key={key}
                        style={styles.sortItem}
                        onPress={() => { setSortBy(key); setSortOpen(false); }}
                        activeOpacity={0.7}>
                        <Text style={[styles.sortLabel, sortBy === key && styles.sortLabelActive]}>{label}</Text>
                        {sortBy === key && <Ionicons name="checkmark" size={15} color={SAND} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {climbs.length === 0 ? (
              <Text style={styles.climbsEmpty}>No public climbs yet.</Text>
            ) : visibleClimbs.length === 0 ? (
              <Text style={styles.climbsEmpty}>
                {selectedDay
                  ? 'No climbs on that date.'
                  : `No ${gradeFilter} climbs yet.`}
              </Text>
            ) : (
              <View style={styles.climbsGrid}>
                {toRows(visibleClimbs).map((row, ri) => (
                  <View key={ri} style={styles.climbsRow}>
                    {row.map((c) => (
                      <TouchableOpacity
                        key={c.sessionId}
                        style={{ flex: 1 }}
                        activeOpacity={0.75}
                        onPress={() => router.push(`/session/${c.sessionId}`)}>
                        <View style={styles.climbCard}>
                          {c.mediaUrl ? (
                            <Image source={{ uri: c.mediaUrl }} style={styles.climbThumb} resizeMode="cover" />
                          ) : (
                            <View style={styles.climbThumbEmpty}>
                              <Text style={styles.climbEmptyIcon}>🧗</Text>
                            </View>
                          )}
                          <View style={styles.climbBody}>
                            <Text style={styles.climbGrade}>{c.grade ?? '—'}</Text>
                            <Text style={styles.climbGym} numberOfLines={1}>{c.gymName}</Text>
                            <Text style={styles.climbDate}>{c.date}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                    {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => (
                      <View key={`pad-${i}`} style={{ flex: 1 }} />
                    ))}
                  </View>
                ))}
              </View>
            )}
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

      {/* ── Date picker ── */}
      {datePickerOpen && (
        <ClimbDatePicker
          onClose={() => setDatePickerOpen(false)}
          selected={selectedDay}
          markedDays={markedDays}
          initialMonth={climbs[0] ? new Date(climbs[0].createdAt) : undefined}
          onSelect={setSelectedDay}
        />
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

  // ── Climbs grid ──────────────────────────────────────────────
  climbsSection: {
    marginTop: 28,
    gap: 12,
  },
  climbsLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  climbsEmpty: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK3,
    paddingVertical: 12,
  },
  climbsGrid: {
    gap: 10,
  },
  climbsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  climbCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    overflow: 'hidden',
  },
  climbThumb: {
    width: '100%',
    height: 80,
  },
  climbThumbEmpty: {
    width: '100%',
    height: 80,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  climbEmptyIcon: {
    fontSize: 22,
  },
  climbBody: {
    padding: 10,
    gap: 2,
  },
  climbGrade: {
    fontSize: 18,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND,
    letterSpacing: -0.5,
  },
  climbGym: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK,
  },
  climbDate: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK3,
  },

  // ── Date search ──────────────────────────────────────────────
  dateSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dateSearchText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK3,
  },
  dateSearchTextActive: {
    color: INK,
    fontFamily: 'SpaceGrotesk_700Bold',
  },

  // ── Filter + sort controls ───────────────────────────────────
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sliderWrap: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
  },
  sliderValue: {
    fontSize: 24,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND,
    letterSpacing: -1,
    marginBottom: 10,
  },
  stepTrack: { width: '100%', height: 28, justifyContent: 'center', marginBottom: 6 },
  stepTrackLine: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: DIVIDER, borderRadius: 2 },
  stepTrackLineFilled: { position: 'absolute', left: 0, height: 1.5, backgroundColor: INK, borderRadius: 2 },
  stepHitArea: { position: 'absolute', width: 32, height: 32, marginLeft: -16, alignItems: 'center', justifyContent: 'center' },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: SURFACE, borderWidth: 0.5, borderColor: 'rgba(26,20,8,0.1)' },
  stepDotActive: { width: 18, height: 18, borderRadius: 9, backgroundColor: INK, borderWidth: 3, borderColor: '#ffffff' },
  stepDotEmpty: { opacity: 0.4 },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  stepLabelText: { fontSize: 9, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK3, textAlign: 'center' },
  stepLabelActive: { color: SAND, fontFamily: 'Syne_800ExtraBold' },
  rightCol: {
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(200,168,74,0.12)',
    borderWidth: 0.5,
    borderColor: SAND,
  },
  clearBtnText: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 11,
    color: SAND,
  },
  allBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  allBtnText: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 11,
    color: 'rgba(26,20,8,0.3)',
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortPanel: {
    alignSelf: 'flex-end',
    minWidth: 130,
    backgroundColor: BG,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: DIVIDER,
    overflow: 'hidden',
  },
  sortItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  sortLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK3,
    letterSpacing: 0.1,
  },
  sortLabelActive: { color: SAND },

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
