import { useCallback, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { togglePostLike, type Post } from '../../lib/store';
import { supabase } from '../../lib/supabase';

const BG         = '#ffffff';
const CARD       = '#d8eaf0';
const SURFACE    = '#d8eaf0';
const ACCENT     = '#ff507c';
const PRIMARY    = '#2E7A96';
const TEXT       = '#0d2b36';
const TEXT_SUB   = '#3d7a8a';
const TEXT_MUTED = '#8bb5c4';
const DIVIDER    = '#c8dde8';

const GYM_NAMES: Record<string, string> = {
  '1': 'Vital Climbing LES',
  '2': 'Vital Climbing Brooklyn',
  '3': 'Vital Climbing UES',
  '4': 'Vital Climbing UWS',
};

const GRADE_ORDER = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24)  return `${hrs}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function toInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');
}

function gradeRange(climbs: { grade: string; count: number }[]): string {
  const active = climbs
    .filter((c) => c.count > 0)
    .map((c) => c.grade)
    .sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b));
  if (active.length === 0) return '—';
  if (active.length === 1) return active[0];
  return `${active[0]} – ${active[active.length - 1]}`;
}

async function fetchSessionPosts(): Promise<Post[]> {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(`
      id,
      user_id,
      gym_id,
      total_problems,
      media_url,
      created_at,
      climbs (
        grade,
        count
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  console.log('[fetchSessionPosts] Supabase query result — error:', error, '| sessions count:', sessions?.length ?? 0);

  if (error || !sessions || sessions.length === 0) return [];

  const userIds = [...new Set(sessions.map((s) => s.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url')
    .in('id', userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return sessions.map((session) => {
    const profile = profileMap.get(session.user_id);
    const name = profile?.full_name || profile?.username || 'Climber';
    const grades = (session.climbs ?? []) as { grade: string; count: number }[];

    const post: Post = {
      id: session.id,
      name,
      initials: toInitials(name),
      avatarBg: PRIMARY,
      avatarUrl: profile?.avatar_url ?? undefined,
      timestamp: timeAgo(session.created_at),
      likes: 0,
      comments: 0,
      liked: false,
      postType: 'session',
      gym: GYM_NAMES[session.gym_id] ?? `Gym ${session.gym_id}`,
      problems: session.total_problems,
      difficulty: gradeRange(grades),
    };

    if (session.media_url) {
      post.media = [{ type: 'image', uri: session.media_url }];
    }

    return post;
  });
}

function useGreeting(name: string) {
  const hour = new Date().getHours();
  const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `Good ${tod}, ${name}`;
}

// ─── Avatar helper ────────────────────────────────────────────────────────────

function Avatar({
  post,
  size,
  dark,
}: {
  post: Post;
  size: number;
  dark?: boolean;
}) {
  if (post.avatarUrl) {
    return (
      <Image
        source={{ uri: post.avatarUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.3,
          borderWidth: dark ? 2 : 0,
          borderColor: dark ? 'rgba(255,255,255,0.6)' : 'transparent',
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: dark ? 'rgba(255,255,255,0.25)' : post.avatarBg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: dark ? 2 : 0,
        borderColor: dark ? 'rgba(255,255,255,0.5)' : 'transparent',
      }}>
      <Text
        style={{
          fontSize: size * 0.32,
          fontFamily: 'DMSans_800ExtraBold',
          color: '#ffffff',
          letterSpacing: 0.3,
        }}>
        {post.initials}
      </Text>
    </View>
  );
}

// ─── Action buttons ───────────────────────────────────────────────────────────

function ActionRow({
  post,
  onLike,
  light,
}: {
  post: Post;
  onLike: (id: string) => void;
  light?: boolean;
}) {
  return (
    <View style={[actionStyles.row, light && actionStyles.rowLight]}>
      <TouchableOpacity
        style={[actionStyles.btn, post.liked && actionStyles.btnActive]}
        activeOpacity={0.7}
        onPress={() => onLike(post.id)}>
        <Text style={[actionStyles.icon, post.liked && actionStyles.iconActive]}>
          {post.liked ? '♥' : '♡'}
        </Text>
        <Text style={[actionStyles.count, post.liked && actionStyles.countActive]}>
          {post.likes}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={actionStyles.btn} activeOpacity={0.7}>
        <Text style={actionStyles.icon}>◎</Text>
        <Text style={actionStyles.count}>{post.comments}</Text>
      </TouchableOpacity>
    </View>
  );
}

const actionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  rowLight: {},
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: SURFACE,
  },
  btnActive: {
    backgroundColor: 'rgba(255, 80, 124, 0.12)',
  },
  icon: {
    fontSize: 15,
    color: TEXT_MUTED,
  },
  iconActive: {
    color: ACCENT,
  },
  count: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: TEXT_MUTED,
  },
  countActive: {
    color: ACCENT,
  },
});

// ─── Full-bleed card (session or photo post with media) ───────────────────────

function FullBleedCard({
  post,
  onLike,
}: {
  post: Post;
  onLike: (id: string) => void;
}) {
  const isSession = post.postType === 'session';
  const mediaItem = post.media![0];

  return (
    <View style={styles.fullBleedCard}>
      {/* Hero image */}
      <View style={styles.heroWrapper}>
        {mediaItem.type === 'image' ? (
          <Image
            source={{ uri: mediaItem.uri }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.heroImage, styles.videoPlaceholder]}>
            <Text style={styles.videoPlayIcon}>▶</Text>
          </View>
        )}

        {/* Top gradient + user overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.58)', 'rgba(0,0,0,0.0)']}
          style={styles.heroGradient}>
          <View style={styles.heroUserRow}>
            <Avatar post={post} size={40} dark />
            <View style={styles.heroUserMeta}>
              <Text style={styles.heroUserName}>{post.name}</Text>
              {isSession && post.gym ? (
                <Text style={styles.heroGym}>{post.gym}</Text>
              ) : null}
            </View>
            <Text style={styles.heroTimestamp}>{post.timestamp}</Text>
          </View>
        </LinearGradient>

        {/* Inset border overlay on the image */}
        <View style={styles.heroImageBorder} pointerEvents="none" />
      </View>

      {/* Stats + actions strip */}
      <View style={styles.strip}>
        {isSession && post.problems !== undefined && post.difficulty ? (
          <>
            <View style={styles.stripStatsRow}>
              <View style={styles.stripStat}>
                <Text style={styles.stripStatValue}>{post.problems}</Text>
                <Text style={styles.stripStatLabel}>PROBLEMS</Text>
              </View>
              <View style={styles.stripDivider} />
              <View style={styles.stripStat}>
                <Text style={styles.stripStatValue}>{post.difficulty}</Text>
                <Text style={styles.stripStatLabel}>DIFFICULTY</Text>
              </View>
            </View>
            <View style={styles.stripHairline} />
          </>
        ) : null}
        <View style={styles.stripActions}>
          <ActionRow post={post} onLike={onLike} />
        </View>
      </View>
    </View>
  );
}

// ─── Plain card (session without photo) ──────────────────────────────────────

function PlainCard({
  post,
  onLike,
}: {
  post: Post;
  onLike: (id: string) => void;
}) {
  return (
    <View style={styles.card}>
      {/* User row */}
      <View style={styles.userRow}>
        <Avatar post={post} size={46} />
        <View style={styles.userMeta}>
          <Text style={styles.userName}>{post.name}</Text>
          <Text style={styles.timestamp}>{post.timestamp}</Text>
        </View>
      </View>

      {/* Gym label */}
      {post.gym ? (
        <Text style={styles.gymLabel}>{post.gym}</Text>
      ) : null}

      {/* Stats */}
      {post.problems !== undefined && post.difficulty ? (
        <View style={styles.statsBlock}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{post.problems}</Text>
            <Text style={styles.statLabel}>PROBLEMS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{post.difficulty}</Text>
            <Text style={styles.statLabel}>DIFFICULTY</Text>
          </View>
        </View>
      ) : null}

      {/* Actions */}
      <View style={[styles.actionsRow, { paddingTop: 14, borderTopWidth: 1, borderTopColor: '#b0cdd8' }]}>
        <ActionRow post={post} onLike={onLike} />
      </View>
    </View>
  );
}

// ─── FeedCard dispatcher ──────────────────────────────────────────────────────

function FeedCard({ post, onLike }: { post: Post; onLike: (id: string) => void }) {
  if (post.media && post.media.length > 0) {
    return <FullBleedCard post={post} onLike={onLike} />;
  }
  return <PlainCard post={post} onLike={onLike} />;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const greeting = useGreeting('Alex');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);

      fetchSessionPosts().then((sessionPosts) => {
        if (!active) return;
        setPosts(sessionPosts);
        setLoading(false);
      });

      return () => {
        active = false;
      };
    }, [])
  );

  const handleLike = async (id: string) => {
    const updated = await togglePostLike(posts, id);
    setPosts(updated);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.subheading}>Your crew is crushing it.</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}>
          {posts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No sessions yet</Text>
              <Text style={styles.emptyText}>Log a climb to see it here.</Text>
            </View>
          ) : (
            posts.map((post) => (
              <FeedCard key={post.id} post={post} onLike={handleLike} />
            ))
          )}
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  greeting: {
    fontSize: 42,
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 1,
    lineHeight: 46,
  },
  subheading: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_SUB,
    marginTop: 6,
    letterSpacing: 0.1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    paddingTop: 60,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 28,
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 1,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_MUTED,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 16,
  },

  // ── Full-bleed card ─────────────────────────────────────────────────────────
  fullBleedCard: {
    backgroundColor: BG,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: DIVIDER,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  heroWrapper: {
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: 300,
  },
  videoPlaceholder: {
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayIcon: {
    fontSize: 44,
    color: '#ffffff',
    opacity: 0.9,
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 130,
    justifyContent: 'flex-start',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  heroImageBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: '#b0cdd8',
  },
  heroUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  heroUserMeta: {
    flex: 1,
    gap: 2,
  },
  heroUserName: {
    fontSize: 15,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.1,
  },
  heroGym: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.1,
  },
  heroTimestamp: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.1,
  },

  // ── Stats + actions strip ────────────────────────────────────────────────────
  strip: {
    flexDirection: 'column',
    backgroundColor: BG,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  stripStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
  },
  stripHairline: {
    height: 1,
    backgroundColor: '#b0cdd8',
    marginBottom: 4,
  },
  stripActions: {
    flexDirection: 'row',
  },
  stripStat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  stripStatValue: {
    fontSize: 20,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: -0.4,
  },
  stripStatLabel: {
    fontSize: 9,
    fontFamily: 'DMSans_700Bold',
    color: TEXT_MUTED,
    letterSpacing: 1.3,
  },
  stripDivider: {
    width: 1,
    height: 28,
    backgroundColor: DIVIDER,
    marginHorizontal: 4,
  },

  // ── Plain card (no photo) ────────────────────────────────────────────────────
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 2.5,
    borderColor: DIVIDER,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userMeta: {
    flex: 1,
    gap: 3,
  },
  userName: {
    fontSize: 16,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: -0.2,
  },
  timestamp: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_MUTED,
  },
  gymLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: PRIMARY,
    letterSpacing: 0.2,
  },
  statsBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: TEXT_MUTED,
    letterSpacing: 1.4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: DIVIDER,
    marginHorizontal: 8,
  },
  actionsRow: {
    flexDirection: 'row',
  },
});
