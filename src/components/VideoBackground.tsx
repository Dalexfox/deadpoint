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

export function VideoBackground({
  uri, isActive, muted = false, rate = 1,
}: { uri: string; isActive: boolean; muted?: boolean; rate?: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = muted;
  });

  // Play ONLY the active card; pause every other one — AND force-mute any card
  // that isn't active. expo-video's player.pause() alone did NOT reliably silence
  // a scrolled-away card in the production build (its audio kept playing under the
  // next card), so muting is the hard guarantee that an off-screen card can never
  // be heard. Effective mute = the user's mute OR "this isn't the active card".
  useEffect(() => {
    try {
      player.muted = muted || !isActive;
      if (isActive) player.play();
      else player.pause();
    } catch {}
  }, [isActive, muted, player]);

  // Playback speed — press-and-hold the feed card boosts this to 2× (TikTok-style).
  useEffect(() => {
    try { player.playbackRate = rate; } catch {}
  }, [rate, player]);

  // Hard stop on teardown — when a card scrolls out of the render window and
  // unmounts, expo-video otherwise keeps the player looping (and audible).
  useEffect(() => {
    return () => { try { player.pause(); player.muted = true; } catch {} };
  }, [player]);

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
