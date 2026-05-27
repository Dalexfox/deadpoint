import AsyncStorage from '@react-native-async-storage/async-storage';
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
  timestamp: string;
  likes: number;
  comments: number;
  liked: boolean;
  media?: MediaItem[];
  // Session posts
  postType?: 'session' | 'photo';
  gym?: string;
  problems?: number;
  difficulty?: string;
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

    // Fetch the local file as a Blob, then upload to Supabase Storage
    const response = await fetch(uri);
    const blob = await response.blob();

    const { error } = await supabase.storage
      .from('session-media')
      .upload(path, blob, { contentType });

    if (error) throw error;

    // Return the permanent public URL for the uploaded file
    const { data } = supabase.storage
      .from('session-media')
      .getPublicUrl(path);

    return data.publicUrl;
  } catch {
    // Fail silently — caller decides whether to surface an error
    return null;
  }
}
