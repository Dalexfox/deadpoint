/**
 * Session Detail — full-screen modal
 * Looks and feels exactly like a feed card. Opened from My Climbs (and
 * anywhere else a session ID is available).
 *
 * Presentation: modal (slides up over the profile).
 * Close: swipe down or tap the × button.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { fetchGyms, gymName as resolveGymName } from '../../lib/gyms';
import { VideoBackground } from '../../components/VideoBackground';
import { DefaultCover } from '../../components/DefaultCover';
import { ShareCardSheet } from '../../components/ShareCardSheet';
import { MentionText } from '../../components/MentionText';

const { width: SW, height: SH } = Dimensions.get('window');
const STATS_BAR_H = 64;

// ─── Design tokens (mirrors index.tsx) ───────────────────────────────────────
const BG      = '#ffffff';
const SURFACE = '#ece8df';
const INK     = '#1a1408';
const INK3    = '#8a7a50';
const SAND    = '#c8a84a';
const SAND_LT = '#e8c87a';
const ACCENT  = '#e8383c';


function toInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}

function timeAgo(dateStr: string) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionData = {
  id:            string;
  userId:        string;
  gymId:         string;
  gymName:       string;
  grade:         string | null;
  mediaUrl:      string | null;
  isVideo:       boolean;
  climbNickname: string | null;
  climbNotes:    string | null;
  sendStyle:     'flash' | 'send' | 'project' | null;
  date:          string | null;
  problemId:     string | null;
  coSessionId:   string | null;
  visibility:    'public' | 'quiet';
};

type CommentItem = {
  id:        string;
  userId:    string;
  content:   string;
  createdAt: string;
  fullName:  string;
  username:  string | null;
  avatarUrl: string | null;
};

// A friend's send shown in the "combine with a friend" picker.
type CombineItem = {
  sessionId: string;
  name:      string;
  username:  string | null;
  avatarUrl: string | null;
  grade:     string;
  gymName:   string;
  date:      string;
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SessionDetailScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [loading,        setLoading]        = useState(true);
  const [session,        setSession]        = useState<SessionData | null>(null);
  const [posterName,     setPosterName]     = useState('');
  const [posterUsername, setPosterUsername] = useState<string | null>(null);
  const [posterAvatar,   setPosterAvatar]   = useState<string | null>(null);
  const [likeCount,      setLikeCount]      = useState(0);
  const [liked,          setLiked]          = useState(false);
  const [commentCount,   setCommentCount]   = useState(0);
  const [currentUserId,  setCurrentUserId]  = useState<string | null>(null);
  const [videoMuted,     setVideoMuted]     = useState(false);
  const [shareOpen,      setShareOpen]      = useState(false);

  // Overflow / visibility sheet (own session only)
  const [overflowOpen,    setOverflowOpen]    = useState(false);
  const [overflowConfirm, setOverflowConfirm] = useState(false);
  const [overflowBusy,    setOverflowBusy]    = useState(false);

  // Combine-with-a-friend (co-session) picker
  const [combineOpen,    setCombineOpen]    = useState(false);
  const [combineLoading, setCombineLoading] = useState(false);
  const [combineList,    setCombineList]    = useState<CombineItem[]>([]);
  const [combineBusy,    setCombineBusy]    = useState<string | null>(null);

  // Comment sheet state
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [commentsList,        setCommentsList]        = useState<CommentItem[]>([]);
  const [commentsLoading,     setCommentsLoading]     = useState(false);
  const [commentInput,        setCommentInput]        = useState('');
  const [sendingComment,      setSendingComment]      = useState(false);
  const commentsScrollRef = useRef<ScrollView>(null);

  useEffect(() => { if (id) loadSession(); }, [id]);

  async function loadSession() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const [sessionRes, likesRes, commentCountRes] = await Promise.all([
        supabase
          .from('sessions')
          .select('id, user_id, gym_id, media_url, notes, visibility, created_at, co_session_id, climbs(grade, problem_id, send_style)')
          .eq('id', id)
          .single(),
        supabase.from('likes').select('user_id').eq('session_id', id),
        supabase.from('comments').select('*', { count: 'exact', head: true }).eq('session_id', id),
      ]);

      const s = sessionRes.data;
      if (!s) return;

      const climb     = ((s.climbs ?? []) as { grade: string; problem_id: string | null; send_style: string | null }[])[0];
      const grade     = climb?.grade ?? null;
      const problemId = climb?.problem_id ?? null;
      const mediaUrl  = s.media_url ?? null;

      // Fetch profile and problem custom_name in parallel
      const [profileRes, problemRes] = await Promise.all([
        supabase.from('profiles').select('full_name, username, avatar_url').eq('id', s.user_id).single(),
        problemId
          ? supabase.from('problems').select('custom_name').eq('id', problemId).single()
          : Promise.resolve({ data: null }),
      ]);

      const gyms = await fetchGyms();
      setSession({
        id:            s.id,
        userId:        s.user_id,
        gymId:         s.gym_id,
        gymName:       resolveGymName(gyms, s.gym_id),
        grade,
        mediaUrl,
        isVideo:       !!mediaUrl && /\.(mp4|mov|m4v|avi)$/i.test(mediaUrl),
        climbNickname: problemRes.data?.custom_name ?? null,
        climbNotes:    (s as any).notes ?? null,
        sendStyle:     (climb?.send_style ?? null) as SessionData['sendStyle'],
        date:          (s as any).created_at
          ? new Date((s as any).created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : null,
        coSessionId:   (s as any).co_session_id ?? null,
        problemId,
        visibility:    ((s as any).visibility ?? 'public') as 'public' | 'quiet',
      });
      const profile = profileRes.data;
      setPosterName(profile?.full_name ?? 'Climber');
      setPosterUsername(profile?.username ?? null);
      setPosterAvatar(profile?.avatar_url ?? null);

      const likes = likesRes.data ?? [];
      setLikeCount(likes.length);
      setLiked(likes.some(l => l.user_id === user?.id));
      setCommentCount(commentCountRes.count ?? 0);
    } finally {
      setLoading(false);
    }
  }

  // ── Like toggle ────────────────────────────────────────────────────────────
  async function handleLike() {
    if (!currentUserId || !session) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);
    if (wasLiked) {
      await supabase.from('likes').delete()
        .eq('user_id', currentUserId).eq('session_id', session.id);
    } else {
      await supabase.from('likes').insert({ user_id: currentUserId, session_id: session.id });
    }
  }

  // ── Open comment sheet ─────────────────────────────────────────────────────
  const openComments = useCallback(async () => {
    setCommentSheetVisible(true);
    setCommentsLoading(true);
    const { data: rows } = await supabase
      .from('comments')
      .select('id, user_id, content, created_at')
      .eq('session_id', id)
      .order('created_at', { ascending: true });

    const commentRows = rows ?? [];
    const uids = [...new Set(commentRows.map(c => c.user_id))];
    const { data: profiles } = uids.length > 0
      ? await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', uids)
      : { data: [] };
    const pm = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

    setCommentsList(commentRows.map(c => ({
      id:        c.id,
      userId:    c.user_id,
      content:   c.content,
      createdAt: c.created_at,
      fullName:  pm[c.user_id]?.full_name ?? 'Climber',
      username:  pm[c.user_id]?.username ?? null,
      avatarUrl: pm[c.user_id]?.avatar_url ?? null,
    })));
    setCommentsLoading(false);
  }, [id]);

  // ── Send comment ───────────────────────────────────────────────────────────
  async function handleSendComment() {
    const content = commentInput.trim();
    if (!content || !currentUserId || !session || sendingComment) return;
    setSendingComment(true);
    setCommentInput('');

    const { data: inserted } = await supabase
      .from('comments')
      .insert({ user_id: currentUserId, session_id: session.id, content })
      .select('id, user_id, content, created_at')
      .single();

    if (inserted) {
      const { data: me } = await supabase
        .from('profiles').select('full_name, username, avatar_url')
        .eq('id', currentUserId).single();

      const newComment: CommentItem = {
        id:        inserted.id,
        userId:    currentUserId,
        content:   inserted.content,
        createdAt: inserted.created_at,
        fullName:  me?.full_name ?? 'You',
        username:  me?.username ?? null,
        avatarUrl: me?.avatar_url ?? null,
      };
      setCommentsList(prev => [...prev, newComment]);
      setCommentCount(c => c + 1);
      setTimeout(() => commentsScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
    setSendingComment(false);
  }

  // ── Visibility toggle (own session) ─────────────────────────────────────────
  async function handleToggleVisibility() {
    if (!session || overflowBusy) return;
    setOverflowBusy(true);
    const target: 'public' | 'quiet' = session.visibility === 'quiet' ? 'public' : 'quiet';
    const { error } = await supabase
      .from('sessions')
      .update({ visibility: target })
      .eq('id', session.id);
    if (!error) {
      if (session.problemId) {
        await supabase.rpc('recompute_problem_cover', { problem_id: session.problemId });
      }
      setSession({ ...session, visibility: target });
    }
    setOverflowBusy(false);
    setOverflowOpen(false);
    setOverflowConfirm(false);
  }

  // ── Combine with a friend's send (co-session) ───────────────────────────────
  async function openCombine() {
    setOverflowOpen(false);
    setCombineOpen(true);
    setCombineLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !session) { setCombineList([]); return; }
      // People you follow → their recent public sends (not yours, not this co-session).
      const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
      const ids = (follows ?? []).map((f: { following_id: string }) => f.following_id);
      if (ids.length === 0) { setCombineList([]); return; }
      const { data: sess } = await supabase
        .from('sessions')
        .select('id, user_id, gym_id, created_at, co_session_id, climbs(grade)')
        .in('user_id', ids)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(40);
      const rows = (sess ?? []).filter((s: any) => !s.co_session_id || s.co_session_id !== session.coSessionId);
      const uids = [...new Set(rows.map((s: any) => s.user_id))];
      const [{ data: profs }, gyms] = await Promise.all([
        supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', uids),
        fetchGyms(),
      ]);
      const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      setCombineList(rows.map((s: any): CombineItem => {
        const p = pmap.get(s.user_id);
        return {
          sessionId: s.id,
          name:      p?.full_name ?? p?.username ?? 'Climber',
          username:  p?.username ?? null,
          avatarUrl: p?.avatar_url ?? null,
          grade:     s.climbs?.[0]?.grade ?? '—',
          gymName:   resolveGymName(gyms, s.gym_id),
          date:      new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        };
      }));
    } catch {
      setCombineList([]);
    } finally {
      setCombineLoading(false);
    }
  }

  async function doCombine(otherSessionId: string) {
    if (!session) return;
    setCombineBusy(otherSessionId);
    try {
      const { error } = await supabase.rpc('combine_sessions', {
        my_session: session.id, other_session: otherSessionId,
      });
      if (error) throw error;
      setCombineOpen(false);
      Alert.alert('Combined', 'This climb is now a co-session — see it on your feed.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (e: any) {
      Alert.alert("Couldn't combine", e?.message ?? 'Please try again.');
    } finally {
      setCombineBusy(null);
    }
  }

  // ── Share — opens the branded share-card sheet ──────────────────────────────
  function handleShare() {
    setShareOpen(true);
  }

  // ── Open the poster's profile (own → tab, other → /user/[id]) ───────────────
  function openPosterProfile() {
    if (!session) return;
    if (session.userId === currentUserId) {
      router.navigate('/(tabs)/profile');
    } else {
      router.push(`/user/${session.userId}`);
    }
  }

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[st.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={SAND_LT} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[st.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'SpaceGrotesk_400Regular' }}>
          Post not found.
        </Text>
      </View>
    );
  }

  const displayName  = posterUsername ? `@${posterUsername}` : posterName;
  const initials     = toInitials(posterName);
  const cardH        = SH; // full screen height

  return (
    <View style={st.root}>

      {/* ── Background media ─────────────────────────────────────────────── */}
      {session.mediaUrl ? (
        session.isVideo ? (
          <VideoBackground uri={session.mediaUrl} isActive muted={videoMuted} />
        ) : (
          <Image
            source={{ uri: session.mediaUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        )
      ) : (
        <DefaultCover grade={session.grade ?? undefined} gym={session.gymName} date={session.date ?? undefined} />
      )}

      {/* ── Bottom vignette ──────────────────────────────────────────────── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.78)']}
        style={[StyleSheet.absoluteFill, { top: cardH * 0.42 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      {/* ── Tap-to-mute (video only) ─────────────────────────────────────── */}
      {session.isVideo && session.mediaUrl && (
        <>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setVideoMuted(m => !m)} />
          <View style={[st.muteBadge, { top: insets.top + 64 }]} pointerEvents="none">
            <Ionicons name={videoMuted ? 'volume-mute' : 'volume-high'} size={15} color="#ffffff" />
          </View>
        </>
      )}

      {/* ── Close button (top-left) ───────────────────────────────────────── */}
      <TouchableOpacity
        style={[st.closeBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        activeOpacity={0.7}>
        <Ionicons name="close" size={24} color="#ffffff" />
      </TouchableOpacity>

      {/* Overflow (own session only) + quiet badge */}
      {currentUserId === session.userId && (
        <TouchableOpacity
          style={[st.overflowBtn, { top: insets.top + 12 }]}
          onPress={() => { setOverflowOpen(true); setOverflowConfirm(false); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}>
          <Ionicons name="ellipsis-vertical" size={22} color="#ffffff" />
        </TouchableOpacity>
      )}
      {currentUserId === session.userId && session.visibility === 'quiet' && (
        <View style={[st.quietBadge, { top: insets.top + 16 }]}>
          <Ionicons name="eye-off-outline" size={13} color="#ffffff" />
          <Text style={st.quietBadgeText}>ONLY YOU</Text>
        </View>
      )}

      {/* ── Right action rail ─────────────────────────────────────────────── */}
      <View style={[st.rail, { bottom: STATS_BAR_H + 20 }]}>

        {/* Avatar → poster's profile */}
        <TouchableOpacity style={st.railItem} activeOpacity={0.8} onPress={openPosterProfile}>
          <View style={st.avatarRing}>
            {posterAvatar ? (
              <Image source={{ uri: posterAvatar }} style={st.railAvatar} />
            ) : (
              <View style={[st.railAvatar, st.railAvatarFallback]}>
                <Text style={st.railAvatarText}>{initials}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Like */}
        <TouchableOpacity style={st.railItem} activeOpacity={0.8} onPress={handleLike}>
          <Text style={[st.railIcon, liked && st.railIconLiked]}>
            {liked ? '♥' : '♡'}
          </Text>
          <Text style={st.railCount}>{likeCount}</Text>
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity style={st.railItem} activeOpacity={0.8} onPress={openComments}>
          <Text style={st.railIcon}>◎</Text>
          <Text style={st.railCount}>{commentCount}</Text>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity style={st.railItem} activeOpacity={0.8} onPress={handleShare}>
          <Text style={st.railIcon}>↗</Text>
          <Text style={st.railLabel}>share</Text>
        </TouchableOpacity>

        {/* Gym */}
        <TouchableOpacity
          style={st.railItem}
          activeOpacity={0.8}
          onPress={() => router.push(`/gym/${session.gymId}`)}>
          <Text style={st.railIcon}>⬡</Text>
          <Text style={st.railLabel}>gym</Text>
        </TouchableOpacity>
      </View>

      {/* ── Bottom-left username + nickname + notes ──────────────────────── */}
      <View style={[st.bottomInfo, { bottom: STATS_BAR_H + 16 }]}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={openPosterProfile}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={st.username}>{displayName}</Text>
        </TouchableOpacity>
        {session.sendStyle ? (
          <View style={[st.styleTag, session.sendStyle === 'project' && st.styleTagMuted]}>
            <Text style={[st.styleTagText, session.sendStyle === 'project' && st.styleTagTextMuted]}>
              {session.sendStyle === 'flash' ? 'FLASH' : session.sendStyle === 'send' ? 'SEND' : 'PROJECT'}
            </Text>
          </View>
        ) : null}
        {session.climbNickname ? (
          <Text style={st.climbNickname}>{session.climbNickname}</Text>
        ) : null}
        {session.climbNotes ? (
          <MentionText text={session.climbNotes} style={st.climbNotes} mentionStyle={st.mention} numberOfLines={2} />
        ) : null}
      </View>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <View style={[st.statsBar, { height: STATS_BAR_H }]}>
        <View style={st.statGradeSection}>
          <Text style={st.statGradeValue}>{session.grade ?? '—'}</Text>
          <Text style={st.statGradeLabel}>GRADE</Text>
        </View>
        <View style={st.statDivider} />
        <View style={st.statGymSection}>
          <Text style={st.statGymText} numberOfLines={1}>{'📍  '}{session.gymName}</Text>
        </View>
      </View>

      {/* ── Comment sheet ────────────────────────────────────────────────── */}
      {commentSheetVisible && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setCommentSheetVisible(false)}>
          <View style={cm.modalContainer}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setCommentSheetVisible(false)}
            />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={cm.sheet}>
                <View style={cm.sheetHandle} />
                <View style={cm.sheetHeader}>
                  <Text style={cm.sheetTitle}>Comments</Text>
                  <TouchableOpacity
                    onPress={() => setCommentSheetVisible(false)}
                    hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
                    <Text style={cm.sheetClose}>×</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  ref={commentsScrollRef}
                  style={cm.commentList}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 8 }}>
                  {commentsLoading ? (
                    <ActivityIndicator color={SAND} style={{ marginVertical: 36 }} />
                  ) : commentsList.length === 0 ? (
                    <View style={cm.emptyComments}>
                      <Text style={cm.emptyTitle}>No comments yet</Text>
                      <Text style={cm.emptySub}>Be the first to say something!</Text>
                    </View>
                  ) : (
                    commentsList.map(c => (
                      <View key={c.id} style={cm.row}>
                        {c.avatarUrl ? (
                          <Image source={{ uri: c.avatarUrl }} style={cm.avatarImg} />
                        ) : (
                          <View style={cm.avatarFallback}>
                            <Text style={cm.avatarText}>{toInitials(c.fullName)}</Text>
                          </View>
                        )}
                        <View style={cm.rowContent}>
                          <View style={cm.rowMeta}>
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
                              <Text style={cm.name}>{c.fullName}</Text>
                            </TouchableOpacity>
                            <Text style={cm.time}>{timeAgo(c.createdAt)}</Text>
                          </View>
                          <Text style={cm.text}>{c.content}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>

                <View style={cm.inputRow}>
                  <TextInput
                    style={cm.input}
                    placeholder="Add a comment..."
                    placeholderTextColor={INK3}
                    value={commentInput}
                    onChangeText={setCommentInput}
                    returnKeyType="send"
                    onSubmitEditing={handleSendComment}
                    blurOnSubmit={false}
                  />
                  <TouchableOpacity
                    style={[cm.sendBtn, (!commentInput.trim() || sendingComment) && cm.sendBtnDisabled]}
                    onPress={handleSendComment}
                    disabled={!commentInput.trim() || sendingComment}
                    activeOpacity={0.7}>
                    {sendingComment ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={cm.sendBtnText}>Send</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}

      {/* ── Overflow sheet: make quiet / make public ────────────────────────── */}
      {overflowOpen && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setOverflowOpen(false)}>
          <View style={ov.backdrop}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setOverflowOpen(false)} />
            <View style={ov.sheet}>
              <View style={ov.handle} />
              {!overflowConfirm ? (
                <>
                  <TouchableOpacity style={ov.row} activeOpacity={0.7} onPress={() => setOverflowConfirm(true)}>
                    <Ionicons
                      name={session.visibility === 'quiet' ? 'eye-outline' : 'eye-off-outline'}
                      size={22}
                      color={INK}
                    />
                    <Text style={ov.rowLabel}>
                      {session.visibility === 'quiet' ? 'Make public' : 'Make quiet'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={ov.hint}>
                    {session.visibility === 'quiet'
                      ? 'Everyone will be able to see this climb.'
                      : 'Only you will see this climb. It still counts in your stats.'}
                  </Text>
                  <TouchableOpacity style={ov.row} activeOpacity={0.7} onPress={openCombine}>
                    <Ionicons name="git-merge-outline" size={22} color={INK} />
                    <Text style={ov.rowLabel}>Combine with a friend&apos;s send</Text>
                  </TouchableOpacity>
                  <Text style={ov.hint}>Bundle this with a friend&apos;s climb into one co-session.</Text>
                </>
              ) : (
                <>
                  <Text style={ov.confirmTitle}>
                    {session.visibility === 'quiet' ? 'Make this public?' : 'Make this quiet?'}
                  </Text>
                  <Text style={ov.confirmSub}>
                    {session.visibility === 'quiet'
                      ? 'Everyone will be able to see it.'
                      : 'Only you will see it from now on. Likes and comments are kept.'}
                  </Text>
                  <TouchableOpacity
                    style={ov.confirmBtn}
                    activeOpacity={0.85}
                    disabled={overflowBusy}
                    onPress={handleToggleVisibility}>
                    {overflowBusy ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={ov.confirmBtnText}>
                        {session.visibility === 'quiet' ? 'MAKE PUBLIC' : 'MAKE QUIET'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={ov.cancelBtn} activeOpacity={0.7} onPress={() => setOverflowOpen(false)}>
                    <Text style={ov.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* ── Combine-with-a-friend picker ─────────────────────────────────── */}
      {combineOpen && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setCombineOpen(false)}>
          <View style={ov.backdrop}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setCombineOpen(false)} />
            <View style={ov.sheet}>
              <View style={ov.handle} />
              <Text style={cb.title}>Combine with a friend</Text>
              <Text style={cb.sub}>Bundle this climb with a friend&apos;s send into one co-session.</Text>
              {combineLoading ? (
                <ActivityIndicator color={SAND} style={{ marginVertical: 28 }} />
              ) : combineList.length === 0 ? (
                <Text style={cb.empty}>No recent sends from people you follow.</Text>
              ) : (
                <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                  {combineList.map((c) => (
                    <TouchableOpacity
                      key={c.sessionId}
                      style={cb.row}
                      activeOpacity={0.7}
                      disabled={combineBusy !== null}
                      onPress={() => doCombine(c.sessionId)}>
                      {c.avatarUrl ? (
                        <Image source={{ uri: c.avatarUrl }} style={cb.avatar} />
                      ) : (
                        <View style={cb.avatarFallback}>
                          <Text style={cb.avatarInitials}>{(c.name[0] ?? '?').toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={cb.rowName} numberOfLines={1}>@{c.username ?? c.name}</Text>
                        <Text style={cb.rowMeta} numberOfLines={1}>{c.grade} · {c.gymName} · {c.date}</Text>
                      </View>
                      {combineBusy === c.sessionId
                        ? <ActivityIndicator color={SAND} />
                        : <Ionicons name="git-merge-outline" size={18} color={INK3} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <TouchableOpacity style={ov.cancelBtn} activeOpacity={0.7} onPress={() => setCombineOpen(false)}>
                <Text style={ov.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <ShareCardSheet
        visible={shareOpen}
        input={session ? {
          grade:    session.grade ?? '—',
          gym:      session.gymName,
          date:     session.date ?? '',
          username: posterUsername,
          mediaUri: session.mediaUrl,
          isVideo:  session.isVideo,
        } : null}
        onClose={() => setShareOpen(false)}
      />
    </View>
  );
}

// ─── Card styles ──────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: {
    flex: 1,
    width: SW,
    backgroundColor: '#000',
  },
  closeBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  muteBadge: {
    position: 'absolute',
    left: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  overflowBtn: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  quietBadge: {
    position: 'absolute',
    right: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    zIndex: 20,
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

  // Bottom-left info
  bottomInfo: {
    position: 'absolute',
    left: 16,
    right: 80,
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
  styleTag: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(232,200,122,0.5)',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  styleTagMuted: {
    borderColor: 'rgba(255,255,255,0.3)',
  },
  styleTagText: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 1.5,
    color: SAND_LT,
  },
  styleTagTextMuted: {
    color: 'rgba(255,255,255,0.72)',
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
  mention: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: SAND_LT,
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

// ─── Comment sheet styles (mirrors index.tsx comment styles) ──────────────────

const cm = StyleSheet.create({
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
    maxHeight: SH * 0.78,
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
    maxHeight: SH * 0.44,
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

const cb = StyleSheet.create({
  title: { fontSize: 20, fontFamily: 'Syne_800ExtraBold', color: INK, letterSpacing: -0.5, marginBottom: 4 },
  sub: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: INK3, lineHeight: 18, marginBottom: 12 },
  empty: { fontSize: 14, fontFamily: 'SpaceGrotesk_500Medium', color: INK3, textAlign: 'center', paddingVertical: 28 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderTopWidth: 0.5, borderTopColor: 'rgba(26,20,8,0.08)',
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: SURFACE },
  avatarFallback: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#2a2010',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontSize: 15, fontFamily: 'Syne_800ExtraBold', color: SAND_LT },
  rowName: { fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold', color: INK },
  rowMeta: { fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', color: INK3, marginTop: 1 },
});

const ov = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  handle: {
    width: 40, height: 4, backgroundColor: 'rgba(26,20,8,0.15)',
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowLabel: { fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', color: INK },
  hint: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: INK3, lineHeight: 18, paddingBottom: 8 },
  confirmTitle: { fontSize: 20, fontFamily: 'Syne_800ExtraBold', color: INK, letterSpacing: -0.5, marginBottom: 6 },
  confirmSub: { fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', color: INK3, lineHeight: 20, marginBottom: 18 },
  confirmBtn: { backgroundColor: SAND, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  confirmBtnText: { fontSize: 14, fontFamily: 'Syne_800ExtraBold', color: '#ffffff', letterSpacing: -0.3 },
  cancelBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  cancelText: { fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK3 },
});
