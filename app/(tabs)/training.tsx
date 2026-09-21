import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { EmptyState, LoadingState, Screen } from '../../components/Screen';
import { SegmentedControl } from '../../components/SegmentedControl';
import { WorkoutLogSheet } from '../../components/WorkoutLogSheet';
import { useAthlete } from '../../lib/athlete';
import { useAuth } from '../../lib/auth';
import { firstName, formatMileRange, planDayLabel } from '../../lib/format';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { currentWeekNumber, planDayToday } from '../../lib/training';
import { TRAINING_PLAN_COLUMNS,
  WORKOUT_COLUMNS,
  isAthlete,
  isParent,
  type TrainingPlan,
  type Workout,
} from '../../lib/types';
import { radius, spacing, type, type Palette } from '../../lib/theme';
import { useTheme, useThemedStyles } from '../../lib/appearance';

export default function Training() {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const { profile, role } = useAuth();
  const { athletes, activeAthleteId, setActiveAthleteId, activeAthlete } = useAthlete();

  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());
  const [week, setWeek] = useState(1);
  /** Where the athlete actually is in the plan, as opposed to the week on screen. */
  const [thisWeek, setThisWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState<Workout | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !activeAthleteId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: assignment } = await supabase
      .from('plan_assignments')
      .select('plan_id, starts_on')
      .eq('athlete_id', activeAthleteId)
      .order('starts_on', { ascending: false })
      .limit(1)
      .maybeSingle();

    const assigned = assignment as { plan_id: string; starts_on: string } | null;
    if (!assigned) {
      setPlan(null);
      setWorkouts([]);
      setLoading(false);
      return;
    }

    const [{ data: planRow }, { data: workoutRows }, { data: logRows }] = await Promise.all([
      supabase
        .from('training_plans')
        .select(TRAINING_PLAN_COLUMNS)
        .eq('id', assigned.plan_id)
        .maybeSingle(),
      supabase
        .from('workouts')
        .select(WORKOUT_COLUMNS)
        .eq('plan_id', assigned.plan_id)
        .order('week_number')
        .order('day_of_week'),
      supabase.from('workout_logs').select('workout_id').eq('athlete_id', activeAthleteId),
    ]);

    setPlan((planRow as TrainingPlan | null) ?? null);
    setWorkouts((workoutRows as Workout[] | null) ?? []);
    setLoggedIds(
      new Set(
        ((logRows as { workout_id: string | null }[] | null) ?? [])
          .map((row) => row.workout_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const active = currentWeekNumber(assigned.starts_on);
    setThisWeek(active);
    setWeek(active);
    setLoading(false);
  }, [activeAthleteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const weeks = useMemo(
    () => [...new Set(workouts.map((workout) => workout.week_number))].sort((a, b) => a - b),
    [workouts]
  );

  const shown = useMemo(
    () => workouts.filter((workout) => workout.week_number === week),
    [workouts, week]
  );

  // An athlete logs their own training, and a parent logs for the athlete they
  // guard — plenty of these runners have no phone of their own, so without that
  // second case they would have no training history at all.
  const canLog = Boolean(
    activeAthleteId && (activeAthleteId === profile?.id || isParent(role))
  );
  const today = planDayToday();

  const subtitle = activeAthlete && !isAthlete(role)
    ? `${firstName(activeAthlete.full_name)}’s plan`
    : role === 'private_client'
      ? 'Your one-on-one plan'
      : 'Your clinic plan';

  return (
    <Screen title="Training" subtitle={subtitle} onRefresh={load}>
      {athletes.length > 1 ? (
        <SegmentedControl
          options={athletes.map((athlete) => ({
            value: athlete.id,
            label: firstName(athlete.full_name),
          }))}
          value={activeAthleteId ?? athletes[0]!.id}
          onChange={setActiveAthleteId}
        />
      ) : null}

      {loading ? (
        <LoadingState label="Loading your plan" />
      ) : !plan ? (
        <EmptyState
          icon="fitness-outline"
          message="No plan assigned yet. Your coach will put one together before the season starts."
        />
      ) : (
        <>
          <Card accent="primary">
            <Text style={styles.planName}>{plan.name}</Text>
            {plan.description ? <Text style={styles.planDesc}>{plan.description}</Text> : null}
          </Card>

          {weeks.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weeks}
            >
              {weeks.map((number) => {
                const selected = number === week;
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
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {shown.length === 0 ? (
            <EmptyState icon="bed-outline" message="Nothing written for this week yet." />
          ) : (
            shown.map((workout) => {
              const isToday = workout.day_of_week === today && week === thisWeek;
              const logged = loggedIds.has(workout.id);
              return (
                <Card key={workout.id} accent={isToday ? 'primary' : undefined}>
                  <View style={styles.head}>
                    <Text style={[styles.day, isToday && styles.dayToday]}>
                      {planDayLabel(workout.day_of_week)}
                      {isToday ? ' · Today' : ''}
                    </Text>
                    {logged ? <Badge label="Logged" tone="success" /> : null}
                  </View>

                  <Text style={styles.title}>{workout.title}</Text>

                  <View style={styles.metaRow}>
                    {formatMileRange(workout.distance_miles, workout.distance_miles_max) ? (
                      <Badge
                        label={formatMileRange(workout.distance_miles, workout.distance_miles_max)!}
                        tone="primary"
                      />
                    ) : null}
                    {workout.intensity ? <Badge label={workout.intensity} /> : null}
                  </View>

                  {workout.description ? (
                    <Text style={styles.body}>{workout.description}</Text>
                  ) : null}

                  {canLog ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setLogging(workout)}
                      style={({ pressed }) => [styles.logButton, pressed && styles.pressed]}
                    >
                      <Ionicons
                        name={logged ? 'add-circle-outline' : 'checkmark-circle-outline'}
                        size={17}
                        color={c.primary}
                      />
                      <Text style={styles.logText}>
                        {logged
                          ? 'Log again'
                          : isParent(role)
                            ? `Log this for ${firstName(activeAthlete?.full_name)}`
                            : 'Mark it done'}
                      </Text>
                    </Pressable>
                  ) : null}
                </Card>
              );
            })
          )}
        </>
      )}

      {activeAthleteId ? (
        <WorkoutLogSheet
          workout={logging}
          athleteId={activeAthleteId}
          onClose={() => setLogging(null)}
          onSaved={() => {
            setLogging(null);
            void load();
          }}
        />
      ) : null}
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  planName: { ...type.heading, color: c.text },
  planDesc: { ...type.body, color: c.textMuted, marginTop: spacing.xs },
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
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  day: { ...type.overline, color: c.textFaint },
  dayToday: { color: c.primary },
  title: { ...type.heading, color: c.text, marginTop: spacing.xs },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  body: { ...type.body, color: c.textMuted, marginTop: spacing.sm },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  pressed: { opacity: 0.7 },
  logText: { ...type.label, color: c.primary },
});
