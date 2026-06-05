import { useCallback, useEffect, useState } from 'react';
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
import { supabase } from '../../lib/supabase';
import { uploadSessionMedia } from '../../lib/store';
import { fetchGyms, type Gym } from '../../lib/gyms';
import { HOLD_COLOR_SWATCHES } from '../../components/ProblemCard';

const BG      = '#ffffff';
const CARD    = '#f4f1eb';
const SURFACE = '#ece8df';
const SAND    = '#c8a84a';
const INK     = '#1a1408';
const INK2    = '#3d3320';
const INK3    = '#8a7a50';
const DIVIDER = 'rgba(26,20,8,0.08)';

const GRADES = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10'];

type SendMedia = { type: 'image' | 'video'; uri: string };

function StepIndicator() {
  return (
    <View style={si.row}>
      {([1, 2, 3] as const).map((step, i) => (
        <View key={step} style={si.stepGroup}>
          {i > 0 && <View style={si.line} />}
          <View style={[si.dot, si.dotActive, step === 3 && si.dotCurrent]} />
        </View>
      ))}
      <Text style={si.label}>Step 3 of 3 — Log your send</Text>
    </View>
  );
}

const si = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, gap: 0 },
  stepGroup:  { flexDirection: 'row', alignItems: 'center' },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  dotActive:  { backgroundColor: SAND },
  dotCurrent: { width: 10, height: 10, borderRadius: 5 },
  line:       { width: 24, height: 1, backgroundColor: 'rgba(26,20,8,0.15)', marginHorizontal: 4 },
  label:      { fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK3, marginLeft: 10 },
});

export default function SendScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    gymId:        string;
    gymName:      string;
    holdColor:    string;
    wallSection:  string;
    problemId?:   string;
    problemName?: string;
    problemGrade?: string;
    newProblem?:  string;
  }>();

  const {
    gymId,
    gymName: paramGymName,
    holdColor,
    wallSection,
    problemId,
    problemName,
    problemGrade,
    newProblem,
  } = params;

  const isNew = newProblem === 'true';
  const swatch = HOLD_COLOR_SWATCHES[holdColor] ?? '#888';
  const displayName = isNew
    ? `${holdColor.charAt(0).toUpperCase() + holdColor.slice(1)} ${wallSection}`
    : (problemName ?? 'Unknown Climb');

  const [gyms, setGyms]               = useState<Gym[]>([]);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [gymDropdownOpen, setGymDropdownOpen] = useState(false);

  const [gradeIndex, setGradeIndex]   = useState(() => {
    const idx = GRADES.indexOf(problemGrade ?? 'V0');
    return idx >= 0 ? idx : 0;
  });
  const selectedGrade = GRADES[gradeIndex];

  const [customName, setCustomName]   = useState('');
  const [notes, setNotes]             = useState('');
  const [sendMedia, setSendMedia]     = useState<SendMedia | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);

  useEffect(() => {
    fetchGyms().then(gyms => {
      setGyms(gyms);
      const match = gyms.find(g => g.id === gymId);
      if (match) setSelectedGym(match);
    });
  }, [gymId]);

  // ── Send media picker (completely separate from recognition photo) ──

  const handleAddMedia = () => {
    Alert.alert('Add to your post', '', [
      { text: 'Take Photo',          onPress: () => launchCamera() },
      { text: 'Choose Photo',        onPress: () => pickMedia('images') },
      { text: 'Choose Video',        onPress: () => pickMedia('videos') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const launchCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.85 });
    if (!result.canceled) setSendMedia({ type: 'image', uri: result.assets[0].uri });
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
      setSendMedia({ type: asset.type === 'video' ? 'video' : 'image', uri: asset.uri });
    }
  };

  // ── Submit ──────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!selectedGym || submitting) return;
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const gymId = selectedGym.id;
      const grade = selectedGrade;

      // 1. Create problem if new
      let finalProblemId = problemId ?? null;
      if (isNew) {
        const autoName = `${holdColor.charAt(0).toUpperCase() + holdColor.slice(1)} ${grade} ${wallSection}`;
        const { data: newP, error: pErr } = await supabase
          .from('problems')
          .insert({
            gym_id:      gymId,
            name:        autoName,
            custom_name: customName.trim() || null,
            hold_color:  holdColor,
            grade,
            wall_section: wallSection,
            created_by:  user.id,
            map_x:       null,
            map_y:       null,
            map_wall_id: null,
          })
          .select('id')
          .single();
        if (pErr) throw pErr;
        finalProblemId = newP.id;
      }

      // 2. Insert session
      const { data: session, error: sErr } = await supabase
        .from('sessions')
        .insert({
          user_id:        user.id,
          gym_id:         gymId,
          total_problems: 1,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        })
        .select('id')
        .single();
      if (sErr) throw sErr;

      // 3. Insert climb
      const { error: cErr } = await supabase
        .from('climbs')
        .insert({
          session_id:  session.id,
          grade,
          count:       1,
          problem_id:  finalProblemId,
        });
      if (cErr) throw cErr;

      // 4. Upload send media and save to session
      let mediaUrl: string | null = null;
      if (sendMedia) {
        mediaUrl = await uploadSessionMedia(sendMedia.uri, sendMedia.type);
        if (mediaUrl) {
          await supabase.from('sessions').update({ media_url: mediaUrl }).eq('id', session.id);
        }
      }

      // 5. Recompute problems.media_url = best-liked session photo for this problem
      if (finalProblemId) {
        const { data: linkedSessions } = await supabase
          .from('sessions')
          .select('id, media_url')
          .eq('id', session.id); // simple: use this session for now; a full recompute would join likes

        // Find all sessions for this problem via climbs
        const { data: climbRows } = await supabase
          .from('climbs')
          .select('session_id')
          .eq('problem_id', finalProblemId);

        if (climbRows && climbRows.length > 0) {
          const sessionIds = climbRows.map(r => r.session_id);
          const { data: candidateSessions } = await supabase
            .from('sessions')
            .select('id, media_url')
            .in('id', sessionIds)
            .not('media_url', 'is', null);

          if (candidateSessions && candidateSessions.length > 0) {
            // Pick session with most likes
            const { data: likeCounts } = await supabase
              .from('likes')
              .select('session_id')
              .in('session_id', candidateSessions.map(s => s.id));

            const countMap: Record<string, number> = {};
            for (const l of likeCounts ?? []) {
              countMap[l.session_id] = (countMap[l.session_id] ?? 0) + 1;
            }
            const best = candidateSessions.reduce((a, b) =>
              (countMap[a.id] ?? 0) >= (countMap[b.id] ?? 0) ? a : b
            );
            await supabase
              .from('problems')
              .update({ media_url: best.media_url })
              .eq('id', finalProblemId);
          }
        }
      }

      setSubmitted(true);
      setTimeout(() => router.navigate('/(tabs)'), 2500);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save session. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.successScreen}>
          <Text style={styles.successEmoji}>🧗</Text>
          <Text style={styles.successTitle}>CLIMB LOGGED</Text>
          <Text style={styles.successSub}>Your crew can see it on the feed.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StepIndicator />

      {/* Nav */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backLabel}>Back</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.heading}>Log Your{'\n'}Send</Text>
        <Text style={styles.subheading}>Fill in the details and submit</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Context pill */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>THE CLIMB</Text>
          <View style={styles.contextPill}>
            <View style={[styles.colorDot, { backgroundColor: swatch }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pillName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.pillGym} numberOfLines={1}>{paramGymName} · {wallSection}</Text>
            </View>
          </View>
        </View>

        {/* Custom name (new problems only) */}
        {isNew && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NICKNAME (OPTIONAL)</Text>
            <TextInput
              style={styles.textInput}
              value={customName}
              onChangeText={setCustomName}
              placeholder="e.g. The Crimpy Traverse"
              placeholderTextColor={INK3}
              maxLength={60}
            />
          </View>
        )}

        {/* Send media — separate from recognition photo */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>YOUR SEND MEDIA</Text>
          {sendMedia ? (
            <View style={styles.mediaPreviewWrapper}>
              {sendMedia.type === 'image' ? (
                <Image source={{ uri: sendMedia.uri }} style={styles.mediaPreview} resizeMode="cover" />
              ) : (
                <View style={styles.videoPreview}>
                  <Text style={styles.videoIcon}>▶</Text>
                  <Text style={styles.videoLabel}>Video selected</Text>
                </View>
              )}
              <TouchableOpacity style={styles.mediaRemoveBtn} onPress={() => setSendMedia(null)} activeOpacity={0.8}>
                <Text style={styles.mediaRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.mediaArea} onPress={handleAddMedia} activeOpacity={0.85}>
              <Text style={styles.mediaIcon}>🎬</Text>
              <Text style={styles.mediaLabel}>Add photo or video</Text>
              <Text style={styles.mediaSubLabel}>Posted to the feed</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Grade slider */}
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
                <Text key={grade} style={[styles.stepLabelText, i === gradeIndex && styles.stepLabelActive]}>
                  {grade}
                </Text>
              ))}
            </View>
          </View>
        </View>

        {/* Gym picker */}
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
                    {active && <Text style={styles.dropdownCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
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

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (!selectedGym || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={!selectedGym || submitting}>
          {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitLabel}>LOG SESSION</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    gap: 2,
  },
  backArrow: { fontSize: 22, fontFamily: 'SpaceGrotesk_300Light', color: INK2, lineHeight: 24, marginTop: -1 },
  backLabel: { fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', color: INK2 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 18,
  },
  heading: {
    fontSize: 26,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -1,
    lineHeight: 30,
  },
  subheading: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK3,
    marginTop: 6,
    lineHeight: 18,
  },

  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },

  // ── Context pill ───────────────────────────────────────────────
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 10,
    paddingHorizontal: 12,
    borderWidth: 0.5,
    borderColor: DIVIDER,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    flexShrink: 0,
  },
  pillName: {
    fontSize: 12,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.2,
  },
  pillGym: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK3,
    marginTop: 1,
  },

  // ── Text input ─────────────────────────────────────────────────
  textInput: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    padding: 14,
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK,
  },

  // ── Send media ─────────────────────────────────────────────────
  mediaArea: {
    height: 100,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  mediaIcon: { fontSize: 22, color: INK3 },
  mediaLabel: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
  },
  mediaSubLabel: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK3,
    opacity: 0.6,
  },
  mediaPreviewWrapper: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
  },
  mediaPreview: { width: '100%', height: 160, borderRadius: 14 },
  videoPreview: {
    width: '100%',
    height: 160,
    backgroundColor: CARD,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoIcon: { fontSize: 32, color: INK },
  videoLabel: { fontSize: 13, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK2 },
  mediaRemoveBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaRemoveText: { fontSize: 12, color: '#ffffff', fontFamily: 'SpaceGrotesk_700Bold' },

  // ── Grade slider ───────────────────────────────────────────────
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
    fontSize: 56,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND,
    letterSpacing: -3,
    marginBottom: 14,
  },
  stepTrack: { width: '100%', height: 32, justifyContent: 'center', marginBottom: 8 },
  stepTrackLine: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: DIVIDER, borderRadius: 2 },
  stepTrackLineFilled: { position: 'absolute', left: 0, height: 1.5, backgroundColor: INK, borderRadius: 2 },
  stepHitArea: { position: 'absolute', width: 32, height: 32, marginLeft: -16, alignItems: 'center', justifyContent: 'center' },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: SURFACE, borderWidth: 0.5, borderColor: 'rgba(26,20,8,0.1)' },
  stepDotActive: { width: 20, height: 20, borderRadius: 10, backgroundColor: INK, borderWidth: 3, borderColor: '#ffffff' },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  stepLabelText: { fontSize: 10, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK3, textAlign: 'center' },
  stepLabelActive: { color: SAND, fontFamily: 'SpaceGrotesk_700Bold' },

  // ── Gym dropdown ───────────────────────────────────────────────
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    padding: 14,
  },
  dropdownTriggerText: { fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold', color: INK, letterSpacing: -0.2 },
  dropdownPlaceholder: { color: INK3 },
  dropdownChevron: { fontSize: 10, color: INK3 },
  dropdownList: { backgroundColor: CARD, borderRadius: 14, borderWidth: 0.5, borderColor: DIVIDER, marginTop: 4 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  dropdownItemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DIVIDER },
  dropdownItemText: { fontSize: 15, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK },
  dropdownItemTextActive: { color: SAND, fontFamily: 'SpaceGrotesk_700Bold' },
  dropdownCheck: { fontSize: 14, color: SAND },

  // ── Notes ──────────────────────────────────────────────────────
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

  // ── Submit ─────────────────────────────────────────────────────
  submitBtn: {
    backgroundColor: SAND,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.35 },
  submitLabel: {
    fontSize: 14,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.3,
  },

  // ── Success ────────────────────────────────────────────────────
  successScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  successEmoji: { fontSize: 64 },
  successTitle: { fontSize: 52, fontFamily: 'Syne_800ExtraBold', color: SAND, letterSpacing: -2, textAlign: 'center', paddingHorizontal: 20 },
  successSub: { fontSize: 16, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK2, letterSpacing: 0.1, textAlign: 'center', paddingHorizontal: 20 },
});
