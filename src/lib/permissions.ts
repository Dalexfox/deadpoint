import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

/**
 * Ensure camera permission before launching the camera. In Expo Go the camera
 * "just works" (Expo Go owns the entitlement); in a standalone/TestFlight build
 * the app must request it itself, or `launchCameraAsync` silently does nothing.
 *
 * Returns true if granted. If permanently denied, surfaces an alert with a
 * shortcut to Settings. Call this before every `ImagePicker.launchCameraAsync`.
 */
export async function ensureCameraPermission(): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return true;

  if (current.canAskAgain) {
    const req = await ImagePicker.requestCameraPermissionsAsync();
    if (req.granted) return true;
    if (req.canAskAgain) return false; // user dismissed the prompt; no nag
  }

  Alert.alert(
    'Camera access needed',
    'Turn on Camera access for Deadpoint in Settings to take photos and videos.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
  );
  return false;
}
