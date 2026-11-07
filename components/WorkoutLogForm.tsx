import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { ChipSelect, TextField } from './Field';
import {
  PLAN_DAYS,
  formatDuration,
  formatPace,
  isSameDay,
  localDateKey,
  milesNumber,
  parseDuration,
  parseLocalDateTime,
} from '../lib/format';
import { weekDays } from '../lib/mileage';
import { mondayOf, planDayToday } from '../lib/training';
import { supabase } from '../lib/supabase';
import { radius, spacing, type, type Palette } from '../lib/theme';
import { useTheme, useThemedStyles } from '../lib/appearance';

const EFFORTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** A run already logged, as the day's list reads it back to be changed. */
export type WorkoutLogEntry = {
  id: string;
  workout_id: string | null;
  /** The planned workout it was logged against, if any. */
  workout_title: string | null;
  logged_on: string;
  // Postgres numeric can come back as a string.
  distance_miles: number | string | null;
  duration_seconds: number | null;
  effort: number | null;
  notes: string | null;
  /** Each rep's time in seconds, for a workout with splits. */
  split_seconds: number[] | null;
  /** The workout's own splits setting, so the boxes come back when editing. */
  workout_split_count: number | null;
  workout_split_label: string | null;
};

function dayLabel(day: Date, today: Date): string {
  if (isSameDay(day, today)) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(day, yesterday)) return 'Yesterday';
  return `${PLAN_DAYS[planDayToday(day) - 1]} ${day.getDate()}`;
}

/**
 * The days "Which day?" offers.
 *
 * A new run: the last week, today first. A run forgotten yesterday belongs on
 * yesterday's bar of the weekly mileage, not today's.
 *
 * A run being changed: the days of its own week up to today, so one logged on
 * the wrong day can be moved without leaving the week it was in.
 */
function dayOptions(loggedOn: string | null): { value: string; label: string }[] {
  const today = new Date();
  if (!loggedOn) {
    return Array.from({ length: 7 }, (_, back) => {
      const day = new Date();
      day.setDate(day.getDate() - back);
      return { value: localDateKey(day), label: dayLabel(day, today) };
    });
  }
  const logged = parseLocalDateTime(loggedOn, '00:00') ?? today;
  const options = weekDays(mondayOf(logged))
    .filter((day) => day <= today || isSameDay(day, today))
    .map((day) => ({ value: localDateKey(day), label: dayLabel(day, today) }));
  // Never leave the run's own day out, whatever the clock says.
  return options.some((option) => option.value === loggedOn)
    ? options
    : [...options, { value: loggedOn, label: dayLabel(logged, today) }];
}

/**
 * How an athlete says "done" — distance, time, and how hard it felt — or,
 * given an entry, changes or deletes a run they already logged.
 */
export function WorkoutLogForm({
  athleteId,
  workoutId,
  workoutTitle,
  splitCount = null,
  splitLabel = null,
  entry,
  onCancel,
  onSaved,
  onDeleted,
}: {
  athleteId: string;
  workoutId: string | null;
  workoutTitle: string | null;
  /** Set when the coach wants each rep's time for this workout. */
  splitCount?: number | null;
  /** What each rep is, like "800m". */
  splitLabel?: string | null;
  /** A run to change. Without one, the form logs a new run. */
  entry?: WorkoutLogEntry;
  onCancel: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  const days = dayOptions(entry?.logged_on ?? null);

  const [day, setDay] = useState(entry?.logged_on ?? days[0]!.value);
  const [distance, setDistance] = useState(
    entry?.distance_miles != null ? milesNumber(Number(entry.distance_miles)) : ''
  );
  const [duration, setDuration] = useState(formatDuration(entry?.duration_seconds ?? null) ?? '');
  const [effort, setEffort] = useState<number | null>(entry?.effort ?? null);
  const [notes, setNotes] = useState(entry?.notes ?? '');
  // One box per rep. A log saved before the coach changed the rep count keeps
  // every time it already has.
  const [splits, setSplits] = useState<string[]>(() =>
    Array.from({ length: Math.max(splitCount ?? 0, entry?.split_seconds?.length ?? 0) }, (_, rep) =>
      formatDuration(entry?.split_seconds?.[rep] ?? null) ?? ''
    )
  );
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filled in as they type: distance over time, worked out for them.
  const pace = formatPace(
    distance.trim() ? Number(distance.trim()) : null,
    duration.trim() ? parseDuration(duration) : null
  );

  async function save() {
    const miles = distance.trim() ? Number(distance.trim()) : null;
    if (!workoutId && miles === null) {
      setError('How far did you run? Distance is what this adds to your week.');
      return;
    }
    if (miles !== null && (Number.isNaN(miles) || miles <= 0)) {
      setError('Distance should be a number of miles, like 5 or 6.2.');
      return;
    }

    const seconds = duration.trim() ? parseDuration(duration) : null;
    if (duration.trim() && seconds === null) {
      setError('Time should look like 42:30.');
      return;
    }

    // Reps are filled from the first one; blank boxes at the end are reps not
    // run, but a gap in the middle would put every later time on the wrong rep.
    const typed = splits.map((split) => split.trim());
    const lastFilled = typed.reduce((last, split, rep) => (split ? rep : last), -1);
    const splitSeconds: number[] = [];
    for (let rep = 0; rep <= lastFilled; rep += 1) {
      if (!typed[rep]) {
        setError(`Fill in rep ${rep + 1}, or leave every rep after it blank.`);
        return;
      }
      const seconds = parseDuration(typed[rep]!);
      if (seconds === null) {
        setError(`Rep ${rep + 1} should look like 2:45.`);
        return;
      }
      splitSeconds.push(seconds);
    }

    setSaving(true);
    setError(null);

    const values = {
      logged_on: day,
      distance_miles: miles,
      duration_seconds: seconds,
      effort,
      notes: notes.trim() || null,
      split_seconds: splitSeconds.length > 0 ? splitSeconds : null,
    };
    const { error: saveError } = entry
      ? await supabase.from('workout_logs').update(values).eq('id', entry.id)
      : await supabase
          .from('workout_logs')
          .insert({ athlete_id: athleteId, workout_id: workoutId, ...values });

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onSaved();
  }

  async function remove() {
    if (!entry) return;
    setDeleting(true);
    setError(null);
    const { error: deleteError } = await supabase.from('workout_logs').delete().eq('id', entry.id);
    setDeleting(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onDeleted?.();
  }

  return (
    <>
      <Text style={styles.kicker}>
        {entry ? 'Change this run' : workoutId ? 'Log this workout' : 'Log a run'}
      </Text>
      <Text style={styles.title}>{workoutTitle ?? 'A run of your own'}</Text>

      <ChipSelect label="Which day?" options={days} value={day} onChange={setDay} />

      <TextField
        label="Distance (miles)"
        required={!workoutId}
        value={distance}
        onChangeText={setDistance}
        placeholder="6.2"
        keyboardType="decimal-pad"
      />
      <TextField
        label="Time"
        value={duration}
        onChangeText={setDuration}
        placeholder="42:30"
        keyboardType="numbers-and-punctuation"
      />

      {pace ? (
        <View style={styles.pace} accessibilityLiveRegion="polite">
          <Ionicons name="speedometer-outline" size={18} color={c.primary} />
          <Text style={styles.paceText}>
            Pace <Text style={styles.paceValue}>{pace}</Text>
          </Text>
        </View>
      ) : null}

      {splits.length > 0 ? (
        <View style={styles.splitsBlock}>
          <Text style={styles.label}>
            Splits{splitLabel ? ` · ${splits.length} × ${splitLabel}` : ''}
          </Text>
          <Text style={styles.hint}>Each rep’s time, like 2:45. Leave the end blank for reps you didn’t run.</Text>
          <View style={styles.splits}>
            {splits.map((split, rep) => (
              <View key={rep} style={styles.split}>
                <TextField
                  label={`Rep ${rep + 1}`}
                  value={split}
                  onChangeText={(next) =>
                    setSplits((current) => current.map((value, index) => (index === rep ? next : value)))
                  }
                  placeholder="2:45"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.effortBlock}>
        <Text style={styles.label}>How hard did it feel?</Text>
        <View style={styles.efforts}>
          {EFFORTS.map((value) => {
            const selected = effort === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Effort ${value} of 10`}
                onPress={() => setEffort(selected ? null : value)}
                style={[styles.effort, selected && styles.effortSelected]}
              >
                <Text style={[styles.effortText, selected && styles.effortTextSelected]}>
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>1 is easy, 10 is all out.</Text>
      </View>

      <TextField
        label="Notes for your coach"
        value={notes}
        onChangeText={setNotes}
        placeholder="Legs felt heavy on the last two miles."
        multiline
      />

      {error ? (
        <View style={styles.error}>
          <Ionicons name="alert-circle" size={16} color={c.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button label="Cancel" variant="secondary" onPress={onCancel} style={styles.action} />
        <Button
          label={entry ? 'Save changes' : 'Save'}
          loading={saving}
          disabled={deleting}
          onPress={save}
          style={styles.action}
        />
      </View>

      {entry ? (
        confirmingDelete ? (
          <View style={styles.confirm}>
            <Text style={styles.confirmText}>
              Delete this run? It comes off the week’s miles, and the coach no longer sees it.
            </Text>
            <View style={styles.actions}>
              <Button
                label="Keep it"
                variant="secondary"
                onPress={() => setConfirmingDelete(false)}
                style={styles.action}
              />
              <Button
                label="Delete"
                variant="danger"
                loading={deleting}
                onPress={remove}
                style={styles.action}
              />
            </View>
          </View>
        ) : (
          <Button
            label="Delete this run"
            variant="ghost"
            icon="trash-outline"
            disabled={saving}
            onPress={() => setConfirmingDelete(true)}
          />
        )
      ) : null}
    </>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    kicker: { ...type.overline, color: c.primary },
    title: { ...type.title, color: c.text, marginTop: -spacing.sm },
    label: { ...type.label, color: c.text },
    hint: { ...type.caption, color: c.textFaint },
    effortBlock: { gap: spacing.sm },
    efforts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    effort: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    effortSelected: { backgroundColor: c.primarySurface, borderColor: c.primary },
    effortText: { ...type.bodyStrong, color: c.textMuted },
    effortTextSelected: { color: c.textInverse },
    error: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    errorText: { ...type.caption, color: c.danger, flex: 1 },
    actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
    action: { flex: 1 },
    confirm: {
      gap: spacing.sm,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: c.dangerTint,
    },
    confirmText: { ...type.body, color: c.text },
    pace: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.primaryTint,
      marginTop: -spacing.sm,
    },
    paceText: { ...type.body, color: c.text },
    paceValue: { ...type.bodyStrong, color: c.primary },
    splitsBlock: { gap: spacing.sm },
    splits: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    split: { width: '30%', minWidth: 90 },
  });
