import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { uploadSessionMedia, type MediaItem } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { fetchGyms, type Gym } from '../../lib/gyms';

const BG        = '#ffffff';
const CARD      = '#f4f1eb';
const SURFACE   = '#ece8df';
const ACCENT    = '#e8383c';
const SAND      = '#c8a84a';
const INK       = '#1a1408';
const INK2      = '#3d3320';
const INK3      = '#8a7a50';
const DIVIDER   = 'rgba(26,20,8,0.08)';


const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];

export default function LogScreen() {
  const [gyms, setGyms]                   = useState<Gym[]>([]);
  const [selectedGym, setSelectedGym]     = useState<Gym | null>(null);
  const [gradeIndex, setGradeIndex]       = useState(0);
  const selectedGrade = GRADES[gradeIndex];
  const [media, setMedia]                 = useState<MediaItem | null>(null);
  const [notes, setNotes]                 = useState('');
  const [submitted, setSubmitted]         = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [gymDropdownOpen, setGymDropdownOpen] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchGyms().then(setGyms);
  }, []));

  const canSubmit = selectedGym !== null;

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

      const gymId = selectedGym!.id;

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
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;

      // One climb row, count always 1
      const { error: climbError } = await supabase
        .from('climbs')
        .insert({ session_id: session.id, grade: selectedGrade, count: 1 });

      if (climbError) throw climbError;

      // Reset and show success screen
      setSelectedGym(null);
      setGradeIndex(0);
      setMedia(null);
      setNotes('');
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
          <View style={styles.sliderCard}>
            <Text style={styles.sliderValue}>{selectedGrade}</Text>
            <View style={styles.stepTrack}>
              <View style={styles.stepTrackLine} />
              <View style={[styles.stepTrackLineFilled, { width: `${(gradeIndex / (GRADES.length - 1)) * 100}%` }]} />
              {GRADES.map((grade, i) => {
                const active = i === gradeIndex;
                return (
                  <TouchableOpacity
                    key={grade}
                    style={[styles.stepHitArea, { left: `${(i / (GRADES.length - 1)) * 100}%` }]}
                    onPress={() => setGradeIndex(i)}
                    activeOpacity={0.7}>
                    <View style={[styles.stepDot, active && styles.stepDotActive]} />
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.stepLabels}>
              {GRADES.map((grade, i) => (
                <Text
                  key={grade}
                  style={[styles.stepLabelText, i === gradeIndex && styles.stepLabelTextActive]}>
                  {grade}
                </Text>
              ))}
            </View>
          </View>
        </View>

        {/* 3 ── Gym */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>GYM</Text>
          <TouchableOpacity
            style={styles.dropdownTrigger}
            onPress={() => setGymDropdownOpen(!gymDropdownOpen)}
            activeOpacity={0.7}>
            <Text style={[styles.dropdownTriggerText, !selectedGym && styles.dropdownPlaceholder]}>
              {selectedGym?.name ?? 'Select a gym'}
            </Text>
            <Text style={styles.dropdownChevron}>{gymDropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {gymDropdownOpen && (
            <View style={styles.dropdownList}>
              {gyms.map((gym, i) => {
                const active = selectedGym?.id === gym.id;
                return (
                  <TouchableOpacity
                    key={gym.id}
                    style={[styles.dropdownItem, i < gyms.length - 1 && styles.dropdownItemBorder]}
                    onPress={() => { setSelectedGym(gym); setGymDropdownOpen(false); }}
                    activeOpacity={0.7}>
                    <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>{gym.name}</Text>
                    {active && <Text style={styles.dropdownItemCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* 4 ── Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOTES</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Describe the climb, beta, or how it felt..."
            placeholderTextColor={INK3}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* 5 ── Submit */}
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
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -1.5,
    lineHeight: 46,
  },
  subheading: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK2,
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
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },

  // ── Media ─────────────────────────────────────────────────────
  mediaPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingVertical: 22,
    borderWidth: 0.5,
    borderColor: DIVIDER,
  },
  mediaPickerIcon: { fontSize: 22 },
  mediaPickerLabel: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK2,
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
    backgroundColor: CARD,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoIcon: { fontSize: 36, color: INK },
  videoLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK2,
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
    fontFamily: 'SpaceGrotesk_700Bold',
  },

  // ── Grade step slider ─────────────────────────────────────────
  sliderCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  sliderValue: {
    fontSize: 64,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND,
    letterSpacing: -3,
    marginBottom: 16,
  },
  stepTrack: {
    width: '100%',
    height: 32,
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepTrackLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: DIVIDER,
    borderRadius: 2,
  },
  stepTrackLineFilled: {
    position: 'absolute',
    left: 0,
    height: 1.5,
    backgroundColor: INK,
    borderRadius: 2,
  },
  stepHitArea: {
    position: 'absolute',
    width: 32,
    height: 32,
    marginLeft: -16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SURFACE,
    borderWidth: 0.5,
    borderColor: 'rgba(26,20,8,0.1)',
  },
  stepDotActive: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: INK,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  stepLabelText: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    textAlign: 'center',
  },
  stepLabelTextActive: {
    color: SAND,
    fontFamily: 'SpaceGrotesk_700Bold',
  },

  // ── Gym dropdown ──────────────────────────────────────────────
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    padding: 16,
  },
  dropdownTriggerText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK,
    letterSpacing: -0.2,
  },
  dropdownPlaceholder: {
    color: INK3,
  },
  dropdownChevron: {
    fontSize: 10,
    color: INK3,
  },
  dropdownList: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    marginTop: 6,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  dropdownItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  dropdownItemText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK,
    letterSpacing: -0.2,
  },
  dropdownItemTextActive: {
    color: SAND,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  dropdownItemCheck: {
    fontSize: 16,
    color: SAND,
    fontFamily: 'Syne_800ExtraBold',
  },

  // ── Notes ─────────────────────────────────────────────────────
  notesInput: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    padding: 14,
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK,
    minHeight: 100,
  },

  // ── Submit ────────────────────────────────────────────────────
  submitBtn: {
    backgroundColor: SAND,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.35,
  },
  submitLabel: {
    fontSize: 15,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.3,
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
    fontFamily: 'Syne_800ExtraBold',
    color: SAND,
    letterSpacing: -2,
  },
  successSub: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK2,
    letterSpacing: 0.1,
  },
});
