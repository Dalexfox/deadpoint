import { useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { uploadSessionMedia } from '../../lib/store';

const BG        = '#ffffff';
const SURFACE   = '#d8eaf0';
const ACCENT    = '#ff507c';
const PRIMARY   = '#2E7A96';
const TEXT      = '#0d2b36';
const TEXT_SUB  = '#3d7a8a';
const TEXT_MUTED = '#8bb5c4';
const DIVIDER   = '#c8dde8';

const GYMS: Record<string, { name: string; neighborhood: string; city: string }> = {
  '1': { name: 'Vital Climbing LES',      neighborhood: 'Lower East Side', city: 'NYC' },
  '2': { name: 'Vital Climbing Brooklyn', neighborhood: 'Brooklyn',        city: 'NYC' },
  '3': { name: 'Vital Climbing UES',      neighborhood: 'Upper East Side', city: 'NYC' },
  '4': { name: 'Vital Climbing UWS',      neighborhood: 'Upper West Side', city: 'NYC' },
};

const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];

type MediaItem = { type: 'image' | 'video'; uri: string };

export default function GymDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const router   = useRouter();
  const gym      = GYMS[id as string] ?? null;

  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [media, setMedia]                 = useState<MediaItem | null>(null);
  const [submitting, setSubmitting]       = useState(false);
  const [submitted, setSubmitted]         = useState(false);

  // After the success screen shows, navigate back to the Gyms tab after 2.5 s
  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => router.replace('/(tabs)/gyms'), 2500);
    return () => clearTimeout(timer);
  }, [submitted]);

  const canSubmit = selectedGrade !== null;

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
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      // Upload media if attached; silently continue without it if upload fails
      let mediaUrl: string | null = null;
      if (media) {
        mediaUrl = await uploadSessionMedia(media.uri, media.type);
      }

      // Each gym-detail log = exactly 1 climb
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          gym_id: id,
          total_problems: 1,
          ...(mediaUrl ? { media_url: mediaUrl } : {}),
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;

      // One climb row, count always 1
      const { error: climbsError } = await supabase
        .from('climbs')
        .insert({ session_id: session.id, grade: selectedGrade!, count: 1 });

      if (climbsError) throw climbsError;

      setSubmitted(true);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save session. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!gym) return null;

  // ─── Success screen ───────────────────────────────────────────

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Back nav */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>Gyms</Text>
        </TouchableOpacity>
      </View>

      {/* Gym header */}
      <View style={styles.gymHeader}>
        <View style={styles.gymPill}>
          <Text style={styles.gymPillMarker}>▲</Text>
          <Text style={styles.gymPillText}>Vital</Text>
        </View>
        <Text style={styles.gymName}>{gym.name}</Text>
        <Text style={styles.gymLocation}>{gym.neighborhood} · {gym.city}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

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
                  <Text style={[styles.gradeChipLabel, active && styles.gradeChipLabelActive]}>
                    {grade}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

      </ScrollView>

      {/* Fixed footer with Submit */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
          activeOpacity={0.85}
          disabled={!canSubmit || submitting}
          onPress={handleSubmit}>
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitLabel}>Submit Session</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Nav ───────────────────────────────────────────────────────
  nav: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  backArrow: {
    fontSize: 28,
    fontFamily: 'DMSans_300Light',
    color: TEXT,
    lineHeight: 28,
    marginTop: -2,
  },
  backLabel: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    color: TEXT,
    letterSpacing: 0.1,
  },

  // ── Gym header ────────────────────────────────────────────────
  gymHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
    gap: 6,
  },
  gymPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: SURFACE,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  gymPillMarker: { fontSize: 8, color: PRIMARY },
  gymPillText: {
    fontSize: 11,
    fontFamily: 'DMSans_800ExtraBold',
    color: PRIMARY,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  gymName: {
    fontSize: 40,
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 1,
    lineHeight: 44,
  },
  gymLocation: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_SUB,
    letterSpacing: 0.1,
  },

  // ── Scroll ────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 16,
    gap: 28,
  },
  section: { gap: 12 },
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
  gradeChipLabel: {
    fontSize: 14,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT_SUB,
    letterSpacing: 0.2,
  },
  gradeChipLabelActive: {
    color: '#ffffff',
  },

  // ── Footer / Submit ───────────────────────────────────────────
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
  },
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

  // ── Success screen ────────────────────────────────────────────
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
