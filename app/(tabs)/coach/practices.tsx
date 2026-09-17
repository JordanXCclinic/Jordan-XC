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
import {
  AUDIENCE_LABELS,
  PRACTICE_COLUMNS,
  type Audience,
  type Practice,
} from '../../../lib/types';
import { colors, spacing, type } from '../../../lib/theme';

const AUDIENCES = (Object.keys(AUDIENCE_LABELS) as Audience[]).map((value) => ({
  value,
  label: AUDIENCE_LABELS[value],
}));

/** Next practice defaults to tomorrow morning, which is what usually gets typed. */
function defaultStart(): Date {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(7, 0, 0, 0);
  return start;
}

export default function CoachPractices() {
  const { profile } = useAuth();
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);

  const [startsAt, setStartsAt] = useState(defaultStart);
  const [location, setLocation] = useState('');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [notes, setNotes] = useState('');
  const [audience, setAudience] = useState<Audience>('clinic');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('practices')
      .select(PRACTICE_COLUMNS)
      .gte('starts_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('starts_at', { ascending: true })
      .limit(60);
    setPractices((data as Practice[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!profile) return;
    if (!location.trim()) {
      setError('Where is it? A location is needed.');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from('practices').insert({
      starts_at: startsAt.toISOString(),
      location_name: location.trim(),
      meeting_point: meetingPoint.trim() || null,
      notes: notes.trim() || null,
      audience,
      created_by: profile.id,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setLocation('');
    setMeetingPoint('');
    setNotes('');
    setStartsAt(defaultStart());
    await load();
  }

  async function setStatus(practice: Practice, status: Practice['status']) {
    await supabase.from('practices').update({ status }).eq('id', practice.id);
    await load();
  }

  function confirmDelete(practice: Practice) {
    const remove = async () => {
      await supabase.from('practices').delete().eq('id', practice.id);
      await load();
    };
    if (Platform.OS === 'web') {
      void remove();
      return;
    }
    Alert.alert('Delete this practice?', practice.location_name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove() },
    ]);
  }

  return (
    <Screen
      inStack
      title="Schedule"
      subtitle="Practices, meets, and clinic sessions."
      onRefresh={load}
      avoidKeyboard
    >
      <Card accent="primary">
        <Text style={styles.cardTitle}>Add to the schedule</Text>
        <View style={styles.fields}>
          <DateTimeField label="When" value={startsAt} onChange={setStartsAt} />
          <TextField
            label="Location"
            value={location}
            onChangeText={setLocation}
            placeholder="Jemison Trail"
            required
          />
          <TextField
            label="Meeting point"
            value={meetingPoint}
            onChangeText={setMeetingPoint}
            placeholder="Lower parking lot by the bridge"
          />
          <TextField
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Bring trail shoes and a full water bottle."
            multiline
          />
          <ChipSelect label="Who it is for" options={AUDIENCES} value={audience} onChange={setAudience} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Post practice" full loading={saving} onPress={create} style={styles.submit} />
      </Card>

      <SectionHeader title="Scheduled" />

      {loading ? (
        <LoadingState />
      ) : practices.length === 0 ? (
        <EmptyState icon="calendar-outline" message="Nothing on the schedule yet." />
      ) : (
        practices.map((practice) => (
          <Card
            key={practice.id}
            accent={practice.status === 'cancelled' ? 'danger' : undefined}
          >
            <View style={styles.head}>
              <View style={styles.headText}>
                <Text style={styles.day}>{formatDayHeading(practice.starts_at)}</Text>
                <Text style={styles.time}>{formatTime(practice.starts_at)}</Text>
              </View>
              {practice.status !== 'scheduled' ? (
                <Badge
                  label={practice.status === 'moved' ? 'Changed' : 'Cancelled'}
                  tone={practice.status === 'moved' ? 'warning' : 'danger'}
                />
              ) : null}
            </View>

            <Text style={styles.location}>{practice.location_name}</Text>
            {practice.meeting_point ? (
              <Text style={styles.meta}>Meet at {practice.meeting_point}</Text>
            ) : null}
            <Text style={styles.meta}>{AUDIENCE_LABELS[practice.audience]}</Text>

            <View style={styles.rowActions}>
              {practice.status !== 'cancelled' ? (
                <RowAction
                  icon="close-circle-outline"
                  label="Cancel"
                  tone={colors.danger}
                  onPress={() => void setStatus(practice, 'cancelled')}
                />
              ) : (
                <RowAction
                  icon="refresh-outline"
                  label="Restore"
                  onPress={() => void setStatus(practice, 'scheduled')}
                />
              )}

              {practice.status === 'scheduled' ? (
                <RowAction
                  icon="alert-circle-outline"
                  label="Flag change"
                  onPress={() => void setStatus(practice, 'moved')}
                />
              ) : null}

              <RowAction
                icon="trash-outline"
                label="Delete"
                tone={colors.danger}
                onPress={() => confirmDelete(practice)}
              />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

function RowAction({
  icon,
  label,
  onPress,
  tone = colors.primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={16} color={tone} />
      <Text style={[styles.rowActionText, { color: tone }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.text },
  fields: { gap: spacing.lg, marginTop: spacing.lg },
  submit: { marginTop: spacing.lg },
  error: { ...type.caption, color: colors.danger, marginTop: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headText: { flex: 1 },
  day: { ...type.overline, color: colors.textFaint },
  time: { ...type.title, color: colors.primary, marginTop: 2 },
  location: { ...type.bodyStrong, color: colors.text, marginTop: spacing.sm },
  meta: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    flexWrap: 'wrap',
  },
  rowAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowActionText: { ...type.label },
  pressed: { opacity: 0.7 },
});
