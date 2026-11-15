import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../../../components/Avatar';
import { DraggableList, type DragHandle } from '../../../../components/DraggableList';
import { SegmentedControl } from '../../../../components/SegmentedControl';
import { Badge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { ChipSelect, TextField } from '../../../../components/Field';
import { EmptyState, LoadingState, Screen, SectionHeader } from '../../../../components/Screen';
import { confirmDestructive } from '../../../../lib/confirm';
import { formatShortDate } from '../../../../lib/format';
import { useAuth } from '../../../../lib/auth';
import {
  filterRoster,
  moveInFull,
  sortRoster,
  type RosterFilter,
  type RosterSort,
} from '../../../../lib/roster';
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

const SORTS: { value: RosterSort; label: string }[] = [
  { value: 'custom', label: 'My order' },
  { value: 'first', label: 'First name' },
  { value: 'last', label: 'Last name' },
  { value: 'class', label: 'Class year' },
];

// How the coach last left the list, on this phone. The dragged order itself is
// kept in the database so it follows them everywhere.
const SORT_KEY = 'roster-sort';
const FILTER_KEY = 'roster-filter';

export default function Roster() {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const [athletes, setAthletes] = useState<Profile[]>([]);
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const [settingUp, setSettingUp] = useState<string | null>(null);
  const [waitError, setWaitError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { profile } = useAuth();
  /** Runner ids in the coach's own dragged order. */
  const [order, setOrder] = useState<string[]>([]);
  const [sort, setSort] = useState<RosterSort>('custom');
  const [filter, setFilter] = useState<RosterFilter>('all');
  const [dragging, setDragging] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    void AsyncStorage.multiGet([SORT_KEY, FILTER_KEY])
      .then((pairs) => {
        const saved = Object.fromEntries(pairs);
        if (SORTS.some((option) => option.value === saved[SORT_KEY])) setSort(saved[SORT_KEY] as RosterSort);
        if (['all', 'private', 'clinic'].includes(saved[FILTER_KEY] ?? '')) {
          setFilter(saved[FILTER_KEY] as RosterFilter);
        }
      })
      .catch(() => undefined);
  }, []);

  function chooseSort(next: RosterSort) {
    setSort(next);
    void AsyncStorage.setItem(SORT_KEY, next).catch(() => undefined);
  }

  function chooseFilter(next: RosterFilter) {
    setFilter(next);
    void AsyncStorage.setItem(FILTER_KEY, next).catch(() => undefined);
  }
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
    const [{ data }, { data: waitingRows }, { data: orderRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .in('role', ['athlete', 'private_client'])
        .order('full_name'),
      supabase.rpc('runners_waiting_for_set_up'),
      supabase.from('roster_order').select('athlete_id').order('position'),
    ]);
    setAthletes((data as Profile[] | null) ?? []);
    setOrder(((orderRows as { athlete_id: string }[] | null) ?? []).map((row) => row.athlete_id));
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

  const counts = useMemo(
    () => ({
      all: athletes.length,
      private: filterRoster(athletes, 'private').length,
      clinic: filterRoster(athletes, 'clinic').length,
    }),
    [athletes]
  );

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = filterRoster(athletes, filter).filter(
      (athlete) => !needle || athlete.full_name.toLowerCase().includes(needle)
    );
    return sortRoster(filtered, sort, order);
  }, [athletes, search, filter, sort, order]);

  // Dragging only makes sense in the coach's own order, with nothing hidden by a search.
  const canDrag = sort === 'custom' && !search.trim() && shown.length > 1;

  async function reorder(from: number, to: number) {
    if (!profile) return;
    const full = sortRoster(athletes, 'custom', order).map((athlete) => athlete.id);
    const next = moveInFull(full, shown.map((athlete) => athlete.id), from, to);
    const before = order;
    setOrder(next);
    setOrderError(null);

    const { error } = await supabase.from('roster_order').upsert(
      next.map((athleteId, position) => ({ coach_id: profile.id, athlete_id: athleteId, position })),
      { onConflict: 'coach_id,athlete_id' }
    );
    if (error) {
      setOrder(before);
      setOrderError(`Your order was not saved — ${error.message}`);
    }
  }

  function renderRow(athlete: Profile, handle: DragHandle | null, lifted = false) {
    return (
      <View style={[styles.row, lifted && styles.rowLifted]}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/(tabs)/coach/roster/[id]',
              params: { id: athlete.id },
            })
          }
          style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
        >
          <Avatar name={athlete.full_name} />
          <View style={styles.text}>
            <Text style={styles.name}>{athlete.full_name}</Text>
            {athlete.graduation_year ? (
              <Text style={styles.meta}>Class of {athlete.graduation_year}</Text>
            ) : null}
            {athlete.role === 'private_client' || athlete.managed || !athlete.onboarded_at ? (
              // Under the name rather than beside it, so two badges and the
              // drag handle never squeeze the name into a column of letters.
              <View style={styles.badges}>
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
              </View>
            ) : null}
          </View>
        </Pressable>
        {handle ? (
          <View
            {...handle.handlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`Move ${athlete.full_name}`}
            accessibilityHint="Drag up or down to change the order"
            accessibilityActions={handle.accessibilityActions}
            onAccessibilityAction={handle.onAccessibilityAction}
            style={styles.handle}
          >
            <Ionicons name="reorder-three" size={28} color={c.textMuted} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Screen
      inStack
      title="Roster"
      subtitle={`${athletes.length} ${athletes.length === 1 ? 'athlete' : 'athletes'}`}
      onRefresh={load}
      avoidKeyboard
      scrollEnabled={!dragging}
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

      {athletes.length > 0 ? (
        <>
          <SegmentedControl
            options={[
              { value: 'all', label: `All ${counts.all}` },
              { value: 'private', label: `One-on-one ${counts.private}` },
              { value: 'clinic', label: `Clinic ${counts.clinic}` },
            ]}
            value={filter}
            onChange={chooseFilter}
          />
          <ChipSelect label="Sort by" options={SORTS} value={sort} onChange={chooseSort} />
          {canDrag ? (
            <Text style={styles.dragHint}>
              Hold the lines on the right of a name and drag it up or down to put the roster in your
              own order.
            </Text>
          ) : null}
          {orderError ? <Text style={styles.waitError}>{orderError}</Text> : null}
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
              : search.trim()
                ? 'No athlete by that name.'
                : filter === 'private'
                  ? 'No one-on-one clients yet.'
                  : 'No clinic athletes yet.'
          }
        />
      ) : canDrag ? (
        <DraggableList
          items={shown}
          keyOf={(athlete) => athlete.id}
          onReorder={(from, to) => void reorder(from, to)}
          onDragChange={setDragging}
          renderItem={(athlete, handle, lifted) => renderRow(athlete, handle, lifted)}
        />
      ) : (
        shown.map((athlete) => <View key={athlete.id}>{renderRow(athlete, null)}</View>)
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
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowLifted: { borderColor: c.primary },
  handle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -spacing.xs },
  dragHint: { ...type.caption, color: c.textMuted, marginTop: -spacing.xs },
  text: { flex: 1, minWidth: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  name: { ...type.bodyStrong, color: c.text },
  meta: { ...type.caption, color: c.textMuted },
  waitHint: { ...type.caption, color: c.textMuted, marginTop: -spacing.sm },
  waitRow: { borderStyle: 'dashed', borderColor: c.warning },
  waitError: { ...type.caption, color: c.danger },
});
