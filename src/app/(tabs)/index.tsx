import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACCENT = '#ff507c';

function useGreeting(name: string) {
  return useMemo(() => {
    const hour = new Date().getHours();
    const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    return `Good ${tod}, ${name} 👋`;
  }, [name]);
}

type Post = {
  id: string;
  name: string;
  initials: string;
  avatarBg: string;
  gym: string;
  problems: number;
  difficulty: string;
  timestamp: string;
  likes: number;
  comments: number;
  liked: boolean;
};

const POSTS: Post[] = [
  {
    id: '1',
    name: 'Alex Chen',
    initials: 'AC',
    avatarBg: '#ffd1dc',
    gym: 'Vital Climbing LES',
    problems: 14,
    difficulty: 'V4 – V6',
    timestamp: '2h ago',
    likes: 31,
    comments: 4,
    liked: false,
  },
  {
    id: '2',
    name: 'Sarah Park',
    initials: 'SP',
    avatarBg: '#d1e8ff',
    gym: 'Brooklyn Boulders Queensbridge',
    problems: 8,
    difficulty: 'V7 – V8',
    timestamp: '5h ago',
    likes: 58,
    comments: 11,
    liked: true,
  },
  {
    id: '3',
    name: 'Marcus Webb',
    initials: 'MW',
    avatarBg: '#d4f5e2',
    gym: 'Movement LIC',
    problems: 22,
    difficulty: 'V2 – V5',
    timestamp: 'Yesterday',
    likes: 19,
    comments: 2,
    liked: false,
  },
];

function FeedCard({ post }: { post: Post }) {
  return (
    <View style={styles.card}>
      <View style={styles.userRow}>
        <View style={[styles.avatar, { backgroundColor: post.avatarBg }]}>
          <Text style={styles.avatarText}>{post.initials}</Text>
        </View>
        <View style={styles.userMeta}>
          <Text style={styles.userName}>{post.name}</Text>
          <Text style={styles.timestamp}>{post.timestamp}</Text>
        </View>
      </View>

      <Text style={styles.gymLabel}>{post.gym}</Text>

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

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, post.liked && styles.actionBtnActive]}
          activeOpacity={0.7}>
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.subheading}>Your crew is crushing it.</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}>
        {POSTS.map((post) => (
          <FeedCard key={post.id} post={post} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  // ─── Header ──────────────────────────────────────────────────
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  greeting: {
    fontSize: 34,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  subheading: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: '#888888',
    marginTop: 6,
    letterSpacing: 0.1,
  },

  // ─── Feed list ───────────────────────────────────────────────
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
  },

  // ─── Card ────────────────────────────────────────────────────
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
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
    color: '#000000',
    letterSpacing: 0.4,
  },
  userMeta: {
    flex: 1,
    gap: 3,
  },
  userName: {
    fontSize: 16,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.2,
  },
  timestamp: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#aaaaaa',
  },

  gymLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: ACCENT,
    letterSpacing: 0.2,
  },

  // ─── Stats block ─────────────────────────────────────────────
  statsBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
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
    color: '#000000',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    color: '#aaaaaa',
    letterSpacing: 1.4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },

  // ─── Actions ─────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f0f0f0',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
  },
  actionBtnActive: {
    backgroundColor: '#fff0f4',
  },
  actionIcon: {
    fontSize: 16,
    color: '#bbbbbb',
  },
  actionIconActive: {
    color: ACCENT,
  },
  actionCount: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#bbbbbb',
  },
  actionCountActive: {
    color: ACCENT,
  },
});
