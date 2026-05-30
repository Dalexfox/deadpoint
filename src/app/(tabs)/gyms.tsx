import { useCallback, useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

const BG        = '#ffffff';
const CARD      = '#d8eaf0';
const SURFACE   = '#d8eaf0';
const PRIMARY   = '#2E7A96';
const TEXT_CLR   = '#0d2b36';
const TEXT_SUB  = '#3d7a8a';
const TEXT_MUTED = '#8bb5c4';
const DIVIDER   = '#c8dde8';

const SCREEN_W = Dimensions.get('window').width;
const THUMB_SIZE = (SCREEN_W - 16 * 2 - 12) / 2;

const GYMS = [
  {
    id: '1',
    name: 'Vital Climbing LES',
    neighborhood: 'Lower East Side',
    city: 'NYC',
    image: 'https://images.squarespace-cdn.com/content/v1/625bfab4e397erico0e5e2e0/1650294908776-gym-les.jpg',
  },
  {
    id: '2',
    name: 'Vital Climbing Brooklyn',
    neighborhood: 'Brooklyn',
    city: 'NYC',
    image: 'https://images.squarespace-cdn.com/content/v1/625bfab4e397erico0e5e2e0/1650294908776-gym-bk.jpg',
  },
  {
    id: '3',
    name: 'Vital Climbing UES',
    neighborhood: 'Upper East Side',
    city: 'NYC',
    image: 'https://images.squarespace-cdn.com/content/v1/625bfab4e397erico0e5e2e0/1650294908776-gym-ues.jpg',
  },
  {
    id: '4',
    name: 'Vital Climbing UWS',
    neighborhood: 'Upper West Side',
    city: 'NYC',
    image: 'https://images.squarespace-cdn.com/content/v1/625bfab4e397erico0e5e2e0/1650294908776-gym-uws.jpg',
  },
];

export default function GymsScreen() {
  const router = useRouter();
  const [visitedGymIds, setVisitedGymIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !active) return;
        const { data } = await supabase
          .from('sessions')
          .select('gym_id')
          .eq('user_id', user.id);
        if (!active) return;
        const ids = new Set((data ?? []).map((s: any) => s.gym_id));
        setVisitedGymIds(ids);
      })();
      return () => { active = false; };
    }, [])
  );

  const yourGyms = GYMS.filter((g) => visitedGymIds.has(g.id));
  const discoverGyms = GYMS.filter((g) => !visitedGymIds.has(g.id));

  const renderCard = (gym: typeof GYMS[0]) => (
    <TouchableOpacity
      key={gym.id}
      style={styles.thumbCard}
      onPress={() => router.push(`/gym/${gym.id}`)}
      activeOpacity={0.8}>
      <View style={styles.thumbImageWrap}>
        <Image source={{ uri: gym.image }} style={styles.thumbImage} />
        <View style={styles.thumbOverlay}>
          <Text style={styles.thumbInitial}>{gym.name.split(' ').pop()}</Text>
        </View>
      </View>
      <View style={styles.thumbInfo}>
        <Text style={styles.thumbName} numberOfLines={1}>{gym.name}</Text>
        <Text style={styles.thumbLocation} numberOfLines={1}>
          {gym.neighborhood} · {gym.city}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Gyms</Text>
        <Text style={styles.subheading}>{GYMS.length} locations</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>

        {yourGyms.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>YOUR GYMS</Text>
            <View style={styles.grid}>
              {yourGyms.map(renderCard)}
            </View>
          </View>
        )}

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionLabel}>
            {yourGyms.length > 0 ? 'DISCOVER NEAR YOU' : 'GYMS NEAR YOU'}
          </Text>
          {discoverGyms.length > 0 ? (
            <View style={styles.grid}>
              {discoverGyms.map(renderCard)}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>You've visited every gym!</Text>
            </View>
          )}
        </View>
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
    paddingBottom: 24,
  },
  heading: {
    fontSize: 42,
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT_CLR,
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
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 28,
  },

  // ── Section ─────────────────────────────────────────────────
  sectionBlock: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT_MUTED,
    letterSpacing: 1.4,
    paddingHorizontal: 4,
  },

  // ── Grid ────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  // ── Thumbnail card ──────────────────────────────────────────
  thumbCard: {
    width: THUMB_SIZE,
    borderRadius: 16,
    backgroundColor: CARD,
    borderWidth: 1.5,
    borderColor: DIVIDER,
  },
  thumbImageWrap: {
    width: '100%',
    height: THUMB_SIZE * 0.7,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    overflow: 'hidden',
    backgroundColor: PRIMARY,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,43,54,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbInitial: {
    fontSize: 28,
    fontFamily: 'BebasNeue_400Regular',
    color: '#ffffff',
    letterSpacing: 1,
  },
  thumbInfo: {
    padding: 12,
    gap: 3,
  },
  thumbName: {
    fontSize: 14,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT_CLR,
    letterSpacing: -0.2,
  },
  thumbLocation: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_SUB,
    letterSpacing: 0.1,
  },

  // ── Empty ───────────────────────────────────────────────────
  emptyState: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_MUTED,
  },
});
