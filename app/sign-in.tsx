import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { isSupabaseConfigured } from '../lib/supabase';
import { PROVIDER_LABELS, signInWithProvider, type OAuthProvider } from '../lib/oauth';
import { colors, radius, spacing } from '../lib/theme';

// Apple requires Sign in with Apple wherever a third-party login is offered
// on iOS (App Store guideline 4.8), so it leads on that platform.
const PROVIDERS: OAuthProvider[] =
  Platform.OS === 'ios' ? ['apple', 'google'] : ['google', 'apple'];

export default function SignIn() {
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPress(provider: OAuthProvider) {
    setBusy(provider);
    setError(null);
    const { error: signInError } = await signInWithProvider(provider);
    setBusy(null);
    if (signInError) setError(signInError);
  }

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.brand}>Jordan XC Clinic</Text>
        <Text style={styles.subtitle}>
          Your schedule, training, and clinic news for the summer.
        </Text>

        {!isSupabaseConfigured ? (
          <Text style={styles.warning}>
            Backend not configured yet. Add EXPO_PUBLIC_SUPABASE_URL and
            EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, and enable the Apple and Google
            providers in Supabase.
          </Text>
        ) : null}

        {PROVIDERS.map((provider) => (
          <Pressable
            key={provider}
            style={[styles.button, busy !== null && styles.buttonDisabled]}
            onPress={() => onPress(provider)}
            disabled={busy !== null}
          >
            <Text style={styles.buttonText}>
              {busy === provider ? 'Opening…' : PROVIDER_LABELS[provider]}
            </Text>
          </Pressable>
        ))}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.help}>
          After signing in you will be asked for the clinic code from your
          registration confirmation.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary, justifyContent: 'center', padding: spacing.lg },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  brand: { fontSize: 26, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  warning: {
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    lineHeight: 19,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14 },
  help: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
});
