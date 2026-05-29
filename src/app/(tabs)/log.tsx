import { useState } from 'react';
import {
  ActivityIndicator,
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
import { uploadSessionMedia, type MediaItem } from '../../lib/store';
import { supabase } from '../../lib/supabase';

const BG        = '#ffffff';
const SURFACE   = '#d8eaf0';
const ACCENT    = '#ff507c';
const PRIMARY   = '#2E7A96';
const TEXT      = '#0d2b36';
const TEXT_SUB  = '#3d7a8a';
const TEXT_MUTED = '#8bb5c4';

const GYMS = [
  'Vital Climbing LES',
  'Vital Climbing Brooklyn',
  'Vital Climbing UES',
  'Vital Climbing UWS',
];

// Maps gym display name → the gym_id stored in Supabase
const GYM_IDS: Record<string, string> = {
  'Vital Climbing LES': '1',
  'Vital Climbing Brooklyn': '2',
  'Vital Climbing UES': '3',
  'Vital Climbing UWS': '4',
};

const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];

export default function LogScreen() {
  const [selectedGym, setSelectedGym]     = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [media, setMedia]                 = useState<MediaItem | null>(null);
  const [submitted, setSubmitted]         = useState(false);
  const [submitting, setSubmitting]       = useState(false);

  // Both gym and grade must be chosen before the user can submit
  const canSubmit = selectedGym !== null && selectedGrade !== null;

  // ─── Media helpers ────────────────────────────────────────────

  const handleAddMedia = () => {
    Alert.alert('Add to your post', '', [
      { text: 'Choose Photo', onPress: () => pickMedia('images') },
      { text: 'Choose Video', onPress: () => pickMedia('videos') },
      { text: 'Take Photo',   onPress: takePhoto },
      { text: 'Cancel',       style: 'cancel' },
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
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.85 });
    if (!result.canceled) {
      setMedia({ type: 'image', uri: result.assets[0].uri });
    }
  };

  // ─── Submit ───────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const gymId = GYM_IDS[selectedGym!];
      if (!gymId) throw new Error('Unknown gym');

      // Upload media if attached; silently continue without it if upload fails
      let mediaUrl: string | null = null;
      if (media) {
        mediaUrl = await uploadSessionMedia(media.uri, media.type);
      }

      // Each log = exactly 1 climb
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          gym_id: gymId,
          total_problems: 1,
          ...(mediaUrl ? { media_url: mediaUrl } : {}),
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;

      // One climb row, count always 1
      const { error: climbError } = await supabase
        .from('climbs')
        .insert({ session_id: session.id, grade: selectedGrade!, count: 1 });

      if (climbError) throw climbError;

      // Reset and show success screen
      setSelectedGym(null);
      setSelectedGrade(null);
      setMedia(null);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2500);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save session. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Success screen ───────────────────────────────────────────

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

  // ─── Form ─────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Log</Text>
        <Text style={styles.subheading}>Record your climb</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* 1 ── Photo / Video */}
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
              <TouchableOpacity style={styles.mediaRemoveBtn} onPress={() => setMedia(null)} activeOpacity={0.8}>
                <Text style={styles.mediaRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.mediaPickerBtn} onPress={handleAddMedia} activeOpacity={0.7}>
              <Text style={styles.mediaPickerIcon}>📷</Text>
              <Text style={styles.mediaPickerLabel}>Add a photo or video</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 2 ── Difficulty */}
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

        {/* 3 ── Gym */}
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
                  <Text style={[styles.gymName, active && styles.gymNameActive]}>{gym}</Text>
                  {active && <Text style={styles.gymCheck}>▲</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 4 ── Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={!canSubmit || submitting}>
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitLabel}>Submit Session</Text>
          )}
        </TouchableOpacity>
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
  heading: {
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
    color: TEXT_MUTED,
    letterSpacing: 1.4,
  },

  // ── Media ─────────────────────────────────────────────────────
  mediaPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: SURFACE,
    borderRadius: 16,
    paddingVertical: 22,
  },
  mediaPickerIcon: { fontSize: 22 },
  mediaPickerLabel: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: TEXT_SUB,
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
    backgroundColor: SURFACE,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoIcon: { fontSize: 36, color: TEXT },
  videoLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_SUB,
  },
  mediaRemoveBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaRemoveText: {
    fontSize: 13,
    color: '#ffffff',
    fontFamily: 'DMSans_700Bold',
  },

  // ── Grade chips ───────────────────────────────────────────────
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gradeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: SURFACE,
  },
  gradeChipActive: {
    backgroundColor: PRIMARY,
  },
  gradeLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT_SUB,
    letterSpacing: 0.2,
  },
  gradeLabelActive: {
    color: '#ffffff',
  },

  // ── Gym selector ──────────────────────────────────────────────
  gymList: { gap: 8 },
  gymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
  },
  gymRowActive: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: TEXT_MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: PRIMARY },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
  },
  gymName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: TEXT,
    letterSpacing: -0.2,
  },
  gymNameActive: { color: TEXT },
  gymCheck: { fontSize: 9, color: PRIMARY },

  // ── Submit ────────────────────────────────────────────────────
  submitBtn: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.35,
    shadowOpacity: 0,
  },
  submitLabel: {
    fontSize: 17,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: 0.2,
  },

  // ── Success ───────────────────────────────────────────────────
  successScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  successEmoji: { fontSize: 64 },
  successTitle: {
    fontSize: 52,
    fontFamily: 'BebasNeue_400Regular',
    color: ACCENT,
    letterSpacing: 2,
  },
  successSub: {
    fontSize: 16,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_SUB,
    letterSpacing: 0.1,
  },
});
