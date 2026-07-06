/**
 * ClimbThumb — the cover thumbnail for a climb card in the My Climbs / profile
 * grids. Handles all three media cases so a card is NEVER blank:
 *   • photo  → the image
 *   • video  → a frame grabbed with expo-video-thumbnails (cached per URL) + a ▶
 *              badge; a branded placeholder shows while it generates / if it fails
 *   • none   → the 🧗 placeholder
 *
 * Why this exists: a grid `<Image>` can't render a video URL, so video climbs
 * showed NO cover (blank). Generating a poster at upload time would be the
 * longer-term fix; this fixes existing + new videos with no schema change.
 */
import { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';

const VIDEO_RE = /\.(mp4|mov|m4v|avi)$/i;
const SAND_LT = '#e8c87a';

// Cache generated frames per video URL so revisits / re-renders are instant.
const thumbCache = new Map<string, string>();

export function ClimbThumb({
  uri,
  posterUri,
  grade,
  style,
}: {
  uri: string | null;
  /** Pre-generated cover uploaded at log time (sessions.media_poster_url).
      When present, NO on-device frame generation happens — generating a frame
      from a REMOTE 50–300MB clip requires downloading huge chunks (the moov
      index often sits at the file's end), which stalls/fails on gym Wi-Fi.
      That was the "media doesn't show in Current Climbs" bug on build #27. */
  posterUri?: string | null;
  grade?: string | null;
  style: StyleProp<ViewStyle>;
}) {
  const isVideo = !!uri && VIDEO_RE.test(uri);
  const [thumb, setThumb] = useState<string | null>(
    isVideo && uri ? (posterUri ?? thumbCache.get(uri) ?? null) : null,
  );

  useEffect(() => {
    if (!isVideo || !uri) return;
    if (posterUri) { setThumb(posterUri); return; }
    if (thumbCache.has(uri)) return;
    let active = true;
    VideoThumbnails.getThumbnailAsync(uri, { time: 500, quality: 0.7 })
      .then((res) => {
        thumbCache.set(uri, res.uri);
        if (active) setThumb(res.uri);
      })
      .catch(() => { /* keep the placeholder */ });
    return () => { active = false; };
  }, [uri, isVideo, posterUri]);

  // Photo → just the image (wrapped in a View so `style` is always a ViewStyle).
  if (uri && !isVideo) {
    return (
      <View style={style}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </View>
    );
  }

  // Video with a ready frame → frame + play badge.
  if (isVideo && thumb) {
    return (
      <View style={style}>
        <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={st.playBadge}><Ionicons name="play" size={10} color="#ffffff" /></View>
      </View>
    );
  }

  // Video still generating (or it failed), or no media at all → placeholder.
  return (
    <View style={[style, isVideo ? st.videoPlaceholder : st.emptyPlaceholder]}>
      {isVideo
        ? <Text style={st.grade}>{grade ?? ''}</Text>
        : <Text style={st.icon}>🧗</Text>}
      {isVideo && <View style={st.playBadge}><Ionicons name="play" size={10} color="#ffffff" /></View>}
    </View>
  );
}

const st = StyleSheet.create({
  videoPlaceholder: { backgroundColor: '#2a2010', alignItems: 'center', justifyContent: 'center' },
  emptyPlaceholder: { backgroundColor: '#ece8df', alignItems: 'center', justifyContent: 'center' },
  grade: { fontFamily: 'Syne_800ExtraBold', fontSize: 20, color: SAND_LT },
  icon: { fontSize: 22 },
  playBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
