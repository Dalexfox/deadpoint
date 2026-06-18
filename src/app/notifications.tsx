/**
 * Notifications / Activity — an in-app inbox of activity on YOUR content.
 * Derived entirely from existing tables (no notifications table):
 *   - likes on your sessions      → "@user liked your climb"  + post thumbnail
 *   - comments on your sessions   → "@user commented: …"       + post thumbnail
 *   - new followers (follows you) → "@user started following you" + Follow-back
 * Newest first. Tapping the avatar/name → that profile; tapping the thumbnail →
 * the post (/session/[id]). Opening this screen stamps NOTIF_LAST_SEEN_KEY so the
 * Profile bell's unread dot clears.
 */
import { useCallback, useState } from 'react';
import {
  View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { NOTIF_LAST_SEEN_KEY } from '../lib/store';

const BG      = '#ffffff';
const INK     = '#1a1408';
const INK2    = '#3d3320';
const INK3    = '#8a7a50';
const SAND    = '#c8a84a';
const SAND_LT = '#e8c87a';
const DIVIDER = 'rgba(26,20,8,0.08)';

const VIDEO_RE = /\.(mp4|mov|m4v|avi)$/i;

type Notif = {
  key:       string;
  type:      'like' | 'comment' | 'follow';
  actorId:   string;
  name:      string;
  username:  string | null;
  avatar:    string | null;
  sessionId?: string;
  thumb?:    string | null;
  content?:  string;
  createdAt: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1)  return 'now';
  if (mins < 60) return `${mins}m`;
  if (hrs < 24)  return `${hrs}h`;
  if (days < 7)  return `${days}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function toInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('') || '?';
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [loading, setLoading]             = useState(true);
  const [items, setItems]                 = useState<Notif[]>([]);
  const [meId, setMeId]                   = useState<string | null>(null);
  const [followingSet, setFollowingSet]   = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setItems([]); setLoading(false); return; }
      setMeId(user.id);
      // Stamp "seen" so the Profile bell's unread dot clears on next focus.
      AsyncStorage.setItem(NOTIF_LAST_SEEN_KEY, new Date().toISOString()).catch(() => {});

      const { data: mySessions } = await supabase
        .from('sessions').select('id, media_url').eq('user_id', user.id);
      const ids = (mySessions ?? []).map(s => s.id);
      const mediaBy: Record<string, string | null> =
        Object.fromEntries((mySessions ?? []).map(s => [s.id, s.media_url ?? null]));

      const [likesRes, commentsRes, followsRes, myFollowsRes] = await Promise.all([
        ids.length
          ? supabase.from('likes').select('user_id, session_id, created_at')
              .in('session_id', ids).neq('user_id', user.id).order('created_at', { ascending: false }).limit(60)
          : Promise.resolve({ data: [] as any[] }),
        ids.length
          ? supabase.from('comments').select('user_id, session_id, content, created_at')
              .in('session_id', ids).neq('user_id', user.id).order('created_at', { ascending: false }).limit(60)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('follows').select('follower_id, created_at')
          .eq('following_id', user.id).order('created_at', { ascending: false }).limit(60),
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
      ]);

      setFollowingSet(new Set((myFollowsRes.data ?? []).map((f: any) => f.following_id)));

      const actorIds = [...new Set([
        ...(likesRes.data ?? []).map((l: any) => l.user_id),
        ...(commentsRes.data ?? []).map((c: any) => c.user_id),
        ...(followsRes.data ?? []).map((f: any) => f.follower_id),
      ])];
      const { data: profs } = actorIds.length
        ? await supabase.from('profiles').select('id, username, full_name, avatar_url').in('id', actorIds)
        : { data: [] as any[] };
      const pm = new Map((profs ?? []).map((p: any) => [p.id, p]));

      const withActor = (actorId: string, base: Omit<Notif, 'name' | 'username' | 'avatar'>): Notif => {
        const p: any = pm.get(actorId);
        return { ...base, name: p?.full_name || p?.username || 'Climber', username: p?.username ?? null, avatar: p?.avatar_url ?? null };
      };

      const list: Notif[] = [];
      (likesRes.data ?? []).forEach((l: any, i: number) =>
        list.push(withActor(l.user_id, { key: `l-${l.session_id}-${l.user_id}-${i}`, type: 'like', actorId: l.user_id, sessionId: l.session_id, thumb: mediaBy[l.session_id] ?? null, createdAt: l.created_at })));
      (commentsRes.data ?? []).forEach((c: any, i: number) =>
        list.push(withActor(c.user_id, { key: `c-${c.session_id}-${c.user_id}-${i}`, type: 'comment', actorId: c.user_id, sessionId: c.session_id, thumb: mediaBy[c.session_id] ?? null, content: c.content, createdAt: c.created_at })));
      (followsRes.data ?? []).forEach((f: any, i: number) =>
        list.push(withActor(f.follower_id, { key: `f-${f.follower_id}-${i}`, type: 'follow', actorId: f.follower_id, createdAt: f.created_at })));

      list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const openActor = (id: string) => router.push(meId === id ? '/(tabs)/profile' : `/user/${id}`);

  const toggleFollow = async (id: string) => {
    if (!meId) return;
    const isFollowing = followingSet.has(id);
    setFollowingSet(prev => {
      const next = new Set(prev);
      if (isFollowing) next.delete(id); else next.add(id);
      return next;
    });
    try {
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', meId).eq('following_id', id);
      } else {
        await supabase.from('follows').insert({ follower_id: meId, following_id: id });
      }
    } catch {
      // revert on failure
      setFollowingSet(prev => {
        const next = new Set(prev);
        if (isFollowing) next.add(id); else next.delete(id);
        return next;
      });
    }
  };

  const renderThumb = (n: Notif) => {
    if (n.thumb && !VIDEO_RE.test(n.thumb)) {
      return <Image source={{ uri: n.thumb }} style={st.thumb} resizeMode="cover" />;
    }
    return (
      <View style={[st.thumb, st.thumbPlaceholder]}>
        <Ionicons name={n.thumb ? 'play' : 'triangle'} size={n.thumb ? 16 : 12} color={SAND_LT} />
      </View>
    );
  };

  const renderItem = ({ item }: { item: Notif }) => {
    const verb = item.type === 'like' ? ' liked your climb'
      : item.type === 'comment' ? ' commented'
      : ' started following you';
    return (
      <View style={st.row}>
        <TouchableOpacity
          style={st.left}
          activeOpacity={0.7}
          onPress={() => openActor(item.actorId)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={st.avatar} />
          ) : (
            <View style={[st.avatar, st.avatarFallback]}>
              <Text style={st.avatarInitials}>{toInitials(item.name)}</Text>
            </View>
          )}
          <View style={st.body}>
            <Text style={st.text} numberOfLines={2}>
              <Text style={st.name}>@{item.username ?? item.name}</Text>
              <Text style={st.verb}>{verb}</Text>
              {item.type === 'comment' && item.content ? (
                <Text style={st.comment}>{`: ${item.content}`}</Text>
              ) : null}
            </Text>
            <Text style={st.time}>{timeAgo(item.createdAt)}</Text>
          </View>
        </TouchableOpacity>

        {item.type === 'follow' ? (
          <TouchableOpacity
            style={[st.followBtn, followingSet.has(item.actorId) && st.followingBtn]}
            activeOpacity={0.8}
            onPress={() => toggleFollow(item.actorId)}>
            <Text style={[st.followText, followingSet.has(item.actorId) && st.followingText]}>
              {followingSet.has(item.actorId) ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity activeOpacity={0.8} onPress={() => item.sessionId && router.push(`/session/${item.sessionId}`)}>
            {renderThumb(item)}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={st.back}>‹</Text>
        </TouchableOpacity>
        <Text style={st.title}>Activity</Text>
        <View style={st.headerSpacer} />
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator color={SAND} /></View>
      ) : items.length === 0 ? (
        <View style={st.center}>
          <Ionicons name="notifications-outline" size={30} color={INK3} />
          <Text style={st.emptyTitle}>No activity yet</Text>
          <Text style={st.emptySub}>Likes, comments and new followers show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.key}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 4 }}
          ItemSeparatorComponent={() => <View style={st.sep} />}
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  back: { fontSize: 30, fontFamily: 'SpaceGrotesk_300Light', color: INK, lineHeight: 32, marginTop: -2 },
  title: { fontSize: 20, fontFamily: 'Syne_800ExtraBold', color: INK, letterSpacing: -0.5 },
  headerSpacer: { width: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontFamily: 'Syne_800ExtraBold', color: INK, marginTop: 4 },
  emptySub: { fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', color: INK3, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 12,
  },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2a2010' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 15, fontFamily: 'Syne_800ExtraBold', color: SAND_LT },
  body: { flex: 1 },
  text: { fontSize: 14, lineHeight: 19, color: INK2 },
  name: { fontFamily: 'SpaceGrotesk_700Bold', color: INK },
  verb: { fontFamily: 'SpaceGrotesk_400Regular', color: INK2 },
  comment: { fontFamily: 'SpaceGrotesk_400Regular', color: INK2 },
  time: { fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK3, marginTop: 2 },
  thumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#2a2010' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  followBtn: {
    backgroundColor: SAND,
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  followingBtn: { backgroundColor: '#ece8df', borderWidth: 0.5, borderColor: DIVIDER },
  followText: { fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold', color: '#ffffff' },
  followingText: { color: INK3 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: DIVIDER, marginLeft: 72 },
});
