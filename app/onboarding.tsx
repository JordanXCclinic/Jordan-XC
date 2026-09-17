import { useState } from 'react';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import { CLINIC_URL } from './sign-in';

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { refreshProfile, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc('redeem_invite_code', { p_code: code });

    if (rpcError) {
      setBusy(false);
      setError(rpcError.message);
      return;
    }

    await refreshProfile();
    setBusy(false);
    // Redemption creates the profile; the intake form comes next.
    router.replace('/profile-setup');
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.badge}>
            <Ionicons name="key" size={22} color={colors.primary} />
          </View>

          <Text style={styles.title}>Enter your clinic code</Text>
          <Text style={styles.subtitle}>
            It came with your registration confirmation. Athletes and parents each get
            their own code, and either one can be used first.
          </Text>

          <TextInput
            style={[styles.input, Boolean(error) && styles.inputError]}
            placeholder="ABCDEFGHJK"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            value={code}
            onChangeText={(next) => {
              // The alphabet has no I, O, 0 or 1, so anything typed is upper case.
              setCode(next.toUpperCase().replace(/\s/g, ''));
              if (error) setError(null);
            }}
            maxLength={16}
            accessibilityLabel="Clinic code"
            returnKeyType="go"
            onSubmitEditing={() => {
              if (code.trim() && !busy) void onSubmit();
            }}
          />

          {error ? (
            <View style={styles.error}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            label="Unlock the app"
            size="lg"
            full
            loading={busy}
            disabled={!code.trim()}
            onPress={onSubmit}
          />

          <Pressable
            accessibilityRole="link"
            onPress={() => void WebBrowser.openBrowserAsync(CLINIC_URL)}
            style={styles.linkRow}
          >
            <Text style={styles.link}>No code yet? Register at jordanxcclinic.com</Text>
            <Ionicons name="open-outline" size={15} color={colors.primary} />
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" onPress={signOut} style={styles.signOut}>
          <Text style={styles.signOutText}>Use a different account</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, gap: spacing.xl },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadow.raised,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.textMuted },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  error: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  errorText: { ...type.caption, color: colors.danger, flex: 1, lineHeight: 18 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  link: { ...type.caption, color: colors.primary, fontWeight: '600' },
  signOut: { alignSelf: 'center' },
  signOutText: { ...type.caption, color: colors.textOnPrimary, textDecorationLine: 'underline' },
});
