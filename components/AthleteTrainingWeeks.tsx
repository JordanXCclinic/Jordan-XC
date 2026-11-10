import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { EmptyState, LoadingState, SectionHeader } from './Screen';
import { useTheme, useThemedStyles } from '../lib/appearance';
import {
  PLAN_DAYS,
  formatDate,
  formatDuration,
  formatMiles,
  formatPace,
  formatShortDate,
  formatSplits,
  milesNumber,
  parseLocalDateTime,
} from '../lib/format';
import { summarizeWeek, type InsightDay } from '../lib/insights';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { mondayOf, planWeekOf, workoutDate } from '../lib/training';
import { WORKOUT_COLUMNS, WORKOUT_LOG_COLUMNS, type Workout, type WorkoutLog } from '../lib/types';
import { radius, spacing, type, type Palette } from '../lib/theme';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BAR_AREA = 76;
const NOTES_PAGE = 15;
/** Effort from here up is a run a coach wants to look at twice. */
const HARD = 8;

export type RosterAssignment = {
  plan_id: string;
  starts_on: string;
  name: string;
  pace_group: number | null;
};

type Run = WorkoutLog & {
  workouts:
    | { title: string; split_labels: string[] | null }
    | { title: string; split_labels: string[] | null }[]
    | null;
};

function workoutOf(run: Run): { title: string; split_labels: string[] | null } | null {
  return (Array.isArray(run.workouts) ? run.workouts[0] : run.workouts) ?? null;
}

/** Whole weeks from one Monday to another, rounded across clock changes. */
function weeksBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / WEEK_MS);
}

/**
 * A runner's training on the coach's roster, a week at a time: what the plan
 * asked for each day against what was logged, the week's totals, and below it
 * every note they have written with how hard it felt.
 *
 * Read-only. The log is the runner's own account (0010), so nothing here
 * writes to it.
 */
export function AthleteTrainingWeeks({
  athleteId,
  assignment,
  refreshKey = 0,
}: {
  athleteId: string;
  assignment: RosterAssignment | null;
  /** Bumped by the screen's pull-to-refresh. */
  refreshKey?: number;
}) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [runs, setRuns] = useState<Run[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  /** Names for runs a parent entered, so the coach knows whose account it is. */
  const [enteredBy, setEnteredBy] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  /** Weeks back from this one: 0 is this week, 1 last week, -1 next week. */
  const [back, setBack] = useState(0);
  const [notesShown, setNotesShown] = useState(NOTES_PAGE);

  const planId = assignment?.plan_id ?? null;

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const [{ data: runRows }, { data: workoutRows }] = await Promise.all([
      supabase
        .from('workout_logs')
        .select(`${WORKOUT_LOG_COLUMNS}, workouts(title, split_labels)`)
        .eq('athlete_id', athleteId)
        .order('logged_on', { ascending: false })
        .limit(1000),
      planId
        ? supabase.from('workouts').select(WORKOUT_COLUMNS).eq('plan_id', planId)
        : Promise.resolve({ data: [] as Workout[] }),
    ]);

    const list = (runRows as Run[] | null) ?? [];
    setRuns(list);
    setWorkouts((workoutRows as Workout[] | null) ?? []);

    // Only the entries somebody else wrote: a run the athlete logged
    // themselves needs no attribution.
    const others = [
      ...new Set(
        list.map((run) => run.logged_by).filter((who): who is string => Boolean(who) && who !== athleteId)
      ),
    ];
    if (others.length > 0) {
      const { data: people } = await supabase.from('profiles').select('id, full_name').in('id', others);
      setEnteredBy(
        Object.fromEntries(
          ((people as { id: string; full_name: string }[] | null) ?? []).map((p) => [p.id, p.full_name])
        )
      );
    } else {
      setEnteredBy({});
    }
    setLoading(false);
  }, [athleteId, planId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const today = new Date();
  const thisMonday = mondayOf(today);
  const monday = new Date(thisMonday);
  monday.setDate(thisMonday.getDate() - back * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  // As far back as the plan's start or the oldest run, and as far ahead as the
  // plan's last written week, so the coach can see what is coming up too.
  const { furthestBack, furthestAhead } = useMemo(() => {
    const starts: Date[] = [thisMonday];
    const start = assignment ? parseLocalDateTime(assignment.starts_on, '00:00') : null;
    if (start) starts.push(mondayOf(start));
    const oldest = runs.length > 0 ? parseLocalDateTime(runs[runs.length - 1]!.logged_on, '00:00') : null;
    if (oldest) starts.push(mondayOf(oldest));
    const earliest = new Date(Math.min(...starts.map((d) => d.getTime())));

    const lastWeek = workouts.reduce((max, w) => Math.max(max, w.week_number), 0);
    const lastMonday =
      assignment && lastWeek > 0 ? workoutDate(assignment.starts_on, lastWeek, 1) : null;
    return {
      furthestBack: Math.max(0, weeksBetween(earliest, thisMonday)),
      furthestAhead: lastMonday ? Math.max(0, weeksBetween(thisMonday, mondayOf(lastMonday))) : 0,
    };
    // thisMonday is recomputed every render; its day is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment, runs, workouts, thisMonday.getTime()]);

  const planWeek = assignment ? planWeekOf(assignment.starts_on, monday) : null;
  const week = summarizeWeek({ monday, today, planWeek, workouts, runs });
  const notes = runs.filter((run) => run.notes && run.notes.trim());

  const title =
    planWeek !== null
      ? `Week ${planWeek}${back === 0 ? ' · this week' : ''}`
      : back === 0
        ? 'This week'
        : back === 1
          ? 'Last week'
          : assignment
            ? 'Before the plan'
            : `${back} weeks ago`;

  const barMax = Math.max(1, ...week.days.map((day) => day.miles));
  const pace = formatPace(week.pacedMiles, week.seconds);
  const planned = week.planned
    ? week.planned.min === week.planned.max
      ? milesNumber(week.planned.min)
      : `${milesNumber(week.planned.min)}–${milesNumber(week.planned.max)}`
    : null;

  if (loading) return <LoadingState />;

  return (
    <>
      <SectionHeader title="Training by week" />

      {assignment ? (
        <Card accent="primary">
          <View style={styles.planHead}>
            <Text style={styles.planName}>{assignment.name}</Text>
            {assignment.pace_group ? (
              <Badge label={`Group ${assignment.pace_group}`} tone="primary" />
            ) : null}
          </View>
          <Text style={styles.meta}>
            {/* Read as a local date: new Date('2026-10-26') is midnight in London, the 25th here. */}
            Started {formatDate(parseLocalDateTime(assignment.starts_on, '00:00') ?? assignment.starts_on)}
          </Text>
        </Card>
      ) : (
        <EmptyState icon="barbell-outline" message="No plan assigned yet. Their own runs still show here." />
      )}

      <Card>
        <View style={styles.nav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Earlier week"
            disabled={back >= furthestBack}
            onPress={() => setBack((value) => value + 1)}
            style={({ pressed }) => [
              styles.arrow,
              back >= furthestBack && styles.arrowOff,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="chevron-back" size={20} color={c.primary} />
          </Pressable>
          <View style={styles.navText}>
            <Text style={styles.navTitle}>{title}</Text>
            <Text style={styles.navDates}>
              {formatShortDate(monday)} – {formatShortDate(sunday)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Later week"
            disabled={back <= -furthestAhead}
            onPress={() => setBack((value) => value - 1)}
            style={({ pressed }) => [
              styles.arrow,
              back <= -furthestAhead && styles.arrowOff,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="chevron-forward" size={20} color={c.primary} />
          </Pressable>
        </View>
        {back !== 0 ? (
          <Pressable accessibilityRole="button" onPress={() => setBack(0)} style={styles.toToday}>
            <Text style={styles.toTodayText}>Back to this week</Text>
          </Pressable>
        ) : null}
      </Card>

      <View style={styles.stats}>
        <Stat label="Miles" value={milesNumber(week.miles)} of={planned ? `of ${planned}` : null} />
        <Stat
          label="Workouts logged"
          value={String(week.done)}
          of={week.due > 0 ? `of ${week.due}${back === 0 ? ' so far' : ''}` : null}
        />
        <Stat
          label="Average effort"
          value={week.effort !== null ? week.effort.toFixed(1) : '–'}
          of={week.effort !== null ? '/10' : null}
          warn={week.effort !== null && week.effort >= HARD}
        />
        <Stat label="Average pace" value={pace ? pace.replace(' /mi', '') : '–'} of={pace ? '/mi' : null} />
      </View>

      <Card>
        <View style={styles.bars}>
          {week.days.map((day, index) => {
            const hard = day.runs.some((run) => (run.effort ?? 0) >= HARD);
            return (
              <View key={day.key} style={styles.barColumn}>
                <Text style={styles.barValue}>{day.miles > 0 ? milesNumber(day.miles) : '–'}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: day.miles > 0 ? Math.max(6, (day.miles / barMax) * BAR_AREA) : 4,
                        backgroundColor:
                          day.miles > 0 ? (hard ? c.danger : c.primary) : c.surfaceSunken,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barDay}>{PLAN_DAYS[index]}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.barHint}>Red: a run that felt 8/10 or harder.</Text>
      </Card>

      {week.days.map((day, index) => (
        <DayCard key={day.key} day={day} index={index} athleteId={athleteId} enteredBy={enteredBy} />
      ))}

      <SectionHeader title="Notes and how they felt" />
      {notes.length === 0 ? (
        <EmptyState icon="chatbubble-ellipses-outline" message="No notes yet. They show here as soon as a run has one." />
      ) : (
        <>
          <Text style={styles.notesHint}>Every note, newest first, across all weeks.</Text>
          {notes.slice(0, notesShown).map((run) => (
            <NoteRow key={run.id} run={run} />
          ))}
          {notes.length > notesShown ? (
            <Button
              label={`Show ${Math.min(NOTES_PAGE, notes.length - notesShown)} more`}
              variant="secondary"
              full
              onPress={() => setNotesShown((count) => count + NOTES_PAGE)}
            />
          ) : null}
        </>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  of,
  warn = false,
}: {
  label: string;
  value: string;
  of: string | null;
  warn?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, warn && styles.statWarn]}>
        {value}
        {of ? <Text style={styles.statOf}> {of}</Text> : null}
      </Text>
    </View>
  );
}

function DayCard({
  day,
  index,
  athleteId,
  enteredBy,
}: {
  day: InsightDay<Workout, Run>;
  index: number;
  athleteId: string;
  enteredBy: Record<string, string>;
}) {
  const styles = useThemedStyles(makeStyles);
  const heading = `${PLAN_DAYS[index]} · ${formatShortDate(day.date)}`;

  if (day.status === 'rest') {
    return (
      <View style={styles.restRow}>
        <Text style={styles.restText}>{heading}</Text>
        <Text style={styles.restText}>Rest</Text>
      </View>
    );
  }

  const hardest = day.runs.reduce<number | null>(
    (max, run) => (run.effort !== null && (max === null || run.effort > max) ? run.effort : max),
    null
  );

  return (
    <Card>
      <View style={styles.dayHead}>
        <Text style={styles.dayHeading}>{heading.toUpperCase()}</Text>
        {day.status === 'done' ? (
          hardest !== null ? (
            <Badge label={`Effort ${hardest}/10`} tone={hardest >= HARD ? 'danger' : 'primary'} />
          ) : (
            <Badge label="Logged" tone="primary" />
          )
        ) : day.status === 'missed' ? (
          <Badge label="Not logged" tone="warning" />
        ) : (
          <Badge label="Coming up" />
        )}
      </View>
      <Text style={styles.dayTitle}>{day.workout?.title ?? 'Their own run'}</Text>
      {day.workout && formatMiles(day.workout.distance_miles) && day.runs.length === 0 ? (
        <Text style={styles.dayPlanned}>Planned {formatMiles(day.workout.distance_miles)}</Text>
      ) : null}
      {day.runs.map((run) => {
        const facts = [
          formatMiles(run.distance_miles),
          formatDuration(run.duration_seconds),
          formatPace(run.distance_miles, run.duration_seconds),
        ]
          .filter(Boolean)
          .join(' · ');
        const splits = formatSplits(run.split_seconds, workoutOf(run)?.split_labels ?? null);
        const extra = day.workout && run.workout_id !== day.workout.id && day.runs.length > 1;
        return (
          <View key={run.id} style={styles.run}>
            {extra || (!day.workout && workoutOf(run)) ? (
              <Text style={styles.runLabel}>{workoutOf(run)?.title ?? 'Extra run'}</Text>
            ) : null}
            <Text style={styles.runFacts}>{facts || 'Marked done'}</Text>
            {splits ? <Text style={styles.runSplits}>Splits: {splits}</Text> : null}
            {run.logged_by && run.logged_by !== athleteId ? (
              <Text style={styles.runBy}>Entered by {enteredBy[run.logged_by] ?? 'a parent'}</Text>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

function NoteRow({ run }: { run: Run }) {
  const styles = useThemedStyles(makeStyles);
  const date = parseLocalDateTime(run.logged_on, '00:00');
  const when = [
    date ? `${PLAN_DAYS[(date.getDay() + 6) % 7]}, ${formatShortDate(date)}` : run.logged_on,
    workoutOf(run)?.title ?? 'Their own run',
    formatMiles(run.distance_miles),
  ]
    .filter(Boolean)
    .join(' · ');
  const hard = (run.effort ?? 0) >= HARD;

  return (
    <View style={styles.note}>
      <View style={[styles.noteEffort, hard && styles.noteEffortHard]}>
        {run.effort !== null ? (
          <>
            <Text style={[styles.noteEffortValue, hard && styles.noteEffortValueHard]}>{run.effort}</Text>
            <Text style={[styles.noteEffortOf, hard && styles.noteEffortValueHard]}>/10</Text>
          </>
        ) : (
          <Text style={styles.noteEffortOf}>–</Text>
        )}
      </View>
      <View style={styles.noteText}>
        <Text style={styles.noteWhen}>{when}</Text>
        <Text style={styles.noteBody}>{run.notes}</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    planName: { ...type.heading, color: c.text, flex: 1 },
    meta: { ...type.caption, color: c.textMuted, marginTop: spacing.xs },
    nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    arrow: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrowOff: { opacity: 0.35 },
    pressed: { opacity: 0.7 },
    navText: { flex: 1, alignItems: 'center', gap: 2 },
    navTitle: { ...type.bodyStrong, color: c.text },
    navDates: { ...type.caption, color: c.textMuted },
    toToday: { alignSelf: 'center', marginTop: spacing.sm, paddingVertical: spacing.xs },
    toTodayText: { ...type.label, color: c.primary },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    stat: {
      flexGrow: 1,
      flexBasis: '45%',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: 2,
      backgroundColor: c.background,
    },
    statLabel: { ...type.caption, color: c.textMuted, fontWeight: '600' },
    statValue: { ...type.title, color: c.primary },
    statWarn: { color: c.danger },
    statOf: { ...type.caption, color: c.textMuted, fontWeight: '600' },
    bars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.xs },
    barColumn: { flex: 1, alignItems: 'center', gap: spacing.xs },
    barValue: { ...type.caption, color: c.text, fontWeight: '700' },
    barTrack: { height: BAR_AREA, justifyContent: 'flex-end' },
    bar: { width: 22, borderRadius: radius.sm },
    barDay: { ...type.caption, color: c.textMuted },
    barHint: { ...type.caption, color: c.textMuted, marginTop: spacing.md },
    restRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    restText: { ...type.caption, color: c.textMuted },
    dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    dayHeading: { ...type.overline, color: c.textMuted },
    dayTitle: { ...type.bodyStrong, color: c.text, marginTop: spacing.sm },
    dayPlanned: { ...type.caption, color: c.textMuted, marginTop: 2 },
    run: { marginTop: spacing.sm, gap: 2 },
    runLabel: { ...type.caption, color: c.textMuted, fontWeight: '700' },
    runFacts: { ...type.body, color: c.primary },
    runSplits: { ...type.caption, color: c.text },
    runBy: { ...type.caption, color: c.textMuted, fontStyle: 'italic' },
    notesHint: { ...type.caption, color: c.textMuted, marginTop: -spacing.sm },
    note: {
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: c.surface,
    },
    noteEffort: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noteEffortHard: { backgroundColor: c.dangerTint },
    noteEffortValue: { ...type.bodyStrong, color: c.primary, lineHeight: 18 },
    noteEffortValueHard: { color: c.danger },
    noteEffortOf: { fontSize: 10, fontWeight: '700', color: c.primary },
    noteText: { flex: 1, gap: 2 },
    noteWhen: { ...type.caption, color: c.textMuted, fontWeight: '600' },
    noteBody: { ...type.body, color: c.text },
  });
