import { useCallback, useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { EmptyState, Screen } from '../../../components/Screen';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { colors, radius, spacing } from '../../../lib/theme';
import type { InviteCode } from '../../../lib/types';

const SEASON = String(new Date().getFullYear());

type Issued = { athlete_code: string; parent_code: string; name: string };

export default function Codes() {
  const [name, setName] = useState('');
  const [oneOnOne, setOneOnOne] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const loadCodes = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase
      .from('invite_codes')
      .select('id, code, role, full_name, season, redeemed_at, expires_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setCodes((data as InviteCode[]) ?? []);
  }, []);

  useEffect(() => {
    void loadCodes();
  }, [loadCodes]);

  async function onGenerate() {
    setBusy(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('create_family_codes', {
      p_full_name: name,
      p_season: SEASON,
      p_athlete_role: oneOnOne ? 'private_client' : 'athlete',
    });

    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      setIssued({ ...row, name: name.trim() });
      setName('');
      void loadCodes();
    }
  }

  async function copy(label: string, value: string) {
    await Clipboard.setStringAsync(value);
    setCopied(label);
  }

  const outstanding = codes.filter((code) => !code.redeemed_at);

  return (
    <Screen title="Clinic codes" subtitle={`Season ${SEASON}`}>
      <View style={styles.form}>
        <Text style={styles.label}>Athlete name</Text>
        <TextInput
          style={styles.input}
          placeholder="Sam Runner"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <View style={styles.switchRow}>
          <Text style={styles.label}>One-on-one client</Text>
          <Switch
            value={oneOnOne}
            onValueChange={setOneOnOne}
            trackColor={{ true: colors.primaryLight, false: colors.border }}
          />
        </View>

        <Pressable
          style={[styles.button, (busy || !name.trim()) && styles.buttonDisabled]}
          onPress={onGenerate}
          disabled={busy || !name.trim()}
        >
          <Text style={styles.buttonText}>{busy ? 'Generating…' : 'Generate codes'}</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {issued ? (
        <View style={styles.issued}>
          <Text style={styles.issuedTitle}>Codes for {issued.name}</Text>
          <Text style={styles.issuedHint}>
            Send the athlete code to the runner and the parent code to their
            guardian. Each one works once.
          </Text>

          {(
            [
              ['Athlete', issued.athlete_code],
              ['Parent', issued.parent_code],
            ] as const
          ).map(([label, value]) => (
            <Pressable key={label} style={styles.codeRow} onPress={() => copy(label, value)}>
              <View>
                <Text style={styles.codeLabel}>{label}</Text>
                <Text style={styles.code}>{value}</Text>
              </View>
              <Text style={styles.copy}>{copied === label ? 'Copied' : 'Copy'}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Not yet used ({outstanding.length})</Text>
      {outstanding.length === 0 ? (
        <EmptyState message="Every code you have issued has been claimed." />
      ) : (
        outstanding.map((code) => (
          <View key={code.id} style={styles.row}>
            <View>
              <Text style={styles.name}>{code.full_name}</Text>
              <Text style={styles.meta}>{code.role.replace('_', ' ')}</Text>
            </View>
            <Text style={styles.rowCode}>{code.code}</Text>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
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
  issued: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: spacing.sm,
  },
  issuedTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  issuedHint: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  codeLabel: { fontSize: 13, color: colors.textMuted },
  code: { fontSize: 20, fontWeight: '700', letterSpacing: 2, color: colors.text },
  copy: { fontSize: 15, fontWeight: '600', color: colors.primary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, textTransform: 'capitalize' },
  rowCode: { fontSize: 16, fontWeight: '700', letterSpacing: 1.5, color: colors.primary },
});
