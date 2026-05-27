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
  // Fetch sessions with their climbs (climbs FK is session_id → sessions.id)
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
  console.log('[fetchSessionPosts] Raw sessions:', sessions);

  if (error || !sessions || sessions.length === 0) return [];

  // sessions.user_id → auth.users.id (not directly profiles.id),
  // so batch-fetch profiles separately and join in JS.
  const userIds = [...new Set(sessions.map((s) => s.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url')
    .in('id', userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const posts = sessions.map((session) => {
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

  console.log('[fetchSessionPosts] Final posts array being set to state:', posts);
  return posts;
}

function useGreeting(name: string) {
  const hour = new Date().getHours();
  const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `Good ${tod}, ${name} 👋`;
}

function FeedCard({ post, onLike }: { post: Post; onLike: (id: string) => void }) {
  const isPhoto = post.postType === 'photo';

  return (
    <View style={styles.card}>
      {/* User row */}
      <View style={styles.userRow}>
        {post.avatarUrl ? (
          <Image source={{ uri: post.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: post.avatarBg }]}>
            <Text style={styles.avatarText}>{post.initials}</Text>
          </View>
        )}
        <View style={styles.userMeta}>
          <Text style={styles.userName}>{post.name}</Text>
          <Text style={styles.timestamp}>{post.timestamp}</Text>
        </View>
      </View>

      {/* Gym label — session posts only */}
      {!isPhoto && post.gym ? (
        <Text style={styles.gymLabel}>{post.gym}</Text>
      ) : null}

      {/* Media */}
      {post.media && post.media.length > 0 && (
        <View style={styles.mediaContainer}>
          {post.media[0].type === 'image' ? (
            <Image
              source={{ uri: post.media[0].uri }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Text style={styles.videoPlayIcon}>▶</Text>
            </View>
          )}
        </View>
      )}

      {/* Stats — session posts only */}
      {!isPhoto && post.problems !== undefined && post.difficulty ? (
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
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, post.liked && styles.actionBtnActive]}
          activeOpacity={0.7}
          onPress={() => onLike(post.id)}>
          <Text style={[styles.actionIcon, post.liked && styles.actionIconActive]}>
            {post.liked ? '♥' : '♡'}
          </Text>
          <Text style={[styles.actionCount, post.liked && styles.actionCountActive]}>
            {post.likes}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
          <Text style={styles.actionIcon}>◎</Text>
          <Text style={styles.actionCount}>{post.comments}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
        console.log('[Feed] sessionPosts count:', sessionPosts.length, '| ids:', sessionPosts.map(p => p.id));
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
            (() => {
              console.log('[Feed render] posts.length:', posts.length, '| ids:', posts.map(p => p.id));
              return posts.map((post) => {
                console.log('[Feed render] Rendering card for post.id:', post.id, '| postType:', post.postType);
                return <FeedCard key={post.id} post={post} onLike={handleLike} />;
              });
            })()
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

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
    paddingBottom: 24,
    gap: 16,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarText: {
    fontSize: 14,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: 0.4,
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
  mediaContainer: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: 220,
    borderRadius: 14,
  },
  videoPlaceholder: {
    width: '100%',
    height: 220,
    backgroundColor: SURFACE,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayIcon: {
    fontSize: 40,
    color: TEXT,
    opacity: 0.8,
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
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: SURFACE,
  },
  actionBtnActive: {
    backgroundColor: 'rgba(255, 80, 124, 0.12)',
  },
  actionIcon: {
    fontSize: 16,
    color: TEXT_MUTED,
  },
  actionIconActive: {
    color: ACCENT,
  },
  actionCount: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: TEXT_MUTED,
  },
  actionCountActive: {
    color: ACCENT,
  },
});
