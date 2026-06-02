import { useCallback, useRef, useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { supabase } from '../../lib/supabase';

const BG        = '#ffffff';
const CARD      = '#f4f1eb';
const SURFACE   = '#ece8df';
const SAND      = '#c8a84a';
const SAND_LT   = '#e8c87a';
const INK       = '#1a1408';
const INK2      = '#3d3320';
const INK3      = '#8a7a50';
const DIVIDER   = 'rgba(26,20,8,0.08)';

const SCREEN_W = Dimensions.get('window').width;
const THUMB_SIZE = (SCREEN_W - 16 * 2 - 12) / 2;

const GYMS = [
  {
    id: '1',
    name: 'Vital Climbing LES',
    neighborhood: 'Lower East Side',
    city: 'NYC',
    image: 'https://images.squarespace-cdn.com/content/v1/625bfab4e397erico0e5e2e0/1650294908776-gym-les.jpg',
    lat: 40.7195,
    lng: -73.9865,
  },
  {
    id: '2',
    name: 'Vital Climbing Brooklyn',
    neighborhood: 'Brooklyn',
    city: 'NYC',
    image: 'https://images.squarespace-cdn.com/content/v1/625bfab4e397erico0e5e2e0/1650294908776-gym-bk.jpg',
    lat: 40.6892,
    lng: -73.9442,
  },
  {
    id: '3',
    name: 'Vital Climbing UES',
    neighborhood: 'Upper East Side',
    city: 'NYC',
    image: 'https://images.squarespace-cdn.com/content/v1/625bfab4e397erico0e5e2e0/1650294908776-gym-ues.jpg',
    lat: 40.7739,
    lng: -73.9540,
  },
  {
    id: '4',
    name: 'Vital Climbing UWS',
    neighborhood: 'Upper West Side',
    city: 'NYC',
    image: 'https://images.squarespace-cdn.com/content/v1/625bfab4e397erico0e5e2e0/1650294908776-gym-uws.jpg',
    lat: 40.7870,
    lng: -73.9754,
  },
];

const MAP_REGION = {
  latitude: 40.7400,
  longitude: -73.9600,
  latitudeDelta: 0.14,
  longitudeDelta: 0.14,
};

export default function GymsScreen() {
  const router = useRouter();
  const [visitedGymIds, setVisitedGymIds] = useState<Set<string>>(new Set());
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

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

      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={MAP_REGION}
        showsUserLocation
        showsMyLocationButton={false}>
        {GYMS.map((gym) => (
          <Marker
            key={gym.id}
            coordinate={{ latitude: gym.lat, longitude: gym.lng }}
            onPress={() => {
              setSelectedGymId(gym.id);
              router.push(`/gym/${gym.id}`);
            }}>
            <View style={[
              styles.pin,
              visitedGymIds.has(gym.id) && styles.pinVisited,
              selectedGymId === gym.id && styles.pinSelected,
            ]}>
              <Text style={styles.pinLabel}>{gym.neighborhood.split(' ')[0]}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <ScrollView
        ref={scrollRef}
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
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: 1,
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
    fontFamily: 'Syne_800ExtraBold',
    color: INK3,
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
    backgroundColor: SAND,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(13,43,54,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbInitial: {
    fontSize: 28,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  thumbInfo: {
    padding: 12,
    gap: 3,
  },
  thumbName: {
    fontSize: 14,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.2,
  },
  thumbLocation: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK2,
    letterSpacing: 0.1,
  },

  // ── Map ─────────────────────────────────────────────────────
  map: {
    width: '100%',
    height: 220,
  },
  pin: {
    backgroundColor: INK,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  pinVisited: {
    backgroundColor: SAND,
  },
  pinSelected: {
    backgroundColor: SAND,
    transform: [{ scale: 1.1 }],
  },
  pinLabel: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#ffffff',
    letterSpacing: 0.2,
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
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
  },
});
