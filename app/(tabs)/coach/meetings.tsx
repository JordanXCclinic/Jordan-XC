import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/Badge';
import { confirmDestructive } from '../../../lib/confirm';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { ChipSelect, TextField } from '../../../components/Field';
import { DateTimeField } from '../../../components/DateTimeField';
import { EmptyState, LoadingState, Screen, SectionHeader } from '../../../components/Screen';
import { SegmentedControl } from '../../../components/SegmentedControl';
import { useAuth } from '../../../lib/auth';
import { firstName, formatDayHeading, formatTime } from '../../../lib/format';
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

type Form = 'call' | 'open';

const FORMS: { value: Form; label: string }[] = [
  { value: 'call', label: 'Add a call you set up' },
  { value: 'open', label: 'Open a time' },
];

type Runner = { id: string; full_name: string; role: string };

function defaultStart(hour = 16): Date {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(hour, 0, 0, 0);
  return start;
}

const WHERE_PLACEHOLDER: Record<MeetingMode, string> = {
  phone: 'I’ll call your cell',
  video: 'Video link',
  in_person: 'Jemison Trail parking lot',
};

export default function CoachMeetings() {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const { profile } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [slots, setSlots] = useState<MeetingSlot[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [runners, setRunners] = useState<Runner[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form>('call');

  // A call already arranged with a family, usually by text.
  const [runnerId, setRunnerId] = useState<string | null>(null);
  const [showClinic, setShowClinic] = useState(false);
  const [callStart, setCallStart] = useState(() => defaultStart(18));
  const [callDuration, setCallDuration] = useState('30');
  const [callMode, setCallMode] = useState<MeetingMode>('phone');
  const [callWhere, setCallWhere] = useState('');
  const [callNote, setCallNote] = useState('');
  const [editing, setEditing] = useState<MeetingSlot | null>(null);
  const [callSaving, setCallSaving] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [callDone, setCallDone] = useState<string | null>(null);

  // An open time for any family to claim.
  const [startsAt, setStartsAt] = useState(() => defaultStart());
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

    const [{ data }, { data: people }] = await Promise.all([
      supabase
        .from('meeting_slots')
        .select(MEETING_SLOT_COLUMNS)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(80),
      supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['athlete', 'private_client'])
        .order('full_name', { ascending: true }),
    ]);

    const rows = (data as MeetingSlot[] | null) ?? [];
    const everyone = (people as Runner[] | null) ?? [];
    setSlots(rows);
    setRunners(everyone);

    // Runners are already loaded, so who booked what needs no query of its own.
    const map: Record<string, string> = {};
    for (const person of everyone) map[person.id] = person.full_name;
    const missing = [...new Set(rows.map((slot) => slot.booked_for).filter((id) => id && !map[id]))] as string[];
    if (missing.length > 0) {
      const { data: others } = await supabase.from('profiles').select('id, full_name').in('id', missing);
      for (const person of (others as { id: string; full_name: string }[] | null) ?? []) {
        map[person.id] = person.full_name;
      }
    }
    setNames(map);

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runnerOptions = useMemo(
    () =>
      runners
        .filter((runner) => showClinic || runner.role === 'private_client' || runner.id === runnerId)
        .map((runner) => ({ value: runner.id, label: runner.full_name })),
    [runners, showClinic, runnerId]
  );

  function resetCall() {
    setEditing(null);
    setRunnerId(null);
    setCallStart(defaultStart(18));
    setCallDuration('30');
    setCallMode('phone');
    setCallWhere('');
    setCallNote('');
    setCallError(null);
  }

  function startEditing(slot: MeetingSlot) {
    const runner = runners.find((person) => person.id === slot.booked_for);
    setForm('call');
    setEditing(slot);
    setRunnerId(slot.booked_for);
    if (runner && runner.role !== 'private_client') setShowClinic(true);
    setCallStart(new Date(slot.starts_at));
    setCallDuration(String(slot.duration_minutes));
    setCallMode(slot.mode);
    setCallWhere(slot.location ?? '');
    setCallNote(slot.notes ?? '');
    setCallError(null);
    setCallDone(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  async function saveCall() {
    if (!profile) return;
    if (!runnerId) {
      setCallError('Pick who the call is with.');
      return;
    }
    if (callStart.getTime() < Date.now()) {
      setCallError('That time has already passed. Pick when the call is.');
      return;
    }

    setCallSaving(true);
    setCallError(null);
    setCallDone(null);

    const fields = {
      starts_at: callStart.toISOString(),
      duration_minutes: Number(callDuration),
      mode: callMode,
      location: callWhere.trim() || null,
      notes: callNote.trim() || null,
      booked_for: runnerId,
    };
    const { error: saveError } = editing
      ? await supabase.from('meeting_slots').update(fields).eq('id', editing.id)
      : await supabase.from('meeting_slots').insert({
          ...fields,
          created_by: profile.id,
          booked_by: profile.id,
          booked_at: new Date().toISOString(),
          set_by_coach: true,
        });

    setCallSaving(false);
    if (saveError) {
      setCallError(saveError.message);
      return;
    }

    const who = firstName(names[runnerId] ?? runners.find((r) => r.id === runnerId)?.full_name) || 'their';
    setCallDone(
      editing
        ? `Saved. ${who}’s Home screen shows the new details.`
        : `Added. It’s on ${who}’s Home screen now.`
    );
    resetCall();
    await load();
  }

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

  async function confirmDelete(slot: MeetingSlot) {
    const booked = Boolean(slot.booked_for);
    const name = names[slot.booked_for ?? ''];
    const ok = await confirmDestructive(
      slot.set_by_coach ? 'Remove this call?' : booked ? 'Delete this booked meeting?' : 'Delete this time?',
      slot.set_by_coach
        ? `It comes off ${firstName(name) || 'their'}’s Home screen. They are not told automatically.`
        : booked
          ? `${name ?? 'A family'} has this booked. They will not be told automatically.`
          : formatDayHeading(slot.starts_at)
    );
    if (!ok) return;

    await supabase.from('meeting_slots').delete().eq('id', slot.id);
    if (editing?.id === slot.id) resetCall();
    await load();
  }

  const booked = slots.filter((slot) => slot.booked_for !== null);
  const open = slots.filter((slot) => slot.booked_for === null);
  const clients = runners.filter((runner) => runner.role === 'private_client').length;

  return (
    <Screen
      inStack
      title="Meetings"
      subtitle="A call you set up shows on that runner's Home screen. Open times are for any family to claim."
      onRefresh={load}
      avoidKeyboard
      scrollRef={scrollRef}
    >
      <SegmentedControl options={FORMS} value={form} onChange={setForm} />

      {form === 'call' ? (
        <Card accent="primary">
          <Text style={styles.cardTitle}>{editing ? 'Change this call' : 'Add a call you set up'}</Text>
          <Text style={styles.cardHint}>
            For a call you arranged by text. It shows on their Home screen, and on their
            parents&rsquo; too.
          </Text>
          <View style={styles.fields}>
            {runnerOptions.length > 0 ? (
              <ChipSelect
                label="Who"
                options={runnerOptions}
                value={runnerId}
                onChange={(id) => {
                  setRunnerId(id);
                  setCallDone(null);
                }}
                required
              />
            ) : (
              <Text style={styles.cardHint}>
                {loading ? 'Loading runners…' : 'No one-on-one clients yet.'}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowClinic((shown) => !shown)}
              hitSlop={6}
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
            >
              <Ionicons name={showClinic ? 'remove-circle-outline' : 'add-circle-outline'} size={16} color={c.primary} />
              <Text style={styles.linkText}>
                {showClinic
                  ? 'Only show one-on-one clients'
                  : clients === runners.length
                    ? 'Show clinic athletes too'
                    : `Show clinic athletes too (${runners.length - clients})`}
              </Text>
            </Pressable>
            <DateTimeField label="When" value={callStart} onChange={setCallStart} />
            <ChipSelect label="How long" options={DURATIONS} value={callDuration} onChange={setCallDuration} />
            <ChipSelect label="How" options={MODES} value={callMode} onChange={setCallMode} />
            <TextField
              label={callMode === 'video' ? 'Link' : callMode === 'phone' ? 'Who calls who' : 'Where'}
              value={callWhere}
              onChangeText={setCallWhere}
              placeholder={WHERE_PLACEHOLDER[callMode]}
              hint="Optional"
            />
            <TextField
              label="Note for them"
              value={callNote}
              onChangeText={setCallNote}
              placeholder="We'll go over your race plan for Saturday."
              hint="Optional. They see this under the time."
              multiline
            />
          </View>

          {callError ? <Text style={styles.error}>{callError}</Text> : null}
          {callDone ? <Text style={styles.done}>{callDone}</Text> : null}

          <Button
            label={editing ? 'Save changes' : 'Add to their Home screen'}
            full
            loading={callSaving}
            onPress={saveCall}
            style={styles.submit}
          />
          {editing ? (
            <Button label="Cancel" variant="secondary" full onPress={resetCall} style={styles.secondary} />
          ) : null}
        </Card>
      ) : (
        <Card accent="primary">
          <Text style={styles.cardTitle}>Open a time</Text>
          <Text style={styles.cardHint}>Any family can claim an open time from their app.</Text>
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
      )}

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
                  {slot.set_by_coach ? ' · You set this up' : ' · They booked it'}
                </Text>
                {slot.set_by_coach && slot.notes ? <Text style={styles.note}>{slot.notes}</Text> : null}
                {slot.topic ? <Text style={styles.topic}>&ldquo;{slot.topic}&rdquo;</Text> : null}

                <View style={styles.rowActions}>
                  {slot.set_by_coach ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => startEditing(slot)}
                      style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}
                    >
                      <Ionicons name="create-outline" size={16} color={c.primary} />
                      <Text style={styles.editText}>Change</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void confirmDelete(slot)}
                    style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}
                  >
                    <Ionicons name="trash-outline" size={16} color={c.danger} />
                    <Text style={styles.rowActionText}>{slot.set_by_coach ? 'Remove' : 'Delete'}</Text>
                  </Pressable>
                </View>
              </Card>
            ))
          )}

          <SectionHeader title={`Open (${open.length})`} />
          {open.length === 0 ? (
            <EmptyState icon="time-outline" message="No open times posted. Use Open a time above." />
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
                    onPress={() => void confirmDelete(slot)}
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
  cardHint: { ...type.caption, color: c.textMuted, marginTop: spacing.xs, lineHeight: 18 },
  fields: { gap: spacing.lg, marginTop: spacing.lg },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: -spacing.sm },
  linkText: { ...type.label, color: c.primary },
  submit: { marginTop: spacing.lg },
  secondary: { marginTop: spacing.sm },
  error: { ...type.caption, color: c.danger, marginTop: spacing.md },
  done: { ...type.caption, color: c.success, fontWeight: '700', marginTop: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headText: { flex: 1 },
  day: { ...type.overline, color: c.textFaint },
  time: { ...type.title, color: c.primary, marginTop: 2 },
  who: { ...type.bodyStrong, color: c.text, marginTop: spacing.sm },
  meta: { ...type.caption, color: c.textMuted, marginTop: spacing.xs },
  note: { ...type.body, color: c.textMuted, marginTop: spacing.sm },
  topic: { ...type.body, color: c.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  rowAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editText: { ...type.label, color: c.primary },
  rowActionText: { ...type.label, color: c.danger },
  pressed: { opacity: 0.7 },
});
