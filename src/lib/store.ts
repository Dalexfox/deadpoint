import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const POSTS_KEY = 'deadpoint_user_posts';
const AVATAR_KEY = 'deadpoint_profile_avatar';

export type MediaItem = {
  type: 'image' | 'video';
  uri: string;
};

export type Post = {
  id: string;
  name: string;
  initials: string;
  avatarBg: string;
  avatarUrl?: string;     // public Supabase Storage URL — shows real photo in feed
  userId?: string;        // Supabase auth user ID — used for profile tap-through
  username?: string;      // @username string for display
  gymId?: string;         // raw gym_id for navigation to /gym/[id]
  topGrade?: string;       // grade from climbs[0].grade — every session is one climb
  climbNickname?: string;  // custom_name from the linked problem row, if set
  climbNotes?: string;     // notes entered on the log screen
  timestamp: string;
  likes: number;
  comments: number;
  liked: boolean;
  media?: MediaItem[];
  postType?: 'session' | 'photo';
  gym?: string;
};

// ─── Posts ────────────────────────────────────────────────────

export async function getUserPosts(): Promise<Post[]> {
  try {
    const raw = await AsyncStorage.getItem(POSTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveUserPost(post: Post): Promise<void> {
  try {
    const existing = await getUserPosts();
    await AsyncStorage.setItem(POSTS_KEY, JSON.stringify([post, ...existing]));
  } catch {
    // fail silently for now
  }
}

export async function togglePostLike(
  posts: Post[],
  postId: string
): Promise<Post[]> {
  return posts.map((p) =>
    p.id === postId
      ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
      : p
  );
}

// ─── Profile avatar ───────────────────────────────────────────

export async function getProfileAvatar(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AVATAR_KEY);
  } catch {
    return null;
  }
}

export async function saveProfileAvatar(uri: string): Promise<void> {
  try {
    await AsyncStorage.setItem(AVATAR_KEY, uri);
  } catch {
    // fail silently for now
  }
}

// ─── Profile avatar upload ────────────────────────────────────
// Uploads the avatar to Supabase Storage, writes the public URL to
// profiles.avatar_url, and caches it in AsyncStorage for fast local loads.
// Always writes to the same path (avatars/{userId}.jpg) so it self-overwrites.

export async function uploadProfileAvatar(uri: string): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const path = `avatars/${user.id}.jpg`;
    const contentType = 'image/jpeg';

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const arrayBuffer = decode(base64);

    const { error } = await supabase.storage
      .from('session-media')
      .upload(path, arrayBuffer, { contentType, upsert: true });

    if (error) throw error;

    const { data } = supabase.storage
      .from('session-media')
      .getPublicUrl(path);

    const publicUrl = data.publicUrl;

    // Write the public URL to the profiles table so the feed can display it
    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    // Cache in AsyncStorage so the profile screen loads it instantly on next open
    await AsyncStorage.setItem(AVATAR_KEY, publicUrl);

    return publicUrl;
  } catch (err) {
    console.log('[uploadProfileAvatar] Error:', err);
    return null;
  }
}

// ─── Profile banner ───────────────────────────────────────────

const BANNER_KEY = 'deadpoint_profile_banner';

export async function getProfileBanner(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(BANNER_KEY);
  } catch {
    return null;
  }
}

export async function saveProfileBanner(uri: string): Promise<void> {
  try {
    await AsyncStorage.setItem(BANNER_KEY, uri);
  } catch {
    // fail silently for now
  }
}

// ─── Session media upload ─────────────────────────────────────
// Uploads a local file URI to the 'session-media' Supabase Storage bucket
// and returns the public URL. Returns null (silently) on failure so the
// session can still be saved even if the upload fails.

export async function uploadSessionMedia(
  uri: string,
  mediaType: 'image' | 'video'
): Promise<string | null> {
  try {
    // Get the logged-in user so we can namespace the file path by user ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Pull the extension from the local URI (e.g. "jpg", "mp4")
    const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase()
      ?? (mediaType === 'video' ? 'mp4' : 'jpg');

    // Use a timestamp so the filename is unique on every upload
    const path = `${user.id}/${Date.now()}.${ext}`;
    const contentType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';

    console.log('[uploadSessionMedia] Uploading file:', { uri, path, contentType });

    // Read the file as base64, then decode to an ArrayBuffer using
    // base64-arraybuffer — more reliable than atob() in React Native/Hermes.
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const arrayBuffer = decode(base64);

    const { error } = await supabase.storage
      .from('session-media')
      .upload(path, arrayBuffer, { contentType, upsert: true });

    if (error) {
      console.log('[uploadSessionMedia] Supabase Storage upload error:', error);
      throw error;
    }

    console.log('[uploadSessionMedia] Upload succeeded for path:', path);

    // Return the permanent public URL for the uploaded file
    const { data } = supabase.storage
      .from('session-media')
      .getPublicUrl(path);

    console.log('[uploadSessionMedia] Final media_url to save:', data.publicUrl);

    return data.publicUrl;
  } catch (err) {
    console.log('[uploadSessionMedia] Caught error (returning null):', err);
    return null;
  }
}
