import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { WorkoutLogSheet } from './WorkoutLogSheet';
import { useTheme, useThemedStyles } from '../lib/appearance';
import {
  PLAN_DAYS,
  formatShortDate,
  isSameDay,
  localDateKey,
  milesNumber,
  parseLocalDateTime,
} from '../lib/format';
import { milesByDay, plannedMiles, round2, weekDays } from '../lib/mileage';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { mondayOf, planWeekOf } from '../lib/training';
import { radius, spacing, type, type Palette } from '../lib/theme';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const BAR_AREA = 76;

type Assignment = { plan_id: string; starts_on: string } | null;

/**
 * One athlete's own running, Monday to Sunday: the miles on each day, the
 * week's total, and how far through the plan's mileage they are.
 *
 * Deliberately private. It is only ever shown for the athlete themselves (or
 * to their own parent), and nothing here compares one runner with another —
 * a summer clinic of mixed ages is the wrong place for a leaderboard.
 */
export function WeeklyMileage({
  athleteId,
  canLog,
  refreshKey = 0,
}: {
  athleteId: string;
  /** The athlete, or their parent. Staff read the roster instead. */
  canLog: boolean;
  /** Bumped by the screen's pull-to-refresh. */
  refreshKey?: number;
}) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  /** Weeks back from this one: 0 is this week, 1 last week. */
  const [offset, setOffset] = useState(0);
  const [miles, setMiles] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [plan, setPlan] = useState<{ min: number; max: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const assignment = useRef<{ athleteId: string; value: Assignment } | null>(null);

  const today = new Date();
  const monday = mondayOf(today);
  monday.setDate(monday.getDate() - offset * 7);
  const days = weekDays(monday);
  const mondayKey = localDateKey(days[0]!);
  const sundayKey = localDateKey(days[6]!);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // The plan assignment does not change week to week, so it is looked up
    // once per athlete rather than on every tap of the arrows.
    if (assignment.current?.athleteId !== athleteId) {
      const { data } = await supabase
        .from('plan_assignments')
        .select('plan_id, starts_on')
        .eq('athlete_id', athleteId)
        .order('starts_on', { ascending: false })
        .limit(1)
        .maybeSingle();
      assignment.current = { athleteId, value: (data as Assignment) ?? null };
    }

    const assigned = assignment.current.value;
    const weekMonday = parseLocalDateTime(mondayKey, '00:00') ?? mondayOf(new Date());
    const week = assigned ? planWeekOf(assigned.starts_on, weekMonday) : null;

    const [{ data: logRows }, { data: workoutRows }] = await Promise.all([
      supabase
        .from('workout_logs')
        .select('logged_on, distance_miles')
        .eq('athlete_id', athleteId)
        .gte('logged_on', mondayKey)
        .lte('logged_on', sundayKey),
      assigned && week
        ? supabase
            .from('workouts')
            .select('distance_miles, distance_miles_max')
            .eq('plan_id', assigned.plan_id)
            .eq('week_number', week)
        : Promise.resolve({ data: [] }),
    ]);

    setMiles(
      milesByDay(
        (logRows as { logged_on: string; distance_miles: number | null }[] | null) ?? [],
        weekMonday
      )
    );
    setPlan(
      plannedMiles(
        (workoutRows as { distance_miles: number | null; distance_miles_max: number | null }[] | null) ??
          []
      )
    );
    setLoading(false);
  }, [athleteId, mondayKey, sundayKey]);

  // On focus as well as on change: a run logged from the Training tab should
  // be on the bar when the athlete comes back here.
  useFocusEffect(
    useCallback(() => {
      void load();
      // refreshKey only needs to retrigger this; its value is not read.
    }, [load, refreshKey])
  );

  const total = round2(miles.reduce((sum, value) => sum + value, 0));
  const tallest = Math.max(...miles, 0);
  const progress = plan && plan.min > 0 ? Math.min(total / plan.min, 1) : 0;
  const planMet = Boolean(plan && total >= plan.min);
  const planText = plan
    ? plan.max > plan.min
      ? `${milesNumber(plan.min)}–${milesNumber(plan.max)}`
      : milesNumber(plan.min)
    : null;

  const title = offset === 0 ? 'This week' : offset === 1 ? 'Last week' : `Week of ${formatShortDate(days[0]!)}`;

  return (
    <Card>
      <View style={styles.head}>
        <WeekArrow
          icon="chevron-back"
          label="Previous week"
          onPress={() => setOffset((value) => value + 1)}
        />
        <View style={styles.headText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.range}>
            {formatShortDate(days[0]!)} – {formatShortDate(days[6]!)}
          </Text>
        </View>
        <WeekArrow
          icon="chevron-forward"
          label="Next week"
          disabled={offset === 0}
          onPress={() => setOffset((value) => Math.max(0, value - 1))}
        />
      </View>

      <View style={[styles.totalRow, loading && styles.loading]}>
        <Text style={styles.total} accessibilityLabel={`${milesNumber(total)} miles this week`}>
          {milesNumber(total)}
          <Text style={styles.totalUnit}> mi</Text>
        </Text>
        {planText ? <Text style={styles.planText}>of {planText} mi planned</Text> : null}
      </View>

      {plan ? (
        <View style={styles.progressBlock}>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
            accessibilityLabel="Progress toward this week's planned miles"
          >
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
          {planMet ? (
            <View style={styles.metRow}>
              <Ionicons name="checkmark-circle" size={15} color={c.success} />
              <Text style={styles.metText}>Planned miles done</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.chart, loading && styles.loading]}>
        {days.map((day, index) => {
          const value = miles[index] ?? 0;
          const future = day > today && !isSameDay(day, today);
          const isToday = isSameDay(day, today);
          const height = tallest > 0 && value > 0 ? Math.max(4, (value / tallest) * BAR_AREA) : 0;
          return (
            <View
              key={localDateKey(day)}
              style={styles.column}
              accessible
              accessibilityLabel={
                future
                  ? `${DAY_NAMES[index]}, still to come`
                  : `${DAY_NAMES[index]}, ${value > 0 ? `${milesNumber(value)} miles` : 'no miles logged'}`
              }
            >
              <Text style={[styles.value, value === 0 && styles.valueEmpty]}>
                {future ? '' : value > 0 ? milesNumber(value) : '–'}
              </Text>
              <View style={styles.barArea}>
                {height > 0 ? (
                  <View style={[styles.bar, { height }]} />
                ) : (
                  <View style={[styles.stub, future && styles.stubFuture]} />
                )}
              </View>
              <Text style={[styles.day, isToday && styles.dayToday, future && styles.dayFuture]}>
                {PLAN_DAYS[index]}
              </Text>
              <View style={[styles.todayDot, !isToday && styles.hidden]} />
            </View>
          );
        })}
      </View>

      {canLog ? (
        <Button
          label="Log a run"
          icon="add"
          variant="secondary"
          full
          onPress={() => setLogging(true)}
          style={styles.logButton}
        />
      ) : null}

      <WorkoutLogSheet
        workout={null}
        freeRun={logging}
        athleteId={athleteId}
        onClose={() => setLogging(false)}
        onSaved={() => {
          setLogging(false);
          setOffset(0);
          void load();
        }}
      />
    </Card>
  );
}

function WeekArrow({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.arrow, pressed && styles.pressed, disabled && styles.arrowOff]}
    >
      <Ionicons name={icon} size={18} color={disabled ? c.textFaint : c.primary} />
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    headText: { flex: 1, alignItems: 'center' },
    title: { ...type.heading, color: c.text },
    range: { ...type.caption, color: c.textMuted, marginTop: 2 },
    arrow: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: c.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrowOff: { backgroundColor: c.surfaceSunken },
    pressed: { opacity: 0.7 },
    loading: { opacity: 0.55 },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    total: { ...type.display, color: c.text },
    totalUnit: { ...type.heading, color: c.textMuted },
    planText: { ...type.body, color: c.textMuted },
    progressBlock: { marginTop: spacing.sm, gap: spacing.sm },
    track: {
      height: 10,
      borderRadius: radius.pill,
      backgroundColor: c.border,
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: radius.pill, backgroundColor: c.primary },
    metRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    metText: { ...type.label, color: c.success },
    chart: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginTop: spacing.xl,
    },
    column: { flex: 1, alignItems: 'center' },
    value: { ...type.label, color: c.text, marginBottom: spacing.xs, minHeight: 18 },
    valueEmpty: { color: c.textFaint },
    barArea: {
      height: BAR_AREA,
      width: '100%',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    // Rounded at the data end only, square on the baseline it stands on.
    bar: {
      width: '62%',
      maxWidth: 28,
      backgroundColor: c.primary,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
    },
    stub: { width: '62%', maxWidth: 28, height: 2, backgroundColor: c.borderStrong },
    stubFuture: { backgroundColor: c.border },
    day: { ...type.caption, color: c.textMuted, marginTop: spacing.sm },
    dayToday: { color: c.primary, fontWeight: '800' },
    dayFuture: { color: c.textFaint },
    todayDot: {
      width: 5,
      height: 5,
      borderRadius: radius.pill,
      backgroundColor: c.primary,
      marginTop: 3,
    },
    hidden: { opacity: 0 },
    logButton: { marginTop: spacing.lg },
  });
