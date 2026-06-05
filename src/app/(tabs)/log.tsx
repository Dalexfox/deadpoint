import { useCallback, useRef, useState } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { fetchGyms, gymName, type Gym } from '../../lib/gyms';
import { detectHolds, type BoundingBox } from '../../lib/holdDetection';

const BG      = '#ffffff';
const CARD    = '#f4f1eb';
const SURFACE = '#ece8df';
const SAND    = '#c8a84a';
const INK     = '#1a1408';
const INK2    = '#3d3320';
const INK3    = '#8a7a50';
const DIVIDER = 'rgba(26,20,8,0.08)';

const HOLD_COLORS = [
  { id: 'blue',   label: 'Blue',   swatch: '#3070c0' },
  { id: 'red',    label: 'Red',    swatch: '#e8383c' },
  { id: 'yellow', label: 'Yellow', swatch: '#f0c030' },
  { id: 'green',  label: 'Green',  swatch: '#40a060' },
  { id: 'orange', label: 'Orange', swatch: '#f07030' },
  { id: 'purple', label: 'Purple', swatch: '#8050c0' },
  { id: 'pink',   label: 'Pink',   swatch: '#e070a0' },
  { id: 'white',  label: 'White',  swatch: '#e8e4da' },
  { id: 'black',  label: 'Black',  swatch: '#2a2010' },
];

const WALL_SECTIONS = ['Main Wall', 'Cave', 'Slab', 'Overhang', 'Arete'];
const GRADES = ['V0','V1','V2','V3','V4','V5','V6','V7','V8','V9','V10'];

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <View style={si.row}>
      {([1, 2, 3] as const).map((step, i) => (
        <View key={step} style={si.stepGroup}>
          {i > 0 && <View style={si.line} />}
          <View style={[si.dot, step <= current ? si.dotActive : si.dotFuture, step === current && si.dotCurrent]} />
        </View>
      ))}
      <Text style={si.label}>Step 1 of 3 — Identify climb</Text>
    </View>
  );
}

const si = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4, gap: 0 },
  stepGroup:  { flexDirection: 'row', alignItems: 'center' },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  dotActive:  { backgroundColor: SAND },
  dotFuture:  { backgroundColor: 'rgba(26,20,8,0.15)' },
  dotCurrent: { width: 10, height: 10, borderRadius: 5 },
  line:       { width: 24, height: 1, backgroundColor: 'rgba(26,20,8,0.15)', marginHorizontal: 4 },
  label:      { fontSize: 11, fontFamily: 'SpaceGrotesk_600SemiBold', color: INK3, marginLeft: 10 },
});

export default function LogScreen() {
  const router = useRouter();
  const [gyms, setGyms]                     = useState<Gym[]>([]);
  const [selectedGym, setSelectedGym]       = useState<Gym | null>(null);
  const [gymDropdownOpen, setGymDropdownOpen] = useState(false);
  const [holdColor, setHoldColor]           = useState<string | null>(null);
  const [wallSection, setWallSection]       = useState<string | null>(null);
  const [gradeIndex, setGradeIndex]         = useState(0);
  const selectedGrade = GRADES[gradeIndex];
  const [photoUri, setPhotoUri]             = useState<string | null>(null);
  const [boxes, setBoxes]                   = useState<BoundingBox[]>([]);
  const [detecting, setDetecting]           = useState(false);
  const [photoLayout, setPhotoLayout]       = useState({ width: 1, height: 1 });
  const [querying, setQuerying]             = useState(false);

  useFocusEffect(useCallback(() => {
    fetchGyms().then(setGyms);
  }, []));

  const canContinue = selectedGym !== null && holdColor !== null && wallSection !== null;

  // ── Photo & detection ───────────────────────────────────────────

  const runDetection = async (uri: string, color: string) => {
    setDetecting(true);
    setBoxes([]);
    try {
      const result = await detectHolds(uri, color);
      setBoxes(result);
    } catch {
      setBoxes([]);
    } finally {
      setDetecting(false);
    }
  };

  const handleTakePhoto = async () => {
    Alert.alert('Identify hold color', '', [
      { text: 'Take Photo',        onPress: () => launchCamera() },
      { text: 'Choose from Library', onPress: () => launchLibrary() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const launchCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 });
    if (!result.canceled) processPhoto(result.assets[0].uri);
  };

  const launchLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
    if (!result.canceled) processPhoto(result.assets[0].uri);
  };

  const processPhoto = (uri: string) => {
    setPhotoUri(uri);
    if (holdColor) runDetection(uri, holdColor);
  };

  const handleSelectColor = (colorId: string) => {
    setHoldColor(colorId);
    if (photoUri) runDetection(photoUri, colorId);
  };

  // ── Query & navigate ────────────────────────────────────────────

  const queryAndNavigate = async (skip: boolean) => {
    if (!canContinue || querying) return;
    setQuerying(true);
    try {
      const params = new URLSearchParams({
        gymId:       selectedGym!.id,
        gymName:     selectedGym!.name,
        holdColor:   holdColor!,
        wallSection: wallSection!,
        grade:       selectedGrade,
      });

      if (!skip) {
        const { data } = await supabase
          .from('problems')
          .select('*')
          .eq('gym_id', selectedGym!.id)
          .eq('hold_color', holdColor!)
          .eq('wall_section', wallSection!)
          .eq('grade', selectedGrade);

        if (data && data.length > 0) {
          router.push(`/log-flow/match?${params.toString()}`);
          return;
        }
        params.set('newProblem', 'true');
        Alert.alert("You're the first! 🧗", "No one has logged this climb yet. You're breaking new ground.", [
          { text: 'Log It', onPress: () => router.push(`/log-flow/send?${params.toString()}`) },
        ]);
        return;
      }
      params.set('newProblem', 'true');
      router.push(`/log-flow/send?${params.toString()}`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not search problems.');
    } finally {
      setQuerying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StepIndicator current={1} />

      <View style={styles.header}>
        <Text style={styles.heading}>Identify Your{'\n'}Climb</Text>
        <Text style={styles.subheading}>Photo helps detect hold color automatically</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* 1 ── Recognition photo */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECOGNITION PHOTO</Text>
          <TouchableOpacity
            style={styles.photoArea}
            onPress={handleTakePhoto}
            activeOpacity={0.85}
            onLayout={e => setPhotoLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>

            {photoUri ? (
              <>
                <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                {/* Dark desaturating overlay */}
                {boxes.length > 0 && (
                  <View style={[StyleSheet.absoluteFill, styles.darkOverlay]} />
                )}
                {/* Hold highlight boxes */}
                {boxes.map((box, i) => (
                  <View
                    key={i}
                    style={[styles.holdBox, {
                      left:   box.x      * photoLayout.width,
                      top:    box.y      * photoLayout.height,
                      width:  box.width  * photoLayout.width,
                      height: box.height * photoLayout.height,
                    }]}
                  />
                ))}
                {detecting && (
                  <View style={styles.detectingOverlay}>
                    <ActivityIndicator color={SAND} />
                    <Text style={styles.detectingLabel}>Detecting holds…</Text>
                  </View>
                )}
                {!detecting && boxes.length === 0 && photoUri && (
                  <View style={styles.noHoldsLabel}>
                    <Text style={styles.noHoldsText}>No holds detected</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.photoEmpty}>
                <Text style={styles.cameraIcon}>📷</Text>
                <Text style={styles.photoEmptyLabel}>Take a photo of the climb</Text>
                <View style={styles.detectionPill}>
                  <Text style={styles.detectionPillText}>For detection only — not posted</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* 2 ── Hold color chips */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HOLD COLOR</Text>
          <View style={styles.chipRow}>
            {HOLD_COLORS.map(c => {
              const active = holdColor === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.colorChip, active ? { backgroundColor: c.swatch, borderWidth: 0 } : styles.colorChipInactive]}
                  onPress={() => handleSelectColor(c.id)}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipText, { color: active ? '#ffffff' : INK2 }]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 3 ── Wall section chips */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WALL SECTION</Text>
          <View style={styles.chipRow}>
            {WALL_SECTIONS.map(ws => {
              const active = wallSection === ws;
              return (
                <TouchableOpacity
                  key={ws}
                  style={[styles.wallChip, active ? styles.wallChipActive : styles.wallChipInactive]}
                  onPress={() => setWallSection(ws)}
                  activeOpacity={0.7}>
                  <Text style={[styles.chipText, { color: active ? '#ffffff' : INK2 }]}>{ws}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 4 ── Grade */}
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

        {/* 5 ── Gym picker */}
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

        {/* 5 ── CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, (!canContinue || querying) && styles.ctaBtnDisabled]}
          onPress={() => queryAndNavigate(false)}
          activeOpacity={0.85}
          disabled={!canContinue || querying}>
          {querying ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.ctaLabel}>IDENTIFY CLIMB</Text>}
        </TouchableOpacity>

        <View style={styles.skipRow}>
          <Text style={styles.skipStatic}>No photo? </Text>
          <TouchableOpacity onPress={() => queryAndNavigate(true)} disabled={!canContinue || querying} activeOpacity={0.7}>
            <Text style={[styles.skipLink, (!canContinue || querying) && { opacity: 0.4 }]}>
              Skip — log by attributes only
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
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

  // ── Photo area ─────────────────────────────────────────────────
  photoArea: {
    height: 180,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoEmpty: {
    alignItems: 'center',
    gap: 6,
  },
  cameraIcon: { fontSize: 28, color: INK3 },
  photoEmptyLabel: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
  },
  detectionPill: {
    marginTop: 4,
    backgroundColor: 'rgba(200,168,74,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(200,168,74,0.4)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  detectionPillText: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: SAND,
  },
  darkOverlay: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  holdBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: SAND,
    borderRadius: 6,
    backgroundColor: 'rgba(200,168,74,0.15)',
  },
  detectingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  detectingLabel: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#ffffff',
  },
  noHoldsLabel: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  noHoldsText: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: 'rgba(255,255,255,0.7)',
  },

  // ── Chips ──────────────────────────────────────────────────────
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  colorChip: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  colorChipInactive: {
    backgroundColor: SURFACE,
    borderWidth: 0.5,
    borderColor: DIVIDER,
  },
  wallChip: {
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  wallChipActive: {
    backgroundColor: SAND,
    borderWidth: 0,
  },
  wallChipInactive: {
    backgroundColor: SURFACE,
    borderWidth: 0.5,
    borderColor: DIVIDER,
  },
  chipText: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },

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
  stepLabelTextActive: { color: SAND, fontFamily: 'SpaceGrotesk_700Bold' },

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
  dropdownTriggerText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK,
    letterSpacing: -0.2,
  },
  dropdownPlaceholder: { color: INK3 },
  dropdownChevron: { fontSize: 10, color: INK3 },
  dropdownList: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    marginTop: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  dropdownItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  dropdownItemText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK,
  },
  dropdownItemTextActive: {
    color: SAND,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  dropdownCheck: { fontSize: 14, color: SAND },

  // ── CTA ────────────────────────────────────────────────────────
  ctaBtn: {
    backgroundColor: SAND,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  ctaBtnDisabled: { opacity: 0.35 },
  ctaLabel: {
    fontSize: 14,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
  },
  skipStatic: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
  },
  skipLink: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: SAND,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },
});
