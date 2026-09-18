import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { TextField } from '../components/Field';
import { EmptyState, LoadingState, Screen, SectionHeader } from '../components/Screen';
import { SegmentedControl } from '../components/SegmentedControl';
import { useAthlete } from '../lib/athlete';
import { useAuth } from '../lib/auth';
import { firstName, formatDayHeading, formatRelative, formatTime } from '../lib/format';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { MEETING_MODE_LABELS,
  MEETING_SLOT_COLUMNS,
  isCoach,
  type MeetingSlot,
} from '../lib/types';
import { spacing, type, type Palette } from '../lib/theme';
import { useTheme, useThemedStyles } from '../lib/appearance';
import { useReducedMotion } from '../lib/a11y';

export default function Meetings() {

  const c = useTheme();
  const calm = useReducedMotion();

  const styles = useThemedStyles(makeStyles);

  const { role } = useAuth();
  const { athletes, activeAthleteId, setActiveAthleteId, activeAthlete } = useAthlete();

  const [slots, setSlots] = useState<MeetingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<MeetingSlot | null>(null);
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // RLS returns open times plus this family's own bookings, and nothing else.
    const { data } = await supabase
      .from('meeting_slots')
      .select(MEETING_SLOT_COLUMNS)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(80);
    setSlots((data as MeetingSlot[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mine = useMemo(
    () => slots.filter((slot) => slot.booked_for !== null),
    [slots]
  );
  const open = useMemo(() => slots.filter((slot) => slot.booked_for === null), [slots]);

  async function confirmBooking() {
    if (!booking || !activeAthleteId) return;
    setBusy(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc('book_meeting_slot', {
      p_slot: booking.id,
      p_athlete: activeAthleteId,
      p_topic: topic.trim() || null,
    });

    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setBooking(null);
    setTopic('');
    await load();
  }

  async function cancel(slot: MeetingSlot) {
    const { error: rpcError } = await supabase.rpc('cancel_meeting_booking', { p_slot: slot.id });
    if (rpcError) setError(rpcError.message);
    await load();
  }

  const canBook = Boolean(activeAthleteId);

  return (
    <Screen
      inStack
      title="Meet with Coach"
      subtitle="Pick a time that works. Coaches post new ones as the summer goes."
      onRefresh={load}
    >
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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <LoadingState />
      ) : (
        <>
          {mine.length > 0 ? (
            <>
              <SectionHeader title="Booked" />
              {mine.map((slot) => (
                <Card key={slot.id} accent="primary">
                  <View style={styles.head}>
                    <Text style={styles.day}>{formatDayHeading(slot.starts_at)}</Text>
                    <Badge label={formatRelative(slot.starts_at)} tone="primary" />
                  </View>
                  <Text style={styles.time}>{formatTime(slot.starts_at)}</Text>
                  <Text style={styles.meta}>
                    {MEETING_MODE_LABELS[slot.mode]}
                    {slot.location ? ` · ${slot.location}` : ''} · {slot.duration_minutes} min
                  </Text>
                  {slot.topic ? <Text style={styles.topic}>&ldquo;{slot.topic}&rdquo;</Text> : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void cancel(slot)}
                    style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
                  >
                    <Ionicons name="close-circle-outline" size={16} color={c.danger} />
                    <Text style={styles.cancelText}>Cancel this meeting</Text>
                  </Pressable>
                </Card>
              ))}
            </>
          ) : null}

          <SectionHeader title="Open times" />

          {open.length === 0 ? (
            <EmptyState
              icon="time-outline"
              message="No open times right now. Check back — coaches add them through the summer."
            />
          ) : (
            open.map((slot) => (
              <Card key={slot.id}>
                <View style={styles.head}>
                  <View style={styles.headText}>
                    <Text style={styles.day}>{formatDayHeading(slot.starts_at)}</Text>
                    <Text style={styles.time}>{formatTime(slot.starts_at)}</Text>
                  </View>
                  {!isCoach(role) ? (
                    <Button
                      label="Book"
                      onPress={() => {
                        setBooking(slot);
                        setTopic('');
                        setError(null);
                      }}
                      disabled={!canBook}
                    />
                  ) : null}
                </View>
                <Text style={styles.meta}>
                  {MEETING_MODE_LABELS[slot.mode]}
                  {slot.location ? ` · ${slot.location}` : ''} · {slot.duration_minutes} min
                </Text>
                {slot.notes ? <Text style={styles.notes}>{slot.notes}</Text> : null}
              </Card>
            ))
          )}

          {!canBook && !isCoach(role) ? (
            <Text style={styles.hint}>
              Booking needs a linked athlete. Once your runner redeems their code you can book
              on their behalf.
            </Text>
          ) : null}
        </>
      )}

      <Modal
        visible={booking !== null}
        transparent
        animationType={calm ? 'none' : 'slide'}
        onRequestClose={() => setBooking(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setBooking(null)} />
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetKicker}>Confirm your time</Text>
            <Text style={styles.sheetTitle}>
              {booking ? `${formatDayHeading(booking.starts_at)} at ${formatTime(booking.starts_at)}` : ''}
            </Text>
            {activeAthlete ? (
              <Text style={styles.meta}>For {activeAthlete.full_name}</Text>
            ) : null}

            <TextField
              label="What would you like to talk about?"
              value={topic}
              onChangeText={setTopic}
              placeholder="Race schedule and summer mileage."
              hint="Optional, but it helps the coach come prepared."
              multiline
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              <Button
                label="Back"
                variant="secondary"
                onPress={() => setBooking(null)}
                style={styles.action}
              />
              <Button
                label="Book it"
                loading={busy}
                onPress={confirmBooking}
                style={styles.action}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headText: { flex: 1 },
  day: { ...type.overline, color: c.textFaint },
  time: { ...type.title, color: c.primary, marginTop: 2 },
  meta: { ...type.caption, color: c.textMuted, marginTop: spacing.xs },
  notes: { ...type.body, color: c.textMuted, marginTop: spacing.sm },
  topic: { ...type.body, color: c.text, fontStyle: 'italic', marginTop: spacing.sm },
  cancel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  pressed: { opacity: 0.7 },
  cancelText: { ...type.label, color: c.danger },
  error: { ...type.caption, color: c.danger },
  hint: { ...type.caption, color: c.textFaint, textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: c.overlay },
  sheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '80%',
  },
  sheetContent: { padding: spacing.xl, gap: spacing.lg },
  sheetKicker: { ...type.overline, color: c.primary },
  sheetTitle: { ...type.title, color: c.text },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
});
