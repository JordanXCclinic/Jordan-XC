import { useCallback, useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { SwitchRow, TextField } from '../../../components/Field';
import { EmptyState, LoadingState, Screen, SectionHeader } from '../../../components/Screen';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { INVITE_CODE_COLUMNS, isHeadCoach, type InviteCode } from '../../../lib/types';
import { roleLabel } from '../../../lib/format';
import { radius, spacing, type, type Palette } from '../../../lib/theme';
import { useTheme, useThemedStyles } from '../../../lib/appearance';

const SEASON = String(new Date().getFullYear());

type Issued = { athlete_code: string; parent_code: string; name: string };

export default function Codes() {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const { role } = useAuth();
  const [name, setName] = useState('');
  const [oneOnOne, setOneOnOne] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('invite_codes')
      .select(INVITE_CODE_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(60);
    setCodes((data as InviteCode[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      setCopied(null);
      await load();
    }
  }

  async function copy(key: string, value: string) {
    await Clipboard.setStringAsync(value);
    setCopied(key);
  }

  const outstanding = codes.filter((code) => !code.redeemed_at);

  // Assistants can run every practice and write every plan, but letting a new
  // family into the clinic stays with the head coach. RLS enforces it too.
  if (!isHeadCoach(role)) {
    return (
      <Screen inStack title="Clinic codes">
        <EmptyState
          icon="lock-closed-outline"
          message="Only the head coach issues clinic codes. Ask Coach Will for one and he can send it straight to the family."
        />
      </Screen>
    );
  }

  return (
    <Screen
      inStack
      title="Clinic codes"
      subtitle={`Season ${SEASON}. Issue a pair once a family has registered on the website.`}
      onRefresh={load}
      avoidKeyboard
    >
      <Card accent="primary">
        <Text style={styles.cardTitle}>Issue a pair</Text>
        <View style={styles.fields}>
          <TextField
            label="Athlete name"
            value={name}
            onChangeText={setName}
            placeholder="Sam Runner"
            required
            autoCapitalize="words"
          />
          <SwitchRow
            label="One-on-one client"
            hint="Private coaching rather than the summer clinic."
            value={oneOnOne}
            onValueChange={setOneOnOne}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label="Generate codes"
          full
          loading={busy}
          disabled={!name.trim()}
          onPress={onGenerate}
          style={styles.submit}
        />
      </Card>

      {issued ? (
        <Card accent="primary">
          <Text style={styles.cardTitle}>Codes for {issued.name}</Text>
          <Text style={styles.hint}>
            Send the athlete code to the runner and the parent code to their guardian. Each one
            works once, and either can be redeemed first.
          </Text>

          {(
            [
              ['Athlete', issued.athlete_code],
              ['Parent', issued.parent_code],
            ] as const
          ).map(([kind, value]) => (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={`Copy the ${kind.toLowerCase()} code`}
              onPress={() => copy(kind, value)}
              style={({ pressed }) => [styles.codeRow, pressed && styles.pressed]}
            >
              <View style={styles.codeText}>
                <Text style={styles.codeLabel}>{kind}</Text>
                <Text style={styles.code}>{value}</Text>
              </View>
              <View style={styles.copy}>
                <Ionicons
                  name={copied === kind ? 'checkmark-circle' : 'copy-outline'}
                  size={17}
                  color={copied === kind ? c.success : c.primary}
                />
                <Text style={[styles.copyText, copied === kind && styles.copiedText]}>
                  {copied === kind ? 'Copied' : 'Copy'}
                </Text>
              </View>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <SectionHeader title={`Not yet used (${outstanding.length})`} />

      {loading ? (
        <LoadingState />
      ) : outstanding.length === 0 ? (
        <EmptyState
          icon="checkmark-done-outline"
          message="Every code you have issued has been claimed."
        />
      ) : (
        outstanding.map((code) => (
          <Card key={code.id}>
            <View style={styles.row}>
              <View style={styles.codeText}>
                <Text style={styles.name}>{code.full_name}</Text>
                <Badge label={roleLabel(code.role)} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Copy the code for ${code.full_name}`}
                onPress={() => copy(code.id, code.code)}
                hitSlop={8}
                style={({ pressed }) => [styles.rowCodeWrap, pressed && styles.pressed]}
              >
                <Text style={styles.rowCode}>{code.code}</Text>
                <Ionicons
                  name={copied === code.id ? 'checkmark-circle' : 'copy-outline'}
                  size={16}
                  color={copied === code.id ? c.success : c.textFaint}
                />
              </Pressable>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  cardTitle: { ...type.heading, color: c.text },
  hint: { ...type.caption, color: c.textMuted, marginTop: spacing.xs, lineHeight: 17 },
  fields: { gap: spacing.lg, marginTop: spacing.lg },
  submit: { marginTop: spacing.lg },
  error: { ...type.caption, color: c.danger, marginTop: spacing.md },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.md,
  },
  codeText: { flex: 1, gap: spacing.xs },
  codeLabel: { ...type.caption, color: c.textMuted },
  code: { ...type.title, color: c.text, letterSpacing: 3 },
  copy: { alignItems: 'center', gap: 2 },
  copyText: { ...type.caption, color: c.primary, fontWeight: '700' },
  copiedText: { color: c.success },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { ...type.bodyStrong, color: c.text },
  rowCodeWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowCode: { ...type.bodyStrong, color: c.primary, letterSpacing: 1.5 },
});
