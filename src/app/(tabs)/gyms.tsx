import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
const MAP_HEIGHT = Math.max(340, Dimensions.get('window').height * 0.52);
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

function getRegion(gyms: Gym[]) {
  if (!gyms.length) return {
    latitude: 40.7484,
    longitude: -73.9967,
    latitudeDelta: 0.22,
    longitudeDelta: 0.14,
  };
  const lats = gyms.map(g => g.latitude ?? 0);
  const lngs = gyms.map(g => g.longitude ?? 0);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const padLat = (maxLat - minLat) * 0.35;
  const padLng = (maxLng - minLng) * 0.35;
  return {
    latitude:       (minLat + maxLat) / 2,
    longitude:      (minLng + maxLng) / 2,
    latitudeDelta:  (maxLat - minLat) + padLat,
    longitudeDelta: (maxLng - minLng) + padLng,
  };
}

export default function GymsScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [gyms, setGyms]               = useState<Gym[]>([]);
  const [loading, setLoading]         = useState(true);
  const [visitedGymIds, setVisitedGymIds] = useState<Set<string>>(new Set());
  const [selectedGymId, setSelectedGymId] = useState<string | null>(null);

  // Load gyms once on mount — fetchGyms() is cached after first call
  useEffect(() => {
    fetchGyms()
      .then(setGyms)
      .finally(() => setLoading(false));
  }, []);

  // Refresh visited gyms on every tab focus
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
        setVisitedGymIds(new Set((data ?? []).map((s: any) => s.gym_id)));
      })();
      return () => { active = false; };
    }, [])
  );

  const yourGyms     = gyms.filter(g => visitedGymIds.has(g.id));
  const discoverGyms = gyms.filter(g => !visitedGymIds.has(g.id));

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

      {loading ? (
        <View style={styles.mapPlaceholder}>
          <ActivityIndicator color={SAND} size="large" />
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          customMapStyle={MAP_STYLE}
          initialRegion={getRegion(gyms)}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={false}
          showsPointsOfInterests={false}
          showsBuildings={true}
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={false}
          rotateEnabled={false}>
          {gyms.filter(g => g.latitude && g.longitude).map(gym => {
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
                      <Text style={styles.calloutBtnLabel}>Visit Gym →</Text>
                    </View>
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>
      )}

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

  // ── Map / placeholder ────────────────────────────────────────
  map: {
    width: '100%',
    height: MAP_HEIGHT,
  },
  mapPlaceholder: {
    width: '100%',
    height: MAP_HEIGHT,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
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
    shadowOpacity: 0.2,
    shadowRadius: 3,
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
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },

  // ── Callout ──────────────────────────────────────────────────
  callout: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    width: 210,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 0.5,
    borderColor: DIVIDER,
  },
  calloutName: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 15,
    color: INK,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  calloutNeighborhood: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 11,
    color: SAND,
    marginBottom: 2,
  },
  calloutAddress: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 11,
    color: 'rgba(26,20,8,0.4)',
    marginBottom: 12,
  },
  calloutBtn: {
    backgroundColor: INK,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  calloutBtnLabel: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 12,
    color: '#ffffff',
    letterSpacing: 0.3,
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
