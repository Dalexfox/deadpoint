/**
 * VideoBackground — full-bleed inline video for feed cards + session detail.
 *
 * Uses expo-video (the supported replacement for the removed expo-av). Mounted
 * only for video posts, so a player is created only when there's actually a
 * video. Autoplays + loops while `isActive`, pauses otherwise — so in the feed
 * only the visible card's video plays, and in a group only the visible page.
 *
 * pointerEvents="none" wrapper so the card's overlays (like/comment/etc.) still
 * receive taps.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export function VideoBackground({ uri, isActive, muted = false }: { uri: string; isActive: boolean; muted?: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (isActive) player.play();
    else player.pause();
  }, [isActive, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
    </View>
  );
}
