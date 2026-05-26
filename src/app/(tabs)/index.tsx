import { useCallback, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { getUserPosts, togglePostLike, type Post } from '../../lib/store';

const BG = '#0c1e21';
const CARD = '#142829';
const SURFACE = '#1a3235';
const ACCENT = '#ff507c';
const TEAL = '#4da8ae';
const TEXT = '#ffffff';
const TEXT_SUB = '#7ab4b8';
const TEXT_MUTED = '#3d6b6f';
const DIVIDER = '#1e3840';

const PLACEHOLDER_POSTS: Post[] = [
  {
    id: 'p1',
    name: 'Alex Chen',
    initials: 'AC',
    avatarBg: '#1a4a4e',
    gym: 'Vital Climbing LES',
    problems: 14,
    difficulty: 'V4 – V6',
    timestamp: '2h ago',
    likes: 31,
    comments: 4,
    liked: false,
    postType: 'session',
  },
  {
    id: 'p2',
    name: 'Sarah Park',
    initials: 'SP',
    avatarBg: '#1a3a4a',
    gym: 'Brooklyn Boulders Queensbridge',
    problems: 8,
    difficulty: 'V7 – V8',
    timestamp: '5h ago',
    likes: 58,
    comments: 11,
    liked: true,
    postType: 'session',
  },
  {
    id: 'p3',
    name: 'Marcus Webb',
    initials: 'MW',
    avatarBg: '#1a3e2e',
    gym: 'Movement LIC',
    problems: 22,
    difficulty: 'V2 – V5',
    timestamp: 'Yesterday',
    likes: 19,
    comments: 2,
    liked: false,
    postType: 'session',
  },
];

function useGreeting(name: string) {
  const hour = new Date().getHours();
  const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `Good ${tod}, ${name} 👋`;
}

function FeedCard({ post, onLike }: { post: Post; onLike: (id: string) => void }) {
  const isPhoto = post.postType === 'photo';

  return (
    <View style={styles.card}>
      {/* User row */}
      <View style={styles.userRow}>
        <View style={[styles.avatar, { backgroundColor: post.avatarBg }]}>
          <Text style={styles.avatarText}>{post.initials}</Text>
        </View>
        <View style={styles.userMeta}>
          <Text style={styles.userName}>{post.name}</Text>
          <Text style={styles.timestamp}>{post.timestamp}</Text>
        </View>
      </View>

      {/* Gym label — session posts only */}
      {!isPhoto && post.gym ? (
        <Text style={styles.gymLabel}>{post.gym}</Text>
      ) : null}

      {/* Media */}
      {post.media && post.media.length > 0 && (
        <View style={styles.mediaContainer}>
          {post.media[0].type === 'image' ? (
            <Image
              source={{ uri: post.media[0].uri }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Text style={styles.videoPlayIcon}>▶</Text>
            </View>
          )}
        </View>
      )}

      {/* Stats — session posts only */}
      {!isPhoto && post.problems !== undefined && post.difficulty ? (
        <View style={styles.statsBlock}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{post.problems}</Text>
            <Text style={styles.statLabel}>PROBLEMS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{post.difficulty}</Text>
            <Text style={styles.statLabel}>DIFFICULTY</Text>
          </View>
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, post.liked && styles.actionBtnActive]}
          activeOpacity={0.7}
          onPress={() => onLike(post.id)}>
          <Text style={[styles.actionIcon, post.liked && styles.actionIconActive]}>
            {post.liked ? '♥' : '♡'}
          </Text>
          <Text style={[styles.actionCount, post.liked && styles.actionCountActive]}>
            {post.likes}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
          <Text style={styles.actionIcon}>◎</Text>
          <Text style={styles.actionCount}>{post.comments}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const greeting = useGreeting('Alex');
  const [posts, setPosts] = useState<Post[]>(PLACEHOLDER_POSTS);

  useFocusEffect(
    useCallback(() => {
      getUserPosts().then((userPosts) => {
        setPosts([...userPosts, ...PLACEHOLDER_POSTS]);
      });
    }, [])
  );

  const handleLike = async (id: string) => {
    const updated = await togglePostLike(posts, id);
    setPosts(updated);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.subheading}>Your crew is crushing it.</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}>
        {posts.map((post) => (
          <FeedCard key={post.id} post={post} onLike={handleLike} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  greeting: {
    fontSize: 42,
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 1,
    lineHeight: 46,
  },
  subheading: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_SUB,
    marginTop: 6,
    letterSpacing: 0.1,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: 0.4,
  },
  userMeta: {
    flex: 1,
    gap: 3,
  },
  userName: {
    fontSize: 16,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: -0.2,
  },
  timestamp: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_MUTED,
  },
  gymLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: TEAL,
    letterSpacing: 0.2,
  },
  mediaContainer: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: 220,
    borderRadius: 14,
  },
  videoPlaceholder: {
    width: '100%',
    height: 220,
    backgroundColor: '#0a1618',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayIcon: {
    fontSize: 40,
    color: TEXT,
    opacity: 0.8,
  },
  statsBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: TEXT_MUTED,
    letterSpacing: 1.4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: DIVIDER,
    marginHorizontal: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: SURFACE,
  },
  actionBtnActive: {
    backgroundColor: '#2a1520',
  },
  actionIcon: {
    fontSize: 16,
    color: TEXT_MUTED,
  },
  actionIconActive: {
    color: ACCENT,
  },
  actionCount: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: TEXT_MUTED,
  },
  actionCountActive: {
    color: ACCENT,
  },
});
