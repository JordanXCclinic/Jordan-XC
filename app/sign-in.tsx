import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '../components/Logo';
import { isSupabaseConfigured } from '../lib/supabase';
import { signInWithProvider, type OAuthProvider } from '../lib/oauth';
import { brand, radius, shadow, spacing, type, type Palette } from '../lib/theme';
import { useTheme, useThemedStyles } from '../lib/appearance';

export const CLINIC_URL = 'https://jordanxcclinic.com/';

// Apple requires Sign in with Apple wherever a third-party login is offered on
// iOS (App Store guideline 4.8), so it leads there. Android leads with Google,
// which is also what Play sign-in lands on.
const PROVIDERS: OAuthProvider[] = Platform.OS === 'ios' ? ['apple', 'google'] : ['google', 'apple'];

const PROVIDER_STYLE: Record<
  OAuthProvider,
  { label: string; icon: 'logo-apple' | 'logo-google'; bg: string; ink: string; border?: string }
> = {
  apple: { label: 'Continue with Apple', icon: 'logo-apple', bg: brand.black, ink: brand.white },
  google: {
    label: 'Continue with Google',
    icon: 'logo-google',
    bg: brand.white,
    ink: '#1F1F1F',
    border: '#DADCE0',
  },
};

export default function SignIn() {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const insets = useSafeAreaInsets();
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
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brandBlock}>
        <Logo size={148} ring label="Jordan Cross Country Clinic" />
        <Text style={styles.title}>Jordan Cross Country Clinic</Text>
        <Text style={styles.tagline}>
          Your schedule, training, and clinic news — all summer, in one place.
        </Text>
      </View>

      <View style={styles.actions}>
        {!isSupabaseConfigured ? (
          <View style={styles.notice}>
            <Ionicons name="construct-outline" size={18} color={c.textInverse} />
            <Text style={styles.noticeText}>
              Backend not connected yet. Add EXPO_PUBLIC_SUPABASE_URL and
              EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then enable the Apple and Google
              providers in Supabase.
            </Text>
          </View>
        ) : null}

        {PROVIDERS.map((provider) => {
          const style = PROVIDER_STYLE[provider];
          const loading = busy === provider;
          return (
            <Pressable
              key={provider}
              accessibilityRole="button"
              accessibilityLabel={style.label}
              accessibilityState={{ disabled: busy !== null, busy: loading }}
              onPress={() => onPress(provider)}
              disabled={busy !== null}
              style={({ pressed }) => [
                styles.provider,
                { backgroundColor: style.bg },
                style.border ? { borderWidth: 1, borderColor: style.border } : null,
                pressed && styles.pressed,
                busy !== null && !loading && styles.dimmed,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={style.ink} />
              ) : (
                <>
                  <Ionicons name={style.icon} size={20} color={style.ink} />
                  <Text style={[styles.providerLabel, { color: style.ink }]}>{style.label}</Text>
                </>
              )}
            </Pressable>
          );
        })}

        {error ? (
          <View style={styles.error}>
            <Ionicons name="alert-circle" size={18} color={c.textInverse} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.help}>
          After you sign in, enter the clinic code from your registration confirmation.
        </Text>
      </View>

      <Pressable
        accessibilityRole="link"
        onPress={() => void WebBrowser.openBrowserAsync(CLINIC_URL)}
        style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
      >
        <Text style={styles.footerText}>
          Not registered yet? Sign up at <Text style={styles.footerStrong}>jordanxcclinic.com</Text>
        </Text>
        <Ionicons name="open-outline" size={15} color={c.textOnPrimary} />
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: c.primarySurface },
  content: { flexGrow: 1, paddingHorizontal: spacing.xl, justifyContent: 'space-between', gap: spacing.xxl },
  brandBlock: { alignItems: 'center', gap: spacing.lg, paddingTop: spacing.xl },
  title: {
    ...type.display,
    color: c.textInverse,
    textAlign: 'center',
    fontSize: 27,
    lineHeight: 33,
  },
  tagline: {
    ...type.body,
    color: c.textOnPrimary,
    textAlign: 'center',
    maxWidth: 320,
  },
  actions: { gap: spacing.md },
  provider: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    ...shadow.card,
  },
  providerLabel: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  dimmed: { opacity: 0.5 },
  notice: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  noticeText: { ...type.caption, color: c.textInverse, flex: 1, lineHeight: 18 },
  error: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: c.accent,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { ...type.caption, color: c.textInverse, flex: 1 },
  help: { ...type.caption, color: c.textOnPrimary, textAlign: 'center', lineHeight: 18 },
  footerLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  footerText: { ...type.caption, color: c.textOnPrimary },
  footerStrong: { color: c.textInverse, fontWeight: '700' },
});
