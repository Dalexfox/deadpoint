/**
 * Onboarding — a 3-card swipeable intro shown ONCE per install, AFTER auth and
 * before the feed. Swipeable content (paged horizontal FlatList) + a fixed bottom
 * row of page dots and a single CTA whose label/action switch on the active card
 * ("Next" advances; "Get started" on the last card finishes).
 *
 * Completion calls markSeen() from OnboardingContext — that persists
 * `hasSeenOnboarding=true` AND updates the root layout's in-memory flag, so the
 * post-auth redirect in _layout.tsx routes to the feed instead of bouncing back
 * here. Routing itself lives in _layout.tsx; this screen only shows + completes.
 */
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOnboarding } from '../lib/onboarding';

const INK   = '#1a1408';
const SAND  = '#c8a84a';
const INK3  = '#8a7a50';
const WHITE = '#ffffff';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Card = { icon: keyof typeof Ionicons.glyphMap; title: string; body: string };

const CARDS: Card[] = [
  { icon: 'triangle-outline',    title: 'Track your climbs',  body: 'Log every problem you send. Your progress, always with you.' },
  { icon: 'people-outline',      title: "See what's sending", body: 'Follow climbers at your gym. Discover problems worth projecting.' },
  { icon: 'trending-up-outline', title: 'Build your story',   body: 'Your grade history, streaks, and high points — all in one place.' },
];

export default function Onboarding() {
  const router = useRouter();
  const { markSeen } = useOnboarding();
  const listRef = useRef<FlatList<Card>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardH, setCardH] = useState(0);

  const isLast = activeIndex === CARDS.length - 1;

  // Keep the active index in sync after both a swipe and a programmatic advance.
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
  };

  const handleCta = () => {
    if (isLast) {
      markSeen();
      router.replace('/(tabs)');
    } else {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      <View style={styles.listArea} onLayout={(e) => setCardH(e.nativeEvent.layout.height)}>
        <FlatList
          ref={listRef}
          data={CARDS}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => String(i)}
          onMomentumScrollEnd={onMomentumEnd}
          getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
          renderItem={({ item }) => (
            <View style={[styles.card, { width: SCREEN_WIDTH, height: cardH }]}>
              <View style={styles.iconBox}>
                <Ionicons name={item.icon} size={36} color={SAND} />
              </View>
              <Text style={styles.headline}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          )}
        />
      </View>

      {/* Fixed controls — page dots + a single CTA. */}
      <View style={styles.controls}>
        <View style={styles.dotsRow}>
          {CARDS.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.cta} onPress={handleCta} activeOpacity={0.9}>
          <Text style={styles.ctaLabel}>{isLast ? 'Get started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WHITE },
  listArea:  { flex: 1 },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#f5f0e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  headline: {
    fontFamily: 'Syne_700Bold',
    fontSize: 24,
    color: INK,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    color: INK3,
    textAlign: 'center',
    lineHeight: 22,
  },
  controls: {
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive:   { backgroundColor: INK },
  dotInactive: { backgroundColor: '#d5cfc4' },
  cta: {
    height: 50,
    borderRadius: 50,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 15,
    color: WHITE,
  },
});
