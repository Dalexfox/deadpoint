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
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { type Post } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { fetchGyms, gymName as resolveGymName, type Gym } from '../../lib/gyms';
import { groupPosts, isGroupedPost, type GroupedPost } from '../../lib/groupPosts';

// ─── Session-only dismissal flags ───────────────────────────────────────────────
// Module-level (not component state) so a dismissal survives tab switches and feed
// refreshes but resets on next app launch — exactly the spec'd "app session only"
// lifetime. The picker/suggestion cards reappear next launch until resolved.
let gymPickerDismissedThisSession = false;
let suggestionsDismissedThisSession = false;

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

type SuggestedClimber = {
  id: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
};

// The feed is a single vertical-snap list. Posts and the first-run cards are all
// full-height items in the same list so snap behaviour is never broken.
type FeedItem =
  | { key: string; kind: 'post'; post: Post }
  | { key: string; kind: 'group'; group: GroupedPost }
  | { key: 'gymPicker'; kind: 'gymPicker' }
  | { key: 'gymConfirm'; kind: 'gymConfirm'; gymId: string; gymName: string }
  | { key: 'suggestions'; kind: 'suggestions'; gymId: string }
  | { key: 'empty'; kind: 'empty' };

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
  // Visibility filter lives in the QUERY (never the render layer): public posts,
  // plus the current user's own quiet posts. RLS enforces the same rule server-side;
  // this keeps it explicit and correct even if RLS ever changes.
  let query = supabase
    .from('sessions')
    .select('id, user_id, gym_id, media_url, notes, created_at, visibility, feed_rank, solo, climbs(grade, problem_id)')
    .order('created_at', { ascending: false })
    .limit(50);
  query = currentUserId
    ? query.or(`visibility.eq.public,user_id.eq.${currentUserId}`)
    : query.eq('visibility', 'public');
  const { data: sessions, error } = await query;

  if (error || !sessions || sessions.length === 0) return { posts: [], followingSet: new Set() };

  const sessionIds = sessions.map(s => s.id);
  const userIds    = [...new Set(sessions.map(s => s.user_id))];

  const problemIds = [
    ...new Set(
      sessions.flatMap(s => (s.climbs as { grade: string; problem_id: string | null }[])
        .map(c => c.problem_id).filter(Boolean) as string[]
    )
  )];

  const [profilesRes, likesRes, commentsRes, followsRes, problemsRes] = await Promise.all([
    supabase.from('profiles').select('id,full_name,username,avatar_url').in('id', userIds),
    supabase.from('likes').select('session_id,user_id').in('session_id', sessionIds),
    supabase.from('comments').select('session_id').in('session_id', sessionIds),
    currentUserId
      ? supabase.from('follows').select('following_id').eq('follower_id', currentUserId)
      : Promise.resolve({ data: [] }),
    problemIds.length > 0
      ? supabase.from('problems').select('id,custom_name').in('id', problemIds)
      : Promise.resolve({ data: [] }),
  ]);

  const followingSet = new Set<string>(
    (followsRes.data ?? []).map((f: { following_id: string }) => f.following_id),
  );

  const profileMap = new Map((profilesRes.data ?? []).map(p => [p.id, p]));
  const problemMap = new Map((problemsRes.data ?? []).map((p: { id: string; custom_name: string | null }) => [p.id, p]));

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

  const allPosts = sessions.map(session => {
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
      createdAt:  session.created_at,
      visibility: ((session as any).visibility ?? 'public') as 'public' | 'quiet',
      feedRank:   (session as any).feed_rank ?? null,
      solo:       (session as any).solo ?? false,
      topGrade:   (session.climbs as { grade: string; problem_id: string | null }[])?.[0]?.grade,
      problemId:  (session.climbs as { grade: string; problem_id: string | null }[])?.[0]?.problem_id ?? undefined,
      climbNotes: (session as any).notes ?? undefined,
      climbNickname: (() => {
        const pid = (session.climbs as { grade: string; problem_id: string | null }[])?.[0]?.problem_id;
        if (!pid) return undefined;
        const prob = problemMap.get(pid);
        return prob?.custom_name ?? undefined;
      })(),
    };

    if (session.media_url) {
      // sessions has no media_type column — sniff the extension to tell videos
      // from photos (matches the logic in session/[id].tsx).
      const isVideo = /\.(mp4|mov|m4v|avi)$/i.test(session.media_url);
      post.media = [{ type: isVideo ? 'video' : 'image', uri: session.media_url }];
    }

    return post;
  });

  // Followed users' posts first (already sorted by created_at desc from the query),
  // then everyone else sorted by like count descending.
  const followedPosts = allPosts.filter(p => p.userId && followingSet.has(p.userId));
  const otherPosts    = allPosts
    .filter(p => !p.userId || !followingSet.has(p.userId))
    .sort((a, b) => b.likes - a.likes);

  const posts = [...followedPosts, ...otherPosts];

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
  onOverflow,
  inGroup,
}: {
  post:            Post;
  height:          number;
  isActive:        boolean;
  isOwnPost:       boolean;
  isFollowing:     boolean;
  inGroup?:        boolean;
  onLike:          (id: string) => void;
  onComment:       (id: string) => void;
  onFollowToggle:  (userId: string) => void;
  onPressUser:     (userId: string) => void;
  onShare:         (post: Post) => void;
  onGym:           (gymId: string) => void;
  onOverflow:      (post: Post) => void;
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
      {/* Hidden inside a group carousel — the group header takes the top slot. */}
      {!inGroup && (
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
      )}

      {/* ── Overflow menu (own posts only) ──────────────────────────────────── */}
      {isOwnPost && (
        <TouchableOpacity
          style={card.overflowBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => onOverflow(post)}>
          <Ionicons name="ellipsis-vertical" size={20} color="#ffffff" />
        </TouchableOpacity>
      )}

      {/* ── Quiet badge (own quiet posts) ───────────────────────────────────── */}
      {isOwnPost && post.visibility === 'quiet' && (
        <View style={card.quietBadge}>
          <Ionicons name="eye-off-outline" size={13} color="#ffffff" />
          <Text style={card.quietBadgeText}>ONLY YOU</Text>
        </View>
      )}

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
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => post.userId && onPressUser(post.userId)}>
        {!inGroup && <Text style={card.username}>{displayName}</Text>}
        {post.climbNickname ? (
          <Text style={card.climbNickname}>{post.climbNickname}</Text>
        ) : null}
        {post.climbNotes ? (
          <Text style={card.climbNotes} numberOfLines={2}>{post.climbNotes}</Text>
        ) : null}
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

// ─── Grouped card (same-day same-gym carousel) ──────────────────────────────────

function GroupedCard({
  group, height, isActive, currentUserId, followingSet,
  onLike, onComment, onFollowToggle, onPressUser, onShare, onGym, onOverflow,
}: {
  group:          GroupedPost;
  height:         number;
  isActive:       boolean;
  currentUserId:  string | null;
  followingSet:   Set<string>;
  onLike:         (id: string) => void;
  onComment:      (id: string) => void;
  onFollowToggle: (userId: string) => void;
  onPressUser:    (userId: string) => void;
  onShare:        (post: Post) => void;
  onGym:          (gymId: string) => void;
  onOverflow:     (post: Post, group: GroupedPost) => void;
}) {
  const [activePage, setActivePage] = useState(0);
  const pages = group.pages;
  const n     = pages.length;
  const head  = pages[0]; // username + gym are identical across members

  return (
    <View style={{ width: SCREEN_WIDTH, height, backgroundColor: '#000' }}>
      {/* Horizontal paged carousel — one full session card per page */}
      <FlatList
        data={pages}
        keyExtractor={(p) => p.id}
        horizontal
        pagingEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setActivePage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
        }
        renderItem={({ item, index }) => (
          <FullScreenCard
            post={item}
            height={height}
            isActive={isActive && index === activePage}
            isOwnPost={item.userId === currentUserId}
            isFollowing={!!item.userId && followingSet.has(item.userId)}
            inGroup
            onLike={onLike}
            onComment={onComment}
            onFollowToggle={onFollowToggle}
            onPressUser={onPressUser}
            onShare={onShare}
            onGym={onGym}
            onOverflow={(post) => onOverflow(post, group)}
          />
        )}
      />

      {/* Group header (top-left) — username + "N climbs at gym" */}
      <TouchableOpacity
        style={grp.header}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => head.userId && onPressUser(head.userId)}>
        <Text style={grp.headerUser} numberOfLines={1}>@{head.username ?? head.name}</Text>
        <Text style={grp.headerMeta} numberOfLines={1}>{n} climbs at {head.gym ?? 'the gym'}</Text>
      </TouchableOpacity>

      {/* "+N more" cue — cover page only */}
      {activePage === 0 && (
        <View style={grp.moreCue} pointerEvents="none">
          <Ionicons name="layers-outline" size={13} color="#ffffff" />
          <Text style={grp.moreText}>+{n - 1} more</Text>
        </View>
      )}

      {/* Page dots */}
      <View style={grp.dots} pointerEvents="none">
        {pages.map((_, i) => (
          <View key={i} style={[grp.dot, i === activePage ? grp.dotActive : grp.dotInactive]} />
        ))}
      </View>
    </View>
  );
}

// ─── First-run feed cards ───────────────────────────────────────────────────────

// Gym picker — shown as the first feed item while home_gym_id is null.
function GymPickerCard({
  height, gyms, onSelect, onDismiss,
}: {
  height: number;
  gyms: Gym[];
  onSelect: (gym: Gym) => void;
  onDismiss: () => void;
}) {
  return (
    <View style={[fc.card, { height }]}>
      <TouchableOpacity style={fc.dismiss} onPress={onDismiss} activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={fc.dismissText}>✕</Text>
      </TouchableOpacity>

      <View style={fc.inner}>
        <Text style={fc.label}>YOUR GYM</Text>
        <Text style={fc.pickerHeadline}>Where do you climb?</Text>
        <Text style={fc.pickerSub}>Tap your home gym to see what&apos;s on the wall.</Text>

        <View style={fc.chipWrap}>
          {gyms.map(gym => (
            <TouchableOpacity key={gym.id} style={fc.chip} activeOpacity={0.8}
              onPress={() => onSelect(gym)}>
              <Text style={fc.chipName}>{gym.name}</Text>
              {gym.neighborhood ? (
                <Text style={fc.chipNeighborhood}>{gym.neighborhood}</Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// One-time confirmation shown in place of the picker right after a gym is chosen.
function GymConfirmCard({
  height, gymName, onPress,
}: {
  height: number;
  gymName: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[fc.card, { height }]} activeOpacity={0.9} onPress={onPress}>
      <View style={fc.inner}>
        <Text style={fc.label}>YOUR GYM</Text>
        <Text style={fc.confirmHeadline}>
          <Text style={fc.confirmGym}>{gymName}</Text> set as your gym
        </Text>
        <Text style={fc.confirmSub}>Tap to see what&apos;s on the wall →</Text>
      </View>
    </TouchableOpacity>
  );
}

// In-feed climber suggestions — injected after the 3rd post. Reuses the feed's
// own follow mutation (onFollowToggle) so the follow logic is never duplicated.
function SuggestionsCard({
  height, gymName, climbers, followingSet, onFollowToggle, onPressUser, onDismiss,
}: {
  height: number;
  gymName: string;
  climbers: SuggestedClimber[];
  followingSet: Set<string>;
  onFollowToggle: (userId: string) => void;
  onPressUser: (userId: string) => void;
  onDismiss: () => void;
}) {
  return (
    <View style={[fc.card, { height }]}>
      <TouchableOpacity style={fc.dismiss} onPress={onDismiss} activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={fc.dismissText}>✕</Text>
      </TouchableOpacity>

      <View style={fc.inner}>
        <Text style={fc.label}>CLIMBERS AT {gymName.toUpperCase()}</Text>
        <Text style={fc.suggestHeadline}>Find your people.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={fc.suggestRow}>
          {climbers.map(c => {
            const following = followingSet.has(c.id);
            return (
              <View key={c.id} style={fc.suggestItem}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => onPressUser(c.id)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={fc.suggestTap}>
                  {c.avatarUrl ? (
                    <Image source={{ uri: c.avatarUrl }} style={fc.suggestAvatar} />
                  ) : (
                    <View style={[fc.suggestAvatar, fc.suggestAvatarFallback]}>
                      <Text style={fc.suggestAvatarText}>{toInitials(c.fullName)}</Text>
                    </View>
                  )}
                  <Text style={fc.suggestName} numberOfLines={1}>@{c.username}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[fc.suggestFollowBtn, following && fc.suggestFollowingBtn]}
                  onPress={() => onFollowToggle(c.id)}
                  activeOpacity={0.8}>
                  <Text style={[fc.suggestFollowText, following && fc.suggestFollowingText]}>
                    {following ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

// Empty feed — never a blank screen. Always points at real content.
function EmptyFeedCard({
  height, hasHomeGym, homeGymName, homeGymHasProblems, onLogSend, onGoToGym,
}: {
  height: number;
  hasHomeGym: boolean;
  homeGymName: string;
  homeGymHasProblems: boolean;
  onLogSend: () => void;
  onGoToGym: () => void;
}) {
  return (
    <View style={[fc.card, { height }]}>
      <View style={fc.inner}>
        <Text style={fc.label}>QUIET IN HERE</Text>
        <Text style={fc.emptyHeadline}>No sends yet.</Text>
        <Text style={fc.emptySub}>
          Log a climb and yours will be the first thing climbers see.
        </Text>

        <TouchableOpacity style={fc.emptyCta} onPress={onLogSend} activeOpacity={0.85}>
          <Text style={fc.emptyCtaText}>LOG A SEND</Text>
        </TouchableOpacity>

        {hasHomeGym && homeGymHasProblems ? (
          <TouchableOpacity onPress={onGoToGym} activeOpacity={0.7} style={fc.emptyLink}>
            <Text style={fc.emptyLinkText}>Meanwhile, on the wall at {homeGymName} →</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// Quiet inline retry — shown when the feed query fails. Never a dead screen.
function FeedErrorCard({ height, onRetry }: { height: number; onRetry: () => void }) {
  return (
    <View style={[fc.card, { height }]}>
      <View style={fc.inner}>
        <Text style={fc.label}>HMM</Text>
        <Text style={fc.emptyHeadline}>Couldn&apos;t load the feed.</Text>
        <Text style={fc.emptySub}>Check your connection and try again.</Text>
        <TouchableOpacity style={fc.emptyCta} onPress={onRetry} activeOpacity={0.85}>
          <Text style={fc.emptyCtaText}>RETRY</Text>
        </TouchableOpacity>
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

  // First-run / personalization state
  const [gyms,               setGyms]               = useState<Gym[]>([]);
  const [homeGymId,          setHomeGymId]          = useState<string | null>(null);
  const [suggestedClimbers,  setSuggestedClimbers]  = useState<SuggestedClimber[]>([]);
  const [homeGymHasProblems, setHomeGymHasProblems] = useState(false);
  const [gymJustSet,         setGymJustSet]         = useState<{ gymId: string; gymName: string } | null>(null);
  const [loadError,          setLoadError]          = useState(false);
  const [, setDismissTick] = useState(0); // bump to re-render after a session-only dismissal

  // Overflow / visibility sheet (own posts)
  const [overflowPost,    setOverflowPost]    = useState<Post | null>(null);
  const [overflowGroup,   setOverflowGroup]   = useState<GroupedPost | null>(null);
  const [overflowConfirm, setOverflowConfirm] = useState(false);
  const [overflowBusy,    setOverflowBusy]    = useState(false);

  // Arrange-climbs sheet (own grouped cards)
  const [arrangeGroup, setArrangeGroup] = useState<GroupedPost | null>(null);
  const [arrangeOrder, setArrangeOrder] = useState<Post[]>([]);
  const [arrangeBusy,  setArrangeBusy]  = useState(false);

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

  // Single shared loader — used by focus and by the inline retry. Any failure
  // sets loadError so the feed shows a quiet retry card, never a dead screen.
  const runLoad = useCallback(async (isActive: () => boolean) => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? null;
      if (!isActive()) return;
      setCurrentUserId(userId);

      const gymsData = await fetchGyms();

      // Current user's home gym (null → show the picker card)
      let hgid: string | null = null;
      if (userId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('home_gym_id')
          .eq('id', userId)
          .single();
        hgid = prof?.home_gym_id ?? null;
      }

      const { posts: sessionPosts, followingSet: fs } = await fetchSessionPosts(userId);

      // Suggested climbers — only when a home gym is set and the user follows < 3.
      let suggested: SuggestedClimber[] = [];
      if (userId && hgid && fs.size < 3) {
        const { data: sharers } = await supabase
          .from('profiles')
          .select('id,full_name,username,avatar_url')
          .eq('home_gym_id', hgid)
          .neq('id', userId)
          .limit(12);
        suggested = (sharers ?? [])
          .filter(p => !fs.has(p.id))
          .slice(0, 8)
          .map(p => ({
            id: p.id,
            fullName: p.full_name ?? 'Climber',
            username: p.username ?? 'climber',
            avatarUrl: p.avatar_url ?? null,
          }));
      }

      // Does the home gym have catalog problems? (drives the empty-state link.)
      let hgHasProblems = false;
      if (hgid) {
        const { count } = await supabase
          .from('problems')
          .select('id', { count: 'exact', head: true })
          .eq('gym_id', hgid);
        hgHasProblems = (count ?? 0) > 0;
      }

      if (!isActive()) return;
      setGyms(gymsData);
      setHomeGymId(hgid);
      setSuggestedClimbers(suggested);
      setHomeGymHasProblems(hgHasProblems);
      setGymJustSet(null); // confirmation card never survives a refresh
      setPosts(sessionPosts);
      setFollowingSet(fs);
      setLoading(false);
    } catch {
      if (!isActive()) return;
      setLoadError(true);
      setLoading(false);
    }
  }, []);

  // Load feed on every focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      runLoad(() => active);
      return () => { active = false; };
    }, [runLoad])
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

  // Pick a home gym from the picker card → write to profile, show confirmation.
  const handleSelectHomeGym = useCallback(async (gym: Gym) => {
    setGymJustSet({ gymId: gym.id, gymName: gym.name });
    setHomeGymId(gym.id);
    if (!currentUserId) return;
    try {
      await supabase.from('profiles').update({ home_gym_id: gym.id }).eq('id', currentUserId);
    } catch {
      // Optimistic — if the write fails the picker simply returns next launch.
    }
  }, [currentUserId]);

  const dismissPicker = useCallback(() => {
    gymPickerDismissedThisSession = true;
    setDismissTick(t => t + 1);
  }, []);

  const dismissSuggestions = useCallback(() => {
    suggestionsDismissedThisSession = true;
    setDismissTick(t => t + 1);
  }, []);

  const handleRetry = useCallback(() => { runLoad(() => true); }, [runLoad]);

  // ── After-the-fact visibility toggle (own posts) ──────────────────────────
  const handleOverflow = useCallback((post: Post, group?: GroupedPost) => {
    setOverflowPost(post);
    setOverflowGroup(group ?? null);
    setOverflowConfirm(false);
  }, []);

  // ── Arrange climbs (own grouped cards) → writes feed_rank ─────────────────
  const openArrange = useCallback((group: GroupedPost) => {
    setArrangeGroup(group);
    setArrangeOrder(group.pages);
    setOverflowPost(null);
    setOverflowGroup(null);
  }, []);

  const moveArrange = useCallback((from: number, to: number) => {
    setArrangeOrder(prev => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  }, []);

  const saveArrange = useCallback(async () => {
    if (!arrangeGroup || arrangeBusy) return;
    setArrangeBusy(true);
    // feed_rank 0..n-1 in the new order; groupPosts then honours it on reload.
    await Promise.all(arrangeOrder.map((p, i) =>
      supabase.from('sessions').update({ feed_rank: i }).eq('id', p.id),
    ));
    setArrangeBusy(false);
    setArrangeGroup(null);
    runLoad(() => true);
  }, [arrangeGroup, arrangeOrder, arrangeBusy, runLoad]);

  const resetArrange = useCallback(async () => {
    if (!arrangeGroup || arrangeBusy) return;
    setArrangeBusy(true);
    await Promise.all(arrangeGroup.members.map(p =>
      supabase.from('sessions').update({ feed_rank: null }).eq('id', p.id),
    ));
    setArrangeBusy(false);
    setArrangeGroup(null);
    runLoad(() => true);
  }, [arrangeGroup, arrangeBusy, runLoad]);

  // Pull one climb out of its group (solo = true) / merge it back (solo = false).
  const setSolo = useCallback(async (value: boolean) => {
    if (!overflowPost) return;
    await supabase.from('sessions').update({ solo: value }).eq('id', overflowPost.id);
    setOverflowPost(null);
    setOverflowGroup(null);
    setOverflowConfirm(false);
    runLoad(() => true);
  }, [overflowPost, runLoad]);

  const handleToggleVisibility = useCallback(async () => {
    if (!overflowPost || overflowBusy) return;
    setOverflowBusy(true);
    const target: 'public' | 'quiet' = overflowPost.visibility === 'quiet' ? 'public' : 'quiet';
    const { error } = await supabase
      .from('sessions')
      .update({ visibility: target })
      .eq('id', overflowPost.id);
    if (!error) {
      // Cover may change (a newly-quiet session can no longer be a cover; a
      // newly-public one may become one). The RPC re-derives it server-side.
      if (overflowPost.problemId) {
        await supabase.rpc('recompute_problem_cover', { problem_id: overflowPost.problemId });
      }
      // Optimistic: flip visibility in place. created_at is untouched, so a
      // re-publicised post slots back at its original feed position (no bump).
      setPosts(prev => prev.map(p => (p.id === overflowPost.id ? { ...p, visibility: target } : p)));
    }
    setOverflowBusy(false);
    setOverflowPost(null);
    setOverflowGroup(null);
    setOverflowConfirm(false);
  }, [overflowPost, overflowBusy]);

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

  // A solo post can rejoin its day's group only if a groupable sibling exists.
  const overflowCanRegroup = !!(
    overflowPost?.solo && overflowPost.createdAt &&
    posts.some(p =>
      p.id !== overflowPost.id && !p.solo &&
      p.userId === overflowPost.userId && p.gymId === overflowPost.gymId &&
      p.createdAt &&
      new Date(p.createdAt).toDateString() === new Date(overflowPost.createdAt!).toDateString(),
    )
  );

  // Build the feed item list — posts plus the first-run cards, all full-height so
  // the vertical snap behaviour is identical for every item.
  const showPicker = homeGymId === null && !gymPickerDismissedThisSession;
  const homeGymNameResolved = homeGymId ? resolveGymName(gyms, homeGymId) : '';

  const feedItems: FeedItem[] = [];
  if (gymJustSet) {
    // Confirmation replaces the picker in place after a gym is chosen.
    feedItems.push({ key: 'gymConfirm', kind: 'gymConfirm', gymId: gymJustSet.gymId, gymName: gymJustSet.gymName });
  } else if (showPicker) {
    feedItems.push({ key: 'gymPicker', kind: 'gymPicker' });
  }

  if (posts.length === 0) {
    feedItems.push({ key: 'empty', kind: 'empty' });
  } else {
    // Fold same-day/same-gym/same-user runs into grouped carousels (singles pass
    // through unchanged). Grouping runs on the already-ordered list and can't
    // cross segments, so feed ordering is untouched.
    const postItems: FeedItem[] = groupPosts(posts).map((g): FeedItem =>
      isGroupedPost(g)
        ? { key: `group-${g.groupKey}`, kind: 'group', group: g }
        : { key: g.id, kind: 'post', post: g }
    );
    const showSuggestions =
      homeGymId !== null &&
      !suggestionsDismissedThisSession &&
      followingSet.size < 3 &&
      suggestedClimbers.length > 0;
    if (showSuggestions) {
      // After the 3rd post (or appended if there are fewer than 3).
      const at = Math.min(3, postItems.length);
      postItems.splice(at, 0, { key: 'suggestions', kind: 'suggestions', gymId: homeGymId! });
    }
    feedItems.push(...postItems);
  }

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
        ) : loadError ? (
          <FeedErrorCard height={cardHeight} onRetry={handleRetry} />
        ) : (
          <FlatList
            data={feedItems}
            keyExtractor={item => item.key}
            renderItem={({ item, index }) => {
              switch (item.kind) {
                case 'post':
                  return (
                    <FullScreenCard
                      post={item.post}
                      height={cardHeight}
                      isActive={index === activeIndex}
                      isOwnPost={item.post.userId === currentUserId}
                      isFollowing={!!item.post.userId && followingSet.has(item.post.userId)}
                      onLike={handleLike}
                      onComment={openCommentSheet}
                      onFollowToggle={handleFollowToggle}
                      onPressUser={handlePressUser}
                      onShare={handleShare}
                      onGym={gymId => router.push(`/gym/${gymId}`)}
                      onOverflow={(post) => handleOverflow(post)}
                    />
                  );
                case 'group':
                  return (
                    <GroupedCard
                      group={item.group}
                      height={cardHeight}
                      isActive={index === activeIndex}
                      currentUserId={currentUserId}
                      followingSet={followingSet}
                      onLike={handleLike}
                      onComment={openCommentSheet}
                      onFollowToggle={handleFollowToggle}
                      onPressUser={handlePressUser}
                      onShare={handleShare}
                      onGym={gymId => router.push(`/gym/${gymId}`)}
                      onOverflow={handleOverflow}
                    />
                  );
                case 'gymPicker':
                  return (
                    <GymPickerCard
                      height={cardHeight}
                      gyms={gyms}
                      onSelect={handleSelectHomeGym}
                      onDismiss={dismissPicker}
                    />
                  );
                case 'gymConfirm':
                  return (
                    <GymConfirmCard
                      height={cardHeight}
                      gymName={item.gymName}
                      onPress={() => router.push(`/gym/${item.gymId}`)}
                    />
                  );
                case 'suggestions':
                  return (
                    <SuggestionsCard
                      height={cardHeight}
                      gymName={resolveGymName(gyms, item.gymId)}
                      climbers={suggestedClimbers}
                      followingSet={followingSet}
                      onFollowToggle={handleFollowToggle}
                      onPressUser={handlePressUser}
                      onDismiss={dismissSuggestions}
                    />
                  );
                case 'empty':
                  return (
                    <EmptyFeedCard
                      height={cardHeight}
                      hasHomeGym={homeGymId !== null}
                      homeGymName={homeGymNameResolved}
                      homeGymHasProblems={homeGymHasProblems}
                      onLogSend={() => router.navigate('/(tabs)/log')}
                      onGoToGym={() => { if (homeGymId) router.push(`/gym/${homeGymId}`); }}
                    />
                  );
                default:
                  return null;
              }
            }}
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
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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

      {/* ── Overflow sheet: make quiet / make public (own posts) ─────────────── */}
      {overflowPost && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setOverflowPost(null)}>
          <View style={overflow.backdrop}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setOverflowPost(null)} />
            <View style={overflow.sheet}>
              <View style={overflow.handle} />
              {!overflowConfirm ? (
                <>
                  <TouchableOpacity
                    style={overflow.row}
                    activeOpacity={0.7}
                    onPress={() => setOverflowConfirm(true)}>
                    <Ionicons
                      name={overflowPost.visibility === 'quiet' ? 'eye-outline' : 'eye-off-outline'}
                      size={22}
                      color={INK}
                    />
                    <Text style={overflow.rowLabel}>
                      {overflowPost.visibility === 'quiet' ? 'Make public' : 'Make quiet'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={overflow.hint}>
                    {overflowPost.visibility === 'quiet'
                      ? 'Everyone will be able to see this climb.'
                      : 'Only you will see this climb. It still counts in your stats.'}
                  </Text>
                  {overflowGroup && (
                    <TouchableOpacity
                      style={[overflow.row, overflow.rowBordered]}
                      activeOpacity={0.7}
                      onPress={() => overflowGroup && openArrange(overflowGroup)}>
                      <Ionicons name="swap-vertical" size={22} color={INK} />
                      <Text style={overflow.rowLabel}>Arrange climbs</Text>
                    </TouchableOpacity>
                  )}
                  {overflowGroup && (
                    <TouchableOpacity
                      style={[overflow.row, overflow.rowBordered]}
                      activeOpacity={0.7}
                      onPress={() => setSolo(true)}>
                      <Ionicons name="remove-circle-outline" size={22} color={INK} />
                      <Text style={overflow.rowLabel}>Post separately</Text>
                    </TouchableOpacity>
                  )}
                  {overflowCanRegroup && (
                    <TouchableOpacity
                      style={[overflow.row, overflow.rowBordered]}
                      activeOpacity={0.7}
                      onPress={() => setSolo(false)}>
                      <Ionicons name="albums-outline" size={22} color={INK} />
                      <Text style={overflow.rowLabel}>Add back to the group</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <>
                  <Text style={overflow.confirmTitle}>
                    {overflowPost.visibility === 'quiet' ? 'Make this public?' : 'Make this quiet?'}
                  </Text>
                  <Text style={overflow.confirmSub}>
                    {overflowPost.visibility === 'quiet'
                      ? 'Everyone will be able to see it.'
                      : 'Only you will see it from now on. Likes and comments are kept.'}
                  </Text>
                  <TouchableOpacity
                    style={overflow.confirmBtn}
                    activeOpacity={0.85}
                    disabled={overflowBusy}
                    onPress={handleToggleVisibility}>
                    {overflowBusy ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={overflow.confirmBtnText}>
                        {overflowPost.visibility === 'quiet' ? 'MAKE PUBLIC' : 'MAKE QUIET'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={overflow.cancelBtn}
                    activeOpacity={0.7}
                    onPress={() => setOverflowPost(null)}>
                    <Text style={overflow.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* ── Arrange climbs sheet (own grouped cards) ──────────────────────────── */}
      {arrangeGroup && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setArrangeGroup(null)}>
          <View style={overflow.backdrop}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setArrangeGroup(null)} />
            <View style={overflow.sheet}>
              <View style={overflow.handle} />
              <Text style={arrange.title}>Arrange climbs</Text>
              <Text style={arrange.sub}>Set the order climbers swipe through this day.</Text>
              <ScrollView style={arrange.list} showsVerticalScrollIndicator={false}>
                {arrangeOrder.map((p, i) => (
                  <View key={p.id} style={arrange.row}>
                    <Text style={arrange.rowGrade}>{p.topGrade ?? '—'}</Text>
                    <Text style={arrange.rowName} numberOfLines={1}>
                      {p.climbNickname ?? p.gym ?? 'Climb'}
                    </Text>
                    <View style={arrange.rowBtns}>
                      <TouchableOpacity
                        style={[arrange.moveBtn, i === 0 && arrange.moveBtnDisabled]}
                        disabled={i === 0}
                        onPress={() => moveArrange(i, i - 1)}
                        activeOpacity={0.7}>
                        <Ionicons name="chevron-up" size={18} color={i === 0 ? INK3 : INK} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[arrange.moveBtn, i === arrangeOrder.length - 1 && arrange.moveBtnDisabled]}
                        disabled={i === arrangeOrder.length - 1}
                        onPress={() => moveArrange(i, i + 1)}
                        activeOpacity={0.7}>
                        <Ionicons name="chevron-down" size={18} color={i === arrangeOrder.length - 1 ? INK3 : INK} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={overflow.confirmBtn}
                activeOpacity={0.85}
                disabled={arrangeBusy}
                onPress={saveArrange}>
                {arrangeBusy ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={overflow.confirmBtnText}>SAVE ORDER</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={overflow.cancelBtn} activeOpacity={0.7} onPress={resetArrange} disabled={arrangeBusy}>
                <Text style={overflow.cancelText}>Reset to default order</Text>
              </TouchableOpacity>
            </View>
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
  overflowBtn: {
    position: 'absolute',
    top: 30,
    right: 14,
    zIndex: 11,
    padding: 4,
  },
  quietBadge: {
    position: 'absolute',
    top: 64,
    right: 14,
    zIndex: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  quietBadgeText: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#ffffff',
    letterSpacing: 1,
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
    gap: 2,
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
  climbNickname: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: SAND_LT,
    letterSpacing: 0.1,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  climbNotes: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 17,
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

// ─── Overflow / visibility sheet styles ─────────────────────────────────────────

const overflow = StyleSheet.create({
  backdrop: {
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
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(26,20,8,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowBordered: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
    marginTop: 6,
  },
  rowLabel: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK,
  },
  hint: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK3,
    lineHeight: 18,
    paddingBottom: 8,
  },
  confirmTitle: {
    fontSize: 20,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  confirmSub: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK3,
    lineHeight: 20,
    marginBottom: 18,
  },
  confirmBtn: {
    backgroundColor: SAND,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
  },
});

// ─── Grouped card styles ────────────────────────────────────────────────────────

const grp = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 30,
    left: 16,
    right: 60,        // clear the overflow button
    zIndex: 11,
  },
  headerUser: {
    fontSize: 16,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  headerMeta: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  moreCue: {
    position: 'absolute',
    bottom: STATS_BAR_H + 100,
    right: 14,
    zIndex: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  moreText: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  dots: {
    position: 'absolute',
    bottom: STATS_BAR_H + 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    zIndex: 11,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: SAND,
  },
  dotInactive: {
    backgroundColor: INK3,
  },
});

// ─── Arrange-climbs sheet styles ────────────────────────────────────────────────

const arrange = StyleSheet.create({
  title: {
    fontSize: 20,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  sub: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK3,
    marginBottom: 12,
  },
  list: {
    maxHeight: SCREEN_HEIGHT * 0.4,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  rowGrade: {
    width: 40,
    fontSize: 16,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND,
    letterSpacing: -0.5,
  },
  rowName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK,
  },
  rowBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  moveBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveBtnDisabled: {
    opacity: 0.4,
  },
});

// ─── First-run card styles ──────────────────────────────────────────────────────

const fc = StyleSheet.create({
  card: {
    width: SCREEN_WIDTH,
    backgroundColor: INK,
    justifyContent: 'center',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  dismiss: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  label: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },

  // Gym picker
  pickerHeadline: {
    fontSize: 34,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND,
    letterSpacing: -1,
    lineHeight: 38,
  },
  pickerSub: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
    marginBottom: 6,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 2,
  },
  chipName: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  chipNeighborhood: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: 'rgba(255,255,255,0.5)',
  },

  // Gym confirmation
  confirmHeadline: {
    fontSize: 26,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  confirmGym: {
    color: SAND,
  },
  confirmSub: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: SAND_LT,
    marginTop: 2,
  },

  // Suggestions
  suggestHeadline: {
    fontSize: 28,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  suggestRow: {
    gap: 18,
    paddingVertical: 8,
    paddingRight: 28,
  },
  suggestItem: {
    width: 96,
    alignItems: 'center',
    gap: 8,
  },
  suggestTap: {
    alignItems: 'center',
    gap: 8,
  },
  suggestAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  suggestAvatarFallback: {
    backgroundColor: '#2a2010',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestAvatarText: {
    fontSize: 18,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND_LT,
    letterSpacing: 0.3,
  },
  suggestName: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#ffffff',
    maxWidth: 96,
  },
  suggestFollowBtn: {
    backgroundColor: SAND,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 18,
  },
  suggestFollowingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  suggestFollowText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#ffffff',
  },
  suggestFollowingText: {
    color: 'rgba(255,255,255,0.55)',
  },

  // Empty / error
  emptyHeadline: {
    fontSize: 40,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -1.5,
    lineHeight: 44,
  },
  emptySub: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 22,
    marginBottom: 8,
  },
  emptyCta: {
    backgroundColor: SAND,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignSelf: 'flex-start',
  },
  emptyCtaText: {
    fontSize: 15,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  emptyLink: {
    marginTop: 18,
  },
  emptyLinkText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: SAND_LT,
  },
});
