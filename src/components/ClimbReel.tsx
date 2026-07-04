/**
 * ClimbReel — full-screen, vertically-swipeable immersive viewer for ONE grade's
 * logged climbs at a gym. Opened by tapping a card in the Current Climbs grid; you
 * swipe up/down through every send at that grade. Each page is a full-bleed media
 * card (video autoplays only while it's the active page, via the shared
 * VideoBackground). Tap a card to open the full post (/session/[id]) for
 * likes / comments / share. Read-only here — it's a browse/watch surface.
 */
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { VideoBackground } from './VideoBackground';

const SAND_LT  = '#e8c87a';
const VIDEO_RE = /\.(mp4|mov|m4v|avi)$/i;
const { width: SCREEN_W } = Dimensions.get('window');

export type ReelSession = {
  id: string;
  media_url: string | null;
  created_at: string;
  grade: string;
  likeCount: number;
  profile: { full_name: string; username: string | null; avatar_url: string | null } | null;
};

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ClimbReel({
  visible, gymName, sessions, startIndex, onClose, suspended = false,
}: {
  visible: boolean;
  gymName: string;
  sessions: ReelSession[];
  startIndex: number;
  onClose: () => void;
  /** True while a route (e.g. /session/[id]) is pushed over the host screen —
      the reel stays mounted but its video must go silent underneath. */
  suspended?: boolean;
}) {
  const router = useRouter();
  const [height, setHeight] = useState(0);
  const [active, setActive] = useState(startIndex);
  const [muted, setMuted]   = useState(false);

  // Stable refs (RN throws if onViewableItemsChanged / viewabilityConfig change).
  const onViewRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const idx = viewableItems[0]?.index;
    if (idx != null) setActive(idx);
  });
  const viewCfgRef = useRef({ itemVisiblePercentThreshold: 60 });

  const safeStart = Math.min(Math.max(0, startIndex), Math.max(0, sessions.length - 1));
  const activeSrc = sessions[active]?.media_url ?? null;
  const activeIsVideo = !!activeSrc && VIDEO_RE.test(activeSrc);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={st.container} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {height > 0 && (
          <FlatList
            data={sessions}
            // Re-render pages when the active page, mute, or suspension changes —
            // otherwise the page you scroll away from (or push a route over)
            // keeps isActive=true and its audio plays on.
            extraData={`${active}|${muted}|${suspended}`}
            keyExtractor={(s) => s.id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            initialScrollIndex={safeStart}
            getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
            onViewableItemsChanged={onViewRef.current}
            viewabilityConfig={viewCfgRef.current}
            renderItem={({ item, index }) => {
              const isVideo = !!item.media_url && VIDEO_RE.test(item.media_url);
              const handle = item.profile?.username
                ? `@${item.profile.username}`
                : (item.profile?.full_name || 'Climber');
              return (
                <Pressable style={{ width: SCREEN_W, height }} onPress={() => router.push(`/session/${item.id}`)}>
                  {/* Background */}
                  {item.media_url ? (
                    isVideo ? (
                      <VideoBackground uri={item.media_url} isActive={visible && !suspended && index === active} muted={muted} />
                    ) : (
                      <Image source={{ uri: item.media_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    )
                  ) : (
                    <LinearGradient colors={['#2a2010', '#1a1408']} style={StyleSheet.absoluteFill} />
                  )}

                  {/* Bottom scrim for legibility */}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.78)']}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />

                  {/* Info overlay */}
                  <View style={st.info} pointerEvents="none">
                    <Text style={st.grade}>{item.grade}</Text>
                    <Text style={st.handle} numberOfLines={1}>{handle}</Text>
                    <Text style={st.meta} numberOfLines={1}>{gymName} · {fmtDate(item.created_at)}</Text>
                  </View>

                  {/* Right rail — like count + open hint */}
                  <View style={st.rail} pointerEvents="none">
                    <Text style={st.like}>♥ {item.likeCount}</Text>
                    <Text style={st.openHint}>Tap to open</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {/* Top bar — close + (video) mute */}
        <SafeAreaView edges={['top']} style={st.topBar}>
          <TouchableOpacity style={st.iconBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
            <Ionicons name="close" size={26} color="#ffffff" />
          </TouchableOpacity>
          {activeIsVideo && (
            <TouchableOpacity style={st.iconBtn} onPress={() => setMuted((m) => !m)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
              <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#ffffff" />
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    zIndex: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { position: 'absolute', left: 16, right: 80, bottom: 40, gap: 3 },
  grade:  { fontSize: 30, fontFamily: 'Syne_800ExtraBold', color: SAND_LT, letterSpacing: -0.5 },
  handle: { fontSize: 17, fontFamily: 'Syne_800ExtraBold', color: '#ffffff' },
  meta:   { fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', color: 'rgba(255,255,255,0.75)' },
  rail:   { position: 'absolute', right: 16, bottom: 40, alignItems: 'center', gap: 4 },
  like:   { fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold', color: '#ffffff' },
  openHint: { fontSize: 10, fontFamily: 'SpaceGrotesk_600SemiBold', color: 'rgba(255,255,255,0.6)' },
});
