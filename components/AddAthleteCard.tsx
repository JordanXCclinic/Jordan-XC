import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { TextField } from './Field';
import { useTheme, useThemedStyles } from '../lib/appearance';
import { supabase } from '../lib/supabase';
import { radius, spacing, type, type Palette } from '../lib/theme';

/**
 * Where a parent adds a runner after their own account is set up, with either
 * code from a registration confirmation:
 *
 *   - their runner's athlete code, for a child with no phone: it sets up the
 *     child's account, which the parent then runs for them;
 *   - another child's parent code, for a second child in the clinic.
 *
 * Once two children are linked, the switcher at the top of Training, Profile
 * and Meet with Coach appears by itself.
 */
export function AddAthleteCard({
  onLinked,
  startOpen = false,
}: {
  onLinked: () => Promise<void>;
  /** Open straight away for a parent with no runner linked yet. */
  startOpen?: boolean;
}) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [open, setOpen] = useState(startOpen);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setCode('');
    setError(null);
  }

  async function submit() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('add_athlete_to_family', { p_code: code });
    if (rpcError) {
      setBusy(false);
      setError(rpcError.message);
      return;
    }
    await onLinked();
    setBusy(false);
    close();
    setDone(
      data === 'pending'
        ? 'Code accepted. Your runner will appear here as soon as they sign in with their own code.'
        : data === 'managed'
          ? 'Added. You can now see their training, schedule, and miles, and log runs for them. Fill in their profile above.'
          : 'Added. Tap a name at the top of Training or Profile to switch between your runners.'
    );
  }

  if (!open) {
    return (
      <View style={styles.closedWrap}>
        {done ? (
          <View style={styles.done}>
            <Ionicons name="checkmark-circle" size={18} color={c.success} />
            <Text style={styles.doneText}>{done}</Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setDone(null);
            setOpen(true);
          }}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.icon}>
            <Ionicons name="person-add-outline" size={20} color={c.primary} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Add an athlete</Text>
            <Text style={styles.rowSubtitle}>
              A runner without a phone, or another child in the clinic
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
        </Pressable>
      </View>
    );
  }

  return (
    <Card accent="primary">
      <Text style={styles.title}>Add an athlete</Text>
      <View style={styles.cases}>
        <Case
          icon="phone-portrait-outline"
          text="Your runner doesn’t have a phone? Enter their athlete code. You’ll see everything they would, and log their runs."
        />
        <Case
          icon="people-outline"
          text="Another child in the clinic? Enter that child’s parent code."
        />
      </View>
      <View style={styles.field}>
        <TextField
          label="Clinic code"
          value={code}
          onChangeText={(next) => {
            // The alphabet has no I, O, 0 or 1, so anything typed is upper case.
            setCode(next.toUpperCase().replace(/\s/g, ''));
            if (error) setError(null);
          }}
          placeholder="ABCDEFGHJK"
          autoCapitalize="characters"
          maxLength={16}
          error={error}
        />
      </View>
      <View style={styles.actions}>
        <Button label="Cancel" variant="secondary" onPress={close} style={styles.action} />
        <Button
          label="Add"
          loading={busy}
          disabled={!code.trim()}
          onPress={() => void submit()}
          style={styles.action}
        />
      </View>
    </Card>
  );
}

function Case({ icon, text }: { icon: 'phone-portrait-outline' | 'people-outline'; text: string }) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.case}>
      <Ionicons name={icon} size={18} color={c.primary} style={styles.caseIcon} />
      <Text style={styles.caseText}>{text}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    closedWrap: { gap: spacing.md },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.borderStrong,
    },
    pressed: { opacity: 0.75 },
    icon: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: c.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: { flex: 1 },
    rowTitle: { ...type.bodyStrong, color: c.text },
    rowSubtitle: { ...type.caption, color: c.textMuted, marginTop: 2 },
    done: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.successTint,
    },
    doneText: { ...type.caption, color: c.success, flex: 1 },
    title: { ...type.heading, color: c.text },
    cases: { gap: spacing.md, marginTop: spacing.md },
    case: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    caseIcon: { marginTop: 2 },
    caseText: { ...type.body, color: c.textMuted, flex: 1 },
    field: { marginTop: spacing.lg },
    actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    action: { flex: 1 },
  });
