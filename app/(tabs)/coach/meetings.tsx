import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { ChipSelect, TextField } from '../../../components/Field';
import { DateTimeField } from '../../../components/DateTimeField';
import { EmptyState, LoadingState, Screen, SectionHeader } from '../../../components/Screen';
import { useAuth } from '../../../lib/auth';
import { formatDayHeading, formatTime } from '../../../lib/format';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { MEETING_MODE_LABELS,
  MEETING_SLOT_COLUMNS,
  type MeetingMode,
  type MeetingSlot,
} from '../../../lib/types';
import { spacing, type, type Palette } from '../../../lib/theme';
import { useTheme, useThemedStyles } from '../../../lib/appearance';

const DURATIONS = [
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '1 hour' },
];

const MODES = (Object.keys(MEETING_MODE_LABELS) as MeetingMode[]).map((value) => ({
  value,
  label: MEETING_MODE_LABELS[value],
}));

function defaultStart(): Date {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(16, 0, 0, 0);
  return start;
}

export default function CoachMeetings() {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const { profile } = useAuth();
  const [slots, setSlots] = useState<MeetingSlot[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [startsAt, setStartsAt] = useState(defaultStart);
  const [duration, setDuration] = useState('30');
  const [mode, setMode] = useState<MeetingMode>('in_person');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data } = await supabase
      .from('meeting_slots')
      .select(MEETING_SLOT_COLUMNS)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(80);

    const rows = (data as MeetingSlot[] | null) ?? [];
    setSlots(rows);

    // Resolve who booked what in one query rather than one per slot.
    const bookedIds = [...new Set(rows.map((slot) => slot.booked_for).filter(Boolean))] as string[];
    if (bookedIds.length > 0) {
      const { data: people } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', bookedIds);
      const map: Record<string, string> = {};
      for (const person of (people as { id: string; full_name: string }[] | null) ?? []) {
        map[person.id] = person.full_name;
      }
      setNames(map);
    } else {
      setNames({});
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!profile) return;

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from('meeting_slots').insert({
      starts_at: startsAt.toISOString(),
      duration_minutes: Number(duration),
      mode,
      location: location.trim() || null,
      notes: notes.trim() || null,
      created_by: profile.id,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setNotes('');
    // Nudge the next slot an hour on, since times are usually added in a run.
    setStartsAt(new Date(startsAt.getTime() + 60 * 60 * 1000));
    await load();
  }

  function confirmDelete(slot: MeetingSlot) {
    const remove = async () => {
      await supabase.from('meeting_slots').delete().eq('id', slot.id);
      await load();
    };

    const booked = Boolean(slot.booked_for);
    if (Platform.OS === 'web') {
      void remove();
      return;
    }
    Alert.alert(
      booked ? 'Delete this booked meeting?' : 'Delete this time?',
      booked
        ? `${names[slot.booked_for!] ?? 'A family'} has this booked. They will not be told automatically.`
        : formatDayHeading(slot.starts_at),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void remove() },
      ]
    );
  }

  const booked = slots.filter((slot) => slot.booked_for !== null);
  const open = slots.filter((slot) => slot.booked_for === null);

  return (
    <Screen
      inStack
      title="Meetings"
      subtitle="Post the times you are free. Families claim them from their app."
      onRefresh={load}
      avoidKeyboard
    >
      <Card accent="primary">
        <Text style={styles.cardTitle}>Open a time</Text>
        <View style={styles.fields}>
          <DateTimeField label="When" value={startsAt} onChange={setStartsAt} />
          <ChipSelect label="How long" options={DURATIONS} value={duration} onChange={setDuration} />
          <ChipSelect label="Where" options={MODES} value={mode} onChange={setMode} />
          <TextField
            label="Location or link"
            value={location}
            onChangeText={setLocation}
            placeholder={mode === 'video' ? 'Video link' : 'Jemison Trail parking lot'}
          />
          <TextField
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Good for goal setting before the season."
            multiline
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Post this time" full loading={saving} onPress={create} style={styles.submit} />
      </Card>

      {loading ? (
        <LoadingState />
      ) : (
        <>
          <SectionHeader title={`Booked (${booked.length})`} />
          {booked.length === 0 ? (
            <EmptyState icon="calendar-outline" message="Nothing booked yet." />
          ) : (
            booked.map((slot) => (
              <Card key={slot.id} accent="primary">
                <View style={styles.head}>
                  <View style={styles.headText}>
                    <Text style={styles.day}>{formatDayHeading(slot.starts_at)}</Text>
                    <Text style={styles.time}>{formatTime(slot.starts_at)}</Text>
                  </View>
                  <Badge label={`${slot.duration_minutes} min`} tone="primary" />
                </View>

                <Text style={styles.who}>{names[slot.booked_for!] ?? 'A clinic family'}</Text>
                <Text style={styles.meta}>
                  {MEETING_MODE_LABELS[slot.mode]}
                  {slot.location ? ` · ${slot.location}` : ''}
                </Text>
                {slot.topic ? <Text style={styles.topic}>&ldquo;{slot.topic}&rdquo;</Text> : null}

                <Pressable
                  accessibilityRole="button"
                  onPress={() => confirmDelete(slot)}
                  style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}
                >
                  <Ionicons name="trash-outline" size={16} color={c.danger} />
                  <Text style={styles.rowActionText}>Delete</Text>
                </Pressable>
              </Card>
            ))
          )}

          <SectionHeader title={`Open (${open.length})`} />
          {open.length === 0 ? (
            <EmptyState icon="time-outline" message="No open times posted. Add one above." />
          ) : (
            open.map((slot) => (
              <Card key={slot.id}>
                <View style={styles.head}>
                  <View style={styles.headText}>
                    <Text style={styles.day}>{formatDayHeading(slot.starts_at)}</Text>
                    <Text style={styles.time}>{formatTime(slot.starts_at)}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Delete this time"
                    onPress={() => confirmDelete(slot)}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={17} color={c.danger} />
                  </Pressable>
                </View>
                <Text style={styles.meta}>
                  {MEETING_MODE_LABELS[slot.mode]}
                  {slot.location ? ` · ${slot.location}` : ''} · {slot.duration_minutes} min
                </Text>
              </Card>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  cardTitle: { ...type.heading, color: c.text },
  fields: { gap: spacing.lg, marginTop: spacing.lg },
  submit: { marginTop: spacing.lg },
  error: { ...type.caption, color: c.danger, marginTop: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headText: { flex: 1 },
  day: { ...type.overline, color: c.textFaint },
  time: { ...type.title, color: c.primary, marginTop: 2 },
  who: { ...type.bodyStrong, color: c.text, marginTop: spacing.sm },
  meta: { ...type.caption, color: c.textMuted, marginTop: spacing.xs },
  topic: { ...type.body, color: c.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  rowAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  rowActionText: { ...type.label, color: c.danger },
  pressed: { opacity: 0.7 },
});
