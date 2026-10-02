import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { ChipSelect, TextField } from './Field';
import { PLAN_DAYS, localDateKey, parseDuration } from '../lib/format';
import { planDayToday } from '../lib/training';
import { supabase } from '../lib/supabase';
import { radius, spacing, type, type Palette } from '../lib/theme';
import type { Workout } from '../lib/types';
import { useTheme, useThemedStyles } from '../lib/appearance';
import { useReducedMotion } from '../lib/a11y';

const EFFORTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type Props = {
  workout: Workout | null;
  /** A run that is not in the plan — an extra easy day, a weekend long run. */
  freeRun?: boolean;
  athleteId: string;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * The last week of days, today first, for "Which day?". A run forgotten
 * yesterday belongs on yesterday's bar of the weekly mileage, not today's.
 */
function recentDays(): { value: string; label: string }[] {
  return Array.from({ length: 7 }, (_, back) => {
    const day = new Date();
    day.setDate(day.getDate() - back);
    const label =
      back === 0 ? 'Today' : back === 1 ? 'Yesterday' : `${PLAN_DAYS[planDayToday(day) - 1]} ${day.getDate()}`;
    return { value: localDateKey(day), label };
  });
}

/** How an athlete says "done" — distance, time, and how hard it felt. */
export function WorkoutLogSheet({ workout, freeRun = false, athleteId, onClose, onSaved }: Props) {
  const c = useTheme();
  const calm = useReducedMotion();
  const styles = useThemedStyles(makeStyles);

  const open = workout !== null || freeRun;
  const days = recentDays();
  const [day, setDay] = useState(days[0]!.value);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [effort, setEffort] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setDistance('');
    setDuration('');
    setEffort(null);
    setNotes('');
    setDay(localDateKey(new Date()));
    setError(null);
  }

  async function save() {
    if (!open) return;

    const miles = distance.trim() ? Number(distance.trim()) : null;
    if (!workout && miles === null) {
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

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from('workout_logs').insert({
      athlete_id: athleteId,
      workout_id: workout?.id ?? null,
      logged_on: day,
      distance_miles: miles,
      duration_seconds: seconds,
      effort,
      notes: notes.trim() || null,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    reset();
    onSaved();
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType={calm ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.kicker}>{workout ? 'Log this workout' : 'Log a run'}</Text>
          <Text style={styles.title}>{workout ? workout.title : 'A run of your own'}</Text>

          <ChipSelect label="Which day?" options={days} value={day} onChange={setDay} />

          <TextField
            label="Distance (miles)"
            required={!workout}
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
            <Button label="Cancel" variant="secondary" onPress={onClose} style={styles.action} />
            <Button label="Save" loading={saving} onPress={save} style={styles.action} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: c.overlay },
  sheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '88%',
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: c.borderStrong,
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  content: { padding: spacing.xl, gap: spacing.lg },
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
});
