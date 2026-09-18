import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isSupabaseConfigured, supabase } from './supabase';

/**
 * Records an error a family actually hit, in the clinic's own database.
 *
 * Deliberately not a third-party crash service: the privacy policy says there
 * is no outside analytics in this app, and keeping that true is worth more than
 * the extra coverage. Only the message, the stack and where it happened are
 * stored — never what the person was looking at.
 */
export async function reportError(error: Error, route?: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    const { data } = await supabase.auth.getSession();

    await supabase.from('app_errors').insert({
      profile_id: data.session?.user?.id ?? null,
      message: error.message.slice(0, 500),
      stack: error.stack?.slice(0, 4000) ?? null,
      route: route ?? null,
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version ?? null,
    });
  } catch {
    // Reporting a failure must never become a second failure. If this cannot
    // be written the person still gets the screen telling them what happened.
  }
}
