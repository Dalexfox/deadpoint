import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  getProfileAvatar,
  saveProfileAvatar,
  getUserPosts,
  saveUserPost,
  type Post,
} from '../../lib/store';

const ACCENT = '#ff507c';

const USER = {
  name: 'Alex Fox',
  username: '@alexfox',
  initials: 'AF',
  totalClimbs: 142,
  gymsVisited: 9,
  currentStreak: 7,
};

function StatColumn({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statColumn}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActivityCard({ post }: { post: Post }) {
  const isPhoto = post.postType === 'photo';

  return (
    <View style={styles.card}>
      {/* Photo post — show thumbnail */}
      {isPhoto && post.media?.[0] ? (
        <View style={styles.cardPhotoRow}>
          {post.media[0].type === 'image' ? (
            <Image source={{ uri: post.media[0].uri }} style={styles.cardThumbnail} />
          ) : (
            <View style={[styles.cardThumbnail, styles.cardVideoThumb]}>
              <Text style={styles.cardVideoIcon}>▶</Text>
            </View>
          )}
          <View style={styles.cardPhotoMeta}>
            <Text style={styles.cardGym}>Photo</Text>
            <Text style={styles.cardDetail}>{post.timestamp}</Text>
          </View>
        </View>
      ) : (
        /* Session post */
        <View style={styles.cardLeft}>
          <View style={styles.accentBar} />
          <View style={styles.cardBody}>
            <Text style={styles.cardGym}>{post.gym ?? '—'}</Text>
            <Text style={styles.cardDetail}>
              {post.problems} problems · {post.difficulty}
            </Text>
          </View>
          <Text style={styles.cardDate}>{post.timestamp}</Text>
        </View>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);

  useEffect(() => {
    getProfileAvatar().then(setAvatarUri);
  }, []);

  useFocusEffect(
    useCallback(() => {
      getUserPosts().then(setUserPosts);
    }, [])
  );

  // ─── Avatar ───────────────────────────────────────────────────

  const handleAvatarPress = () => {
    Alert.alert('Profile Photo', 'Choose a photo for your profile', [
      { text: 'Choose from Library', onPress: pickAvatar },
      { text: 'Take Photo', onPress: takeAvatarPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      saveProfileAvatar(uri);
    }
  };

  const takeAvatarPhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      saveProfileAvatar(uri);
    }
  };

  // ─── Share to feed ────────────────────────────────────────────

  const handleShare = () => {
    Alert.alert('Share to Feed', 'Add a photo or video to your feed', [
      { text: 'Choose Photo', onPress: () => shareMedia('images') },
      { text: 'Choose Video', onPress: () => shareMedia('videos') },
      { text: 'Take Photo', onPress: shareFromCamera },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const shareMedia = async (type: 'images' | 'videos') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [type],
      allowsEditing: true,
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      await publishPost(asset.uri, asset.type === 'video' ? 'video' : 'image');
    }
  };

  const shareFromCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled) {
      await publishPost(result.assets[0].uri, 'image');
    }
  };

  const publishPost = async (uri: string, mediaType: 'image' | 'video') => {
    const post: Post = {
      id: Date.now().toString(),
      name: USER.name,
      initials: USER.initials,
      avatarBg: ACCENT,
      timestamp: 'Just now',
      likes: 0,
      comments: 0,
      liked: false,
      postType: 'photo',
      media: [{ type: mediaType, uri }],
    };
    await saveUserPost(post);
    const updated = await getUserPosts();
    setUserPosts(updated);
    Alert.alert('Posted!', 'Your photo is now live on the feed.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            activeOpacity={0.7}>
            <SymbolView name="plus.circle" size={24} tintColor={ACCENT} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.gearButton} hitSlop={12}>
            <SymbolView name="gearshape" size={22} tintColor="#0a0a0a" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.85}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarInitials}>{USER.initials}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditIcon}>＋</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{USER.name}</Text>
          <Text style={styles.username}>{USER.username}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatColumn label="Total Climbs" value={USER.totalClimbs} />
          <View style={styles.statDivider} />
          <StatColumn label="Gyms Visited" value={USER.gymsVisited} />
          <View style={styles.statDivider} />
          <StatColumn label="Day Streak" value={USER.currentStreak} />
        </View>

        {/* Share prompt if no posts yet */}
        {userPosts.length === 0 ? (
          <TouchableOpacity style={styles.emptyState} onPress={handleShare} activeOpacity={0.7}>
            <Text style={styles.emptyIcon}>📸</Text>
            <Text style={styles.emptyTitle}>SHARE YOUR FIRST CLIMB</Text>
            <Text style={styles.emptySub}>Tap to post a photo or video to your feed</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Your Posts</Text>
            {userPosts.map((post) => (
              <ActivityCard key={post.id} post={post} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 36,
    fontFamily: 'BebasNeue_400Regular',
    color: '#0a0a0a',
    letterSpacing: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 32,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarInitials: {
    fontSize: 34,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarEditIcon: {
    fontSize: 16,
    color: '#ffffff',
    lineHeight: 18,
  },
  name: {
    fontSize: 30,
    fontFamily: 'BebasNeue_400Regular',
    color: '#0a0a0a',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#8a8a8a',
    letterSpacing: 0.1,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingVertical: 20,
    marginBottom: 32,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 26,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#0a0a0a',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#8a8a8a',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
  sectionTitle: {
    fontSize: 26,
    fontFamily: 'BebasNeue_400Regular',
    color: '#000000',
    letterSpacing: 1,
    marginHorizontal: 20,
    marginBottom: 12,
  },

  // ─── Activity cards ───────────────────────────────────────────
  card: {
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    padding: 14,
    overflow: 'hidden',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accentBar: {
    width: 4,
    height: 36,
    backgroundColor: ACCENT,
    borderRadius: 2,
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
  },
  cardGym: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#0a0a0a',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  cardDetail: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#8a8a8a',
  },
  cardDate: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#b0b0b0',
    letterSpacing: 0.2,
    marginLeft: 8,
  },
  cardPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  cardVideoThumb: {
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardVideoIcon: {
    fontSize: 18,
    color: '#ffffff',
  },
  cardPhotoMeta: {
    flex: 1,
    gap: 3,
  },

  // ─── Empty state ──────────────────────────────────────────────
  emptyState: {
    marginHorizontal: 20,
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: 'BebasNeue_400Regular',
    color: '#000000',
    letterSpacing: 1.5,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#888888',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
