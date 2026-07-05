import { useEffect, useRef, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { uploadSessionMedia, uploadProblemStartPhoto } from '../../lib/store';
import { syncHomeGymAfterSubmit } from '../../lib/homeGym';
import { isNewHighPoint } from '../../lib/stats';
import { ensureCameraPermission } from '../../lib/permissions';
import { fetchGyms, type Gym } from '../../lib/gyms';
import { track } from '../../lib/analytics';
import { queuePendingLog, drainPendingLogs } from '../../lib/pendingLogs';
import { VideoBackground } from '../../components/VideoBackground';
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

// Sticky smart defaults (Strava's "you'll probably do what you did last time"):
// the last grade + gym you logged pre-fill the next log, so the common case —
// another climb at your level at your gym — is zero setup taps.
const LAST_GRADE_KEY = 'deadpoint:lastGrade';
const LAST_GYM_KEY   = 'deadpoint:lastGymId';

type SendMedia = { type: 'image' | 'video'; uri: string };

// Recent-problems shortlist — problems logged at this gym in the last 14 days.
// Tapping one attributes the log to that problem AND sets the grade. Community
// logging becomes the autocomplete; quick logs regain catalog attribution.
type ShortlistProblem = {
  id: string;
  label: string;
  grade: string;
  holdColor: string;
  sends: number;
};

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function StepIndicator({ quick }: { quick?: boolean }) {
  if (quick) {
    return (
      <View style={si.row}>
        <View style={[si.dot, si.dotActive, si.dotCurrent]} />
        <Text style={si.label}>Quick log — just the grade</Text>
      </View>
    );
  }
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
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    gymId:        string;
    gymName:      string;
    holdColor:    string;
    wallSection:  string;
    grade?:       string;  // from Screen 1 (identify flow)
    problemId?:   string;
    problemName?: string;
    problemGrade?: string; // from Screen 2 (matched problem)
    newProblem?:  string;
    focusNickname?: string; // from the "first to log" celebration → auto-focus nickname
    photoUri?:    string;   // recognition photo + start-hold coords (for new problems)
    startX?:      string;
    startY?:      string;
    quick?:       string;   // 'true' = Quick Log — no problem matching/attribution
  }>();

  const {
    gymId,
    gymName: paramGymName,
    holdColor,
    wallSection,
    grade: screen1Grade,
    problemId,
    problemName,
    problemGrade,
    newProblem,
    focusNickname,
    photoUri,
    startX,
    startY,
    quick,
  } = params;

  const isQuick = quick === 'true';

  // Grade comes from Screen 2 (problemGrade) if a match was selected,
  // or from Screen 1 (screen1Grade) if skipped / no match found.
  const initialGrade = problemGrade ?? screen1Grade ?? 'V0';

  const isNew = newProblem === 'true';
  const swatch = HOLD_COLOR_SWATCHES[holdColor] ?? '#888';
  const displayName = isNew
    ? `${holdColor.charAt(0).toUpperCase() + holdColor.slice(1)} ${wallSection}`
    : (problemName ?? 'Unknown Climb');

  const [gyms, setGyms]               = useState<Gym[]>([]);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [gymDropdownOpen, setGymDropdownOpen] = useState(false);

  const [gradeIndex, setGradeIndex]   = useState(() => {
    const idx = GRADES.indexOf(initialGrade);
    return idx >= 0 ? idx : 0;
  });
  const selectedGrade = GRADES[gradeIndex];

  const [customName, setCustomName]   = useState('');
  const [notes, setNotes]             = useState('');
  const [sendMedia, setSendMedia]     = useState<SendMedia | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [showHighPoint, setShowHighPoint] = useState(false);
  const [highPointGrade, setHighPointGrade] = useState('');
  // Visibility — defaults to Public on every launch (useState default handles the reset).
  const [isPublic, setIsPublic] = useState(true);
  // Solo — when on, this climb is never grouped with same-day sends in the feed.
  const [postSolo, setPostSolo] = useState(false);
  // Send style — optional per-climb tag. null = not chosen (no tag shown).
  const [sendStyle, setSendStyle] = useState<'flash' | 'send' | 'project' | null>(null);
  const nicknameRef = useRef<TextInput>(null);

  // ── Reward-screen + log-another state ─────────────────────────────
  // "+ Log another" keeps the composer mounted for the next climb of the same
  // session; the follow-up log is always a quick log (no problem attribution
  // carried over from the identify flow).
  const [quickAgain,   setQuickAgain]   = useState(false);
  const [loggedGrade,  setLoggedGrade]  = useState('');          // grade shown on the reward screen
  const [monthCount,   setMonthCount]   = useState<number | null>(null);
  const [offlineSaved, setOfflineSaved] = useState(false);       // reward variant: queued for later
  const [shortlist,    setShortlist]    = useState<ShortlistProblem[]>([]);
  const [shortlistSel, setShortlistSel] = useState<ShortlistProblem | null>(null);

  const effQuick     = isQuick || quickAgain;
  const effIsNew     = isNew && !quickAgain;
  const effProblemId = quickAgain ? null : (problemId ?? null);

  // Instrumentation: log_started on mount, log_abandoned if unmounted unsaved.
  const mountTs           = useRef(Date.now());
  const submittedRef      = useRef(false);
  const gradeTouchedRef   = useRef(false);
  const identifySwitchRef = useRef(false);

  useEffect(() => {
    track('log_started', { mode: isQuick ? 'quick' : 'identify' });
    drainPendingLogs().catch(() => {}); // post anything queued while offline
    return () => {
      if (!submittedRef.current) {
        track(identifySwitchRef.current ? 'log_switched_identify' : 'log_abandoned', {
          ms: Date.now() - mountTs.current,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sticky grade — quick logs default to the last grade you logged, not V0
  // (nobody warms up on V0 every session; most logs are at your level ±1).
  useEffect(() => {
    if (!isQuick || problemGrade || screen1Grade) return;
    AsyncStorage.getItem(LAST_GRADE_KEY)
      .then((g) => {
        if (!g || gradeTouchedRef.current) return;
        const idx = GRADES.indexOf(g);
        if (idx >= 0) setGradeIndex(idx);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setGrade = (i: number) => {
    gradeTouchedRef.current = true;
    setGradeIndex(i);
  };

  useEffect(() => {
    fetchGyms().then(async (fetched) => {
      setGyms(fetched);
      let match = fetched.find(g => g.id === gymId);
      if (!match && isQuick) {
        // Instant default: last gym you logged at (device cache — no network)…
        try {
          const lastId = await AsyncStorage.getItem(LAST_GYM_KEY);
          if (lastId) match = fetched.find(g => g.id === lastId);
        } catch { /* fall through */ }
        // …falling back to the profile's home gym.
        if (!match) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: prof } = await supabase.from('profiles').select('home_gym_id').eq('id', user.id).single();
              if (prof?.home_gym_id) match = fetched.find(g => g.id === prof.home_gym_id);
            }
          } catch { /* user picks the gym manually */ }
        }
      }
      if (match) setSelectedGym(match);
    });
  }, [gymId, isQuick]);

  // Auto-focus the nickname field when arriving from the "you're the first" celebration.
  // Delayed so the screen-transition animation settles before the keyboard opens.
  useEffect(() => {
    if (isNew && focusNickname === 'true') {
      const t = setTimeout(() => nicknameRef.current?.focus(), 450);
      return () => clearTimeout(t);
    }
  }, [isNew, focusNickname]);

  // ── Recent-problems shortlist (quick mode) ──────────────────────
  // What's been logged at this gym in the last 14 days, ranked by send count.
  // Best-effort: hidden while loading or when the gym has no recent catalog logs.
  useEffect(() => {
    if (!selectedGym || !effQuick) { setShortlist([]); return; }
    let alive = true;
    (async () => {
      try {
        const since = new Date(Date.now() - 14 * 86400000).toISOString();
        const { data: sess } = await supabase
          .from('sessions')
          .select('id')
          .eq('gym_id', selectedGym.id)
          .gte('created_at', since)
          .limit(200);
        const ids = (sess ?? []).map(s => s.id);
        if (ids.length === 0) { if (alive) setShortlist([]); return; }
        const { data: climbs } = await supabase
          .from('climbs')
          .select('problem_id')
          .in('session_id', ids)
          .not('problem_id', 'is', null);
        const counts = new Map<string, number>();
        (climbs ?? []).forEach((c: { problem_id: string | null }) => {
          if (c.problem_id) counts.set(c.problem_id, (counts.get(c.problem_id) ?? 0) + 1);
        });
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([pid]) => pid);
        if (top.length === 0) { if (alive) setShortlist([]); return; }
        const { data: probs } = await supabase
          .from('problems')
          .select('id, name, custom_name, grade, hold_color')
          .in('id', top)
          .is('archived_at', null); // live problems only — never tag a stripped climb
        const byId = new Map((probs ?? []).map(p => [p.id, p]));
        const list = top
          .map(pid => {
            const p = byId.get(pid);
            return p
              ? { id: p.id, label: p.custom_name || p.name, grade: p.grade, holdColor: p.hold_color, sends: counts.get(pid) ?? 0 }
              : null;
          })
          .filter(Boolean) as ShortlistProblem[];
        if (alive) setShortlist(list);
      } catch {
        if (alive) setShortlist([]);
      }
    })();
    return () => { alive = false; };
  }, [selectedGym, effQuick]);

  const toggleShortlist = (p: ShortlistProblem) => {
    if (shortlistSel?.id === p.id) {
      setShortlistSel(null);
      return;
    }
    setShortlistSel(p);
    const idx = GRADES.indexOf(p.grade);
    if (idx >= 0) setGrade(idx);
  };

  // ── Send media picker (completely separate from recognition photo) ──
  // ⚠️ Videos MUST keep `allowsEditing: true` + `videoMaxDuration: 60`: the
  // trim-UI (UIImagePickerController) export is the PROVEN iOS path. The
  // build-#24 combined picker (`allowsEditing: false` → PHPicker export) failed
  // SILENTLY for videos on-device — no asset, no error, no preview. Photos keep
  // `allowsEditing: false` (no forced crop screen — that part worked great).
  // Every failure path now alerts + tracks; a picker failure is never silent.

  const handleAddMedia = () => {
    Alert.alert('Add to your post', '', [
      { text: 'Take Photo',   onPress: () => launchCamera() },
      { text: 'Choose Photo', onPress: () => pickMedia('images') },
      { text: 'Choose Video', onPress: () => pickMedia('videos') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickMedia = async (type: 'images' | 'videos') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: [type],
        allowsEditing: type === 'videos',
        quality: 0.85,
        ...(type === 'videos' ? { videoMaxDuration: 60 } : {}),
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        track('media_pick_failed', { type, reason: 'no_asset' });
        Alert.alert("Couldn't load that", 'Please try a different photo or video.');
        return;
      }
      // Extension sniff as a backstop in case asset.type comes back null.
      const isVideo = asset.type === 'video' || /\.(mp4|mov|m4v|avi)$/i.test(asset.uri);
      setSendMedia({ type: isVideo ? 'video' : 'image', uri: asset.uri });
    } catch (e: any) {
      track('media_pick_failed', { type, reason: e?.message ?? 'threw' });
      Alert.alert("Couldn't load that", 'Please try a different photo or video.');
    }
  };

  const launchCamera = async () => {
    if (!(await ensureCameraPermission())) return;
    try {
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.85 });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (asset?.uri) setSendMedia({ type: 'image', uri: asset.uri });
    } catch (e: any) {
      track('media_pick_failed', { type: 'camera', reason: e?.message ?? 'threw' });
      Alert.alert("Couldn't take that photo", 'Please try again.');
    }
  };

  // ── Submit ──────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!selectedGym || submitting) return;
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const gymIdSubmit = selectedGym.id;
      const grade = selectedGrade;

      // 1. Create problem if new
      let finalProblemId = shortlistSel?.id ?? effProblemId;
      if (effIsNew) {
        const autoName = `${holdColor.charAt(0).toUpperCase() + holdColor.slice(1)} ${grade} ${wallSection}`;
        const sx = startX ? parseFloat(startX) : null;
        const sy = startY ? parseFloat(startY) : null;
        const { data: newP, error: pErr } = await supabase
          .from('problems')
          .insert({
            gym_id:      gymIdSubmit,
            name:        autoName,
            custom_name: customName.trim() || null,
            hold_color:  holdColor,
            grade,
            wall_section: wallSection,
            created_by:  user.id,
            map_x:       sx,   // start-hold position on the recognition photo (0–1)
            map_y:       sy,
            map_wall_id: null,
          })
          .select('id')
          .single();
        if (pErr) throw pErr;
        finalProblemId = newP.id;

        // Upload the recognition photo as this problem's start-hold reference image
        // — in the BACKGROUND so logging doesn't wait on it (it's only used later,
        // on the match screen for the next logger of this problem).
        if (photoUri && sx != null && sy != null) {
          const newProblemId = newP.id;
          uploadProblemStartPhoto(photoUri, newProblemId)
            .then((startUrl) => {
              if (startUrl) supabase.from('problems').update({ start_photo_url: startUrl }).eq('id', newProblemId);
            })
            .catch(() => {});
        }
      }

      // 2. Insert session (with visibility; feed_rank starts null = system order)
      const { data: session, error: sErr } = await supabase
        .from('sessions')
        .insert({
          user_id:        user.id,
          gym_id:         gymIdSubmit,
          total_problems: 1,
          visibility:     isPublic ? 'public' : 'quiet',
          feed_rank:      null,
          solo:           postSolo,
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
          ...(sendStyle ? { send_style: sendStyle } : {}),
        });
      if (cErr) throw cErr;

      // The climb is SAVED — show the reward screen NOW. Everything below is
      // background work that must never delay the "logged" moment.
      AsyncStorage.setItem(LAST_GRADE_KEY, grade).catch(() => {});
      AsyncStorage.setItem(LAST_GYM_KEY, gymIdSubmit).catch(() => {});
      track('log_submitted', {
        ms:      Date.now() - mountTs.current,
        mode:    effQuick ? 'quick' : 'identify',
        media:   sendMedia?.type ?? 'none',
        grade,
        gym_id:  gymIdSubmit,
        quiet:   !isPublic,
        problem: !!finalProblemId,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setLoggedGrade(grade);
      setMonthCount(null);
      submittedRef.current = true;
      setSubmitted(true);

      // 4. Upload send media + recompute the cover — in the BACKGROUND.
      //    A big video upload must NOT make "logged" wait. The promise survives
      //    navigation (not tied to component state); Alert is global so an
      //    upload failure still surfaces.
      const sessionId = session.id;
      const coverProblemId = finalProblemId;
      if (sendMedia) {
        const media = sendMedia;
        (async () => {
          const up = await uploadSessionMedia(media.uri, media.type);
          if (up.url) {
            await supabase.from('sessions').update({ media_url: up.url }).eq('id', sessionId);
            // Recompute the problem cover (SECURITY DEFINER + visibility filter live
            // in the DB function — quiet sessions can never become a cover).
            if (coverProblemId) await supabase.rpc('recompute_problem_cover', { problem_id: coverProblemId });
          } else {
            Alert.alert(
              `Your ${media.type} didn't upload`,
              `${up.error ?? 'Unknown error'}\n\nThe climb was logged, but without the ${media.type}. Videos over the storage size limit are the usual cause.`,
            );
          }
        })().catch(() => {});
      } else if (coverProblemId) {
        // No media to upload — still refresh the cover in the background.
        supabase.rpc('recompute_problem_cover', { problem_id: coverProblemId });
      }

      // Silent home-gym inference — best-effort, fire-and-forget so it never blocks.
      syncHomeGymAfterSubmit(user.id, gymIdSubmit);

      // Reward-screen stat: how many climbs this month (includes this one).
      (async () => {
        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', start.toISOString());
        if (count != null && submittedRef.current) setMonthCount(count);
      })().catch(() => {});

      // New high point? Computed in the BACKGROUND — the reward screen never
      // waits on these queries; the celebration overlays when it resolves.
      // A project isn't a send — never a high point. Query errors never
      // celebrate falsely.
      if (sendStyle !== 'project') {
        (async () => {
          let isHigh = false;
          try {
            const { data: userSessions } = await supabase
              .from('sessions')
              .select('id')
              .eq('user_id', user.id);
            const otherIds = (userSessions ?? [])
              .map(s => s.id)
              .filter((id: string) => id !== session.id);
            if (otherIds.length === 0) {
              isHigh = true; // first-ever log
            } else {
              const { data: prevClimbs } = await supabase
                .from('climbs')
                .select('grade, send_style')
                .in('session_id', otherIds);
              // Previous projects don't count as sends → exclude them from the prior max.
              const prevSentGrades = (prevClimbs ?? [])
                .filter((c: { send_style: string | null }) => c.send_style !== 'project')
                .map((c: { grade: string }) => c.grade);
              isHigh = isNewHighPoint(grade, prevSentGrades);
            }
          } catch {
            isHigh = false;
          }
          if (isHigh && submittedRef.current) {
            setHighPointGrade(grade);
            setShowHighPoint(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
        })().catch(() => {});
      }
    } catch (err: any) {
      // Offline? Offer to queue the log and post it automatically later.
      // (New-problem creation is never queued — keep the form open instead.)
      const isNetworkErr = /network|fetch|internet|timed?\s?out/i.test(err?.message ?? '');
      if (isNetworkErr && !effIsNew && selectedGym) {
        const gymIdQueued = selectedGym.id;
        Alert.alert(
          'No connection',
          "Couldn't reach the server. Save this climb and post it automatically when you're back online?",
          [
            {
              text: 'Save & post later',
              onPress: async () => {
                try {
                  await queuePendingLog({
                    gymId:      gymIdQueued,
                    grade:      selectedGrade,
                    sendStyle,
                    notes:      notes.trim(),
                    visibility: isPublic ? 'public' : 'quiet',
                    solo:       postSolo,
                    problemId:  shortlistSel?.id ?? effProblemId,
                    mediaUri:   sendMedia?.uri ?? null,
                    mediaType:  sendMedia?.type ?? null,
                  });
                  setLoggedGrade(selectedGrade);
                  setOfflineSaved(true);
                  submittedRef.current = true;
                  setSubmitted(true);
                } catch {
                  Alert.alert('Error', "Couldn't save the climb on this device either. Please try again.");
                }
              },
            },
            { text: 'Keep editing', style: 'cancel' },
          ],
        );
      } else {
        Alert.alert('Error', err.message ?? 'Could not save session. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── "+ Log another" — reset for the next climb of this session ─────
  // Keeps gym + grade (sticky) and stays in the composer; the follow-up log is
  // a quick log (no problem/new-problem context carried over).
  const handleLogAnother = () => {
    setQuickAgain(true);
    setSubmitted(false);
    setShowHighPoint(false);
    setOfflineSaved(false);
    setSendMedia(null);
    setNotes('');
    setSendStyle(null);
    setCustomName('');
    setPostSolo(false);
    setMonthCount(null);
    setShortlistSel(null);
    submittedRef.current = false;
    mountTs.current = Date.now();
    track('log_started', { mode: 'again' });
  };

  // ── Success screens ─────────────────────────────────────────────

  // New-high-point celebration — full-screen, SAND on INK; tap returns to the
  // reward screen (where "+ Log another" lives).
  if (submitted && showHighPoint) {
    return (
      <TouchableOpacity
        style={styles.highPointScreen}
        activeOpacity={1}
        onPress={() => setShowHighPoint(false)}>
        <Text style={styles.highPointLabel}>NEW HIGH POINT</Text>
        <Text style={styles.highPointGrade}>{highPointGrade}</Text>
        <Text style={styles.highPointSub}>Your hardest send yet.</Text>
      </TouchableOpacity>
    );
  }

  // Reward screen — the post-log moment. Guaranteed acknowledgment (grade +
  // month stat) and the session loop: "+ Log another" or Done.
  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.successScreen}>
          <Text style={styles.rewardKicker}>{offlineSaved ? 'SAVED' : 'LOGGED'}</Text>
          <Text style={styles.rewardGrade}>{loggedGrade}</Text>
          {!offlineSaved && monthCount != null && (
            <Text style={styles.rewardStat}>Your {ordinal(monthCount)} climb this month</Text>
          )}
          <Text style={styles.successSub}>
            {offlineSaved
              ? "You're offline — it'll post automatically when you're back."
              : isPublic
                ? 'Your crew can see it on the feed.'
                : 'Logged to your climbs — only you can see it.'}
          </Text>
          <TouchableOpacity style={styles.logAnotherBtn} onPress={handleLogAnother} activeOpacity={0.85}>
            <Text style={styles.logAnotherLabel}>+ LOG ANOTHER</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.navigate('/(tabs)')} activeOpacity={0.7}>
            <Text style={styles.doneLabel}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StepIndicator quick={effQuick} />

      {/* Nav */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backLabel}>Back</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.heading}>Log Your{'\n'}Send</Text>
        <Text style={styles.subheading}>
          {effQuick ? 'Grade + go — everything else is optional' : 'Fill in the details and submit'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive">

        {/* Quick log → opt-in to the detailed identify flow (tag a specific problem
            in the gym's catalog). Most logs don't need this; it's here for the
            climbers who want their send attributed to a specific climb. */}
        {effQuick && !effProblemId && (
          <TouchableOpacity
            style={styles.identifyLink}
            onPress={() => {
              identifySwitchRef.current = true;
              if (gymId) router.push(`/gym/${gymId}/log`);
              else router.push('/(tabs)/log');
            }}
            activeOpacity={0.7}>
            <Ionicons name="locate-outline" size={15} color={SAND} />
            <Text style={styles.identifyLinkText}>Identify the exact climb</Text>
            <Text style={styles.identifyLinkChevron}>›</Text>
          </TouchableOpacity>
        )}

        {/* Context pill — the matched/new problem. Shown in identify mode AND for
            a quick log arriving from a problem page (problemId param) so the
            attribution is visible. Hidden only for plain quick logs. */}
        {(!effQuick || !!effProblemId) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>THE CLIMB</Text>
            <View style={styles.contextPill}>
              <View style={[styles.colorDot, { backgroundColor: swatch }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pillName} numberOfLines={1}>{displayName}</Text>
                <Text style={styles.pillGym} numberOfLines={1}>
                  {[paramGymName, wallSection].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Custom name (new problems only) */}
        {effIsNew && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NICKNAME (OPTIONAL)</Text>
            <TextInput
              ref={nicknameRef}
              style={styles.textInput}
              value={customName}
              onChangeText={setCustomName}
              placeholder="e.g. The Crimpy Traverse"
              placeholderTextColor={INK3}
              maxLength={60}
            />
          </View>
        )}

        {/* Recent problems at this gym — tap to tag your send (sets the grade too).
            Hidden when the log already has problem context (problem page / match). */}
        {effQuick && !effProblemId && shortlist.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ON THE WALL — TAP TO TAG (OPTIONAL)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortlistRow}>
              {shortlist.map((p) => {
                const active = shortlistSel?.id === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.shortlistChip, active && styles.shortlistChipActive]}
                    onPress={() => toggleShortlist(p)}
                    activeOpacity={0.8}>
                    <View style={[styles.colorDot, { backgroundColor: HOLD_COLOR_SWATCHES[p.holdColor] ?? '#888' }]} />
                    <Text style={[styles.shortlistName, active && styles.shortlistNameActive]} numberOfLines={1}>
                      {p.label}
                    </Text>
                    <Text style={[styles.shortlistGrade, active && styles.shortlistGradeActive]}>{p.grade}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Grade — the one required decision, so it comes first */}
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
                    onPress={() => setGrade(i)}
                    activeOpacity={0.7}>
                    <View style={[styles.stepDot, active && styles.stepDotActive]} />
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.stepLabels}>
              {GRADES.map((grade, i) => (
                <TouchableOpacity
                  key={grade}
                  onPress={() => setGrade(i)}
                  hitSlop={{ top: 10, bottom: 12, left: 3, right: 3 }}
                  activeOpacity={0.7}>
                  <Text style={[styles.stepLabelText, i === gradeIndex && styles.stepLabelActive]}>
                    {grade}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Send media — separate from recognition photo */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>YOUR SEND MEDIA</Text>
          {sendMedia ? (
            <View style={styles.mediaPreviewWrapper}>
              {sendMedia.type === 'image' ? (
                <Image source={{ uri: sendMedia.uri }} style={styles.mediaPreview} resizeMode="cover" />
              ) : (
                <View style={styles.videoPreview}>
                  {/* Cover = the video's first frame (paused), via expo-video */}
                  <VideoBackground uri={sendMedia.uri} isActive={false} />
                  <View style={styles.videoPlayBadge} pointerEvents="none">
                    <Text style={styles.videoPlayIcon}>▶</Text>
                  </View>
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

        {/* Send style — optional per-climb tag */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SEND STYLE (OPTIONAL)</Text>
          <View style={styles.styleRow}>
            {(['flash', 'send', 'project'] as const).map((opt) => {
              const active = sendStyle === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.styleChip, active && styles.styleChipActive]}
                  onPress={() => setSendStyle(active ? null : opt)}
                  activeOpacity={0.8}>
                  <Text style={[styles.styleChipText, active && styles.styleChipTextActive]}>
                    {opt === 'flash' ? 'Flash' : opt === 'send' ? 'Send' : 'Project'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.styleHint}>
            {sendStyle === 'flash'    ? 'Sent it first try.'
             : sendStyle === 'send'    ? 'Sent it after working the moves.'
             : sendStyle === 'project' ? "Still working it — won't count toward your top grade."
             : 'Tag how it went, or leave it off.'}
          </Text>
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

        {/* Visibility — Public (eye, SAND) ↔ Quiet (eye-off, INK3). Defaults Public.
            Copy makes the feed connection explicit: logging publicly = posting to
            your feed; quiet = logged to your climbs only (beta feedback #6). */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.visibilityRow}
            onPress={() => setIsPublic(v => !v)}
            activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={styles.visibilityLabel}>
                {isPublic ? 'SHARE TO FEED' : 'ONLY YOU'}
              </Text>
              <Text style={styles.soloHint}>
                {isPublic
                  ? 'Posts to your feed for everyone to see'
                  : 'Logged to your climbs — not shared to the feed'}
              </Text>
            </View>
            <Ionicons
              name={isPublic ? 'eye-outline' : 'eye-off-outline'}
              size={22}
              color={isPublic ? SAND : INK3}
            />
          </TouchableOpacity>
        </View>

        {/* Post on its own — when on, this climb is never grouped with same-day sends. */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.visibilityRow}
            onPress={() => setPostSolo(v => !v)}
            activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={styles.visibilityLabel}>POST ON ITS OWN</Text>
              <Text style={styles.soloHint}>
                {postSolo ? "Won't be grouped with today's other sends" : 'Groups with your other sends here today'}
              </Text>
            </View>
            <Ionicons
              name={postSolo ? 'checkbox' : 'square-outline'}
              size={22}
              color={postSolo ? SAND : INK3}
            />
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Fixed footer submit — always visible, no scrolling to log (the primary
          action never hides below the fold). */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={[styles.submitBtn, (!selectedGym || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={!selectedGym || submitting}>
          {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitLabel}>LOG SEND</Text>}
        </TouchableOpacity>
      </View>
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
    paddingBottom: 24,
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

  // ── Recent-problems shortlist ──────────────────────────────────
  shortlistRow: {
    gap: 8,
    paddingRight: 8,
  },
  shortlistChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: DIVIDER,
    maxWidth: 220,
  },
  shortlistChipActive: {
    borderColor: SAND,
    backgroundColor: 'rgba(200,168,74,0.10)',
  },
  shortlistName: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK2,
    flexShrink: 1,
  },
  shortlistNameActive: { color: INK },
  shortlistGrade: {
    fontSize: 12,
    fontFamily: 'Syne_800ExtraBold',
    color: INK3,
  },
  shortlistGradeActive: { color: SAND },

  // ── Send style chips ───────────────────────────────────────────
  styleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  styleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: CARD,
    borderWidth: 0.5,
    borderColor: DIVIDER,
  },
  styleChipActive: {
    backgroundColor: SAND,
    borderColor: SAND,
  },
  styleChipText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK2,
    letterSpacing: -0.2,
  },
  styleChipTextActive: {
    color: '#ffffff',
  },
  styleHint: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK3,
    marginTop: 2,
    lineHeight: 17,
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
  // Quick-log → "identify the exact climb" opt-in link
  identifyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: SURFACE,
    marginBottom: 4,
  },
  identifyLinkText: { fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold', color: INK },
  identifyLinkChevron: { fontSize: 16, fontFamily: 'SpaceGrotesk_300Light', color: INK3 },
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
    backgroundColor: '#0d0a05',
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayIcon: { fontSize: 16, color: '#ffffff', marginLeft: 3 },
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

  // ── Visibility toggle ──────────────────────────────────────────
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: DIVIDER,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  visibilityLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  soloHint: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK3,
    marginTop: 3,
  },

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

  // ── Footer submit ──────────────────────────────────────────────
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER,
  },
  submitBtn: {
    backgroundColor: SAND,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.35 },
  submitLabel: {
    fontSize: 14,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.3,
  },

  // ── New high point celebration ─────────────────────────────────
  highPointScreen: {
    flex: 1,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  highPointLabel: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: SAND,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  highPointGrade: {
    fontSize: 104,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND,
    letterSpacing: -4,
    lineHeight: 112,
  },
  highPointSub: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: 'rgba(255,255,255,0.7)',
  },

  // ── Reward screen ──────────────────────────────────────────────
  successScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  rewardKicker: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  rewardGrade: {
    fontSize: 96,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND,
    letterSpacing: -4,
    lineHeight: 104,
  },
  rewardStat: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK2,
  },
  successSub: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  logAnotherBtn: {
    marginTop: 18,
    backgroundColor: SAND,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 44,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  logAnotherLabel: {
    fontSize: 15,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  doneBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  doneLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK3,
  },
});
