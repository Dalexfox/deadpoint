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
  Dimensions,
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

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

const GYM_NAMES: Record<string, string> = {
  '1': 'Vital LES',
  '2': 'Vital Brooklyn',
  '3': 'Vital UES',
  '4': 'Vital UWS',
};

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
  id:       string;
  userId:   string;
  gymId:    string;
  gymName:  string;
  grade:    string | null;
  mediaUrl: string | null;
  isVideo:  boolean;
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
          .select('id, user_id, gym_id, media_url, climbs(grade)')
          .eq('id', id)
          .single(),
        supabase.from('likes').select('user_id').eq('session_id', id),
        supabase.from('comments').select('*', { count: 'exact', head: true }).eq('session_id', id),
      ]);

      const s = sessionRes.data;
      if (!s) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', s.user_id)
        .single();

      const grade    = ((s.climbs ?? []) as { grade: string }[])[0]?.grade ?? null;
      const mediaUrl = s.media_url ?? null;

      setSession({
        id:       s.id,
        userId:   s.user_id,
        gymId:    s.gym_id,
        gymName:  GYM_NAMES[s.gym_id] ?? `Gym ${s.gym_id}`,
        grade,
        mediaUrl,
        isVideo:  !!mediaUrl && /\.(mp4|mov|m4v|avi)$/i.test(mediaUrl),
      });
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

  // ── Share ──────────────────────────────────────────────────────────────────
  function handleShare() {
    const name = posterUsername ? `@${posterUsername}` : posterName;
    Share.share({
      message: `Check out ${name}'s climb on Deadpoint!`,
    });
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
        <Image
          source={{ uri: session.mediaUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={['#2a2010', '#1a1408']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      )}

      {/* ── Bottom vignette ──────────────────────────────────────────────── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.78)']}
        style={[StyleSheet.absoluteFill, { top: cardH * 0.42 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />

      {/* ── Close button (top-left) ───────────────────────────────────────── */}
      <TouchableOpacity
        style={[st.closeBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        activeOpacity={0.7}>
        <Ionicons name="close" size={24} color="#ffffff" />
      </TouchableOpacity>

      {/* ── Right action rail ─────────────────────────────────────────────── */}
      <View style={[st.rail, { bottom: STATS_BAR_H + 20 }]}>

        {/* Avatar */}
        <View style={st.railItem}>
          <View style={st.avatarRing}>
            {posterAvatar ? (
              <Image source={{ uri: posterAvatar }} style={st.railAvatar} />
            ) : (
              <View style={[st.railAvatar, st.railAvatarFallback]}>
                <Text style={st.railAvatarText}>{initials}</Text>
              </View>
            )}
          </View>
        </View>

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

      {/* ── Bottom-left username ──────────────────────────────────────────── */}
      <View style={[st.bottomInfo, { bottom: STATS_BAR_H + 16 }]}>
        <Text style={st.username}>{displayName}</Text>
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
