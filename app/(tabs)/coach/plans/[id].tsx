import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Badge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { ChipSelect, SwitchRow, TextField } from '../../../../components/Field';
import { WeekCalendar } from '../../../../components/WeekCalendar';
import { EmptyState, LoadingState, Screen, SectionHeader } from '../../../../components/Screen';
import { useAuth } from '../../../../lib/auth';
import { confirmDestructive } from '../../../../lib/confirm';
import {
  PLAN_DAYS,
  formatMileRange,
  formatShortDate,
  parseLadder,
  planDayLabel,
  splitsLabel,
  toDateInput,
} from '../../../../lib/format';
import { planWeekOf, workoutDate } from '../../../../lib/training';

const SPLIT_KINDS = [
  { value: 'same', label: 'All the same' },
  { value: 'ladder', label: 'Ladder' },
] as const;
import { isSupabaseConfigured, supabase } from '../../../../lib/supabase';
import { AUDIENCE_LABELS,
  PROFILE_COLUMNS,
  TRAINING_PLAN_COLUMNS,
  WORKOUT_COLUMNS,
  type Audience,
  type Profile,
  type TrainingPlan,
  type Workout,
} from '../../../../lib/types';
import { radius, spacing, type, type Palette } from '../../../../lib/theme';
import { useTheme, useThemedStyles } from '../../../../lib/appearance';

/** The plan, with the day its week 1 begins (0028), or null before one is picked. */
type EditablePlan = TrainingPlan & { starts_on: string | null };

/** "Nov 16 – 22", or "Nov 30 – Dec 6" when the week crosses a month. */
function weekRange(startsOn: string, week: number): string {
  const monday = workoutDate(startsOn, week, 1);
  const sunday = workoutDate(startsOn, week, 7);
  if (!monday || !sunday) return '';
  return monday.getMonth() === sunday.getMonth()
    ? `${formatShortDate(monday)} – ${sunday.getDate()}`
    : `${formatShortDate(monday)} – ${formatShortDate(sunday)}`;
}

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: 'clinic', label: AUDIENCE_LABELS.clinic },
  { value: 'private', label: AUDIENCE_LABELS.private },
  { value: 'everyone', label: AUDIENCE_LABELS.everyone },
];

type LoggedBy = {
  name: string;
  effort: number | null;
  /** Set when a parent entered it rather than the athlete. */
  enteredBy: string | null;
};

export default function PlanEditor() {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();

  const [plan, setPlan] = useState<EditablePlan | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [athletes, setAthletes] = useState<Profile[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  /** Each assigned runner's pace group on this plan, 1 to 5, or null for none. */
  const [groups, setGroups] = useState<Record<string, number | null>>({});
  /** Each assigned runner's start date, to spot anyone out of step with the plan. */
  const [starts, setStarts] = useState<Record<string, string>>({});
  /** Choosing which calendar week becomes week 1. */
  const [picking, setPicking] = useState(false);
  const [startSaving, setStartSaving] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigningAll, setAssigningAll] = useState(false);
  // Swapping the whole screen for a spinner on every refresh rebuilt the page
  // and lost the scroll position with it. Only the first load has nothing to
  // show yet.
  const loadedOnce = useRef(false);
  /** Who has logged each workout, so a coach can see the week at a glance. */
  const [logsByWorkout, setLogsByWorkout] = useState<Record<string, LoggedBy[]>>({});
  const [loading, setLoading] = useState(true);

  const [week, setWeek] = useState(1);
  const [day, setDay] = useState('1');
  /** Set while correcting an existing session rather than writing a new one. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [editingPlan, setEditingPlan] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planAudience, setPlanAudience] = useState<Audience>('clinic');
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [distance, setDistance] = useState('');
  const [distanceMax, setDistanceMax] = useState('');
  const [intensity, setIntensity] = useState('');
  /** Interval sessions: runners enter each rep's time when they log it. */
  const [splitsOn, setSplitsOn] = useState(false);
  const [splitCount, setSplitCount] = useState('');
  const [splitLabel, setSplitLabel] = useState('');
  /** Same distance every rep, or a ladder with a distance for each. */
  const [splitKind, setSplitKind] = useState<'same' | 'ladder'>('same');
  const [ladder, setLadder] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !id) {
      setLoading(false);
      return;
    }
    if (!loadedOnce.current) setLoading(true);

    const [{ data: planRow }, { data: workoutRows }, { data: athleteRows }, { data: assignRows }] =
      await Promise.all([
        supabase
          .from('training_plans')
          .select(`${TRAINING_PLAN_COLUMNS}, starts_on`)
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('workouts')
          .select(WORKOUT_COLUMNS)
          .eq('plan_id', id)
          .order('week_number')
          .order('day_of_week'),
        supabase
          .from('profiles')
          .select(PROFILE_COLUMNS)
          .in('role', ['athlete', 'private_client'])
          .order('full_name'),
        supabase
          .from('plan_assignments')
          .select('athlete_id, pace_group, starts_on')
          .eq('plan_id', id),
      ]);

    const loadedPlan = (planRow as EditablePlan | null) ?? null;
    setPlan(loadedPlan);
    // Open on this week of the plan, not week 1, once it is under way.
    if (!loadedOnce.current && loadedPlan?.starts_on) {
      setWeek(Math.max(1, planWeekOf(loadedPlan.starts_on, new Date()) ?? 1));
    }
    setWorkouts((workoutRows as Workout[] | null) ?? []);
    setAthletes((athleteRows as Profile[] | null) ?? []);
    const assignments =
      (assignRows as
        | { athlete_id: string; pace_group: number | null; starts_on: string }[]
        | null) ?? [];
    setAssigned(new Set(assignments.map((row) => row.athlete_id)));
    setGroups(Object.fromEntries(assignments.map((row) => [row.athlete_id, row.pace_group])));
    setStarts(Object.fromEntries(assignments.map((row) => [row.athlete_id, row.starts_on])));

    // Who has done which session. One query for the plan rather than one per
    // workout, then matched up in memory.
    const workoutIds = ((workoutRows as Workout[] | null) ?? []).map((workout) => workout.id);
    if (workoutIds.length > 0) {
      const { data: logRows } = await supabase
        .from('workout_logs')
        .select('workout_id, athlete_id, effort, logged_by')
        .in('workout_id', workoutIds);

      const logs = (logRows as
        | { workout_id: string; athlete_id: string; effort: number | null; logged_by: string | null }[]
        | null) ?? [];

      const names = new Map(
        ((athleteRows as Profile[] | null) ?? []).map((a) => [a.id, a.full_name])
      );
      // A parent who entered a log may not be on the athlete roster.
      const enteredIds = [
        ...new Set(
          logs
            .map((log) => log.logged_by)
            .filter((id): id is string => id !== null && !names.has(id))
        ),
      ];
      if (enteredIds.length > 0) {
        const { data: people } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', enteredIds);
        for (const person of (people as { id: string; full_name: string }[] | null) ?? []) {
          names.set(person.id, person.full_name);
        }
      }

      const grouped: Record<string, LoggedBy[]> = {};
      for (const log of logs) {
        (grouped[log.workout_id] ??= []).push({
          name: names.get(log.athlete_id) ?? 'An athlete',
          effort: log.effort,
          enteredBy:
            log.logged_by && log.logged_by !== log.athlete_id
              ? (names.get(log.logged_by) ?? 'a parent')
              : null,
        });
      }
      setLogsByWorkout(grouped);
    } else {
      setLogsByWorkout({});
    }

    loadedOnce.current = true;
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const writtenWeeks = useMemo(
    () => new Set(workouts.map((workout) => workout.week_number)),
    [workouts]
  );

  // Always offer one week past what exists, so a plan can grow a week at a time,
  // and the week picked on the calendar even if it skips ahead.
  const weeks = useMemo(() => {
    const highest = writtenWeeks.size > 0 ? Math.max(...writtenWeeks) : 0;
    return Array.from({ length: Math.max(highest + 1, week, 1) }, (_, index) => index + 1);
  }, [writtenWeeks, week]);

  const startsOn = plan?.starts_on ?? null;
  // With no start yet, the calendar can only be used to pick one.
  const choosingStart = picking || !startsOn;

  const dayOptions = useMemo(
    () =>
      PLAN_DAYS.map((label, index) => {
        const date = startsOn ? workoutDate(startsOn, week, index + 1) : null;
        return { value: String(index + 1), label: date ? `${label} ${date.getDate()}` : label };
      }),
    [startsOn, week]
  );

  /** A different week to write. Leaves any half-made edit behind rather than moving it. */
  function chooseWeek(next: number) {
    if (next === week) return;
    if (editingId) resetForm();
    setWeek(next);
  }

  /**
   * Week 1 begins on this Monday, for the plan and everyone on it. One date for
   * the whole group, so week 3 is the same week for every runner.
   */
  async function saveStart(monday: Date) {
    if (!id || !plan) return;
    const value = toDateInput(monday);
    setStartSaving(true);
    setStartError(null);

    const { error: planWriteError } = await supabase
      .from('training_plans')
      .update({ starts_on: value })
      .eq('id', id);
    const { error: assignWriteError } = planWriteError
      ? { error: null }
      : await supabase.from('plan_assignments').update({ starts_on: value }).eq('plan_id', id);

    setStartSaving(false);
    const writeError = planWriteError ?? assignWriteError;
    if (writeError) {
      setStartError(`The start date was not changed — ${writeError.message}`);
      if (!planWriteError) setPlan({ ...plan, starts_on: value });
      return;
    }

    setPlan({ ...plan, starts_on: value });
    setStarts((current) => Object.fromEntries(Object.keys(current).map((key) => [key, value])));
    setPicking(false);
  }

  function pickWeek(monday: Date) {
    if (choosingStart) {
      void saveStart(monday);
      return;
    }
    const picked = startsOn ? planWeekOf(startsOn, monday) : null;
    if (picked !== null) chooseWeek(picked);
  }

  const shown = useMemo(
    () => workouts.filter((workout) => workout.week_number === week),
    [workouts, week]
  );

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setDistance('');
    setDistanceMax('');
    setIntensity('');
    setSplitsOn(false);
    setSplitCount('');
    setSplitLabel('');
    setSplitKind('same');
    setLadder('');
    setDescription('');
    setError(null);
  }

  /** Pulls a session back into the form, so fixing a typo is not a retype. */
  function startEditing(workout: Workout) {
    setEditingId(workout.id);
    setWeek(workout.week_number);
    setDay(String(workout.day_of_week));
    setTitle(workout.title);
    setDistance(workout.distance_miles === null ? '' : String(workout.distance_miles));
    setDistanceMax(
      workout.distance_miles_max === null ? '' : String(workout.distance_miles_max)
    );
    setIntensity(workout.intensity ?? '');
    setSplitsOn(workout.split_count !== null);
    setSplitCount(workout.split_count === null ? '' : String(workout.split_count));
    setSplitLabel(workout.split_label ?? '');
    setSplitKind(workout.split_labels ? 'ladder' : 'same');
    setLadder(workout.split_labels ? workout.split_labels.join(', ') : '');
    setDescription(workout.description ?? '');
    setError(null);
  }

  async function addWorkout() {
    if (!id) return;
    if (!title.trim()) {
      setError('Give the workout a title.');
      return;
    }

    const miles = distance.trim() ? Number(distance.trim()) : null;
    if (miles !== null && (Number.isNaN(miles) || miles <= 0)) {
      setError('Distance should be a number of miles, like 6 or 6.2.');
      return;
    }

    // The two boxes are one idea, so they are checked together. A range that
    // does not go upwards is a typo, and a far end with no near end is not a
    // range at all; both would otherwise be refused by the database with a
    // message no coach should have to read.
    const milesMaxRaw = distanceMax.trim() ? Number(distanceMax.trim()) : null;
    if (milesMaxRaw !== null && (Number.isNaN(milesMaxRaw) || milesMaxRaw <= 0)) {
      setError('The second distance should be a number of miles, like 8 or 8.5.');
      return;
    }
    if (milesMaxRaw !== null && miles === null) {
      setError('Fill in the first distance too, or the range has no starting point.');
      return;
    }
    if (milesMaxRaw !== null && miles !== null && milesMaxRaw < miles) {
      setError('The second distance should be the larger one, like 4 up to 6.');
      return;
    }
    // "4 up to 4" is a single distance written the long way, so it is stored
    // as one rather than displayed as a range of nothing.
    const milesMax = milesMaxRaw !== null && miles !== null && milesMaxRaw > miles
      ? milesMaxRaw
      : null;

    // A ladder's reps are its distances; otherwise the coach gives a count.
    const rungs = splitsOn && splitKind === 'ladder' ? parseLadder(ladder) : null;
    if (rungs !== null && (rungs.length < 2 || rungs.length > 30)) {
      setError('List each rep’s distance in order, separated by commas, like 400, 800, 1200.');
      return;
    }
    if (rungs?.some((rung) => rung.length > 20)) {
      setError('Keep each distance short, like 400 or 1 mile, separated by commas.');
      return;
    }
    const reps = !splitsOn ? null : rungs ? rungs.length : Number(splitCount.trim());
    if (reps !== null && (!Number.isInteger(reps) || reps < 1 || reps > 30)) {
      setError('Splits need a number of reps from 1 to 30, like 6.');
      return;
    }

    setSaving(true);
    setError(null);

    // One workout per day per week, so re-adding a day replaces it rather than
    // failing on the unique constraint.
    const { error: upsertError } = await supabase.from('workouts').upsert(
      {
        plan_id: id,
        week_number: week,
        day_of_week: Number(day),
        title: title.trim(),
        description: description.trim() || null,
        distance_miles: miles,
        distance_miles_max: milesMax,
        intensity: intensity.trim() || null,
        split_count: reps,
        split_label: reps !== null && !rungs ? splitLabel.trim() || null : null,
        split_labels: rungs,
      },
      { onConflict: 'plan_id,week_number,day_of_week' }
    );

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    resetForm();
    await load();
  }

  function startEditingPlan() {
    if (!plan) return;
    setPlanName(plan.name);
    setPlanDescription(plan.description ?? '');
    setPlanAudience(plan.audience);
    setPlanError(null);
    setEditingPlan(true);
  }

  async function savePlan() {
    if (!id) return;
    if (!planName.trim()) {
      setPlanError('Give the plan a name.');
      return;
    }

    setPlanSaving(true);
    setPlanError(null);

    const { error: updateError } = await supabase
      .from('training_plans')
      .update({
        name: planName.trim(),
        description: planDescription.trim() || null,
        audience: planAudience,
      })
      .eq('id', id);

    setPlanSaving(false);
    if (updateError) {
      setPlanError(updateError.message);
      return;
    }

    setEditingPlan(false);
    await load();
  }

  async function deletePlan() {
    if (!id || !plan) return;

    // Spelled out rather than "are you sure": the workouts and every athlete's
    // assignment go with it, and the count is the part worth knowing before
    // pressing Delete rather than after.
    const confirmed = await confirmDestructive(
      `Delete "${plan.name}"?`,
      `This also deletes ${workouts.length} ${workouts.length === 1 ? 'workout' : 'workouts'}` +
        ` and unassigns ${assigned.size} ${assigned.size === 1 ? 'athlete' : 'athletes'}.` +
        ' It cannot be undone.'
    );
    if (!confirmed) return;

    setPlanSaving(true);
    const { error: deleteError } = await supabase.from('training_plans').delete().eq('id', id);
    setPlanSaving(false);

    if (deleteError) {
      setPlanError(deleteError.message);
      return;
    }
    router.back();
  }

  async function removeWorkout(workout: Workout) {
    // The bin sits beside the edit affordance on a card that is itself
    // tappable, so it asks first. It deleted on the first press before.
    const confirmed = await confirmDestructive(
      `Delete "${workout.title}"?`,
      `${planDayLabel(workout.day_of_week)} of week ${workout.week_number}.` +
        ' Any training an athlete already logged against it is kept.'
    );
    if (!confirmed) return;

    await supabase.from('workouts').delete().eq('id', workout.id);
    await load();
  }

  // Who "all" means follows the plan's own audience: a clinic plan goes to the
  // clinic, not to one-on-one clients, and a one-on-one plan the other way.
  const eligible = athletes.filter((athlete) =>
    plan?.audience === 'clinic'
      ? athlete.role === 'athlete'
      : plan?.audience === 'private'
        ? athlete.role === 'private_client'
        : true
  );
  const unassigned = eligible.filter((athlete) => !assigned.has(athlete.id));

  const outOfStep = startsOn
    ? [...assigned].filter((athleteId) => starts[athleteId] && starts[athleteId] !== startsOn).length
    : 0;

  async function assignAll() {
    if (!id || !profile || unassigned.length === 0) return;
    if (!startsOn) {
      setAssignError('Pick the week training starts on the calendar at the top first.');
      return;
    }

    // Only the ones not on it yet. Anyone already assigned keeps the start date
    // they were given, rather than being moved to whatever the picker says now.
    const adding = unassigned;
    const before = assigned;
    setAssigned(new Set([...assigned, ...adding.map((athlete) => athlete.id)]));
    setAssignError(null);
    setAssigningAll(true);

    const { error: writeError } = await supabase.from('plan_assignments').upsert(
      adding.map((athlete) => ({
        plan_id: id,
        athlete_id: athlete.id,
        starts_on: startsOn,
        assigned_by: profile.id,
      })),
      { onConflict: 'plan_id,athlete_id' }
    );

    setAssigningAll(false);
    if (writeError) {
      // One request, so it either all went in or none of it did.
      setAssigned(before);
      setAssignError(`Nobody was assigned — ${writeError.message}`);
      return;
    }
    setStarts((current) => ({
      ...current,
      ...Object.fromEntries(adding.map((athlete) => [athlete.id, startsOn])),
    }));
  }

  async function toggleAssignment(athlete: Profile, next: boolean) {
    if (!id || !profile) return;
    if (next && !startsOn) {
      setAssignError('Pick the week training starts on the calendar at the top first.');
      return;
    }

    // Flip the switch here and leave the rest of the page alone. Reloading
    // everything meant a coach assigning a squad was thrown back to the top of
    // the screen after each athlete and had to scroll down again.
    const flip = (on: boolean) =>
      setAssigned((current) => {
        const updated = new Set(current);
        if (on) updated.add(athlete.id);
        else updated.delete(athlete.id);
        return updated;
      });

    flip(next);
    setAssignError(null);
    // Off the plan means out of its groups; back on starts without one.
    if (!next) setGroups((current) => ({ ...current, [athlete.id]: null }));

    const { error: writeError } = next
      ? await supabase.from('plan_assignments').upsert(
          {
            plan_id: id,
            athlete_id: athlete.id,
            starts_on: startsOn,
            assigned_by: profile.id,
          },
          { onConflict: 'plan_id,athlete_id' }
        )
      : await supabase
          .from('plan_assignments')
          .delete()
          .eq('plan_id', id)
          .eq('athlete_id', athlete.id);

    if (writeError) {
      // Put it back. A switch that stays on is a coach believing an athlete has
      // training they were never given.
      flip(!next);
      setAssignError(`${athlete.full_name} could not be changed — ${writeError.message}`);
      return;
    }
    if (next && startsOn) setStarts((current) => ({ ...current, [athlete.id]: startsOn }));
  }

  // The coach's paces live in a notebook at practice; the app only records which
  // group a runner is in. Tapping the chosen group again takes them out of it.
  async function setPaceGroup(athlete: Profile, group: number | null) {
    if (!id) return;
    const before = groups[athlete.id] ?? null;
    setGroups((current) => ({ ...current, [athlete.id]: group }));
    setAssignError(null);

    const { error: writeError } = await supabase
      .from('plan_assignments')
      .update({ pace_group: group })
      .eq('plan_id', id)
      .eq('athlete_id', athlete.id);

    if (writeError) {
      setGroups((current) => ({ ...current, [athlete.id]: before }));
      setAssignError(`${athlete.full_name}’s group could not be changed — ${writeError.message}`);
    }
  }

  if (loading) {
    return (
      <Screen inStack>
        <LoadingState />
      </Screen>
    );
  }

  if (!plan) {
    return (
      <Screen inStack>
        <EmptyState icon="barbell-outline" message="That plan no longer exists." />
      </Screen>
    );
  }

  return (
    <Screen inStack title={plan.name} subtitle={plan.description ?? undefined} avoidKeyboard>
      {editingPlan ? (
        <Card accent="primary">
          <Text style={styles.cardTitle}>Edit this plan</Text>
          <View style={styles.fields}>
            <TextField
              label="Plan name"
              value={planName}
              onChangeText={setPlanName}
              placeholder="Summer base"
              required
            />
            <TextField
              label="Description"
              value={planDescription}
              onChangeText={setPlanDescription}
              placeholder="Six weeks of aerobic base before the season."
              multiline
            />
            <ChipSelect
              label="Who it is for"
              options={AUDIENCES}
              value={planAudience}
              onChange={setPlanAudience}
            />
          </View>

          {planError ? <Text style={styles.error}>{planError}</Text> : null}

          <View style={styles.planFormActions}>
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => setEditingPlan(false)}
              style={styles.planFormAction}
            />
            <Button
              label="Save plan"
              loading={planSaving}
              onPress={savePlan}
              style={styles.planFormAction}
            />
          </View>
        </Card>
      ) : (
        <View style={styles.planActions}>
          <Pressable
            accessibilityRole="button"
            onPress={startEditingPlan}
            style={({ pressed }) => [styles.planAction, pressed && styles.pressed]}
          >
            <Ionicons name="create-outline" size={16} color={c.primary} />
            <Text style={styles.planActionText}>Edit plan</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void deletePlan()}
            style={({ pressed }) => [styles.planAction, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={16} color={c.danger} />
            <Text style={[styles.planActionText, styles.planActionDanger]}>Delete plan</Text>
          </Pressable>
        </View>
      )}

      <Card>
        <View style={styles.head}>
          <Text style={styles.cardTitle}>Training calendar</Text>
          {startsOn ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setStartError(null);
                setPicking((on) => !on);
              }}
              hitSlop={8}
              style={({ pressed }) => [styles.editHint, pressed && styles.pressed]}
            >
              <Ionicons
                name={picking ? 'close' : 'calendar-outline'}
                size={15}
                color={c.primary}
              />
              <Text style={styles.editHintText}>{picking ? 'Cancel' : 'Change start'}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={[styles.calendarHint, choosingStart && styles.calendarHintPicking]}>
          {startSaving
            ? 'Saving…'
            : choosingStart
              ? startsOn
                ? 'Tap the week that should be week 1. Everyone on this plan moves with it.'
                : 'Tap the week training starts. That week becomes week 1.'
              : `Week 1 is ${weekRange(startsOn!, 1)}. Tap any week, past or ahead, to write or change its training.`}
        </Text>
        <WeekCalendar
          startsOn={startsOn}
          selectedWeek={week}
          writtenWeeks={writtenWeeks}
          picking={choosingStart}
          onPickWeek={pickWeek}
        />
        {startError ? <Text style={styles.error}>{startError}</Text> : null}
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weeks}>
        {weeks.map((number) => {
          const selected = number === week;
          const empty = !writtenWeeks.has(number);
          return (
            <Pressable
              key={number}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => chooseWeek(number)}
              style={[styles.weekChip, selected && styles.weekChipSelected]}
            >
              <Text style={[styles.weekText, selected && styles.weekTextSelected]}>
                Week {number}
                {empty ? ' +' : ''}
              </Text>
              {startsOn ? (
                <Text style={[styles.weekDates, selected && styles.weekTextSelected]}>
                  {weekRange(startsOn, number)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <Card accent="primary">
        <Text style={styles.cardTitle}>
          {editingId ? `Edit ${planDayLabel(Number(day))}, week ${week}` : `Add a workout to week ${week}`}
        </Text>
        {startsOn ? <Text style={styles.formDates}>{weekRange(startsOn, week)}</Text> : null}
        <View style={styles.fields}>
          <ChipSelect label="Day" options={dayOptions} value={day} onChange={setDay} />
          <TextField
            label="Workout"
            value={title}
            onChangeText={setTitle}
            placeholder="6 x 800m at 5K effort"
            required
          />
          <View style={styles.row}>
            <View style={styles.half}>
              <TextField
                label="Miles"
                value={distance}
                onChangeText={setDistance}
                placeholder="4"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.half}>
              <TextField
                label="Up to"
                value={distanceMax}
                onChangeText={setDistanceMax}
                placeholder="6"
                keyboardType="decimal-pad"
                hint="Optional. Leave empty for one distance."
              />
            </View>
          </View>
          <TextField
            label="Intensity"
            value={intensity}
            onChangeText={setIntensity}
            placeholder="Hard"
          />
          <SwitchRow
            label="Runners enter splits"
            hint="For intervals: each runner types in every rep's time when they log it."
            value={splitsOn}
            onValueChange={setSplitsOn}
          />
          {splitsOn ? (
            <ChipSelect
              label="Reps are"
              options={SPLIT_KINDS}
              value={splitKind}
              onChange={setSplitKind}
            />
          ) : null}
          {splitsOn && splitKind === 'ladder' ? (
            <TextField
              label="Each rep’s distance, in order"
              value={ladder}
              onChangeText={setLadder}
              placeholder="400, 800, 1200, 800, 400"
              hint={
                parseLadder(ladder).length > 0
                  ? `${parseLadder(ladder).length} reps. Separate them with commas.`
                  : 'Separate them with commas.'
              }
              required
              maxLength={300}
            />
          ) : null}
          {splitsOn && splitKind === 'same' ? (
            <View style={styles.row}>
              <View style={styles.half}>
                <TextField
                  label="Reps"
                  value={splitCount}
                  onChangeText={setSplitCount}
                  placeholder="6"
                  keyboardType="number-pad"
                  required
                  maxLength={2}
                />
              </View>
              <View style={styles.half}>
                <TextField
                  label="Each rep"
                  value={splitLabel}
                  onChangeText={setSplitLabel}
                  placeholder="800m"
                  maxLength={40}
                />
              </View>
            </View>
          ) : null}
          <TextField
            label="Details"
            value={description}
            onChangeText={setDescription}
            placeholder="Two-minute jog recovery. Stop if form falls apart."
            multiline
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={editingId ? 'Save changes' : 'Add workout'}
          full
          loading={saving}
          onPress={addWorkout}
          style={styles.submit}
        />
        {editingId ? (
          <Button label="Cancel" variant="ghost" full onPress={resetForm} style={styles.cancel} />
        ) : null}
      </Card>

      <SectionHeader
        title={startsOn ? `Week ${week} · ${weekRange(startsOn, week)}` : `Week ${week}`}
      />

      {shown.length === 0 ? (
        <EmptyState icon="create-outline" message="Nothing written for this week yet." />
      ) : (
        shown.map((workout) => (
          <Card key={workout.id} onPress={() => startEditing(workout)}>
            <View style={styles.head}>
              <Text style={styles.day}>
                {planDayLabel(workout.day_of_week)}
                {startsOn
                  ? ` · ${formatShortDate(workoutDate(startsOn, workout.week_number, workout.day_of_week)!)}`
                  : ''}
              </Text>
              <View style={styles.cardActions}>
                <View style={styles.editHint}>
                  <Ionicons name="create-outline" size={15} color={c.primary} />
                  <Text style={styles.editHintText}>Edit</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${workout.title}`}
                  onPress={() => void removeWorkout(workout)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={17} color={c.danger} />
                </Pressable>
              </View>
            </View>
            <Text style={styles.workoutTitle}>{workout.title}</Text>
            <View style={styles.metaRow}>
              {formatMileRange(workout.distance_miles, workout.distance_miles_max) ? (
                <Badge
                  label={formatMileRange(workout.distance_miles, workout.distance_miles_max)!}
                  tone="primary"
                />
              ) : null}
              {workout.intensity ? <Badge label={workout.intensity} /> : null}
              {workout.split_count ? <Badge label={splitsLabel(workout)} /> : null}
            </View>
            {workout.description ? <Text style={styles.body}>{workout.description}</Text> : null}

            <View style={styles.logs}>
              <Text style={styles.logsHead}>
                Logged by {logsByWorkout[workout.id]?.length ?? 0} of {assigned.size}
              </Text>
              {(logsByWorkout[workout.id] ?? []).map((log, index) => (
                <View key={`${workout.id}-${index}`} style={styles.logRow}>
                  <Text style={styles.logName} numberOfLines={1}>
                    {log.name}
                    {log.enteredBy ? ` · entered by ${log.enteredBy}` : ''}
                  </Text>
                  {/* Eight and above is where a coach wants to look twice. */}
                  {log.effort !== null ? (
                    <Badge
                      label={`${log.effort}/10`}
                      tone={log.effort >= 8 ? 'danger' : 'neutral'}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          </Card>
        ))
      )}

      <SectionHeader
        title="Assigned to"
        action={
          unassigned.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void assignAll()}
              disabled={assigningAll}
              style={({ pressed }) => [styles.assignAll, (pressed || assigningAll) && styles.pressed]}
            >
              <Ionicons name="checkmark-done" size={16} color={c.textInverse} />
              <Text style={styles.assignAllText}>
                {assigningAll ? 'Assigning…' : `Assign all (${unassigned.length})`}
              </Text>
            </Pressable>
          ) : eligible.length > 0 ? (
            <Text style={styles.allAssigned}>Everyone is on it</Text>
          ) : null
        }
      />

      <Card>
        {startsOn ? (
          <Text style={styles.body}>
            Everyone turned on below runs week 1 from {weekRange(startsOn, 1)}. To change it, use
            Change start on the calendar.
          </Text>
        ) : (
          <Text style={[styles.body, styles.calendarHintPicking]}>
            Pick the week training starts on the calendar at the top before turning anyone on.
          </Text>
        )}
        {outOfStep > 0 ? (
          <View style={styles.outOfStep}>
            <Text style={styles.outOfStepText}>
              {outOfStep === 1 ? '1 runner starts' : `${outOfStep} runners start`} on a different
              week from the rest of the plan.
            </Text>
            <Button
              label="Line everyone up"
              variant="secondary"
              loading={startSaving}
              onPress={() => {
                const monday = startsOn ? workoutDate(startsOn, 1, 1) : null;
                if (monday) void saveStart(monday);
              }}
            />
          </View>
        ) : null}
      </Card>

      {athletes.length === 0 ? (
        <EmptyState icon="people-outline" message="No athletes on the roster yet." />
      ) : (
        athletes.map((athlete) => (
          <AssignRow
            key={athlete.id}
            athlete={athlete}
            planName={plan.name}
            assigned={assigned.has(athlete.id)}
            onToggle={(next) => void toggleAssignment(athlete, next)}
            paceGroup={groups[athlete.id] ?? null}
            onPaceGroup={(group) => void setPaceGroup(athlete, group)}
          />
        ))
      )}

      {assignError ? <Text style={styles.error}>{assignError}</Text> : null}
    </Screen>
  );
}

/**
 * One athlete's row. The switch is the control; the row answers it, tinting and
 * showing a tick so a coach assigning a squad can see what they have done
 * without reading every switch.
 *
 * Colours cannot be driven on the native thread, hence useNativeDriver: false.
 */
function AssignRow({
  athlete,
  planName,
  assigned,
  onToggle,
  paceGroup,
  onPaceGroup,
}: {
  athlete: Profile;
  planName: string;
  assigned: boolean;
  onToggle: (next: boolean) => void;
  paceGroup: number | null;
  onPaceGroup: (group: number | null) => void;
}) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const progress = useRef(new Animated.Value(assigned ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: assigned ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [assigned, progress]);

  return (
    <Animated.View
      style={[
        styles.assignRow,
        {
          backgroundColor: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [c.background, c.primaryTint],
          }),
          borderColor: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [c.border, c.primary],
          }),
        },
      ]}
    >
      <View style={styles.assignTop}>
        <Animated.View
          style={[
            styles.assignCheck,
            {
              opacity: progress,
              // Starts a little small so it arrives rather than appears.
              transform: [
                { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              ],
            },
          ]}
        >
          <Ionicons name="checkmark" size={14} color={c.textInverse} />
        </Animated.View>

        <View style={styles.assignText}>
          <Text style={styles.assignName}>{athlete.full_name}</Text>
          <Text style={styles.assignMeta}>
            {athlete.role === 'private_client' ? 'One-on-one' : 'Clinic'}
          </Text>
        </View>

        <Switch
          value={assigned}
          onValueChange={onToggle}
          trackColor={{ true: c.primary, false: c.borderStrong }}
          thumbColor={c.background}
          accessibilityLabel={`Assign ${planName} to ${athlete.full_name}`}
        />
      </View>

      {assigned ? (
        <View style={styles.groupRow}>
          <Text style={styles.groupLabel}>Pace group</Text>
          {PACE_GROUPS.map((group) => {
            const selected = paceGroup === group;
            return (
              <Pressable
                key={group}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Pace group ${group} for ${athlete.full_name}`}
                onPress={() => onPaceGroup(selected ? null : group)}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.groupChip,
                  selected && styles.groupChipOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.groupText, selected && styles.groupTextOn]}>{group}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Animated.View>
  );
}

const PACE_GROUPS = [1, 2, 3, 4, 5];

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  weeks: { gap: spacing.sm, paddingVertical: spacing.xs },
  weekChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  weekChipSelected: { backgroundColor: c.primarySurface, borderColor: c.primary },
  weekText: { ...type.label, color: c.textMuted, textAlign: 'center' },
  weekDates: { ...type.caption, color: c.textFaint, textAlign: 'center' },
  calendarHint: { ...type.caption, color: c.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  calendarHintPicking: { color: c.accent, fontWeight: '700' },
  formDates: { ...type.caption, color: c.textMuted, marginTop: spacing.xs },
  outOfStep: { gap: spacing.sm, marginTop: spacing.md },
  outOfStepText: { ...type.caption, color: c.warning, fontWeight: '700' },
  weekTextSelected: { color: c.textInverse },
  cardTitle: { ...type.heading, color: c.text },
  fields: { gap: spacing.lg, marginTop: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  submit: { marginTop: spacing.lg },
  cancel: { marginTop: spacing.sm },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  logs: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    gap: spacing.sm,
  },
  logsHead: { ...type.overline, color: c.textFaint },
  logRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  logName: { ...type.caption, color: c.textMuted, flex: 1 },
  error: { ...type.caption, color: c.danger, marginTop: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  editHintText: { ...type.label, color: c.primary },
  pressed: { opacity: 0.7 },
  planActions: { flexDirection: 'row', gap: spacing.xl },
  planAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planActionText: { ...type.label, color: c.primary },
  planActionDanger: { color: c.danger },
  planFormActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  planFormAction: { flex: 1 },
  day: { ...type.overline, color: c.textFaint },
  workoutTitle: { ...type.heading, color: c.text, marginTop: spacing.xs },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  body: { ...type.body, color: c.textMuted, marginTop: spacing.sm },
  assignRow: {
    backgroundColor: c.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  assignAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: c.primarySurface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  assignAllText: { ...type.label, color: c.textInverse },
  allAssigned: { ...type.caption, color: c.success, fontWeight: '700' },
  assignCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  groupRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  groupLabel: { ...type.caption, color: c.textMuted, marginRight: spacing.xs },
  groupChip: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupChipOn: { backgroundColor: c.primarySurface, borderColor: c.primary },
  groupText: { ...type.bodyStrong, color: c.textMuted },
  groupTextOn: { color: c.textInverse },
  assignText: { flex: 1 },
  assignName: { ...type.bodyStrong, color: c.text },
  assignMeta: { ...type.caption, color: c.textMuted },
});
