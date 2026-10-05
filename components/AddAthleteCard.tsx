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
 * For a parent with more than one child in the clinic. Each child comes with
 * its own parent code; the first one set up this account, and this is where
 * the rest go. Once two children are linked, the switcher at the top of
 * Training, Profile and Meet with Coach appears by itself.
 */
export function AddAthleteCard({ onLinked }: { onLinked: () => Promise<void> }) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [open, setOpen] = useState(false);
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
    const { data, error: rpcError } = await supabase.rpc('link_another_athlete', { p_code: code });
    if (rpcError) {
      setBusy(false);
      setError(rpcError.message);
      return;
    }
    await onLinked();
    setBusy(false);
    close();
    setDone(
      (data as number | null) && (data as number) > 0
        ? 'Added. Tap a name at the top of Training or Profile to switch between your runners.'
        : 'Code accepted. Your runner will appear here as soon as they sign in with their own code.'
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
            <Text style={styles.rowTitle}>Add another athlete</Text>
            <Text style={styles.rowSubtitle}>
              More than one runner in the clinic? Use their parent code.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
        </Pressable>
      </View>
    );
  }

  return (
    <Card accent="primary">
      <Text style={styles.title}>Add another athlete</Text>
      <Text style={styles.body}>
        Enter the parent code from that runner’s registration confirmation. Each child
        has their own.
      </Text>
      <View style={styles.field}>
        <TextField
          label="Parent code"
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
    body: { ...type.body, color: c.textMuted, marginTop: spacing.xs },
    field: { marginTop: spacing.lg },
    actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    action: { flex: 1 },
  });
