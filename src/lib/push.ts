/**
 * Push notifications — device token registration + foreground display config.
 *
 * The in-app inbox (/notifications) is separate and table-free; THIS adds the
 * OS-level banner when the app is closed/backgrounded. Flow:
 *   1. registerForPushNotifications(userId) on login → asks permission, gets the
 *      Expo push token, upserts it to profiles.push_token.
 *   2. A Supabase Edge Function ("notify") fires on new likes/comments/follows
 *      (via Database Webhooks), looks up the recipient's token, and sends through
 *      Expo's push service. (Server side — see supabase/functions/notify.)
 *   3. Tapping a notification deep-links via the response listener in _layout.tsx.
 *
 * iOS-first. Remote push needs a real device + a real build (not Expo Go on
 * SDK 53+); every helper no-ops safely on a simulator or when permission is denied.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Show a banner + play a sound when a push arrives while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const PROJECT_ID =
  (Constants.expoConfig?.extra as any)?.eas?.projectId ??
  (Constants as any)?.easConfig?.projectId;

/**
 * Ask permission, fetch the Expo push token, and save it to the user's profile.
 * Best-effort: returns the token or null, never throws.
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  try {
    if (!Device.isDevice) return null; // simulators can't get a push token

    // Android requires a channel for notifications to show (harmless on iOS).
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null; // user declined — that's fine

    const { data: token } = await Notifications.getExpoPushTokenAsync(
      PROJECT_ID ? { projectId: PROJECT_ID } : undefined,
    );
    if (!token) return null;

    await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
    return token;
  } catch (err) {
    console.warn('[push] registration failed:', err);
    return null;
  }
}
