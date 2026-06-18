/**
 * ShareCardSheet — full-screen preview + share flow for a climb's ShareCard.
 *
 * Flow: resolve the still (photo URI as-is, or a frame pulled from a video via
 * expo-video-thumbnails; media-less → branded card), prefetch it so the capture
 * isn't blank, preview the ShareCard, then on Share capture it with
 * react-native-view-shot and hand the image to the native share sheet
 * (expo-sharing → Instagram story/feed, Messages, Save to Photos, …).
 *
 * Used by the feed + session detail share buttons.
 */
import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, Image, TouchableOpacity, StyleSheet, ActivityIndicator,
  useWindowDimensions, Alert, Share as RNShare,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { ShareCard, type ShareCardData } from './ShareCard';

const NEAR_BLACK = '#0d0a05';
const SAND       = '#c8a84a';

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
  const [still, setStill]         = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [sharing, setSharing]     = useState(false);

  const cardWidth = Math.min(winW - 56, 320);

  // Resolve + preload the still each time the sheet opens.
  useEffect(() => {
    if (!visible || !input) return;
    let active = true;
    setPreparing(true);
    setStill(null);
    (async () => {
      let uri: string | null = input.mediaUri;
      if (input.mediaUri && input.isVideo) {
        try {
          const { uri: thumb } = await VideoThumbnails.getThumbnailAsync(input.mediaUri, { time: 1000, quality: 0.9 });
          uri = thumb;
        } catch {
          uri = null; // fall back to the branded (media-less) card
        }
      }
      // Prefetch remote images so the captured card isn't blank.
      if (uri && /^https?:/.test(uri)) {
        try { await Image.prefetch(uri); } catch { /* non-fatal */ }
      }
      if (active) { setStill(uri); setPreparing(false); }
    })();
    return () => { active = false; };
  }, [visible, input]);

  const cardData: ShareCardData | null = input
    ? { grade: input.grade, gym: input.gym, date: input.date, username: input.username, stillUri: still }
    : null;

  const handleShare = async () => {
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

        <View style={st.footer}>
          <TouchableOpacity
            style={[st.shareBtn, (preparing || sharing) && st.shareBtnDisabled]}
            disabled={preparing || sharing}
            onPress={handleShare}
            activeOpacity={0.85}>
            {sharing ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="share-outline" size={18} color="#ffffff" />
                <Text style={st.shareText}>Share</Text>
              </>
            )}
          </TouchableOpacity>
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
  preview: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardLoading: {
    borderRadius: 18,
    backgroundColor: '#1a1408',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  shareBtnDisabled: { opacity: 0.6 },
  shareText: { fontSize: 15, fontFamily: 'Syne_800ExtraBold', color: '#ffffff', letterSpacing: -0.3 },
  hint: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginTop: 10,
  },
});
