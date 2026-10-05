import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { TextField } from './Field';
import { useTheme, useThemedStyles } from '../lib/appearance';
import { firstName } from '../lib/format';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { radius, spacing, type, type Palette } from '../lib/theme';

type Waiting = { family_id: string; runner_name: string };

/**
 * For each of a parent's runners who has no account yet: "Runner without a
 * phone?" with the runner's name ready to confirm.
 *
 * A runner with a phone needs nothing from here — they sign in with their own
 * athlete code and the link forms by itself. A runner without one is set up by
 * the parent, by name, and the parent then does everything for them. Coaches
 * see them on the roster like anyone else.
 */
export function SetUpRunnerCards({
  onSetUp,
  refreshKey = 0,
}: {
  onSetUp: () => Promise<void>;
  /** Bumped when the parent adds a code, which may add a runner to wait on. */
  refreshKey?: number;
}) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase.rpc('my_runners_to_set_up');
    setWaiting((data as Waiting[] | null) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <>
      {done ? (
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={18} color={c.success} />
          <Text style={styles.doneText}>{done}</Text>
        </View>
      ) : null}
      {waiting.map((runner) => (
        <SetUpRunner
          key={runner.family_id}
          runner={runner}
          onSetUp={async (name) => {
            await onSetUp();
            await load();
            setDone(
              `${firstName(name)} is set up. You’ll see their training, schedule, and miles here, and can log their runs. Fill in their profile above.`
            );
          }}
        />
      ))}
    </>
  );
}

function SetUpRunner({
  runner,
  onSetUp,
}: {
  runner: Waiting;
  onSetUp: (name: string) => Promise<void>;
}) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState(runner.runner_name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setUp() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('set_up_runner', {
      p_family: runner.family_id,
      p_name: name,
    });
    if (rpcError) {
      setBusy(false);
      setError(rpcError.message);
      return;
    }
    await onSetUp(name.trim());
  }

  const first = firstName(name) || 'your runner';

  return (
    <Card accent="primary">
      <Text style={styles.title}>Runner without a phone?</Text>
      <View style={styles.cases}>
        <View style={styles.case}>
          <Ionicons name="phone-portrait-outline" size={18} color={c.primary} style={styles.caseIcon} />
          <Text style={styles.caseText}>
            <Text style={styles.strong}>Has a phone:</Text> nothing to do. They sign in with
            their own athlete code and appear here.
          </Text>
        </View>
        <View style={styles.case}>
          <Ionicons name="person-outline" size={18} color={c.primary} style={styles.caseIcon} />
          <Text style={styles.caseText}>
            <Text style={styles.strong}>No phone:</Text> set them up here. You’ll see their
            training and log their runs, and the coaches see them like any other runner.
          </Text>
        </View>
      </View>
      <View style={styles.field}>
        <TextField
          label="Runner’s name"
          value={name}
          onChangeText={(next) => {
            setName(next);
            if (error) setError(null);
          }}
          autoCapitalize="words"
          maxLength={80}
          error={error}
        />
      </View>
      <Button
        label={`Set up ${first} without a phone`}
        icon="person-add-outline"
        full
        loading={busy}
        disabled={!name.trim()}
        onPress={() => void setUp()}
        style={styles.button}
      />
    </Card>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    title: { ...type.heading, color: c.text },
    cases: { gap: spacing.md, marginTop: spacing.md },
    case: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    caseIcon: { marginTop: 2 },
    caseText: { ...type.body, color: c.textMuted, flex: 1 },
    strong: { fontWeight: '700', color: c.text },
    field: { marginTop: spacing.lg },
    button: { marginTop: spacing.lg },
    done: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.successTint,
    },
    doneText: { ...type.caption, color: c.success, flex: 1 },
  });
