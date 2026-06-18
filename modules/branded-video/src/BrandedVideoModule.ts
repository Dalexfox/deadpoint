import { NativeModule, requireNativeModule } from 'expo';

declare class BrandedVideoModule extends NativeModule<Record<never, never>> {
  /** Composite the overlay PNG onto the video, returns the output file URI. */
  compose(videoUri: string, overlayUri: string): Promise<string>;
}

// Resolve the native module without throwing at import time. In Expo Go (or any
// build where the native module isn't linked) this returns null, so the JS bundle
// still loads and callers can fall back gracefully.
let mod: BrandedVideoModule | null = null;
try {
  mod = requireNativeModule<BrandedVideoModule>('BrandedVideo');
} catch {
  mod = null;
}

export default mod;
