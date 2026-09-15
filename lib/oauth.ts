import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

export type OAuthProvider = 'apple' | 'google';

export const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  apple: 'Continue with Apple',
  google: 'Continue with Google',
};

export async function signInWithProvider(
  provider: OAuthProvider
): Promise<{ error: string | null }> {
  const redirectTo = Linking.createURL('/');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error) return { error: error.message };
  if (!data.url) return { error: 'Could not start sign-in.' };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return { error: null };

  // Supabase returns the session in the callback fragment; exchange it for a
  // persisted session so onAuthStateChange fires.
  const params = new URL(result.url.replace('#', '?')).searchParams;
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return { error: sessionError?.message ?? null };
  }

  const code = params.get('code');
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    return { error: exchangeError?.message ?? null };
  }

  return { error: 'Sign-in did not complete.' };
}
