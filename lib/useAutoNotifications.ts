import { useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './auth';
import { DEFAULT_PREFS, enableNotifications, savePrefs } from './notifications';

const askedKey = (profileId: string) => `notifications-asked:${profileId}`;

/**
 * Turns notifications on for everyone the first time they reach the app after
 * signing up: iOS shows its own Allow prompt, and on Allow every category starts
 * on. Nobody has to find the switch in Settings for a practice change to reach
 * them.
 *
 * Once per person per phone. After that the choice is theirs: someone who
 * switches notifications off in Settings is never switched back on by this.
 */
export function useAutoNotifications() {
  const { profile, onboarded, refreshProfile } = useAuth();
  const profileId = onboarded ? profile?.id : undefined;

  useEffect(() => {
    if (!profileId || Platform.OS === 'web') return;
    let cancelled = false;

    void (async () => {
      let asked: string | null;
      try {
        asked = await AsyncStorage.getItem(askedKey(profileId));
      } catch {
        return;
      }
      if (asked || cancelled) return;

      // Home draws first, so the prompt arrives over the app, not a blank screen.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (cancelled) return;

      await AsyncStorage.setItem(askedKey(profileId), '1').catch(() => undefined);
      const { ok } = await enableNotifications(profileId);
      if (!ok) return;
      await savePrefs(profileId, DEFAULT_PREFS);
      await refreshProfile();
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId, refreshProfile]);
}
