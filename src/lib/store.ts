import AsyncStorage from '@react-native-async-storage/async-storage';

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
