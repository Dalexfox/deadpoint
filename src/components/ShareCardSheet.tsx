/**
 * ShareCardSheet — preview + share flow for a climb's ShareCard.
 *
 * - Image post  → the photo is the card's hero.
 * - Video post  → sample frames across the clip into a filmstrip; the user taps
 *                 which frame becomes the cover (Instagram-style). They can also
 *                 "Share full video" (downloads the clip → native share sheet so it
 *                 plays for the audience).
 * - No media    → branded gradient card.
 *
 * "Share card" captures the branded still (react-native-view-shot) → expo-sharing.
 * Frames via expo-video-thumbnails (local files → instant in <Image>).
 */
import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, Image, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, useWindowDimensions, Alert, Share as RNShare,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import { ShareCard, type ShareCardData } from './ShareCard';

const NEAR_BLACK = '#0d0a05';
const SAND       = '#c8a84a';

// Sample points across a clip for the cover filmstrip. Out-of-range times just
// throw and are dropped, so short clips simply yield fewer frames.
const FRAME_TIMES_MS = [300, 1000, 2500, 5000, 9000, 15000];

export type ShareInput = {
  grade: string;
  gym: string;
  date: string;
  username: string | null;
  mediaUri: string | null;
  isVideo: boolean;
};

export function ShareCardSheet({
  visible, input, onClose,
}: {
  visible: boolean;
  input: ShareInput | null;
  onClose: () => void;
}) {
  const { width: winW } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const cardWidth = Math.min(winW - 64, 300);
  const isVideo = !!(input?.isVideo && input?.mediaUri);

  const [frames, setFrames]           = useState<string[]>([]);   // filmstrip (video only)
  const [selected, setSelected]       = useState<string | null>(null); // chosen hero still
  const [preparing, setPreparing]     = useState(true);
  const [sharing, setSharing]         = useState(false);
  const [sharingVideo, setSharingVideo] = useState(false);

  useEffect(() => {
    if (!visible || !input) return;
    let active = true;
    setPreparing(true); setFrames([]); setSelected(null); setSharing(false); setSharingVideo(false);
    (async () => {
      if (!isVideo) {
        // Image (or media-less): use it as-is. Prefetch so the capture isn't blank.
        const uri = input.mediaUri ?? null;
        if (uri && /^https?:/.test(uri)) { try { await Image.prefetch(uri); } catch { /* non-fatal */ } }
        if (active) { setSelected(uri); setPreparing(false); }
        return;
      }
      // Video: sample frames across the clip (parallel), keep the ones that succeed.
      const results = await Promise.all(FRAME_TIMES_MS.map(async (t) => {
        try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(input.mediaUri!, { time: t, quality: 0.85 });
          return uri;
        } catch { return null; }
      }));
      const uris = results.filter(Boolean) as string[];
      if (!active) return;
      setFrames(uris);
      setSelected(uris[0] ?? null);
      setPreparing(false);
    })();
    return () => { active = false; };
  }, [visible, input, isVideo]);

  const cardData: ShareCardData | null = input
    ? { grade: input.grade, gym: input.gym, date: input.date, username: input.username, stillUri: selected }
    : null;

  const handleShareCard = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'jpg', quality: 0.95 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: 'Share your send' });
      } else {
        await RNShare.share({ url: uri });
      }
    } catch (e: any) {
      Alert.alert('Could not create the card', e?.message ?? 'Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const handleShareVideo = async () => {
    if (!input?.mediaUri) return;
    setSharingVideo(true);
    try {
      // expo-sharing needs a local file, so download the clip first.
      const ext = (input.mediaUri.split('.').pop()?.split('?')[0] || 'mp4').toLowerCase();
      const local = `${FileSystem.cacheDirectory}deadpoint-share.${ext}`;
      const { uri } = await FileSystem.downloadAsync(input.mediaUri, local);
      const mime = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: 'Share your send' });
      } else {
        await RNShare.share({ url: uri });
      }
    } catch (e: any) {
      Alert.alert('Could not share the video', e?.message ?? 'Please try again.');
    } finally {
      setSharingVideo(false);
    }
  };

  const busy = sharing || sharingVideo;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={st.container} edges={['top', 'bottom']}>
        <View style={st.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color="#ffffff" />
          </TouchableOpacity>
          <Text style={st.title}>Share your send</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={st.preview}>
          {preparing ? (
            <View style={[st.cardLoading, { width: cardWidth, height: Math.round(cardWidth * 1.25) }]}>
              <ActivityIndicator color={SAND} />
            </View>
          ) : cardData ? (
            <ShareCard ref={cardRef} data={cardData} width={cardWidth} />
          ) : null}
        </View>

        {/* Cover picker — video only, when we got more than one frame */}
        {!preparing && isVideo && frames.length > 1 && (
          <View style={st.stripWrap}>
            <Text style={st.stripLabel}>CHOOSE YOUR COVER</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.strip}>
              {frames.map((f) => {
                const active = f === selected;
                return (
                  <TouchableOpacity key={f} activeOpacity={0.8} onPress={() => setSelected(f)} style={[st.frame, active && st.frameActive]}>
                    <Image source={{ uri: f }} style={st.frameImg} resizeMode="cover" />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={st.footer}>
          <TouchableOpacity
            style={[st.shareBtn, (preparing || busy) && st.disabled]}
            disabled={preparing || busy}
            onPress={handleShareCard}
            activeOpacity={0.85}>
            {sharing ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="share-outline" size={18} color="#ffffff" />
                <Text style={st.shareText}>Share card</Text>
              </>
            )}
          </TouchableOpacity>

          {isVideo && (
            <TouchableOpacity
              style={[st.videoBtn, busy && st.disabled]}
              disabled={busy}
              onPress={handleShareVideo}
              activeOpacity={0.7}>
              {sharingVideo ? (
                <ActivityIndicator color={SAND} />
              ) : (
                <Text style={st.videoText}>Share full video instead</Text>
              )}
            </TouchableOpacity>
          )}

          <Text style={st.hint}>Post to your story, send to a friend, or save to Photos.</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: NEAR_BLACK },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  title: { fontSize: 16, fontFamily: 'Syne_800ExtraBold', color: '#ffffff', letterSpacing: -0.3 },
  preview: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  cardLoading: {
    borderRadius: 18,
    backgroundColor: '#1a1408',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripWrap: { paddingTop: 4, paddingBottom: 8 },
  stripLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 8,
  },
  strip: { paddingHorizontal: 18, gap: 8 },
  frame: {
    width: 52,
    height: 65,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  frameActive: { borderColor: SAND },
  frameImg: { width: '100%', height: '100%' },
  footer: { paddingHorizontal: 24, paddingBottom: 8 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SAND,
    borderRadius: 14,
    paddingVertical: 16,
  },
  videoBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  videoText: { fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold', color: SAND },
  disabled: { opacity: 0.6 },
  shareText: { fontSize: 15, fontFamily: 'Syne_800ExtraBold', color: '#ffffff', letterSpacing: -0.3 },
  hint: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginTop: 10,
  },
});
