import { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import * as ImagePicker from 'expo-image-picker';
import { getProfileAvatar, saveProfileAvatar } from '../../lib/store';

const ACCENT = '#ff507c';

const USER = {
  name: 'Alex Fox',
  username: '@alexfox',
  initials: 'AF',
  totalClimbs: 142,
  gymsVisited: 9,
  currentStreak: 7,
};

const ACTIVITY: {
  id: string;
  gym: string;
  problems: number;
  difficulty: string;
  date: string;
}[] = [
  { id: '1', gym: 'Dogpatch Boulders', problems: 8, difficulty: 'V5–V7', date: 'May 25' },
  { id: '2', gym: 'Mission Cliffs', problems: 12, difficulty: 'V3–V5', date: 'May 23' },
  { id: '3', gym: 'Touchstone Berkeley', problems: 6, difficulty: 'V6–V8', date: 'May 20' },
  { id: '4', gym: 'Planet Granite SF', problems: 10, difficulty: 'V4–V6', date: 'May 18' },
  { id: '5', gym: 'Dogpatch Boulders', problems: 9, difficulty: 'V5–V7', date: 'May 15' },
  { id: '6', gym: 'Mission Cliffs', problems: 7, difficulty: 'V3–V4', date: 'May 12' },
];

function StatColumn({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statColumn}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActivityCard({
  gym,
  problems,
  difficulty,
  date,
}: {
  gym: string;
  problems: number;
  difficulty: string;
  date: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.accentBar} />
        <View style={styles.cardBody}>
          <Text style={styles.cardGym}>{gym}</Text>
          <Text style={styles.cardDetail}>
            {problems} problems · {difficulty}
          </Text>
        </View>
      </View>
      <Text style={styles.cardDate}>{date}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  useEffect(() => {
    getProfileAvatar().then(setAvatarUri);
  }, []);

  const handleAvatarPress = () => {
    Alert.alert('Profile Photo', 'Choose a photo for your profile', [
      {
        text: 'Choose from Library',
        onPress: pickFromLibrary,
      },
      {
        text: 'Take Photo',
        onPress: takePhoto,
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickFromLibrary = async () => {
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

  const takePhoto = async () => {
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.gearButton} hitSlop={12}>
          <SymbolView name="gearshape" size={22} tintColor="#0a0a0a" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

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

        <View style={styles.statsRow}>
          <StatColumn label="Total Climbs" value={USER.totalClimbs} />
          <View style={styles.statDivider} />
          <StatColumn label="Gyms Visited" value={USER.gymsVisited} />
          <View style={styles.statDivider} />
          <StatColumn label="Day Streak" value={USER.currentStreak} />
        </View>

        <Text style={styles.sectionTitle}>Recent Activity</Text>

        {ACTIVITY.map((item) => (
          <ActivityCard
            key={item.id}
            gym={item.gym}
            problems={item.problems}
            difficulty={item.difficulty}
            date={item.date}
          />
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    padding: 16,
    overflow: 'hidden',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
});
