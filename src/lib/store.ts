import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

const POSTS_KEY = 'deadpoint_user_posts';
const AVATAR_KEY = 'deadpoint_profile_avatar';
const BANNER_KEY = 'deadpoint_profile_banner';

// Timestamp the user last opened the Notifications screen — drives the unread dot.
export const NOTIF_LAST_SEEN_KEY = 'deadpoint_notif_last_seen';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = 'session-media';

// Result of an upload: the public URL on success, or a human-readable reason on
// failure. The reason is surfaced to the user so a rejected upload (e.g. a video
// over the bucket's file-size limit, or a disallowed MIME type) is never silent.
export type UploadResult = { url: string | null; error: string | null };

/**
 * Streaming binary upload to Supabase Storage via expo-file-system's uploadAsync.
 * The file is streamed straight to the storage REST endpoint — it is NEVER read
 * into JS memory — so this works for large videos where the old
 * base64 → ArrayBuffer path failed/ran out of memory.
 * Returns { url } on success or { error } on failure (best-effort, never throws).
 */
async function uploadFileToStorage(localUri: string, path: string, contentType: string): Promise<UploadResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? SUPABASE_ANON_KEY;
    const endpoint = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;

    const res = await FileSystem.uploadAsync(endpoint, localUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': contentType,
        'x-upsert': 'true',          // overwrite if the path already exists (avatars/banners)
        'cache-control': '3600',
      },
    });

    if (res.status !== 200 && res.status !== 201) {
      // Common cases: 413 = file too large (bucket file-size limit), 400 = MIME
      // type not allowed, 403 = auth/RLS. Surface the status so it's diagnosable.
      const snippet = res.body?.slice(0, 200)?.replace(/\s+/g, ' ').trim();
      const error = `Upload failed (${res.status})${snippet ? `: ${snippet}` : ''}`;
      console.log('[uploadFileToStorage]', error);
      return { url: null, error };
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  } catch (err) {
    const error = `Upload error: ${err instanceof Error ? err.message : String(err)}`;
    console.log('[uploadFileToStorage]', error);
    return { url: null, error };
  }
}

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
  problemId?: string;      // problem_id from climbs[0] — used to recompute cover after a visibility change
  visibility?: 'public' | 'quiet';  // session visibility; quiet = only the owner sees it
  feedRank?: number | null;         // sessions.feed_rank — user's custom order within a same-day group
  solo?: boolean;                   // sessions.solo — true = never folded into a group; always its own card
  coSessionId?: string | null;      // sessions.co_session_id — combined with a friend's send into one co-session
  sendStyle?: 'flash' | 'send' | 'project';  // optional per-climb send-style tag; absent = not set
  climbNickname?: string;  // custom_name from the linked problem row, if set
  climbNotes?: string;     // notes entered on the log screen
  createdAt?: string;      // raw sessions.created_at ISO — used for same-day grouping
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
// ⚠️ Path is UNDER the user's own folder ({userId}/avatar.jpg) — the SAME folder
// session media uses — so it passes the bucket's per-user upload policy. A
// top-level `avatars/` path is rejected by a "first folder = your id" storage RLS
// policy (403), which was the silent "profile photo couldn't save". Returns the
// error string on failure so the caller can show the real reason.

export async function uploadProfileAvatar(uri: string): Promise<UploadResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { url: null, error: 'Not signed in' };

    // Stable name (always overwritten via x-upsert). Append ?v=timestamp to the
    // saved URL so the new image isn't masked by a cached copy of the same URL.
    const { url: publicUrl, error } = await uploadFileToStorage(uri, `${user.id}/avatar.jpg`, 'image/jpeg');
    if (!publicUrl) return { url: null, error };
    const bustedUrl = `${publicUrl}?v=${Date.now()}`;

    // Persist to profiles so the feed/other users see it, and cache locally.
    await supabase.from('profiles').update({ avatar_url: bustedUrl }).eq('id', user.id);
    await AsyncStorage.setItem(AVATAR_KEY, bustedUrl);

    return { url: bustedUrl, error: null };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Profile banner upload ────────────────────────────────────
// Uploads the banner to Storage and caches its PUBLIC URL (not the transient
// local file path, which iOS deletes — that was the "banner reverts" bug).
// Banner stays device-local (AsyncStorage) like before; it's just a durable URL now.

export async function uploadProfileBanner(uri: string): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Under the user's own folder (see uploadProfileAvatar) so it passes the
    // bucket's per-user upload policy — a top-level banners/ path is rejected.
    const { url: publicUrl } = await uploadFileToStorage(uri, `${user.id}/banner.jpg`, 'image/jpeg');
    if (!publicUrl) return null;
    const bustedUrl = `${publicUrl}?v=${Date.now()}`;

    await AsyncStorage.setItem(BANNER_KEY, bustedUrl);
    return bustedUrl;
  } catch (err) {
    console.log('[uploadProfileBanner] Error:', err);
    return null;
  }
}

// ─── Profile banner ───────────────────────────────────────────

export async function getProfileBanner(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(BANNER_KEY);
  } catch {
    return null;
  }
}

// ─── Session media upload ─────────────────────────────────────
// Uploads a local file URI to the 'session-media' Supabase Storage bucket.
// Returns { url } on success or { error } on failure — the caller surfaces the
// error so a rejected upload (oversized video, disallowed MIME) isn't silent.

export async function uploadSessionMedia(
  uri: string,
  mediaType: 'image' | 'video'
): Promise<UploadResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { url: null, error: 'Not signed in' };

  // Derive a sensible extension. CRITICAL for video: the feed/session screens
  // detect video by the URL extension (/\.(mp4|mov|m4v|avi)$/i), so a video
  // MUST land on a video extension or it renders as a (broken) image.
  const rawExt = uri.split('.').pop()?.split('?')[0]?.toLowerCase();
  let ext: string;
  let contentType: string;
  if (mediaType === 'video') {
    ext = rawExt && /^(mp4|mov|m4v|avi)$/.test(rawExt) ? rawExt : 'mp4';
    contentType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
  } else {
    ext = rawExt && /^(jpg|jpeg|png|heic|webp)$/.test(rawExt) ? rawExt : 'jpg';
    contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  }

  const path = `${user.id}/${Date.now()}.${ext}`;
  return uploadFileToStorage(uri, path, contentType);
}

// ─── Problem start-hold reference photo ───────────────────────
// The first logger's recognition photo (with the tapped start hold) becomes the
// problem's identity image. Stored at problems/{problemId}.jpg → start_photo_url.

export async function uploadProblemStartPhoto(uri: string, problemId: string): Promise<string | null> {
  return (await uploadFileToStorage(uri, `problems/${problemId}.jpg`, 'image/jpeg')).url;
}
