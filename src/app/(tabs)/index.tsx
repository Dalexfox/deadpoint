import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { type Post } from '../../lib/store';
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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const GYM_NAMES: Record<string, string> = {
  '1': 'Vital Climbing LES',
  '2': 'Vital Climbing Brooklyn',
  '3': 'Vital Climbing UES',
  '4': 'Vital Climbing UWS',
};

const GRADE_ORDER = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];

// ─── Types ────────────────────────────────────────────────────────────────────

type CommentItem = {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  content: string;
  createdAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// Fetch sessions from Supabase, including real like/comment counts and liked status
async function fetchSessionPosts(currentUserId: string | null): Promise<Post[]> {
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

  console.log('[fetchSessionPosts] error:', error, '| count:', sessions?.length ?? 0);

  if (error || !sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const userIds = [...new Set(sessions.map((s) => s.user_id))];

  // Batch-fetch profiles, likes, and comment counts in parallel
  const [profilesResult, likesResult, commentsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', userIds),
    supabase
      .from('likes')
      .select('session_id, user_id')
      .in('session_id', sessionIds),
    supabase
      .from('comments')
      .select('session_id')
      .in('session_id', sessionIds),
  ]);

  const profileMap = new Map((profilesResult.data ?? []).map((p) => [p.id, p]));

  // Build like count + liked-by-me maps from the flat likes rows
  const likeCountMap: Record<string, number> = {};
  const likedByMeMap: Record<string, boolean> = {};
  (likesResult.data ?? []).forEach((l) => {
    likeCountMap[l.session_id] = (likeCountMap[l.session_id] ?? 0) + 1;
    if (currentUserId && l.user_id === currentUserId) {
      likedByMeMap[l.session_id] = true;
    }
  });

  // Build comment count map from flat comment rows
  const commentCountMap: Record<string, number> = {};
  (commentsResult.data ?? []).forEach((c) => {
    commentCountMap[c.session_id] = (commentCountMap[c.session_id] ?? 0) + 1;
  });

  return sessions.map((session) => {
    const profile = profileMap.get(session.user_id);
    const name = profile?.full_name || profile?.username || 'Climber';
    const grades = (session.climbs ?? []) as { grade: string; count: number }[];

    const post: Post = {
      id: session.id,
      userId: session.user_id,
      name,
      initials: toInitials(name),
      avatarBg: PRIMARY,
      avatarUrl: profile?.avatar_url ?? undefined,
      timestamp: timeAgo(session.created_at),
      likes: likeCountMap[session.id] ?? 0,
      comments: commentCountMap[session.id] ?? 0,
      liked: likedByMeMap[session.id] ?? false,
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
  onComment,
  light,
}: {
  post: Post;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  light?: boolean;
}) {
  return (
    <View style={[actionStyles.row, light && actionStyles.rowLight]}>
      {/* Like button — pink when liked */}
      <TouchableOpacity
        style={[actionStyles.btn, post.liked && actionStyles.btnLiked]}
        activeOpacity={0.7}
        onPress={() => onLike(post.id)}>
        <Text style={[actionStyles.icon, post.liked && actionStyles.iconLiked]}>
          {post.liked ? '♥' : '♡'}
        </Text>
        <Text style={[actionStyles.count, post.liked && actionStyles.countLiked]}>
          {post.likes}
        </Text>
      </TouchableOpacity>

      {/* Comment button — opens sheet */}
      <TouchableOpacity
        style={actionStyles.btn}
        activeOpacity={0.7}
        onPress={() => onComment(post.id)}>
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
  btnLiked: {
    backgroundColor: 'rgba(255, 80, 124, 0.12)',
  },
  icon: {
    fontSize: 15,
    color: TEXT_MUTED,
  },
  iconLiked: {
    color: ACCENT,
  },
  count: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: TEXT_MUTED,
  },
  countLiked: {
    color: ACCENT,
  },
});

// ─── Full-bleed card (session with photo) ────────────────────────────────────

function FullBleedCard({
  post,
  onLike,
  onComment,
  onPressUser,
}: {
  post: Post;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onPressUser: (userId: string) => void;
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
            {/* Tappable: avatar + name → user profile */}
            <TouchableOpacity
              style={styles.heroUserTouchable}
              activeOpacity={0.8}
              onPress={() => post.userId && onPressUser(post.userId)}>
              <Avatar post={post} size={40} dark />
              <View style={styles.heroUserMeta}>
                <Text style={styles.heroUserName}>{post.name}</Text>
                {isSession && post.gym ? (
                  <Text style={styles.heroGym}>{post.gym}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
            <Text style={styles.heroTimestamp}>{post.timestamp}</Text>
          </View>
        </LinearGradient>

        {/* Inset border overlay */}
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
          <ActionRow post={post} onLike={onLike} onComment={onComment} />
        </View>
      </View>
    </View>
  );
}

// ─── Plain card (session without photo) ──────────────────────────────────────

function PlainCard({
  post,
  onLike,
  onComment,
  onPressUser,
}: {
  post: Post;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onPressUser: (userId: string) => void;
}) {
  return (
    <View style={styles.card}>
      {/* User row — tappable to visit profile */}
      <TouchableOpacity
        style={styles.userRow}
        activeOpacity={0.8}
        onPress={() => post.userId && onPressUser(post.userId)}>
        <Avatar post={post} size={46} />
        <View style={styles.userMeta}>
          <Text style={styles.userName}>{post.name}</Text>
          <Text style={styles.timestamp}>{post.timestamp}</Text>
        </View>
      </TouchableOpacity>

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
        <ActionRow post={post} onLike={onLike} onComment={onComment} />
      </View>
    </View>
  );
}

// ─── FeedCard dispatcher ──────────────────────────────────────────────────────

function FeedCard({
  post,
  onLike,
  onComment,
  onPressUser,
}: {
  post: Post;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onPressUser: (userId: string) => void;
}) {
  if (post.media && post.media.length > 0) {
    return <FullBleedCard post={post} onLike={onLike} onComment={onComment} onPressUser={onPressUser} />;
  }
  return <PlainCard post={post} onLike={onLike} onComment={onComment} onPressUser={onPressUser} />;
}

// ─── Search result components ─────────────────────────────────────────────────

function GymResultRow({ gymName, onPress }: { gymName: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={searchStyles.gymRow} activeOpacity={0.75} onPress={onPress}>
      <View style={searchStyles.gymRowLeft}>
        <Text style={searchStyles.gymRowTag}>GYM</Text>
        <Text style={searchStyles.gymRowName}>{gymName}</Text>
      </View>
      <Text style={searchStyles.gymRowChevron}>›</Text>
    </TouchableOpacity>
  );
}

function MiniSessionCard({ post }: { post: Post }) {
  const mediaItem = post.media![0];
  return (
    <View style={searchStyles.miniCard}>
      <Image
        source={{ uri: mediaItem.uri }}
        style={searchStyles.miniThumb}
        resizeMode="cover"
      />
      <View style={searchStyles.miniInfo}>
        <Text style={searchStyles.miniGym} numberOfLines={1}>{post.gym}</Text>
        <Text style={searchStyles.miniMeta}>
          {post.difficulty}
          {post.problems !== undefined ? ` · ${post.problems} problems` : ''}
        </Text>
        <Text style={searchStyles.miniName} numberOfLines={1}>{post.name}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const greeting = useGreeting('Alex');
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Comment sheet state
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [commentSheetSessionId, setCommentSheetSessionId] = useState<string | null>(null);
  const [commentsList, setCommentsList] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const commentsScrollRef = useRef<ScrollView>(null);

  // Load feed on every focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);

      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id ?? null;
        if (!active) return;
        setCurrentUserId(userId);

        const sessionPosts = await fetchSessionPosts(userId);
        if (!active) return;
        setPosts(sessionPosts);
        setLoading(false);
      })();

      return () => { active = false; };
    }, [])
  );

  // Navigate to a user's profile — own profile goes to the tab, others to /user/[id]
  const handlePressUser = useCallback((userId: string) => {
    if (userId === currentUserId) {
      router.navigate('/(tabs)/profile');
    } else {
      router.push(`/user/${userId}`);
    }
  }, [currentUserId, router]);

  // Optimistic like toggle — update UI immediately, sync Supabase in background
  const handleLike = async (id: string) => {
    if (!currentUserId) return;

    const post = posts.find((p) => p.id === id);
    if (!post) return;

    const wasLiked = post.liked;

    // Update state immediately (optimistic)
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, liked: !wasLiked, likes: wasLiked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );

    // Sync with Supabase
    if (wasLiked) {
      await supabase
        .from('likes')
        .delete()
        .eq('user_id', currentUserId)
        .eq('session_id', id);
    } else {
      await supabase
        .from('likes')
        .insert({ user_id: currentUserId, session_id: id });
    }
  };

  // Open comment sheet + fetch comments for the selected session
  const openCommentSheet = async (sessionId: string) => {
    setCommentSheetSessionId(sessionId);
    setCommentSheetVisible(true);
    setCommentsLoading(true);
    setCommentsList([]);
    setCommentInput('');

    const { data: comments } = await supabase
      .from('comments')
      .select('id, user_id, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (comments && comments.length > 0) {
      // Batch-fetch commenter profiles
      const commentUserIds = [...new Set(comments.map((c) => c.user_id))];
      const { data: commentProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', commentUserIds);

      const commentProfileMap = new Map((commentProfiles ?? []).map((p) => [p.id, p]));

      const items: CommentItem[] = comments.map((c) => {
        const profile = commentProfileMap.get(c.user_id);
        return {
          id: c.id,
          userId: c.user_id,
          username: profile?.username ?? 'climber',
          fullName: profile?.full_name ?? 'Climber',
          avatarUrl: profile?.avatar_url ?? null,
          content: c.content,
          createdAt: c.created_at,
        };
      });
      setCommentsList(items);
    }

    setCommentsLoading(false);
  };

  // Post a new comment, update list + count in real time
  const handleSendComment = async () => {
    if (!commentInput.trim() || !commentSheetSessionId || !currentUserId || sendingComment) return;

    const content = commentInput.trim();
    setSendingComment(true);
    setCommentInput('');

    const { data: newComment, error } = await supabase
      .from('comments')
      .insert({ user_id: currentUserId, session_id: commentSheetSessionId, content })
      .select('id, user_id, content, created_at')
      .single();

    if (!error && newComment) {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', currentUserId)
        .single();

      const item: CommentItem = {
        id: newComment.id,
        userId: newComment.user_id,
        username: myProfile?.username ?? 'climber',
        fullName: myProfile?.full_name ?? 'Climber',
        avatarUrl: myProfile?.avatar_url ?? null,
        content: newComment.content,
        createdAt: newComment.created_at,
      };

      setCommentsList((prev) => [...prev, item]);

      // Bump comment count on the feed card immediately
      setPosts((prev) =>
        prev.map((p) =>
          p.id === commentSheetSessionId ? { ...p, comments: p.comments + 1 } : p
        )
      );

      // Scroll to new comment
      setTimeout(() => commentsScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }

    setSendingComment(false);
  };

  // ─── Derived search state ──────────────────────────────────────────────────
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;

  const gymResults = isSearching
    ? Object.entries(GYM_NAMES).filter(([, name]) =>
        name.toLowerCase().includes(trimmedQuery)
      )
    : [];

  const sessionMediaResults = isSearching
    ? posts.filter(
        (p) => p.media && p.media.length > 0 && p.gym?.toLowerCase().includes(trimmedQuery)
      )
    : [];

  const hasResults = gymResults.length > 0 || sessionMediaResults.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.subheading}>Your crew is crushing it.</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search gyms and sessions..."
          placeholderTextColor={TEXT_MUTED}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.searchClear}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : isSearching ? (
        /* ── Search results ─────────────────────────────────────────────────── */
        <ScrollView
          contentContainerStyle={styles.searchResultsContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {!hasResults ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptyText}>Try a different gym name</Text>
            </View>
          ) : (
            <>
              {gymResults.length > 0 && (
                <View style={searchStyles.section}>
                  <Text style={searchStyles.sectionLabel}>GYMS</Text>
                  <View style={searchStyles.sectionCard}>
                    {gymResults.map(([gymId, gymName], idx) => (
                      <View key={gymId}>
                        {idx > 0 && <View style={searchStyles.rowDivider} />}
                        <GymResultRow
                          gymName={gymName}
                          onPress={() => router.push(`/gym/${gymId}`)}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {sessionMediaResults.length > 0 && (
                <View style={searchStyles.section}>
                  <Text style={searchStyles.sectionLabel}>SESSIONS WITH MEDIA</Text>
                  <View style={searchStyles.miniGrid}>
                    {sessionMediaResults.map((post) => (
                      <MiniSessionCard key={post.id} post={post} />
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        /* ── Normal feed ────────────────────────────────────────────────────── */
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
              <FeedCard
                key={post.id}
                post={post}
                onLike={handleLike}
                onComment={openCommentSheet}
                onPressUser={handlePressUser}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Comment bottom sheet — conditionally rendered so it fully unmounts on close */}
      {commentSheetVisible && (
        <Modal
          visible
          animationType="slide"
          transparent
          onRequestClose={() => setCommentSheetVisible(false)}>
          <View style={commentStyles.modalContainer}>
            {/* Flex:1 TouchableOpacity fills space above the sheet — tap to dismiss */}
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setCommentSheetVisible(false)}
            />

            {/* Sheet anchored to bottom */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={commentStyles.sheet}>
                {/* Drag handle */}
                <View style={commentStyles.sheetHandle} />

                {/* Header */}
                <View style={commentStyles.sheetHeader}>
                  <Text style={commentStyles.sheetTitle}>Comments</Text>
                  <TouchableOpacity
                    onPress={() => setCommentSheetVisible(false)}
                    hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
                    <Text style={commentStyles.sheetClose}>×</Text>
                  </TouchableOpacity>
                </View>

                {/* Comment list */}
                <ScrollView
                  ref={commentsScrollRef}
                  style={commentStyles.commentList}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 8 }}>
                  {commentsLoading ? (
                    <ActivityIndicator
                      color={PRIMARY}
                      style={{ marginTop: 36, marginBottom: 36 }}
                    />
                  ) : commentsList.length === 0 ? (
                    <View style={commentStyles.emptyComments}>
                      <Text style={commentStyles.emptyCommentsTitle}>No comments yet</Text>
                      <Text style={commentStyles.emptyCommentsSub}>
                        Be the first to say something!
                      </Text>
                    </View>
                  ) : (
                    commentsList.map((comment) => (
                      <View key={comment.id} style={commentStyles.commentRow}>
                        {/* Avatar — real photo if available, initials fallback */}
                        {comment.avatarUrl ? (
                          <Image
                            source={{ uri: comment.avatarUrl }}
                            style={commentStyles.commentAvatarImg}
                          />
                        ) : (
                          <View style={commentStyles.commentAvatar}>
                            <Text style={commentStyles.commentAvatarText}>
                              {toInitials(comment.fullName)}
                            </Text>
                          </View>
                        )}
                        {/* Content */}
                        <View style={commentStyles.commentContent}>
                          <View style={commentStyles.commentMeta}>
                            {/* Tap name to visit profile */}
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => {
                                setCommentSheetVisible(false);
                                if (comment.userId === currentUserId) {
                                  router.navigate('/(tabs)/profile');
                                } else {
                                  router.push(`/user/${comment.userId}`);
                                }
                              }}>
                              <Text style={commentStyles.commentName}>{comment.fullName}</Text>
                            </TouchableOpacity>
                            <Text style={commentStyles.commentTime}>
                              {timeAgo(comment.createdAt)}
                            </Text>
                          </View>
                          <Text style={commentStyles.commentText}>{comment.content}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>

                {/* Input row */}
                <View style={commentStyles.inputRow}>
                  <TextInput
                    style={commentStyles.input}
                    placeholder="Add a comment..."
                    placeholderTextColor={TEXT_MUTED}
                    value={commentInput}
                    onChangeText={setCommentInput}
                    returnKeyType="send"
                    onSubmitEditing={handleSendComment}
                    blurOnSubmit={false}
                  />
                  <TouchableOpacity
                    style={[
                      commentStyles.sendBtn,
                      (!commentInput.trim() || sendingComment) && commentStyles.sendBtnDisabled,
                    ]}
                    onPress={handleSendComment}
                    disabled={!commentInput.trim() || sendingComment}
                    activeOpacity={0.7}>
                    {sendingComment ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={commentStyles.sendBtnText}>Send</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
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

  // ── Search bar ───────────────────────────────────────────────────────────────
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: SURFACE,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  searchIcon: {
    fontSize: 18,
    color: TEXT_MUTED,
    lineHeight: 22,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: TEXT,
    padding: 0,
  },
  searchClear: {
    fontSize: 22,
    color: TEXT_MUTED,
    lineHeight: 24,
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
  searchResultsContainer: {
    paddingBottom: 40,
  },

  // ── Full-bleed card ──────────────────────────────────────────────────────────
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
  },
  heroUserTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
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

// ─── Search result styles ─────────────────────────────────────────────────────

const searchStyles = StyleSheet.create({
  section: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT_MUTED,
    letterSpacing: 1.4,
    marginBottom: 10,
    marginLeft: 4,
  },
  // Gym results grouped in a card
  sectionCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DIVIDER,
    overflow: 'hidden',
  },
  gymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  gymRowLeft: {
    gap: 2,
  },
  gymRowTag: {
    fontSize: 10,
    fontFamily: 'DMSans_800ExtraBold',
    color: PRIMARY,
    letterSpacing: 1.4,
  },
  gymRowName: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: TEXT,
    letterSpacing: -0.1,
  },
  gymRowChevron: {
    fontSize: 22,
    color: TEXT_MUTED,
    lineHeight: 26,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DIVIDER,
    marginHorizontal: 18,
  },
  // Mini session cards (sessions with media)
  miniGrid: {
    gap: 10,
  },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: DIVIDER,
    overflow: 'hidden',
  },
  miniThumb: {
    width: 80,
    height: 80,
  },
  miniInfo: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
  },
  miniGym: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: TEXT,
    letterSpacing: -0.1,
  },
  miniMeta: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_SUB,
  },
  miniName: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: TEXT_MUTED,
  },
});

// ─── Comment sheet styles ─────────────────────────────────────────────────────

const commentStyles = StyleSheet.create({
  // Outer Modal container — dark semi-transparent backdrop
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  // The sheet panel itself
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    maxHeight: SCREEN_HEIGHT * 0.78,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: DIVIDER,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 22,
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 1,
  },
  sheetClose: {
    fontSize: 30,
    color: TEXT_MUTED,
    lineHeight: 34,
  },
  // Scrollable comment list
  commentList: {
    maxHeight: SCREEN_HEIGHT * 0.44,
  },
  // Empty state
  emptyComments: {
    paddingVertical: 44,
    alignItems: 'center',
    gap: 8,
  },
  emptyCommentsTitle: {
    fontSize: 20,
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 1,
  },
  emptyCommentsSub: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_MUTED,
  },
  // Individual comment row
  commentRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  commentAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 11,
    flexShrink: 0,
  },
  commentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  commentAvatarText: {
    fontSize: 13,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  commentContent: {
    flex: 1,
    gap: 4,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentName: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: TEXT,
  },
  commentTime: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_MUTED,
  },
  commentText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: TEXT,
    lineHeight: 20,
  },
  // Input + send
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
  },
  input: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: TEXT,
  },
  sendBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  sendBtnDisabled: {
    backgroundColor: TEXT_MUTED,
    shadowOpacity: 0,
    opacity: 0.55,
  },
  sendBtnText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#ffffff',
  },
});
