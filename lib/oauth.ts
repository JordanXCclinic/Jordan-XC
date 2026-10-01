import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

export type OAuthProvider = 'apple' | 'google';

export const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  apple: 'Continue with Apple',
  google: 'Continue with Google',
};

// Where the provider sends the browser back to once someone has signed in.
//
// On the web this cannot use Linking.createURL: it resolves the path against
// window.location.origin alone, so an app served from a subpath — Pages serves
// this one from /Jordan-XC — gets sent back to the site root, which is not the
// app and on Pages is a 404. EXPO_BASE_URL is that subpath, inlined at build
// time, and is empty everywhere else, which leaves the origin on its own.
function webRedirectUrl(): string {
  const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/+$/, '');
  return `${window.location.origin}${base}/`;
}

/**
 * Where Sign in with Apple is offered: the iPhone app, natively.
 *
 * Apple requires it there (App Store guideline 4.8) and the native sheet needs
 * nothing but the app's own bundle ID registered with Supabase. On the web and
 * Android it would go through Apple's website instead, which needs a Services
 * ID and a signed secret that expires every six months — a chore with no
 * benefit while Google covers those platforms.
 */
export const APPLE_SIGN_IN_AVAILABLE = Platform.OS === 'ios';

/**
 * The system Sign in with Apple sheet, then the identity token it returns is
 * handed to Supabase. No browser round trip, so nothing to redirect back to.
 *
 * Only the email is asked for, and Apple may hide that behind a relay
 * address. The name is not needed: the clinic code carries it.
 */
async function signInWithAppleNative(): Promise<{ error: string | null }> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) return { error: 'Apple did not return a sign-in token.' };

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    return { error: error?.message ?? null };
  } catch (error) {
    // Closing the sheet is a choice, not a failure.
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return { error: null };
    return { error: error instanceof Error ? error.message : 'Sign in with Apple failed.' };
  }
}

export async function signInWithProvider(
  provider: OAuthProvider
): Promise<{ error: string | null }> {
  if (provider === 'apple' && Platform.OS === 'ios') return signInWithAppleNative();

  // The web signs in by navigating the page, the way a website normally does.
  // The popup flow below is for the phone apps: on the web it would need the
  // returning page to call WebBrowser.maybeCompleteAuthSession() to hand the
  // result back to the opener, and a popup is the worse experience regardless.
  //
  // Nothing is read back here. Supabase puts the session in the URL it returns
  // to, and the client picks it up on load through detectSessionInUrl, which is
  // enabled on web only. This call does not resolve — the page is leaving.
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: webRedirectUrl() },
    });
    return { error: error?.message ?? null };
  }

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
