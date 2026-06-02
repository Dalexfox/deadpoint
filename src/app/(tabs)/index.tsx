/**
 * Feed screen — TikTok-style full-screen vertical swipeable feed.
 *
 * expo-av is loaded via a dynamic require() below instead of a static import.
 * See the "expo-av dynamic load" comment for the full explanation.
 */
import { useCallback, useRef, useState } from 'react';
import {
  Animated,
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
import { fetchGyms, gymName as resolveGymName } from '../../lib/gyms';

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
const ACCENT     = '#e8383c';
const SAND       = '#c8a84a';
const SAND_LT    = '#e8c87a';
const INK        = '#1a1408';
const INK2       = '#3d3320';
const INK3       = '#8a7a50';
const DIVIDER    = 'rgba(26,20,8,0.08)';
const SURFACE    = '#ece8df';
const BG         = '#ffffff';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');



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

// ─── Supabase fetch ───────────────────────────────────────────────────────────

async function fetchSessionPosts(
  currentUserId: string | null,
): Promise<{ posts: Post[]; followingSet: Set<string> }> {
  const gyms = await fetchGyms();
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, user_id, gym_id, media_url, created_at, climbs(grade)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !sessions || sessions.length === 0) return { posts: [], followingSet: new Set() };

  const sessionIds = sessions.map(s => s.id);
  const userIds    = [...new Set(sessions.map(s => s.user_id))];

  const [profilesRes, likesRes, commentsRes, followsRes] = await Promise.all([
    supabase.from('profiles').select('id,full_name,username,avatar_url').in('id', userIds),
    supabase.from('likes').select('session_id,user_id').in('session_id', sessionIds),
    supabase.from('comments').select('session_id').in('session_id', sessionIds),
    currentUserId
      ? supabase.from('follows').select('following_id').eq('follower_id', currentUserId)
      : Promise.resolve({ data: [] }),
  ]);

  const followingSet = new Set<string>(
    (followsRes.data ?? []).map((f: { following_id: string }) => f.following_id),
  );

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

  const posts = sessions.map(session => {
    const profile = profileMap.get(session.user_id);
    const name    = profile?.full_name || profile?.username || 'Climber';
    const post: Post = {
      id:         session.id,
      userId:     session.user_id,
      username:   profile?.username ?? undefined,
      name,
      initials:   toInitials(name),
      avatarBg:   INK,
      avatarUrl:  profile?.avatar_url ?? undefined,
      timestamp:  timeAgo(session.created_at),
      likes:      likeCountMap[session.id] ?? 0,
      comments:   commentCountMap[session.id] ?? 0,
      liked:      likedByMeMap[session.id] ?? false,
      postType:   'session',
      gym:        resolveGymName(gyms, session.gym_id),
      gymId:      session.gym_id,
      topGrade:   (session.climbs as { grade: string }[])?.[0]?.grade,
    };

    if (session.media_url) {
      post.media = [{ type: 'image', uri: session.media_url }];
    }

    return post;
  });

  return { posts, followingSet };
}

// ─── Full-screen card ─────────────────────────────────────────────────────────

function FullScreenCard({
  post,
  height,
  isActive,
  isOwnPost,
  isFollowing,
  onLike,
  onComment,
  onFollowToggle,
  onPressUser,
  onShare,
  onGym,
}: {
  post:            Post;
  height:          number;
  isActive:        boolean;
  isOwnPost:       boolean;
  isFollowing:     boolean;
  onLike:          (id: string) => void;
  onComment:       (id: string) => void;
  onFollowToggle:  (userId: string) => void;
  onPressUser:     (userId: string) => void;
  onShare:         (post: Post) => void;
  onGym:           (gymId: string) => void;
}) {
  const hasMedia  = !!(post.media && post.media.length > 0);
  const mediaItem = hasMedia ? post.media![0] : null;
  const isVideo   = mediaItem?.type === 'video';

  const displayName = post.username ? `@${post.username}` : post.name;

  // Animated follow-confirmation overlay
  const followAnim = useRef(new Animated.Value(0)).current;

  function triggerFollowAnim() {
    followAnim.setValue(1);
    Animated.timing(followAnim, {
      toValue: 0,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }

  function handleAvatarPress() {
    if (!post.userId) return;
    if (isOwnPost || isFollowing) {
      onPressUser(post.userId);
    } else {
      onFollowToggle(post.userId);
      triggerFollowAnim();
    }
  }

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
        // No media — dark gradient background
        <LinearGradient
          colors={['#2a2010', '#1a1408']}
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

        {/* Avatar → follow/unfollow (or own profile) */}
        <TouchableOpacity
          style={card.railItem}
          activeOpacity={0.8}
          onPress={handleAvatarPress}>
          <View style={card.avatarRing}>
            {post.avatarUrl ? (
              <Image source={{ uri: post.avatarUrl }} style={card.railAvatar} />
            ) : (
              <View style={[card.railAvatar, card.railAvatarFallback]}>
                <Text style={card.railAvatarText}>{post.initials}</Text>
              </View>
            )}
            {/* Follow-confirmation emoji overlay */}
            <Animated.View
              pointerEvents="none"
              style={[card.followOverlay, { opacity: followAnim }]}>
              <Text style={card.followOverlayEmoji}>😊</Text>
            </Animated.View>
          </View>
          {!isOwnPost && !isFollowing && (
            <Text style={card.railLabel}>follow</Text>
          )}
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

      {/* ── Bottom-left info (username) ──────────────────────────────────────── */}
      <TouchableOpacity
        style={[card.bottomInfo, { bottom: STATS_BAR_H + 16 }]}
        activeOpacity={0.75}
        onPress={() => post.userId && onPressUser(post.userId)}>
        <Text style={card.username}>{displayName}</Text>
      </TouchableOpacity>

      {/* ── Stats bar ────────────────────────────────────────────────────────── */}
      <View style={[card.statsBar, { height: STATS_BAR_H }]}>
        <View style={card.statGradeSection}>
          <Text style={card.statGradeValue}>{post.topGrade ?? '—'}</Text>
          <Text style={card.statGradeLabel}>GRADE</Text>
        </View>

        <View style={card.statDivider} />

        <View style={card.statGymSection}>
          <Text style={card.statGymText} numberOfLines={1}>
            {'📍  '}{post.gym ?? '—'}
          </Text>
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
  const [followingSet,  setFollowingSet]  = useState<Set<string>>(new Set());

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

        const { posts: sessionPosts, followingSet: fs } = await fetchSessionPosts(userId);
        if (!active) return;
        setPosts(sessionPosts);
        setFollowingSet(fs);
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

  // Optimistic follow/unfollow toggle
  const handleFollowToggle = useCallback(async (userId: string) => {
    if (!currentUserId) return;
    const wasFollowing = followingSet.has(userId);

    setFollowingSet(prev => {
      const next = new Set(prev);
      if (wasFollowing) next.delete(userId); else next.add(userId);
      return next;
    });

    if (wasFollowing) {
      await supabase.from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', userId);
    } else {
      await supabase.from('follows')
        .insert({ follower_id: currentUserId, following_id: userId });
    }
  }, [currentUserId, followingSet]);

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
                isOwnPost={item.userId === currentUserId}
                isFollowing={!!item.userId && followingSet.has(item.userId)}
                onLike={handleLike}
                onComment={openCommentSheet}
                onFollowToggle={handleFollowToggle}
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
                    <ActivityIndicator color={SAND} style={{ marginVertical: 36 }} />
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
                    placeholderTextColor={INK3}
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
    top: 32,
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
    fontSize: 17,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  tabIndicator: {
    alignSelf: 'stretch',
    height: 2.5,
    backgroundColor: SAND_LT,
    borderRadius: 2,
    marginTop: 4,
  },
  tabInactive: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
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
    backgroundColor: '#2a2010',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railAvatarText: {
    fontSize: 15,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND_LT,
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
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  railLabel: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  railLabelFollowing: {
    color: SAND_LT,
  },
  followOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 25,
  },
  followOverlayEmoji: {
    fontSize: 22,
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
    fontSize: 18,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  gymPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(200,168,74,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200,168,74,0.28)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  gymPillText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: SAND_LT,
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
  // Left section — grade in SAND_LT
  statGradeSection: {
    alignItems: 'center',
    gap: 3,
    paddingRight: 4,
  },
  statGradeValue: {
    fontSize: 28,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND_LT,
    letterSpacing: -0.5,
  },
  statGradeLabel: {
    fontSize: 8,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.4,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 16,
  },
  // Right section — gym name
  statGymSection: {
    flex: 1,
    justifyContent: 'center',
  },
  statGymText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#ffffff',
    letterSpacing: 0.1,
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
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -1,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_600SemiBold',
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
    backgroundColor: 'rgba(26,20,8,0.15)',
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
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.5,
  },
  sheetClose: {
    fontSize: 30,
    color: INK3,
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
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.5,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26,20,8,0.08)',
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
    backgroundColor: '#2a2010',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 13,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND_LT,
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
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK,
  },
  time: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
  },
  text: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26,20,8,0.08)',
  },
  input: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK,
  },
  sendBtn: {
    backgroundColor: SAND,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  sendBtnDisabled: {
    backgroundColor: INK3,
    opacity: 0.55,
  },
  sendBtnText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#ffffff',
  },
});
