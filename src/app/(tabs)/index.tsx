/**
 * Feed screen — TikTok-style full-screen vertical swipeable feed.
 *
 * expo-av is loaded via a dynamic require() below instead of a static import.
 * See the "expo-av dynamic load" comment for the full explanation.
 */
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { type Post } from '../../lib/store';
import { supabase } from '../../lib/supabase';

// ─── expo-av dynamic load ─────────────────────────────────────────────────────
// expo-av requires a development build. In Expo Go the native ExponentAV module
// is absent, and a static top-level import crashes the whole app at launch —
// the error surfaces immediately, before any screen renders.
//
// Workaround: defer the load to runtime with require() inside try/catch. If the
// native module is present (dev build / EAS client), VideoPlayer is assigned the
// real Video component and autoplay works normally. If it throws (Expo Go),
// VideoPlayer stays null and video cards fall back to a static thumbnail image.
//
// TODO: once a dev build is in place, replace this block with:
//   import { Video } from 'expo-av';
// and rename VideoPlayer back to Video throughout this file.
let VideoPlayer: React.ComponentType<any> | null = null;
try {
  VideoPlayer = require('expo-av').Video;
} catch {
  // expo-av native module unavailable (Expo Go) — video cards show thumbnail
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const ACCENT     = '#ff507c';
const PRIMARY    = '#2E7A96';
const TEXT       = '#0d2b36';
const TEXT_MUTED = '#8bb5c4';
const DIVIDER    = '#c8dde8';
const SURFACE    = '#d8eaf0';
const BG         = '#ffffff';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const GYM_NAMES: Record<string, string> = {
  '1': 'Vital Climbing LES',
  '2': 'Vital Climbing Brooklyn',
  '3': 'Vital Climbing UES',
  '4': 'Vital Climbing UWS',
};

const GRADE_ORDER = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10'];

// Height of the dark stats strip at the bottom of each card
const STATS_BAR_H = 64;

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
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}

function topGradeFromClimbs(climbs: { grade: string; count: number }[]): string | undefined {
  return climbs
    .filter(c => c.count > 0)
    .sort((a, b) => GRADE_ORDER.indexOf(b.grade) - GRADE_ORDER.indexOf(a.grade))[0]?.grade;
}

// ─── Supabase fetch ───────────────────────────────────────────────────────────

async function fetchSessionPosts(currentUserId: string | null): Promise<Post[]> {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, user_id, gym_id, total_problems, media_url, created_at, climbs(grade,count)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map(s => s.id);
  const userIds    = [...new Set(sessions.map(s => s.user_id))];

  const [profilesRes, likesRes, commentsRes] = await Promise.all([
    supabase.from('profiles').select('id,full_name,username,avatar_url').in('id', userIds),
    supabase.from('likes').select('session_id,user_id').in('session_id', sessionIds),
    supabase.from('comments').select('session_id').in('session_id', sessionIds),
  ]);

  const profileMap = new Map((profilesRes.data ?? []).map(p => [p.id, p]));

  const likeCountMap: Record<string, number>  = {};
  const likedByMeMap: Record<string, boolean> = {};
  (likesRes.data ?? []).forEach(l => {
    likeCountMap[l.session_id] = (likeCountMap[l.session_id] ?? 0) + 1;
    if (currentUserId && l.user_id === currentUserId) likedByMeMap[l.session_id] = true;
  });

  const commentCountMap: Record<string, number> = {};
  (commentsRes.data ?? []).forEach(c => {
    commentCountMap[c.session_id] = (commentCountMap[c.session_id] ?? 0) + 1;
  });

  return sessions.map(session => {
    const profile = profileMap.get(session.user_id);
    const name    = profile?.full_name || profile?.username || 'Climber';
    const grades  = (session.climbs ?? []) as { grade: string; count: number }[];
    const active  = grades.filter(g => g.count > 0);

    const post: Post = {
      id:          session.id,
      userId:      session.user_id,
      username:    profile?.username ?? undefined,
      name,
      initials:    toInitials(name),
      avatarBg:    PRIMARY,
      avatarUrl:   profile?.avatar_url ?? undefined,
      timestamp:   timeAgo(session.created_at),
      likes:       likeCountMap[session.id] ?? 0,
      comments:    commentCountMap[session.id] ?? 0,
      liked:       likedByMeMap[session.id] ?? false,
      postType:    'session',
      gym:         GYM_NAMES[session.gym_id] ?? `Gym ${session.gym_id}`,
      gymId:       session.gym_id,
      problems:    session.total_problems,
      difficulty:  undefined,
      topGrade:    topGradeFromClimbs(grades),
      climbsData:  active,
    };

    if (session.media_url) {
      post.media = [{ type: 'image', uri: session.media_url }];
    }

    return post;
  });
}

// ─── Grade mini bars ──────────────────────────────────────────────────────────

function GradeBars({
  climbs,
  topGrade,
}: {
  climbs: { grade: string; count: number }[];
  topGrade?: string;
}) {
  if (climbs.length === 0) {
    return <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: 'DMSans_700Bold' }}>—</Text>;
  }
  const maxCount = Math.max(...climbs.map(c => c.count));
  const BAR_MAX = 22;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: BAR_MAX }}>
      {climbs.map(c => (
        <View
          key={c.grade}
          style={{
            width: 5,
            height: Math.max(4, (c.count / maxCount) * BAR_MAX),
            backgroundColor: c.grade === topGrade ? ACCENT : 'rgba(46,122,150,0.9)',
            borderRadius: 2,
          }}
        />
      ))}
    </View>
  );
}

// ─── Full-screen card ─────────────────────────────────────────────────────────

function FullScreenCard({
  post,
  height,
  isActive,
  onLike,
  onComment,
  onPressUser,
  onShare,
  onGym,
}: {
  post:        Post;
  height:      number;
  isActive:    boolean;
  onLike:      (id: string) => void;
  onComment:   (id: string) => void;
  onPressUser: (userId: string) => void;
  onShare:     (post: Post) => void;
  onGym:       (gymId: string) => void;
}) {
  const hasMedia  = !!(post.media && post.media.length > 0);
  const mediaItem = hasMedia ? post.media![0] : null;
  const isVideo   = mediaItem?.type === 'video';

  const displayName = post.username ? `@${post.username}` : post.name;

  return (
    <View style={{ width: SCREEN_WIDTH, height, backgroundColor: '#000' }}>

      {/* ── Background ──────────────────────────────────────────────────────── */}
      {hasMedia ? (
        isVideo ? (
          // VideoPlayer is null in Expo Go (expo-av unavailable) — show thumbnail
          VideoPlayer ? (
            <VideoPlayer
              source={{ uri: mediaItem!.uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              isLooping
              shouldPlay={isActive}
            />
          ) : (
            // Expo Go fallback: static thumbnail until a dev build is available
            <Image
              source={{ uri: mediaItem!.uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          )
        ) : (
          <Image
            source={{ uri: mediaItem!.uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        )
      ) : (
        // No media — teal-to-dark gradient background
        <LinearGradient
          colors={['#2E7A96', '#0d2b36']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      )}

      {/* ── Bottom vignette for readability ─────────────────────────────────── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={[StyleSheet.absoluteFill, { top: height * 0.42 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      {/* ── Top tab row: Following | FOR YOU | Nearby ───────────────────────── */}
      <View style={card.tabRow}>
        <TouchableOpacity style={card.tabItem} activeOpacity={0.7}>
          <Text style={card.tabInactive}>Following</Text>
        </TouchableOpacity>

        <View style={card.tabItem}>
          <Text style={card.tabActiveText}>For You</Text>
          <View style={card.tabIndicator} />
        </View>

        <TouchableOpacity style={card.tabItem} activeOpacity={0.7}>
          <Text style={card.tabInactive}>Nearby</Text>
        </TouchableOpacity>
      </View>

      {/* ── Right action rail ───────────────────────────────────────────────── */}
      <View style={[card.rail, { bottom: STATS_BAR_H + 20 }]}>

        {/* Avatar → profile */}
        <TouchableOpacity
          style={card.railItem}
          activeOpacity={0.8}
          onPress={() => post.userId && onPressUser(post.userId)}>
          <View style={card.avatarRing}>
            {post.avatarUrl ? (
              <Image source={{ uri: post.avatarUrl }} style={card.railAvatar} />
            ) : (
              <View style={[card.railAvatar, card.railAvatarFallback]}>
                <Text style={card.railAvatarText}>{post.initials}</Text>
              </View>
            )}
          </View>
          <Text style={card.railLabel}>follow</Text>
        </TouchableOpacity>

        {/* Like */}
        <TouchableOpacity
          style={card.railItem}
          activeOpacity={0.8}
          onPress={() => onLike(post.id)}>
          <Text style={[card.railIcon, post.liked && card.railIconLiked]}>
            {post.liked ? '♥' : '♡'}
          </Text>
          <Text style={card.railCount}>{post.likes}</Text>
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity
          style={card.railItem}
          activeOpacity={0.8}
          onPress={() => onComment(post.id)}>
          <Text style={card.railIcon}>◎</Text>
          <Text style={card.railCount}>{post.comments}</Text>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          style={card.railItem}
          activeOpacity={0.8}
          onPress={() => onShare(post)}>
          <Text style={card.railIcon}>↗</Text>
          <Text style={card.railLabel}>share</Text>
        </TouchableOpacity>

        {/* Gym */}
        <TouchableOpacity
          style={card.railItem}
          activeOpacity={0.8}
          onPress={() => post.gymId && onGym(post.gymId)}>
          <Text style={card.railIcon}>⬡</Text>
          <Text style={card.railLabel}>gym</Text>
        </TouchableOpacity>
      </View>

      {/* ── Bottom-left info (username + gym pill) ───────────────────────────── */}
      <View style={[card.bottomInfo, { bottom: STATS_BAR_H + 16 }]}>
        <Text style={card.username}>{displayName}</Text>
        {post.gym ? (
          <View style={card.gymPill}>
            <Text style={card.gymPillText}>{'📍  '}{post.gym}</Text>
          </View>
        ) : null}
      </View>

      {/* ── Stats bar ────────────────────────────────────────────────────────── */}
      <View style={[card.statsBar, { height: STATS_BAR_H }]}>
        <View style={card.statSection}>
          <Text style={card.statValue}>{post.problems ?? '—'}</Text>
          <Text style={card.statLabel}>PROBLEMS</Text>
        </View>

        <View style={card.statDivider} />

        <View style={card.statSection}>
          <Text style={card.statValue}>{post.topGrade ?? '—'}</Text>
          <Text style={card.statLabel}>TOP GRADE</Text>
        </View>

        <View style={card.statDivider} />

        <View style={[card.statSection, { flex: 1.5 }]}>
          <GradeBars climbs={post.climbsData ?? []} topGrade={post.topGrade} />
          <Text style={card.statLabel}>GRADES</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const router = useRouter();

  const [posts,         setPosts]         = useState<Post[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeIndex,   setActiveIndex]   = useState(0);
  const [cardHeight,    setCardHeight]    = useState(0);

  // Comment sheet
  const [commentSheetVisible,   setCommentSheetVisible]   = useState(false);
  const [commentSheetSessionId, setCommentSheetSessionId] = useState<string | null>(null);
  const [commentsList,          setCommentsList]          = useState<CommentItem[]>([]);
  const [commentsLoading,       setCommentsLoading]       = useState(false);
  const [commentInput,          setCommentInput]          = useState('');
  const [sendingComment,        setSendingComment]        = useState(false);
  const commentsScrollRef = useRef<ScrollView>(null);

  // FlatList viewability — refs are required; cannot be inline functions
  const onViewableItemsChangedRef = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index!);
      }
    }
  );
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 60 });

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

  // Navigate to profile — own → tab, other → /user/[id]
  const handlePressUser = useCallback((userId: string) => {
    if (userId === currentUserId) {
      router.navigate('/(tabs)/profile');
    } else {
      router.push(`/user/${userId}`);
    }
  }, [currentUserId, router]);

  // Native share sheet
  const handleShare = useCallback(async (post: Post) => {
    try {
      await Share.share({
        message: `Check out this climb at ${post.gym ?? 'the gym'} on Deadpoint! 🧗`,
      });
    } catch {
      // user dismissed
    }
  }, []);

  // Optimistic like toggle
  const handleLike = async (id: string) => {
    if (!currentUserId) return;
    const post = posts.find(p => p.id === id);
    if (!post) return;
    const wasLiked = post.liked;

    setPosts(prev =>
      prev.map(p =>
        p.id === id ? { ...p, liked: !wasLiked, likes: wasLiked ? p.likes - 1 : p.likes + 1 } : p
      )
    );

    if (wasLiked) {
      await supabase.from('likes').delete().eq('user_id', currentUserId).eq('session_id', id);
    } else {
      await supabase.from('likes').insert({ user_id: currentUserId, session_id: id });
    }
  };

  // Open comment sheet + fetch comments
  const openCommentSheet = async (sessionId: string) => {
    setCommentSheetSessionId(sessionId);
    setCommentSheetVisible(true);
    setCommentsLoading(true);
    setCommentsList([]);
    setCommentInput('');

    const { data: comments } = await supabase
      .from('comments')
      .select('id,user_id,content,created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (comments && comments.length > 0) {
      const commentUserIds = [...new Set(comments.map(c => c.user_id))];
      const { data: commentProfiles } = await supabase
        .from('profiles')
        .select('id,full_name,username,avatar_url')
        .in('id', commentUserIds);

      const profileMap = new Map((commentProfiles ?? []).map(p => [p.id, p]));

      setCommentsList(
        comments.map(c => {
          const p = profileMap.get(c.user_id);
          return {
            id:        c.id,
            userId:    c.user_id,
            username:  p?.username  ?? 'climber',
            fullName:  p?.full_name ?? 'Climber',
            avatarUrl: p?.avatar_url ?? null,
            content:   c.content,
            createdAt: c.created_at,
          };
        })
      );
    }

    setCommentsLoading(false);
  };

  // Post a new comment
  const handleSendComment = async () => {
    if (!commentInput.trim() || !commentSheetSessionId || !currentUserId || sendingComment) return;
    const content = commentInput.trim();
    setSendingComment(true);
    setCommentInput('');

    const { data: newComment, error } = await supabase
      .from('comments')
      .insert({ user_id: currentUserId, session_id: commentSheetSessionId, content })
      .select('id,user_id,content,created_at')
      .single();

    if (!error && newComment) {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('full_name,username,avatar_url')
        .eq('id', currentUserId)
        .single();

      setCommentsList(prev => [
        ...prev,
        {
          id:        newComment.id,
          userId:    newComment.user_id,
          username:  myProfile?.username  ?? 'climber',
          fullName:  myProfile?.full_name ?? 'Climber',
          avatarUrl: myProfile?.avatar_url ?? null,
          content:   newComment.content,
          createdAt: newComment.created_at,
        },
      ]);

      setPosts(prev =>
        prev.map(p =>
          p.id === commentSheetSessionId ? { ...p, comments: p.comments + 1 } : p
        )
      );

      setTimeout(() => commentsScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }

    setSendingComment(false);
  };

  return (
    <SafeAreaView style={screen.container} edges={['top']}>
      {/* Measure the exact content height (window minus status bar minus tab bar) */}
      <View
        style={{ flex: 1 }}
        onLayout={e => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && h !== cardHeight) setCardHeight(h);
        }}>

        {loading || cardHeight === 0 ? (
          <View style={screen.center}>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        ) : posts.length === 0 ? (
          <View style={screen.center}>
            <Text style={screen.emptyTitle}>No sessions yet</Text>
            <Text style={screen.emptyText}>Log a climb to see it here.</Text>
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={item => item.id}
            renderItem={({ item, index }) => (
              <FullScreenCard
                post={item}
                height={cardHeight}
                isActive={index === activeIndex}
                onLike={handleLike}
                onComment={openCommentSheet}
                onPressUser={handlePressUser}
                onShare={handleShare}
                onGym={gymId => router.push(`/gym/${gymId}`)}
              />
            )}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={cardHeight}
            decelerationRate="fast"
            onViewableItemsChanged={onViewableItemsChangedRef.current}
            viewabilityConfig={viewabilityConfigRef.current}
            getItemLayout={(_, index) => ({
              length: cardHeight,
              offset: cardHeight * index,
              index,
            })}
          />
        )}
      </View>

      {/* ── Comment bottom sheet — conditionally rendered so it fully unmounts ── */}
      {commentSheetVisible && (
        <Modal
          visible
          animationType="slide"
          transparent
          onRequestClose={() => setCommentSheetVisible(false)}>
          <View style={comment.modalContainer}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setCommentSheetVisible(false)}
            />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={comment.sheet}>
                <View style={comment.sheetHandle} />

                <View style={comment.sheetHeader}>
                  <Text style={comment.sheetTitle}>Comments</Text>
                  <TouchableOpacity
                    onPress={() => setCommentSheetVisible(false)}
                    hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
                    <Text style={comment.sheetClose}>×</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  ref={commentsScrollRef}
                  style={comment.commentList}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 8 }}>
                  {commentsLoading ? (
                    <ActivityIndicator color={PRIMARY} style={{ marginVertical: 36 }} />
                  ) : commentsList.length === 0 ? (
                    <View style={comment.emptyComments}>
                      <Text style={comment.emptyTitle}>No comments yet</Text>
                      <Text style={comment.emptySub}>Be the first to say something!</Text>
                    </View>
                  ) : (
                    commentsList.map(c => (
                      <View key={c.id} style={comment.row}>
                        {c.avatarUrl ? (
                          <Image source={{ uri: c.avatarUrl }} style={comment.avatarImg} />
                        ) : (
                          <View style={comment.avatarFallback}>
                            <Text style={comment.avatarText}>{toInitials(c.fullName)}</Text>
                          </View>
                        )}
                        <View style={comment.rowContent}>
                          <View style={comment.rowMeta}>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => {
                                setCommentSheetVisible(false);
                                if (c.userId === currentUserId) {
                                  router.navigate('/(tabs)/profile');
                                } else {
                                  router.push(`/user/${c.userId}`);
                                }
                              }}>
                              <Text style={comment.name}>{c.fullName}</Text>
                            </TouchableOpacity>
                            <Text style={comment.time}>{timeAgo(c.createdAt)}</Text>
                          </View>
                          <Text style={comment.text}>{c.content}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>

                <View style={comment.inputRow}>
                  <TextInput
                    style={comment.input}
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
                      comment.sendBtn,
                      (!commentInput.trim() || sendingComment) && comment.sendBtnDisabled,
                    ]}
                    onPress={handleSendComment}
                    disabled={!commentInput.trim() || sendingComment}
                    activeOpacity={0.7}>
                    {sendingComment ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={comment.sendBtnText}>Send</Text>
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

// ─── Card styles ──────────────────────────────────────────────────────────────

const card = StyleSheet.create({
  // Top tab row
  tabRow: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 10,
  },
  tabItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  tabActiveText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  tabIndicator: {
    alignSelf: 'stretch',
    height: 2.5,
    backgroundColor: ACCENT,
    borderRadius: 2,
    marginTop: 4,
  },
  tabInactive: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.1,
  },

  // Right action rail
  rail: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 22,
    zIndex: 10,
  },
  railItem: {
    alignItems: 'center',
    gap: 5,
  },
  avatarRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#ffffff',
    overflow: 'hidden',
  },
  railAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  railAvatarFallback: {
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railAvatarText: {
    fontSize: 15,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  railIcon: {
    fontSize: 28,
    color: '#ffffff',
    lineHeight: 32,
  },
  railIconLiked: {
    color: ACCENT,
  },
  railCount: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  railLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  // Bottom-left info
  bottomInfo: {
    position: 'absolute',
    left: 16,
    right: 80,   // clear the action rail
    gap: 9,
    zIndex: 10,
  },
  username: {
    fontSize: 16,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  gymPill: {
    alignSelf: 'flex-start',
    backgroundColor: PRIMARY,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  gymPillText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#ffffff',
    letterSpacing: 0.1,
  },

  // Stats bar
  statsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.50)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statSection: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 8,
    fontFamily: 'DMSans_700Bold',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.3,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 4,
  },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const screen = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 28,
    fontFamily: 'BebasNeue_400Regular',
    color: '#ffffff',
    letterSpacing: 1,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: 'rgba(255,255,255,0.6)',
  },
});

// ─── Comment sheet styles ─────────────────────────────────────────────────────

const comment = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
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
  commentList: {
    maxHeight: SCREEN_HEIGHT * 0.44,
  },
  emptyComments: {
    paddingVertical: 44,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 1,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_MUTED,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  avatarImg: {
    width: 38,
    height: 38,
    borderRadius: 11,
    flexShrink: 0,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 13,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: TEXT,
  },
  time: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_MUTED,
  },
  text: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: TEXT,
    lineHeight: 20,
  },
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
