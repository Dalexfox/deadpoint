import { useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { saveUserPost, type MediaItem } from '../../lib/store';

const ACCENT = '#ff507c';

const GYMS = [
  'Vital Climbing LES',
  'Vital Climbing Brooklyn',
  'Vital Climbing UES',
  'Vital Climbing UWS',
];

const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];

export default function LogScreen() {
  const [selectedGym, setSelectedGym] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [problems, setProblems] = useState(0);
  const [media, setMedia] = useState<MediaItem | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = selectedGym !== null && selectedGrade !== null && problems > 0;

  const handleAddMedia = () => {
    Alert.alert('Add to your post', '', [
      { text: 'Choose Photo', onPress: () => pickMedia('images') },
      { text: 'Choose Video', onPress: () => pickMedia('videos') },
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickMedia = async (type: 'images' | 'videos') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [type],
      allowsEditing: true,
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setMedia({ type: asset.type === 'video' ? 'video' : 'image', uri: asset.uri });
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled) {
      setMedia({ type: 'image', uri: result.assets[0].uri });
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await saveUserPost({
      id: Date.now().toString(),
      name: 'Alex Fox',
      initials: 'AF',
      avatarBg: ACCENT,
      gym: selectedGym!,
      problems,
      difficulty: selectedGrade!,
      timestamp: 'Just now',
      likes: 0,
      comments: 0,
      liked: false,
      media: media ? [media] : undefined,
    });
    setSubmitted(true);
    // Reset form
    setSelectedGym(null);
    setSelectedGrade(null);
    setProblems(0);
    setMedia(null);
    setTimeout(() => setSubmitted(false), 2500);
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successScreen}>
          <Text style={styles.successEmoji}>🧗</Text>
          <Text style={styles.successTitle}>SESSION LOGGED</Text>
          <Text style={styles.successSub}>Your crew can see it on the feed.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Log</Text>
        <Text style={styles.subheading}>Record your session</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Gym */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>GYM</Text>
          <View style={styles.gymList}>
            {GYMS.map((gym) => {
              const active = selectedGym === gym;
              return (
                <TouchableOpacity
                  key={gym}
                  style={[styles.gymRow, active && styles.gymRowActive]}
                  onPress={() => setSelectedGym(gym)}
                  activeOpacity={0.7}>
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active && <View style={styles.radioDot} />}
                  </View>
                  <View style={styles.gymMeta}>
                    <Text style={[styles.gymName, active && styles.gymNameActive]}>{gym}</Text>
                  </View>
                  {active && <Text style={styles.gymCheck}>▲</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Difficulty */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DIFFICULTY</Text>
          <View style={styles.gradeGrid}>
            {GRADES.map((grade) => {
              const active = selectedGrade === grade;
              return (
                <TouchableOpacity
                  key={grade}
                  style={[styles.gradeChip, active && styles.gradeChipActive]}
                  onPress={() => setSelectedGrade(grade)}
                  activeOpacity={0.7}>
                  <Text style={[styles.gradeLabel, active && styles.gradeLabelActive]}>
                    {grade}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Problems */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PROBLEMS COMPLETED</Text>
          <View style={styles.counterCard}>
            <TouchableOpacity
              style={[styles.counterBtn, problems === 0 && styles.counterBtnDisabled]}
              onPress={() => setProblems((n) => Math.max(0, n - 1))}
              activeOpacity={0.7}>
              <Text style={[styles.counterBtnText, problems === 0 && styles.counterBtnTextDisabled]}>
                −
              </Text>
            </TouchableOpacity>
            <View style={styles.counterCenter}>
              <Text style={styles.counterValue}>{problems}</Text>
              <Text style={styles.counterUnit}>problems</Text>
            </View>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => setProblems((n) => n + 1)}
              activeOpacity={0.7}>
              <Text style={styles.counterBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Media */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ADD PHOTO / VIDEO</Text>
          {media ? (
            <View style={styles.mediaPreviewWrapper}>
              {media.type === 'image' ? (
                <Image source={{ uri: media.uri }} style={styles.mediaPreview} resizeMode="cover" />
              ) : (
                <View style={styles.videoPreview}>
                  <Text style={styles.videoIcon}>▶</Text>
                  <Text style={styles.videoLabel}>Video selected</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.mediaRemoveBtn}
                onPress={() => setMedia(null)}
                activeOpacity={0.8}>
                <Text style={styles.mediaRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.mediaPickerBtn}
              onPress={handleAddMedia}
              activeOpacity={0.7}>
              <Text style={styles.mediaPickerIcon}>📷</Text>
              <Text style={styles.mediaPickerLabel}>Add a photo or video</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={!canSubmit}>
          <Text style={styles.submitLabel}>Submit Session</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  heading: {
    fontSize: 42,
    fontFamily: 'BebasNeue_400Regular',
    color: '#000000',
    letterSpacing: 1,
    lineHeight: 46,
  },
  subheading: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: '#888888',
    marginTop: 6,
    letterSpacing: 0.1,
  },
  scroll: {
    padding: 20,
    gap: 28,
    paddingBottom: 40,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#aaaaaa',
    letterSpacing: 1.4,
  },
  gymList: {
    gap: 8,
  },
  gymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 16,
  },
  gymRowActive: {
    backgroundColor: '#fff0f4',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#dddddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: ACCENT,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
  gymMeta: {
    flex: 1,
  },
  gymName: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: '#0a0a0a',
    letterSpacing: -0.2,
  },
  gymNameActive: {
    color: ACCENT,
  },
  gymCheck: {
    fontSize: 9,
    color: ACCENT,
  },
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gradeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  gradeChipActive: {
    backgroundColor: ACCENT,
  },
  gradeLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#888888',
    letterSpacing: 0.2,
  },
  gradeLabelActive: {
    color: '#ffffff',
  },
  counterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  counterBtn: {
    paddingHorizontal: 24,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  counterBtnDisabled: {
    opacity: 0.3,
  },
  counterBtnText: {
    fontSize: 24,
    fontFamily: 'DMSans_300Light',
    color: '#0a0a0a',
    lineHeight: 24,
  },
  counterBtnTextDisabled: {
    color: '#aaaaaa',
  },
  counterCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  counterValue: {
    fontSize: 40,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#0a0a0a',
    letterSpacing: -1,
  },
  counterUnit: {
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    color: '#aaaaaa',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // ─── Media picker ─────────────────────────────────────────────
  mediaPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    paddingVertical: 22,
  },
  mediaPickerIcon: {
    fontSize: 22,
  },
  mediaPickerLabel: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#888888',
    letterSpacing: -0.1,
  },
  mediaPreviewWrapper: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  mediaPreview: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  videoPreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#111111',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoIcon: {
    fontSize: 36,
    color: '#ffffff',
  },
  videoLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#ffffff',
    opacity: 0.7,
  },
  mediaRemoveBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaRemoveText: {
    fontSize: 13,
    color: '#ffffff',
    fontFamily: 'DMSans_700Bold',
  },

  // ─── Submit ───────────────────────────────────────────────────
  submitBtn: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
  },
  submitLabel: {
    fontSize: 17,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: 0.2,
  },

  // ─── Success screen ───────────────────────────────────────────
  successScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  successEmoji: {
    fontSize: 64,
  },
  successTitle: {
    fontSize: 52,
    fontFamily: 'BebasNeue_400Regular',
    color: '#000000',
    letterSpacing: 2,
  },
  successSub: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: '#888888',
    letterSpacing: 0.1,
  },
});
