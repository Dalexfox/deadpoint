import { useCallback, useRef, useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import MapView, { Callout, Marker } from 'react-native-maps';
import { supabase } from '../../lib/supabase';
import { fetchGyms, type Gym } from '../../lib/gyms';

const BG      = '#ffffff';
const CARD    = '#f4f1eb';
const SURFACE = '#ece8df';
const SAND    = '#c8a84a';
const INK     = '#1a1408';
const INK2    = '#3d3320';
const INK3    = '#8a7a50';
const DIVIDER = 'rgba(26,20,8,0.08)';

const SCREEN_W  = Dimensions.get('window').width;
const SCREEN_H  = Dimensions.get('window').height;
const MAP_H     = Math.max(340, SCREEN_H * 0.55);
const THUMB_SIZE = (SCREEN_W - 16 * 2 - 12) / 2;

// Placeholder images per gym id — no image_url column in DB yet
const GYM_IMAGES: Record<string, string> = {
  '1': 'https://images.squarespace-cdn.com/content/v1/625bfab4e397erico0e5e2e0/1650294908776-gym-les.jpg',
  '2': 'https://images.squarespace-cdn.com/content/v1/625bfab4e397erico0e5e2e0/1650294908776-gym-bk.jpg',
  '3': 'https://images.squarespace-cdn.com/content/v1/625bfab4e397erico0e5e2e0/1650294908776-gym-ues.jpg',
  '4': 'https://images.squarespace-cdn.com/content/v1/625bfab4e397erico0e5e2e0/1650294908776-gym-uws.jpg',
};

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f2ea' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#1a1408' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f2ea' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#ece8df' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e8e0cc' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c8dce8' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d6070' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#8a7a50' }] },
];

export default function GymsScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [visitedGymIds, setVisitedGymIds] = useState<Set<string>>(new Set());
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [gymList, { data: { user } }] = await Promise.all([
          fetchGyms(),
          supabase.auth.getUser(),
        ]);
        if (!active) return;
        setGyms(gymList);
        if (!user) return;
        const { data } = await supabase
          .from('sessions')
          .select('gym_id')
          .eq('user_id', user.id);
        if (!active) return;
        setVisitedGymIds(new Set((data ?? []).map((s: any) => s.gym_id)));
      })();
      return () => { active = false; };
    }, [])
  );

  const yourGyms     = gyms.filter((g) => visitedGymIds.has(g.id));
  const discoverGyms = gyms.filter((g) => !visitedGymIds.has(g.id));

  const handleCardPress = (gym: Gym) => {
    if (gym.latitude && gym.longitude) {
      setSelectedGymId(gym.id);
      mapRef.current?.animateToRegion(
        { latitude: gym.latitude, longitude: gym.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 },
        500,
      );
    }
    router.push(`/gym/${gym.id}`);
  };

  const renderCard = (gym: Gym) => (
    <TouchableOpacity
      key={gym.id}
      style={styles.thumbCard}
      onPress={() => handleCardPress(gym)}
      activeOpacity={0.8}>
      <View style={styles.thumbImageWrap}>
        <Image source={{ uri: GYM_IMAGES[gym.id] }} style={styles.thumbImage} />
        <View style={styles.thumbOverlay}>
          <Text style={styles.thumbInitial}>{gym.name.split(' ').pop()}</Text>
        </View>
      </View>
      <View style={styles.thumbInfo}>
        <Text style={styles.thumbName} numberOfLines={1}>{gym.name}</Text>
        <Text style={styles.thumbLocation} numberOfLines={1}>
          {gym.neighborhood} · {gym.city ?? 'NYC'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Gyms</Text>
        <Text style={styles.subheading}>{gyms.length} locations · NYC</Text>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        customMapStyle={MAP_STYLE}
        initialRegion={{
          latitude: 40.7484,
          longitude: -73.9967,
          latitudeDelta: 0.18,
          longitudeDelta: 0.12,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsPointsOfInterests={false}
        showsBuildings={true}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}>
        {gyms.filter(g => g.latitude && g.longitude).map((gym) => {
          const isSelected = selectedGymId === gym.id;
          return (
            <Marker
              key={gym.id}
              coordinate={{ latitude: gym.latitude!, longitude: gym.longitude! }}
              onPress={() => setSelectedGymId(gym.id)}>
              <View style={isSelected ? styles.dotSelected : styles.dot} />
              <Callout onPress={() => router.push(`/gym/${gym.id}`)}>
                <View style={styles.callout}>
                  <Text style={styles.calloutName}>{gym.name}</Text>
                  <Text style={styles.calloutNeighborhood}>{gym.neighborhood}</Text>
                  <Text style={styles.calloutAddress}>{gym.address}</Text>
                  <View style={styles.calloutBtn}>
                    <Text style={styles.calloutBtnLabel}>View Gym →</Text>
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

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
    paddingBottom: 16,
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

  // ── Map ─────────────────────────────────────────────────────
  map: {
    width: '100%',
    height: MAP_H,
  },

  // ── Markers ─────────────────────────────────────────────────
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: SAND,
    borderWidth: 2.5,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  dotSelected: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: INK,
    borderWidth: 2.5,
    borderColor: SAND,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },

  // ── Callout ──────────────────────────────────────────────────
  callout: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    width: 200,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 0.5,
    borderColor: DIVIDER,
  },
  calloutName: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 14,
    color: INK,
    letterSpacing: -0.3,
  },
  calloutNeighborhood: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 11,
    color: SAND,
    marginTop: 1,
  },
  calloutAddress: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 11,
    color: 'rgba(26,20,8,0.45)',
    marginTop: 3,
  },
  calloutBtn: {
    marginTop: 10,
    backgroundColor: INK,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  calloutBtnLabel: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 11,
    color: '#ffffff',
    textAlign: 'center',
  },

  // ── Scroll list ──────────────────────────────────────────────
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 28,
  },
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  // ── Thumbnail card ───────────────────────────────────────────
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

  // ── Empty ────────────────────────────────────────────────────
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
