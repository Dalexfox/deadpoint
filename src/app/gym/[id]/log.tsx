import { useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../lib/supabase';
import { uploadSessionMedia } from '../../../lib/store';

const BG        = '#ffffff';
const CARD      = '#f4f1eb';
const SURFACE   = '#ece8df';
const ACCENT    = '#e8383c';
const SAND      = '#c8a84a';
const SAND_LT   = '#e8c87a';
const INK       = '#1a1408';
const INK2      = '#3d3320';
const INK3      = '#8a7a50';
const DIVIDER   = 'rgba(26,20,8,0.08)';

const GYM_NAMES: Record<string, string> = {
  '1': 'Vital Climbing LES',
  '2': 'Vital Climbing Brooklyn',
  '3': 'Vital Climbing UES',
  '4': 'Vital Climbing UWS',
};

const GRADES = ['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'];

type MediaItem = { type: 'image' | 'video'; uri: string };

export default function GymLogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const gymName = GYM_NAMES[id as string] ?? 'Gym';

  const [gradeIndex, setGradeIndex] = useState(0);
  const selectedGrade = GRADES[gradeIndex];
  const [media, setMedia] = useState<MediaItem | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => router.back(), 2500);
    return () => clearTimeout(timer);
  }, [submitted]);

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

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      let mediaUrl: string | null = null;
      if (media) {
        mediaUrl = await uploadSessionMedia(media.uri, media.type);
      }

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          gym_id: id,
          total_problems: 1,
          ...(mediaUrl ? { media_url: mediaUrl } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        })
        .select('id')
        .single();
      if (sessionError) throw sessionError;

      const { error: climbError } = await supabase
        .from('climbs')
        .insert({ session_id: session.id, grade: selectedGrade, count: 1 });
      if (climbError) throw climbError;

      setSubmitted(true);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save session.');
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>{gymName}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={styles.heading}>Log a Climb</Text>
        <Text style={styles.subheading}>{gymName}</Text>
      </View>

      <ScrollView
        style={styles.scrollWrap}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Photo / Video */}
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

        {/* Difficulty */}
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
                <Text key={grade} style={[styles.stepLabelText, i === gradeIndex && styles.stepLabelTextActive]}>
                  {grade}
                </Text>
              ))}
            </View>
          </View>
        </View>

        {/* Notes */}
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
      </ScrollView>

      {/* Submit */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          activeOpacity={0.85}
          disabled={submitting}
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
  container: { flex: 1, backgroundColor: BG },

  nav: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backArrow: { fontSize: 28, fontFamily: 'SpaceGrotesk_300Light', color: INK, lineHeight: 28, marginTop: -2 },
  backLabel: { fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', color: INK, letterSpacing: 0.1 },

  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  heading: { fontSize: 42, fontFamily: 'Syne_800ExtraBold', color: INK, letterSpacing: 1, lineHeight: 46 },
  subheading: { fontSize: 16, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK2, marginTop: 6, letterSpacing: 0.1 },

  scrollWrap: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 16, gap: 28 },
  section: { gap: 12 },
  sectionLabel: { fontSize: 11, fontFamily: 'Syne_800ExtraBold', color: INK3, letterSpacing: 1.4 },

  // Media
  mediaPickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: SURFACE, borderRadius: 16, paddingVertical: 22 },
  mediaPickerIcon: { fontSize: 22 },
  mediaPickerLabel: { fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold', color: INK2, letterSpacing: -0.1 },
  mediaPreviewWrapper: { position: 'relative', borderRadius: 16, overflow: 'hidden' },
  mediaPreview: { width: '100%', height: 200, borderRadius: 16 },
  videoPreview: { width: '100%', height: 200, backgroundColor: SURFACE, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  videoIcon: { fontSize: 36, color: INK },
  videoLabel: { fontSize: 14, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK2 },
  mediaRemoveBtn: { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  mediaRemoveText: { fontSize: 13, color: '#ffffff', fontFamily: 'SpaceGrotesk_700Bold' },

  // Grade step slider
  sliderCard: { backgroundColor: SURFACE, borderRadius: 14, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, alignItems: 'center' },
  sliderValue: { fontSize: 32, fontFamily: 'Syne_800ExtraBold', color: SAND, letterSpacing: 0.5, marginBottom: 16 },
  stepTrack: { width: '100%', height: 32, justifyContent: 'center', marginBottom: 8 },
  stepTrackLine: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: '#c2d9e3', borderRadius: 2 },
  stepTrackLineFilled: { position: 'absolute', left: 0, height: 3, backgroundColor: SAND, borderRadius: 2 },
  stepHitArea: { position: 'absolute', width: 32, height: 32, marginLeft: -16, alignItems: 'center', justifyContent: 'center' },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#c2d9e3', borderWidth: 2, borderColor: '#ffffff' },
  stepDotActive: { width: 20, height: 20, borderRadius: 10, backgroundColor: SAND, borderWidth: 3, borderColor: '#ffffff' },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  stepLabelText: { fontSize: 10, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK3, textAlign: 'center' },
  stepLabelTextActive: { color: SAND, fontFamily: 'Syne_800ExtraBold' },

  // Notes
  notesInput: { backgroundColor: SURFACE, borderRadius: 14, padding: 14, fontSize: 15, fontFamily: 'SpaceGrotesk_400Regular', color: INK, minHeight: 100 },

  // Footer
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER },
  submitBtn: { backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 18, alignItems: 'center', shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 4 },
  submitBtnDisabled: { opacity: 0.35, shadowOpacity: 0 },
  submitLabel: { fontSize: 17, fontFamily: 'Syne_800ExtraBold', color: '#ffffff', letterSpacing: 0.2 },

  // Success
  successScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  successEmoji: { fontSize: 64 },
  successTitle: { fontSize: 52, fontFamily: 'Syne_800ExtraBold', color: ACCENT, letterSpacing: 2 },
  successSub: { fontSize: 16, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK2, letterSpacing: 0.1 },
});
