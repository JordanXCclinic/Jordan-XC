import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../lib/theme';

export default function Onboarding() {
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
    router.replace('/(tabs)');
  }

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Enter your clinic code</Text>
        <Text style={styles.subtitle}>
          This came with your registration confirmation. Athletes and parents each
          get their own code.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="ABCD1234"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={setCode}
          maxLength={16}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, (busy || !code.trim()) && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={busy || !code.trim()}
        >
          <Text style={styles.buttonText}>{busy ? 'Checking…' : 'Continue'}</Text>
        </Pressable>

        <Text style={styles.help}>
          Lost your code? Contact the clinic and we will send a new one.
        </Text>

        <Pressable onPress={signOut}>
          <Text style={styles.signOut}>Use a different account</Text>
        </Pressable>
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
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 20,
    letterSpacing: 2,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  help: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  signOut: { fontSize: 14, color: colors.textMuted, textDecorationLine: 'underline' },
});
