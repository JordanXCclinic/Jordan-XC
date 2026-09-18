import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

export type NotificationPrefs = {
  announcements: boolean;
  practices: boolean;
  workouts: boolean;
  learn: boolean;
  meetings: boolean;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  announcements: true,
  practices: true,
  workouts: true,
  learn: false,
  meetings: true,
};

export const PREF_LABELS: Record<keyof NotificationPrefs, { title: string; hint: string }> = {
  announcements: {
    title: 'Clinic news',
    hint: 'Practice changes and anything time-sensitive.',
  },
  practices: { title: 'Schedule changes', hint: 'When a practice is added or moved.' },
  workouts: { title: 'New workouts', hint: 'When a coach posts training for you.' },
  learn: { title: 'Learn sessions', hint: 'New articles and videos. Off by default.' },
  meetings: { title: 'Meetings', hint: 'Confirmations and reminders for one-on-one times.' },
};

/** Expo needs the EAS project id to mint a token; it is absent until EAS is set up. */
function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? undefined;
}

/**
 * Asks for permission and stores the token against the signed-in profile.
 *
 * Called from Settings when someone switches notifications on, never on launch:
 * a permission prompt before anyone knows what the app is gets denied, and iOS
 * only offers it once.
 */
export async function enableNotifications(
  profileId: string
): Promise<{ ok: boolean; error: string | null }> {
  // Simulators cannot receive a push, and asking there returns a token that
  // never delivers.
  if (!Device.isDevice) {
    return { ok: false, error: 'Notifications only work on a real phone, not a simulator.' };
  }

  const existing = await Notifications.getPermissionsAsync();
  const granted =
    existing.granted ||
    (await Notifications.requestPermissionsAsync()).granted;

  if (!granted) {
    return {
      ok: false,
      error: 'Notifications are turned off for this app. You can turn them on in your phone settings.',
    };
  }

  // Android shows nothing without a channel, and silently drops the rest.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Clinic news',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#003482',
    });
  }

  const id = projectId();
  if (!id) {
    return { ok: false, error: 'Push is not configured for this build yet.' };
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token.data })
      .eq('id', profileId);
    return error ? { ok: false, error: error.message } : { ok: true, error: null };
  } catch (problem) {
    return {
      ok: false,
      error: problem instanceof Error ? problem.message : 'Could not register for notifications.',
    };
  }
}

/** Clearing the token is what actually stops the pushes; the switch alone would not. */
export async function disableNotifications(profileId: string): Promise<string | null> {
  const { error } = await supabase
    .from('profiles')
    .update({ push_token: null })
    .eq('id', profileId);
  return error?.message ?? null;
}

export async function savePrefs(
  profileId: string,
  prefs: NotificationPrefs
): Promise<string | null> {
  const { error } = await supabase
    .from('profiles')
    .update({ notification_prefs: prefs })
    .eq('id', profileId);
  return error?.message ?? null;
}
