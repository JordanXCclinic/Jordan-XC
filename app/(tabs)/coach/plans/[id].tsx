import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Badge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { ChipSelect, TextField } from '../../../../components/Field';
import { DateTimeField } from '../../../../components/DateTimeField';
import { EmptyState, LoadingState, Screen, SectionHeader } from '../../../../components/Screen';
import { useAuth } from '../../../../lib/auth';
import { PLAN_DAYS, formatMileRange, planDayLabel, toDateInput } from '../../../../lib/format';
import { isSupabaseConfigured, supabase } from '../../../../lib/supabase';
import { PROFILE_COLUMNS,
  TRAINING_PLAN_COLUMNS,
  WORKOUT_COLUMNS,
  type Profile,
  type TrainingPlan,
  type Workout,
} from '../../../../lib/types';
import { radius, spacing, type, type Palette } from '../../../../lib/theme';
import { useTheme, useThemedStyles } from '../../../../lib/appearance';

const DAY_OPTIONS = PLAN_DAYS.map((label, index) => ({ value: String(index + 1), label }));

/** Plans usually start on a Monday, so that is what the date field offers. */
function nextMonday(): Date {
  const date = new Date();
  const ahead = (8 - (date.getDay() || 7)) % 7 || 7;
  date.setDate(date.getDate() + ahead);
  date.setHours(0, 0, 0, 0);
  return date;
}

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

  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [athletes, setAthletes] = useState<Profile[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  /** Who has logged each workout, so a coach can see the week at a glance. */
  const [logsByWorkout, setLogsByWorkout] = useState<Record<string, LoggedBy[]>>({});
  const [loading, setLoading] = useState(true);

  const [week, setWeek] = useState(1);
  const [day, setDay] = useState('1');
  /** Set while correcting an existing session rather than writing a new one. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [distance, setDistance] = useState('');
  const [distanceMax, setDistanceMax] = useState('');
  const [intensity, setIntensity] = useState('');
  const [description, setDescription] = useState('');
  const [startsOn, setStartsOn] = useState(nextMonday);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [{ data: planRow }, { data: workoutRows }, { data: athleteRows }, { data: assignRows }] =
      await Promise.all([
        supabase.from('training_plans').select(TRAINING_PLAN_COLUMNS).eq('id', id).maybeSingle(),
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
        supabase.from('plan_assignments').select('athlete_id').eq('plan_id', id),
      ]);

    setPlan((planRow as TrainingPlan | null) ?? null);
    setWorkouts((workoutRows as Workout[] | null) ?? []);
    setAthletes((athleteRows as Profile[] | null) ?? []);
    setAssigned(
      new Set(((assignRows as { athlete_id: string }[] | null) ?? []).map((row) => row.athlete_id))
    );

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

    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Always offer one week past what exists, so a plan can grow a week at a time.
  const weeks = useMemo(() => {
    const written = [...new Set(workouts.map((workout) => workout.week_number))];
    const highest = written.length > 0 ? Math.max(...written) : 0;
    return Array.from({ length: Math.max(highest + 1, 1) }, (_, index) => index + 1);
  }, [workouts]);

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

  async function removeWorkout(workout: Workout) {
    await supabase.from('workouts').delete().eq('id', workout.id);
    await load();
  }

  async function toggleAssignment(athlete: Profile, next: boolean) {
    if (!id || !profile) return;

    if (next) {
      await supabase.from('plan_assignments').upsert(
        {
          plan_id: id,
          athlete_id: athlete.id,
          starts_on: toDateInput(startsOn),
          assigned_by: profile.id,
        },
        { onConflict: 'plan_id,athlete_id' }
      );
    } else {
      await supabase.from('plan_assignments').delete().eq('plan_id', id).eq('athlete_id', athlete.id);
    }
    await load();
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weeks}>
        {weeks.map((number) => {
          const selected = number === week;
          const empty = !workouts.some((workout) => workout.week_number === number);
          return (
            <Pressable
              key={number}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setWeek(number)}
              style={[styles.weekChip, selected && styles.weekChipSelected]}
            >
              <Text style={[styles.weekText, selected && styles.weekTextSelected]}>
                Week {number}
                {empty ? ' +' : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card accent="primary">
        <Text style={styles.cardTitle}>
          {editingId ? `Edit ${planDayLabel(Number(day))}, week ${week}` : `Add a workout to week ${week}`}
        </Text>
        <View style={styles.fields}>
          <ChipSelect label="Day" options={DAY_OPTIONS} value={day} onChange={setDay} />
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

      <SectionHeader title={`Week ${week}`} />

      {shown.length === 0 ? (
        <EmptyState icon="create-outline" message="Nothing written for this week yet." />
      ) : (
        shown.map((workout) => (
          <Card key={workout.id} onPress={() => startEditing(workout)}>
            <View style={styles.head}>
              <Text style={styles.day}>{planDayLabel(workout.day_of_week)}</Text>
              <View style={styles.cardActions}>
                <Ionicons name="create-outline" size={16} color={c.textFaint} />
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

      <SectionHeader title="Assigned to" />

      <Card>
        <DateTimeField
          label="Week 1 starts on"
          value={startsOn}
          onChange={setStartsOn}
          hint="Athletes turned on below start the plan from this date."
        />
      </Card>

      {athletes.length === 0 ? (
        <EmptyState icon="people-outline" message="No athletes on the roster yet." />
      ) : (
        athletes.map((athlete) => (
          <View key={athlete.id} style={styles.assignRow}>
            <View style={styles.assignText}>
              <Text style={styles.assignName}>{athlete.full_name}</Text>
              <Text style={styles.assignMeta}>
                {athlete.role === 'private_client' ? 'One-on-one' : 'Clinic'}
              </Text>
            </View>
            <Switch
              value={assigned.has(athlete.id)}
              onValueChange={(next) => void toggleAssignment(athlete, next)}
              trackColor={{ true: c.primary, false: c.borderStrong }}
              thumbColor={c.background}
              accessibilityLabel={`Assign ${plan.name} to ${athlete.full_name}`}
            />
          </View>
        ))
      )}
    </Screen>
  );
}

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
  weekText: { ...type.label, color: c.textMuted },
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
  day: { ...type.overline, color: c.textFaint },
  workoutTitle: { ...type.heading, color: c.text, marginTop: spacing.xs },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  body: { ...type.body, color: c.textMuted, marginTop: spacing.sm },
  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  assignText: { flex: 1 },
  assignName: { ...type.bodyStrong, color: c.text },
  assignMeta: { ...type.caption, color: c.textMuted },
});
