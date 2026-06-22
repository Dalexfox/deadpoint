import { useCallback, useEffect, useState } from 'react';
import { DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack, useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  Syne_700Bold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne';
import {
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import * as SplashScreen from 'expo-splash-screen';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { SplashGate } from '../components/SplashGate';
import { OnboardingContext, ONBOARDING_KEY } from '../lib/onboarding';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [gateDone, setGateDone] = useState(false); // animated door-reveal overlay
  // Onboarding intro flag. null = still reading from AsyncStorage (don't decide
  // feed-vs-intro yet, so we never flash the feed before redirecting).
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);
  const segments = useSegments();
  const router = useRouter();

  // Load the "seen onboarding" flag once on launch.
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((val) => setSeenOnboarding(val === 'true'))
      .catch(() => setSeenOnboarding(false)); // storage error → treat as not seen
  }, []);

  // Completion handler handed to the onboarding screen via context. Updates the
  // in-memory flag FIRST (so the redirect below sees `true` and routes to the
  // feed instead of bouncing back to /onboarding), then persists it.
  const markSeen = useCallback(() => {
    setSeenOnboarding(true);
    AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {});
  }, []);

  // Hide splash once fonts are ready
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Listen to Supabase auth state
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Verify the user still exists in the database.
        // getUser() makes a live request — if the account was deleted or the
        // token is invalid, it returns an error rather than trusting the local
        // cache. In that case, wipe the stale session and send to login.
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          await supabase.auth.signOut();
          setSession(null);
        } else {
          setSession(session);
        }
      } else {
        setSession(null);
      }
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Redirect based on auth + onboarding state
  useEffect(() => {
    if (!initialized || (!fontsLoaded && !fontError)) return;

    const inAuthGroup  = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session && !inAuthGroup) {
      // Not logged in — send to login (independent of the onboarding flag).
      router.replace('/auth/login');
      return;
    }

    if (session) {
      // Authenticated. Wait for the onboarding flag before choosing feed vs.
      // intro so we don't flash the feed first.
      if (seenOnboarding === null) return;
      if (!seenOnboarding && !inOnboarding) {
        // Hasn't seen the intro — show it once (covers fresh signups + existing
        // logged-in users on first launch after this shipped).
        router.replace('/onboarding');
      } else if (seenOnboarding && (inAuthGroup || inOnboarding)) {
        // Seen it (or just finished) — proceed to the feed.
        router.replace('/(tabs)');
      }
    }
  }, [session, initialized, segments, fontsLoaded, fontError, seenOnboarding]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={DefaultTheme}>
      <OnboardingContext.Provider value={{ markSeen }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth" />
          {/* gestureEnabled:false — can't swipe back to auth from the intro */}
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          <Stack.Screen name="gym/[id]" />
          <Stack.Screen name="log-flow" />
          <Stack.Screen name="user/[id]" />
          <Stack.Screen name="session/[id]" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="notifications" />
        </Stack>
        {!gateDone && <SplashGate onDone={() => setGateDone(true)} />}
      </OnboardingContext.Provider>
    </ThemeProvider>
  );
}
