import { createContext, useContext } from 'react';

// AsyncStorage key for the "user has seen the intro cards" flag (one per install).
export const ONBOARDING_KEY = 'hasSeenOnboarding';

export type OnboardingContextValue = {
  // Mark onboarding complete. Flips the in-memory flag owned by the root layout
  // AND persists it to AsyncStorage. It lives in context so the onboarding screen
  // can update the root layout's state on completion — without that in-memory
  // update, the post-auth redirect would still see `false` and bounce the user
  // straight back to /onboarding after they tap "Get started".
  markSeen: () => void;
};

export const OnboardingContext = createContext<OnboardingContextValue>({
  markSeen: () => {},
});

export const useOnboarding = () => useContext(OnboardingContext);
