import { useCallback, useMemo, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../../../components/Avatar';
import { Badge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { TextField } from '../../../../components/Field';
import { EmptyState, LoadingState, Screen, SectionHeader } from '../../../../components/Screen';
import { confirmDestructive } from '../../../../lib/confirm';
import { formatShortDate } from '../../../../lib/format';
import { isSupabaseConfigured, supabase } from '../../../../lib/supabase';
import { PROFILE_COLUMNS, type Profile } from '../../../../lib/types';
import { radius, shadow, spacing, type, type Palette } from '../../../../lib/theme';
import { useTheme, useThemedStyles } from '../../../../lib/appearance';

/** A runner whose parent signed in but never set them up (0031). */
type Waiting = {
  invite_id: string;
  runner_name: string;
  runner_role: 'athlete' | 'private_client';
  parent_name: string;
  parent_signed_in_at: string;
};

export default function Roster() {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const [athletes, setAthletes] = useState<Profile[]>([]);
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const [settingUp, setSettingUp] = useState<string | null>(null);
  const [waitError, setWaitError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  // The spinner is for the first load only. This list reloads every time it
  // comes back into view, and blanking it each time would throw away the
  // scroll position.
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    if (!loadedOnce.current) setLoading(true);
    const [{ data }, { data: waitingRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .in('role', ['athlete', 'private_client'])
        .order('full_name'),
      supabase.rpc('runners_waiting_for_set_up'),
    ]);
    setAthletes((data as Profile[] | null) ?? []);
    setWaiting(
      ((waitingRows as Waiting[] | null) ?? []).sort((a, b) => a.runner_name.localeCompare(b.runner_name))
    );
    loadedOnce.current = true;
    setLoading(false);
  }, []);

  // On focus rather than on mount: coming back from an athlete who was just
  // removed must not still show them in the list.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function setUp(runner: Waiting) {
    const confirmed = await confirmDestructive(
      `Add ${runner.runner_name} to the roster?`,
      [
        `${runner.runner_name} is set up as a runner without a phone, under the parent who signed in. You can assign training straight away, and the parent sees it in the app.`,
        `Their own code stops working. If ${runner.runner_name} has a phone and wants to sign in on it, let them do that instead.`,
      ].join('\n\n'),
      'Add to roster'
    );
    if (!confirmed) return;

    setSettingUp(runner.invite_id);
    setWaitError(null);
    const { error } = await supabase.rpc('staff_set_up_runner', { p_invite: runner.invite_id });
    setSettingUp(null);
    if (error) {
      setWaitError(`${runner.runner_name} was not added — ${error.message}`);
      return;
    }
    await load();
  }

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return athletes;
    return athletes.filter((athlete) => athlete.full_name.toLowerCase().includes(needle));
  }, [athletes, search]);

  return (
    <Screen
      inStack
      title="Roster"
      subtitle={`${athletes.length} ${athletes.length === 1 ? 'athlete' : 'athletes'}`}
      onRefresh={load}
      avoidKeyboard
    >
      {athletes.length > 6 ? (
        <TextField
          label="Search"
          value={search}
          onChangeText={setSearch}
          placeholder="Name"
          autoCapitalize="none"
        />
      ) : null}

      {!loading && waiting.length > 0 ? (
        <>
          <SectionHeader title={`Waiting to be set up (${waiting.length})`} />
          <Text style={styles.waitHint}>
            Their parent has signed in, but these runners are not set up yet, so they cannot get
            training.
          </Text>
          {waiting.map((runner) => (
            <View key={runner.invite_id} style={[styles.row, styles.waitRow]}>
              <Avatar name={runner.runner_name} />
              <View style={styles.text}>
                <Text style={styles.name}>{runner.runner_name}</Text>
                <Text style={styles.meta}>
                  Parent signed in {formatShortDate(runner.parent_signed_in_at)}
                </Text>
              </View>
              <Button
                label="Add to roster"
                variant="secondary"
                loading={settingUp === runner.invite_id}
                disabled={settingUp !== null}
                onPress={() => void setUp(runner)}
              />
            </View>
          ))}
          {waitError ? <Text style={styles.waitError}>{waitError}</Text> : null}
          <SectionHeader title="On the roster" />
        </>
      ) : null}

      {loading ? (
        <LoadingState />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="people-outline"
          message={
            athletes.length === 0
              ? 'No athletes yet. Issue a clinic code to a registered family to get them in.'
              : 'No athlete by that name.'
          }
        />
      ) : (
        shown.map((athlete) => (
          <Pressable
            key={athlete.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/(tabs)/coach/roster/[id]',
                params: { id: athlete.id },
              })
            }
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Avatar name={athlete.full_name} />
            <View style={styles.text}>
              <Text style={styles.name}>{athlete.full_name}</Text>
              {athlete.graduation_year ? (
                <Text style={styles.meta}>Class of {athlete.graduation_year}</Text>
              ) : null}
            </View>
            {athlete.role === 'private_client' ? (
              <Badge label="One-on-one" tone="primary" />
            ) : null}
            {athlete.managed ? (
              // Nobody signs in as a runner without a phone, so "setup
              // pending" would never clear; the parent does it all.
              <Badge label="Parent manages" />
            ) : !athlete.onboarded_at ? (
              <Badge label="Setup pending" tone="warning" />
            ) : null}
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
    ...shadow.card,
  },
  pressed: { opacity: 0.9 },
  text: { flex: 1 },
  name: { ...type.bodyStrong, color: c.text },
  meta: { ...type.caption, color: c.textMuted },
  waitHint: { ...type.caption, color: c.textMuted, marginTop: -spacing.sm },
  waitRow: { borderStyle: 'dashed', borderColor: c.warning },
  waitError: { ...type.caption, color: c.danger },
});
