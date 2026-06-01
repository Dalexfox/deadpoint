/**
 * Session Detail Screen
 * Opened when the user taps a climb card in My Climbs (or anywhere else a
 * session ID is available). Shows the full post — media, grade, gym, notes,
 * like toggle, and the comment thread — just like the feed card but as a
 * dedicated scrollable page.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Design tokens ────────────────────────────────────────────────────────────
const BG      = '#ffffff';
const CARD    = '#f4f1eb';
const SURFACE = '#ece8df';
const INK     = '#1a1408';
const INK2    = '#3d3320';
const INK3    = '#8a7a50';
const SAND    = '#c8a84a';
const SAND_LT = '#e8c87a';
const ACCENT  = '#e8383c';
const DIVIDER = 'rgba(26,20,8,0.08)';

const GYM_NAMES: Record<string, string> = {
  '1': 'Vital LES',
  '2': 'Vital Brooklyn',
  '3': 'Vital UES',
  '4': 'Vital UWS',
};

function toInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionDetail = {
  id:       string;
  userId:   string;
  gymName:  string;
  grade:    string | null;
  notes:    string | null;
  mediaUrl: string | null;
  date:     string;
  isVideo:  boolean;
};

type Poster = {
  fullName:  string;
  username:  string | null;
  avatarUrl: string | null;
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();

  const [loading,        setLoading]        = useState(true);
  const [session,        setSession]        = useState<SessionDetail | null>(null);
  const [poster,         setPoster]         = useState<Poster | null>(null);
  const [likeCount,      setLikeCount]      = useState(0);
  const [liked,          setLiked]          = useState(false);
  const [comments,       setComments]       = useState<CommentItem[]>([]);
  const [commentInput,   setCommentInput]   = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [currentUserId,  setCurrentUserId]  = useState<string | null>(null);

  const commentsScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!id) return;
    loadSession();
  }, [id]);

  async function loadSession() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const meId = user?.id ?? null;
      setCurrentUserId(meId);

      // Fetch session + climb in parallel with social data
      const [sessionRes, likesRes, commentsRes] = await Promise.all([
        supabase
          .from('sessions')
          .select('id, user_id, gym_id, media_url, notes, created_at, climbs(grade)')
          .eq('id', id)
          .single(),
        supabase
          .from('likes')
          .select('user_id')
          .eq('session_id', id),
        supabase
          .from('comments')
          .select('id, user_id, content, created_at')
          .eq('session_id', id)
          .order('created_at', { ascending: true }),
      ]);

      const s = sessionRes.data;
      if (!s) { setLoading(false); return; }

      // Fetch poster profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', s.user_id)
        .single();

      // Fetch commenter profiles
      const commentRows = commentsRes.data ?? [];
      const commenterIds = [...new Set(commentRows.map(c => c.user_id))];
      const { data: commenterProfiles } = commenterIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', commenterIds)
        : { data: [] };
      const profileMap = Object.fromEntries((commenterProfiles ?? []).map(p => [p.id, p]));

      const grade    = ((s.climbs ?? []) as { grade: string }[])[0]?.grade ?? null;
      const mediaUrl = s.media_url ?? null;
      const isVideo  = !!mediaUrl && /\.(mp4|mov|m4v|avi)$/i.test(mediaUrl);
      const date     = new Date(s.created_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      });

      setSession({
        id:       s.id,
        userId:   s.user_id,
        gymName:  GYM_NAMES[s.gym_id] ?? `Gym ${s.gym_id}`,
        grade,
        notes:    s.notes ?? null,
        mediaUrl,
        isVideo,
        date,
      });

      setPoster({
        fullName:  profileData?.full_name ?? 'Climber',
        username:  profileData?.username ?? null,
        avatarUrl: profileData?.avatar_url ?? null,
      });

      const likes = likesRes.data ?? [];
      setLikeCount(likes.length);
      setLiked(likes.some(l => l.user_id === meId));

      setComments(commentRows.map(c => {
        const p = profileMap[c.user_id] ?? {};
        return {
          id:        c.id,
          userId:    c.user_id,
          content:   c.content,
          createdAt: c.created_at,
          fullName:  p.full_name ?? 'Climber',
          username:  p.username ?? null,
          avatarUrl: p.avatar_url ?? null,
        };
      }));
    } finally {
      setLoading(false);
    }
  }

  async function handleLike() {
    if (!currentUserId || !session) return;
    const wasLiked = liked;
    // Optimistic update
    setLiked(!wasLiked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);

    if (wasLiked) {
      await supabase.from('likes')
        .delete()
        .eq('user_id', currentUserId)
        .eq('session_id', session.id);
    } else {
      await supabase.from('likes')
        .insert({ user_id: currentUserId, session_id: session.id });
    }
  }

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
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', currentUserId)
        .single();

      setComments(prev => [...prev, {
        id:        inserted.id,
        userId:    currentUserId,
        content:   inserted.content,
        createdAt: inserted.created_at,
        fullName:  me?.full_name ?? 'You',
        username:  me?.username ?? null,
        avatarUrl: me?.avatar_url ?? null,
      }]);

      setTimeout(() => commentsScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
    setSendingComment(false);
  }

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator color={SAND} />
      </View>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={s.root}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={INK} />
        </TouchableOpacity>
        <View style={s.loadingWrap}>
          <Text style={s.errorText}>Post not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initials = toInitials(poster?.fullName ?? '');

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={INK} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>POST</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          ref={commentsScrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* ── Media block ─────────────────────────────────────── */}
          <View style={s.mediaBlock}>
            {session.mediaUrl ? (
              session.isVideo ? (
                // Tap to play video in system player (Expo Go compatible)
                <TouchableOpacity
                  style={s.videoThumbWrap}
                  activeOpacity={0.85}
                  onPress={() => Linking.openURL(session.mediaUrl!)}>
                  <View style={s.videoPlaceholder}>
                    <LinearGradient
                      colors={['#2a2010', '#1a1408']}
                      style={StyleSheet.absoluteFill}
                    />
                    <Ionicons name="play-circle" size={64} color={SAND_LT} />
                    <Text style={s.videoPlayLabel}>Tap to play</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <Image
                  source={{ uri: session.mediaUrl }}
                  style={s.mediaImage}
                  resizeMode="cover"
                />
              )
            ) : (
              // No media — warm gradient placeholder
              <LinearGradient
                colors={['#2a2010', '#1a1408']}
                style={s.mediaPlaceholder}>
                <Text style={s.mediaPlaceholderEmoji}>🧗</Text>
              </LinearGradient>
            )}

            {/* Grade + gym stats bar — pinned to bottom of media */}
            <View style={s.statsBar}>
              <View style={s.statsLeft}>
                {session.grade && (
                  <>
                    <Text style={s.statsGrade}>{session.grade}</Text>
                    <Text style={s.statsGradeLabel}>GRADE</Text>
                  </>
                )}
              </View>
              <View style={s.statsDivider} />
              <Text style={s.statsGym} numberOfLines={1}>📍  {session.gymName}</Text>
            </View>
          </View>

          {/* ── Poster identity ─────────────────────────────────── */}
          <View style={s.identityRow}>
            {poster?.avatarUrl ? (
              <Image source={{ uri: poster.avatarUrl }} style={s.avatar} />
            ) : (
              <View style={s.avatarFallback}>
                <Text style={s.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={s.identityText}>
              <Text style={s.posterName}>{poster?.fullName ?? 'Climber'}</Text>
              {poster?.username && (
                <Text style={s.posterUsername}>@{poster.username}</Text>
              )}
            </View>
            <Text style={s.postDate}>{session.date}</Text>
          </View>

          {/* Notes */}
          {session.notes ? (
            <Text style={s.notes}>{session.notes}</Text>
          ) : null}

          {/* ── Like row ────────────────────────────────────────── */}
          <View style={s.likeRow}>
            <TouchableOpacity style={s.likeBtn} onPress={handleLike} activeOpacity={0.7}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={26}
                color={liked ? ACCENT : INK3}
              />
              <Text style={[s.likeCount, liked && s.likeCountActive]}>
                {likeCount}
              </Text>
            </TouchableOpacity>
            <View style={s.commentCountRow}>
              <Ionicons name="chatbubble-outline" size={22} color={INK3} />
              <Text style={s.commentCount}>{comments.length}</Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* ── Comments ────────────────────────────────────────── */}
          <View style={s.commentsSection}>
            {comments.length === 0 ? (
              <Text style={s.noComments}>No comments yet. Be the first!</Text>
            ) : (
              comments.map(c => (
                <View key={c.id} style={s.commentRow}>
                  {c.avatarUrl ? (
                    <Image source={{ uri: c.avatarUrl }} style={s.commentAvatar} />
                  ) : (
                    <View style={s.commentAvatarFallback}>
                      <Text style={s.commentAvatarInitials}>
                        {toInitials(c.fullName)}
                      </Text>
                    </View>
                  )}
                  <View style={s.commentBody}>
                    <Text style={s.commentName}>{c.fullName}</Text>
                    <Text style={s.commentText}>{c.content}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* ── Comment input ────────────────────────────────────── */}
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            value={commentInput}
            onChangeText={setCommentInput}
            placeholder="Add a comment…"
            placeholderTextColor={INK3}
            returnKeyType="send"
            onSubmitEditing={handleSendComment}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!commentInput.trim() || sendingComment) && s.sendBtnDisabled]}
            onPress={handleSendComment}
            activeOpacity={0.7}
            disabled={!commentInput.trim() || sendingComment}>
            <Ionicons name="arrow-up-circle" size={32} color={commentInput.trim() ? SAND : INK3} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
  },
  errorText: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 15,
    color: INK3,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
    backgroundColor: BG,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 14,
    letterSpacing: 2.5,
    color: INK,
  },

  scrollContent: {
    paddingBottom: 16,
  },

  // Media
  mediaBlock: {
    width: SCREEN_WIDTH,
    aspectRatio: 4 / 5,
    backgroundColor: '#1a1408',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPlaceholderEmoji: {
    fontSize: 64,
  },
  videoThumbWrap: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  videoPlayLabel: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },

  // Stats bar (grade + gym) over the bottom of the media
  statsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statsLeft: {
    alignItems: 'flex-start',
    minWidth: 60,
  },
  statsGrade: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 26,
    color: SAND_LT,
    lineHeight: 28,
  },
  statsGradeLabel: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 8,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.5,
  },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginHorizontal: 14,
  },
  statsGym: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    color: '#ffffff',
  },

  // Poster identity row
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: SURFACE,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#2a2010',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 16,
    color: SAND_LT,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  posterName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    color: INK,
  },
  posterUsername: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 13,
    color: INK3,
  },
  postDate: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 12,
    color: INK3,
  },

  // Notes
  notes: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    color: INK2,
    paddingHorizontal: 16,
    paddingBottom: 12,
    lineHeight: 20,
  },

  // Like row
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 20,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  likeCount: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    color: INK3,
  },
  likeCountActive: {
    color: ACCENT,
  },
  commentCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  commentCount: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    color: INK3,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: DIVIDER,
    marginHorizontal: 16,
    marginBottom: 16,
  },

  // Comments
  commentsSection: {
    paddingHorizontal: 16,
    gap: 16,
  },
  noComments: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    color: INK3,
    textAlign: 'center',
    paddingVertical: 20,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: SURFACE,
  },
  commentAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#2a2010',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarInitials: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 11,
    color: SAND_LT,
  },
  commentBody: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  commentName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    color: INK,
  },
  commentText: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    color: INK2,
    lineHeight: 19,
  },

  // Comment input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
    backgroundColor: BG,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    color: INK,
  },
  sendBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
