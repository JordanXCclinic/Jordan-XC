import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { WorkoutLogForm, type WorkoutLogEntry } from './WorkoutLogForm';
import { useTheme, useThemedStyles } from '../lib/appearance';
import {
  formatDayHeading,
  formatDuration,
  formatMiles,
  formatPace,
  formatSplits,
  milesNumber,
  parseLocalDateTime,
} from '../lib/format';
import { round2 } from '../lib/mileage';
import { supabase } from '../lib/supabase';
import { radius, spacing, type, type Palette } from '../lib/theme';

type EmbeddedWorkout = { title: string; split_count: number | null; split_label: string | null };

type LogRow = Omit<
  WorkoutLogEntry,
  'workout_title' | 'workout_split_count' | 'workout_split_label'
> & {
  // A many-to-one embed, which PostgREST returns as an object; read an array
  // too rather than trust the inference.
  workouts: EmbeddedWorkout | EmbeddedWorkout[] | null;
};

function toEntry(row: LogRow): WorkoutLogEntry {
  const { workouts, ...rest } = row;
  const workout = Array.isArray(workouts) ? workouts[0] : workouts;
  return {
    ...rest,
    workout_title: workout?.title ?? null,
    workout_split_count: workout?.split_count ?? null,
    workout_split_label: workout?.split_label ?? null,
  };
}

/**
 * Every run logged on one day, opened from that day's bar of the weekly
 * mileage. Tapping a run opens it to change or delete — the athlete's own
 * record, so a 30 that should have been a 3 can be put right.
 */
export function DayRunsSheet({
  athleteId,
  day,
  canEdit,
  onClose,
  onChanged,
}: {
  athleteId: string;
  /** "2026-10-06", or null when closed. */
  day: string | null;
  /** The athlete or their parent. */
  canEdit: boolean;
  onClose: () => void;
  /** A run was changed or deleted, so the week's bars need reloading. */
  onChanged: () => void;
}) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [runs, setRuns] = useState<WorkoutLogEntry[] | null>(null);
  const [editing, setEditing] = useState<WorkoutLogEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!day) return;
    const { data, error: loadError } = await supabase
      .from('workout_logs')
      .select(
        'id, workout_id, logged_on, distance_miles, duration_seconds, effort, notes, split_seconds, '
          + 'workouts(title, split_count, split_label)'
      )
      .eq('athlete_id', athleteId)
      .eq('logged_on', day)
      .order('created_at');
    setError(loadError?.message ?? null);
    setRuns(((data as LogRow[] | null) ?? []).map(toEntry));
  }, [athleteId, day]);

  // Only on opening: on closing, the last day's runs stay put while the sheet
  // slides away.
  useEffect(() => {
    if (!day) return;
    setRuns(null);
    setEditing(null);
    void load();
  }, [day, load]);

  function close() {
    setEditing(null);
    onClose();
  }

  function changed() {
    setEditing(null);
    void load();
    onChanged();
  }

  const date = day ? parseLocalDateTime(day, '00:00') : null;
  const total = round2(
    (runs ?? []).reduce((sum, run) => sum + (Number(run.distance_miles) || 0), 0)
  );

  return (
    <Sheet open={day !== null} onClose={close}>
      {editing ? (
        <WorkoutLogForm
          key={editing.id}
          athleteId={athleteId}
          workoutId={editing.workout_id}
          workoutTitle={editing.workout_title}
          splitCount={editing.workout_split_count}
          splitLabel={editing.workout_split_label}
          entry={editing}
          onCancel={() => setEditing(null)}
          onSaved={changed}
          onDeleted={changed}
        />
      ) : (
        <>
          <Text style={styles.kicker}>Runs</Text>
          <Text style={styles.title}>{date ? formatDayHeading(date) : ''}</Text>

          {runs === null ? (
            <ActivityIndicator color={c.primary} style={styles.spinner} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : runs.length === 0 ? (
            <Text style={styles.empty}>No runs logged on this day.</Text>
          ) : (
            <>
              <Text style={styles.summary}>
                {runs.length === 1 ? '1 run' : `${runs.length} runs`}
                {total > 0 ? ` · ${milesNumber(total)} mi` : ''}
                {canEdit ? ' · tap one to change it' : ''}
              </Text>
              <View style={styles.list}>
                {runs.map((run) => (
                  <RunRow
                    key={run.id}
                    run={run}
                    onPress={canEdit ? () => setEditing(run) : undefined}
                  />
                ))}
              </View>
            </>
          )}

          <Button label="Close" variant="secondary" full onPress={close} />
        </>
      )}
    </Sheet>
  );
}

function RunRow({ run, onPress }: { run: WorkoutLogEntry; onPress?: () => void }) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  const miles = run.distance_miles != null ? formatMiles(Number(run.distance_miles)) : null;
  const facts = [
    miles,
    formatDuration(run.duration_seconds),
    formatPace(run.distance_miles, run.duration_seconds),
    run.effort ? `Effort ${run.effort}/10` : null,
  ].filter((fact): fact is string => Boolean(fact));
  const splits = formatSplits(run.split_seconds);
  const title = run.workout_title ?? 'Run';

  const body = (
    <>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowFacts}>{facts.length ? facts.join(' · ') : 'Marked done'}</Text>
        {splits ? <Text style={styles.rowSplits}>Splits: {splits}</Text> : null}
        {run.notes ? <Text style={styles.rowNotes}>{run.notes}</Text> : null}
      </View>
      {onPress ? (
        <View style={styles.edit}>
          <Ionicons name="create-outline" size={16} color={c.primary} />
          <Text style={styles.editText}>Edit</Text>
        </View>
      ) : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Change ${title}${facts.length ? `, ${facts.join(', ')}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    kicker: { ...type.overline, color: c.primary },
    title: { ...type.title, color: c.text, marginTop: -spacing.sm },
    spinner: { paddingVertical: spacing.xl },
    empty: { ...type.body, color: c.textMuted },
    errorText: { ...type.body, color: c.danger },
    summary: { ...type.caption, color: c.textMuted, marginTop: -spacing.sm },
    list: { gap: spacing.md },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    pressed: { opacity: 0.75 },
    rowText: { flex: 1, gap: 2 },
    rowTitle: { ...type.bodyStrong, color: c.text },
    rowFacts: { ...type.body, color: c.textMuted },
    rowSplits: { ...type.caption, color: c.text, marginTop: spacing.xs },
    rowNotes: { ...type.caption, color: c.textMuted, marginTop: spacing.xs },
    edit: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: 2 },
    editText: { ...type.label, color: c.primary },
  });
