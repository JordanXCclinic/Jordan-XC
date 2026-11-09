import { useCallback, useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { SwitchRow, TextField } from '../../../components/Field';
import { EmptyState, LoadingState, Screen, SectionHeader } from '../../../components/Screen';
import { confirmDestructive } from '../../../lib/confirm';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { INVITE_CODE_COLUMNS, type InviteCode } from '../../../lib/types';
import { roleLabel } from '../../../lib/format';
import { radius, spacing, type, type Palette } from '../../../lib/theme';
import { useTheme, useThemedStyles } from '../../../lib/appearance';

const SEASON = String(new Date().getFullYear());

/** A family's codes: one per runner, and the one parent code they share. */
type Issued = {
  runners: { name: string; code: string }[];
  parentCode: string;
  /** Added to a family that already had codes, rather than a new family. */
  joined: boolean;
};

/** Brothers and sisters share one parent code; six is plenty for one family. */
const MAX_RUNNERS = 6;

/** "Jack", "Jack and Emmy", "Jack, Emmy and Tre". */
function joinNames(names: string[]): string {
  const firsts = names.map((name) => name.trim().split(/\s+/)[0] ?? name);
  return firsts.length <= 1
    ? (firsts[0] ?? '')
    : `${firsts.slice(0, -1).join(', ')} and ${firsts[firsts.length - 1]}`;
}

export default function Codes() {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  /** One name per runner in the family. */
  const [names, setNames] = useState<string[]>(['']);
  const [oneOnOne, setOneOnOne] = useState(false);
  /** Adding a brother or sister to a family that already has a parent code. */
  const [joining, setJoining] = useState(false);
  const [familyCode, setFamilyCode] = useState('');
  const [issued, setIssued] = useState<Issued | null>(null);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [coachName, setCoachName] = useState('');
  const [coachCode, setCoachCode] = useState<{ code: string; name: string } | null>(null);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);

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

  const filled = names.map((runner) => runner.trim()).filter(Boolean);

  function setNameAt(index: number, next: string) {
    setNames((current) => current.map((runner, at) => (at === index ? next : runner)));
    if (error) setError(null);
  }

  async function onGenerate() {
    if (filled.length === 0) return;
    setBusy(true);
    setError(null);
    const role = oneOnOne ? 'private_client' : 'athlete';

    if (joining) {
      // One at a time onto the family's parent code. Stopping at the first
      // failure keeps what was made, and says which ones those are.
      const made: { name: string; code: string }[] = [];
      for (const runner of filled) {
        const { data, error: rpcError } = await supabase.rpc('add_runner_to_family', {
          p_parent_code: familyCode,
          p_full_name: runner,
          p_season: SEASON,
          p_athlete_role: role,
        });
        if (rpcError || typeof data !== 'string') {
          setError(
            made.length > 0
              ? `${rpcError?.message ?? 'Something went wrong'}. Codes were made for ${joinNames(made.map((m) => m.name))} only.`
              : (rpcError?.message ?? 'Something went wrong.')
          );
          break;
        }
        made.push({ name: runner, code: data });
      }
      setBusy(false);
      if (made.length > 0) {
        setIssued({ runners: made, parentCode: familyCode.trim().toUpperCase(), joined: true });
        setNames(['']);
        setCopied(null);
        await load();
      }
      return;
    }

    const { data, error: rpcError } = await supabase.rpc('create_family_codes_for', {
      p_names: filled,
      p_season: SEASON,
      p_athlete_role: role,
    });

    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const rows =
      (data as { runner_name: string; athlete_code: string; parent_code: string }[] | null) ?? [];
    if (rows.length > 0) {
      setIssued({
        runners: rows.map((row) => ({ name: row.runner_name, code: row.athlete_code })),
        parentCode: rows[0]!.parent_code,
        joined: false,
      });
      setNames(['']);
      setCopied(null);
      await load();
    }
  }

  // A coach code makes an assistant coach: the full Coach tab, every runner's
  // details, and these codes too. One code, one coach, no family attached.
  async function onCoachCode() {
    setCoachBusy(true);
    setCoachError(null);

    const { data, error: rpcError } = await supabase.rpc('create_coach_code', {
      p_full_name: coachName,
      p_season: SEASON,
    });

    setCoachBusy(false);

    if (rpcError) {
      setCoachError(rpcError.message);
      return;
    }

    if (typeof data === 'string') {
      setCoachCode({ code: data, name: coachName.trim() });
      setCoachName('');
      setCopied(null);
      await load();
    }
  }

  async function deleteCode(code: InviteCode) {
    // A parent code finds its athlete through the athlete's code. Delete an
    // unused athlete code on its own and the parent's could still be redeemed
    // later into an account connected to nobody — so it goes with it. A parent
    // code on its own is safe to lose: the athlete can join without one.
    // A brother or sister still on the family keeps the parent code: it is
    // theirs too.
    const siblings = codes.filter(
      (other) =>
        other.id !== code.id &&
        other.family_id === code.family_id &&
        (other.role === 'athlete' || other.role === 'private_client')
    );
    const partners =
      code.role === 'parent' || !code.family_id || siblings.length > 0
        ? []
        : codes.filter(
            (other) =>
              other.id !== code.id &&
              other.family_id === code.family_id &&
              other.role === 'parent' &&
              !other.redeemed_at
          );

    const confirmed = await confirmDestructive(
      `Delete the code for ${code.full_name}?`,
      [
        `${code.code} stops working. Nobody has used it yet, so nothing else changes.`,
        partners.length > 0
          ? `The matching parent code, ${partners.map((p) => p.code).join(' and ')}, is deleted too — without this one it would connect to no one.`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n')
    );
    if (!confirmed) return;

    const ids = [code.id, ...partners.map((p) => p.id)];
    setListError(null);
    // The redeemed_at filter is the real guard: a code claimed since this list
    // loaded is left alone, because a used code is what links a family together.
    const { data, error: deleteError } = await supabase
      .from('invite_codes')
      .delete()
      .in('id', ids)
      .is('redeemed_at', null)
      .select('id');

    if (deleteError) {
      setListError(deleteError.message);
      return;
    }
    const gone = new Set(((data as { id: string }[] | null) ?? []).map((row) => row.id));
    if (gone.size < ids.length) {
      setListError('One of those codes was used a moment ago, so it was kept.');
    }
    // Taken out of the list here rather than by reloading, so the list does
    // not jump back to the top.
    setCodes((current) => current.filter((existing) => !gone.has(existing.id)));
  }

  async function copy(key: string, value: string) {
    await Clipboard.setStringAsync(value);
    setCopied(key);
  }

  const outstanding = codes.filter((code) => !code.redeemed_at);

  return (
    <Screen
      inStack
      title="Clinic codes"
      subtitle={`Season ${SEASON}. Issue codes once a family has registered on the website, or add a coach.`}
      onRefresh={load}
      avoidKeyboard
    >
      <Card accent="primary">
        <Text style={styles.cardTitle}>Issue codes for a family</Text>
        <Text style={styles.hint}>
          Each runner gets their own code. Brothers and sisters share one parent code, so a parent
          signs in once and switches between their runners.
        </Text>
        <View style={styles.fields}>
          <SwitchRow
            label="Adding to a family that already has codes"
            hint="A brother or sister of a runner you have issued codes for before."
            value={joining}
            onValueChange={(next) => {
              setJoining(next);
              setError(null);
            }}
          />
          {joining ? (
            <TextField
              label="That family’s parent code"
              value={familyCode}
              onChangeText={(next) => {
                setFamilyCode(next);
                if (error) setError(null);
              }}
              placeholder="ABCDEFGHJK"
              autoCapitalize="characters"
              hint="It is in the list below, used or not. The parent keeps using the same code."
              required
            />
          ) : null}
          {names.map((runner, index) => (
            <View key={index} style={styles.nameRow}>
              <View style={styles.nameField}>
                <TextField
                  label={
                    index === 0
                      ? joining
                        ? 'Brother or sister’s name'
                        : 'Athlete name'
                      : 'Brother or sister’s name'
                  }
                  value={runner}
                  onChangeText={(next) => setNameAt(index, next)}
                  placeholder={index === 0 ? 'Sam Runner' : 'Alex Runner'}
                  required={index === 0}
                  autoCapitalize="words"
                  maxLength={80}
                />
              </View>
              {index > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${runner.trim() || 'this runner'}`}
                  onPress={() => setNames((current) => current.filter((_, at) => at !== index))}
                  hitSlop={8}
                  style={({ pressed }) => [styles.removeName, pressed && styles.pressed]}
                >
                  <Ionicons name="close-circle" size={22} color={c.textFaint} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {names.length < MAX_RUNNERS ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setNames((current) => [...current, ''])}
              style={({ pressed }) => [styles.addName, pressed && styles.pressed]}
            >
              <Ionicons name="add-circle-outline" size={18} color={c.primary} />
              <Text style={styles.addNameText}>Add a brother or sister</Text>
            </Pressable>
          ) : null}
          <SwitchRow
            label="One-on-one client"
            hint="Private coaching rather than the summer clinic."
            value={oneOnOne}
            onValueChange={setOneOnOne}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={filled.length > 1 ? `Generate codes for ${filled.length} runners` : 'Generate codes'}
          full
          loading={busy}
          disabled={filled.length === 0 || (joining && !familyCode.trim())}
          onPress={onGenerate}
          style={styles.submit}
        />
      </Card>

      {issued ? (
        <Card accent="primary">
          <Text style={styles.cardTitle}>
            Codes for {joinNames(issued.runners.map((runner) => runner.name))}
          </Text>
          <Text style={styles.hint}>
            {issued.joined
              ? `They join the family on its parent code, ${issued.parentCode}. A parent already signed in sees them once each runner signs in, or sets them up from the Profile tab if they have no phone.`
              : issued.runners.length > 1
                ? `Send the parent code to the parent: it covers ${joinNames(issued.runners.map((runner) => runner.name))}. Send each athlete code to the runner it names. A runner without a phone needs no code: the parent sets them up.`
                : 'Send the athlete code to the runner and the parent code to their guardian. Each one works once, and either can be redeemed first.'}
          </Text>

          {[
            ...issued.runners.map((runner, index) => ({
              key: `athlete-${index}`,
              label: issued.runners.length > 1 ? `Athlete · ${runner.name}` : 'Athlete',
              value: runner.code,
            })),
            ...(issued.joined
              ? []
              : [
                  {
                    key: 'parent',
                    label:
                      issued.runners.length > 1
                        ? `Parent · one code for ${joinNames(issued.runners.map((runner) => runner.name))}`
                        : 'Parent',
                    value: issued.parentCode,
                  },
                ]),
          ].map(({ key, label, value }) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`Copy the code: ${label}`}
              onPress={() => copy(key, value)}
              style={({ pressed }) => [styles.codeRow, pressed && styles.pressed]}
            >
              <View style={styles.codeText}>
                <Text style={styles.codeLabel}>{label}</Text>
                <Text style={styles.code}>{value}</Text>
              </View>
              <View style={styles.copy}>
                <Ionicons
                  name={copied === key ? 'checkmark-circle' : 'copy-outline'}
                  size={17}
                  color={copied === key ? c.success : c.primary}
                />
                <Text style={[styles.copyText, copied === key && styles.copiedText]}>
                  {copied === key ? 'Copied' : 'Copy'}
                </Text>
              </View>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <Card>
        <Text style={styles.cardTitle}>Add a coach</Text>
        <Text style={styles.hint}>
          An assistant coach gets the same Coach tab as you, including every runner’s details and
          these codes, so only send one to your staff.
        </Text>
        <View style={styles.fields}>
          <TextField
            label="Coach name"
            value={coachName}
            onChangeText={(next) => {
              setCoachName(next);
              if (coachError) setCoachError(null);
            }}
            placeholder="Alex Coach"
            required
            autoCapitalize="words"
            maxLength={80}
          />
        </View>

        {coachError ? <Text style={styles.error}>{coachError}</Text> : null}

        <Button
          label="Make a coach code"
          icon="people-outline"
          variant="secondary"
          full
          loading={coachBusy}
          disabled={!coachName.trim()}
          onPress={onCoachCode}
          style={styles.submit}
        />

        {coachCode ? (
          <>
            <Text style={[styles.hint, styles.coachSent]}>
              Send this to {coachCode.name}. They sign in with Apple or Google and enter it. It
              works once.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Copy the coach code for ${coachCode.name}`}
              onPress={() => copy('Coach', coachCode.code)}
              style={({ pressed }) => [styles.codeRow, pressed && styles.pressed]}
            >
              <View style={styles.codeText}>
                <Text style={styles.codeLabel}>Coach</Text>
                <Text style={styles.code}>{coachCode.code}</Text>
              </View>
              <View style={styles.copy}>
                <Ionicons
                  name={copied === 'Coach' ? 'checkmark-circle' : 'copy-outline'}
                  size={17}
                  color={copied === 'Coach' ? c.success : c.primary}
                />
                <Text style={[styles.copyText, copied === 'Coach' && styles.copiedText]}>
                  {copied === 'Coach' ? 'Copied' : 'Copy'}
                </Text>
              </View>
            </Pressable>
          </>
        ) : null}
      </Card>

      <SectionHeader title={`Not yet used (${outstanding.length})`} />

      {listError ? <Text style={styles.error}>{listError}</Text> : null}

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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete the code for ${code.full_name}`}
                onPress={() => void deleteCode(code)}
                hitSlop={8}
                style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
              >
                <Ionicons name="trash-outline" size={17} color={c.danger} />
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
  coachSent: { marginTop: spacing.lg },
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
  delete: { paddingLeft: spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  nameField: { flex: 1 },
  removeName: { paddingBottom: spacing.md },
  addName: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' },
  addNameText: { ...type.label, color: c.primary },
});
