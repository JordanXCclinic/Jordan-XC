import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../../../components/Avatar';
import { Badge } from '../../../../components/Badge';
import { Card } from '../../../../components/Card';
import { SegmentedControl } from '../../../../components/SegmentedControl';
import { EmptyState, LoadingState, Screen } from '../../../../components/Screen';
import { useAuth } from '../../../../lib/auth';
import { formatDayHeading, formatTime } from '../../../../lib/format';
import { isSupabaseConfigured, supabase } from '../../../../lib/supabase';
import { PRACTICE_COLUMNS, PROFILE_COLUMNS, type Practice, type Profile } from '../../../../lib/types';
import { spacing, type, type Palette } from '../../../../lib/theme';
import { useTheme, useThemedStyles } from '../../../../lib/appearance';

type Status = 'present' | 'absent' | 'excused';

const OPTIONS: { value: Status; label: string }[] = [
  { value: 'present', label: 'Here' },
  { value: 'absent', label: 'Missing' },
  { value: 'excused', label: 'Excused' },
];

/**
 * Taking the register at a practice. Tapping writes immediately rather than
 * collecting a form and saving at the end — this gets used one-handed at a
 * trailhead, and a half-finished list that was never submitted is worse than
 * no list at all.
 */
export default function Attendance() {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();

  const [practice, setPractice] = useState<Practice | null>(null);
  const [roster, setRoster] = useState<Profile[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [{ data: practiceRow }, { data: athletes }, { data: rows }] = await Promise.all([
      supabase.from('practices').select(PRACTICE_COLUMNS).eq('id', id).maybeSingle(),
      supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .in('role', ['athlete', 'private_client'])
        .order('full_name'),
      supabase.from('attendance').select('athlete_id, status').eq('practice_id', id),
    ]);

    setPractice((practiceRow as Practice | null) ?? null);
    setRoster((athletes as Profile[] | null) ?? []);

    const existing: Record<string, Status> = {};
    for (const row of (rows as { athlete_id: string; status: Status }[] | null) ?? []) {
      existing[row.athlete_id] = row.status;
    }
    setMarks(existing);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function mark(athleteId: string, status: Status) {
    if (!id || !profile) return;

    // Optimistic: the tap has to feel instant when standing in a car park.
    const previous = marks[athleteId];
    setMarks((current) => ({ ...current, [athleteId]: status }));
    setError(null);

    const { error: writeError } = await supabase.from('attendance').upsert(
      { practice_id: id, athlete_id: athleteId, status, recorded_by: profile.id },
      { onConflict: 'practice_id,athlete_id' }
    );

    if (writeError) {
      // Put it back rather than showing a mark that was never saved.
      setMarks((current) => {
        const next = { ...current };
        if (previous) next[athleteId] = previous;
        else delete next[athleteId];
        return next;
      });
      setError(writeError.message);
    }
  }

  const counts = useMemo(() => {
    const values = Object.values(marks);
    return {
      present: values.filter((status) => status === 'present').length,
      absent: values.filter((status) => status === 'absent').length,
      excused: values.filter((status) => status === 'excused').length,
      unmarked: roster.length - values.length,
    };
  }, [marks, roster.length]);

  if (loading) {
    return (
      <Screen inStack>
        <LoadingState />
      </Screen>
    );
  }

  if (!practice) {
    return (
      <Screen inStack>
        <EmptyState icon="calendar-outline" message="That practice no longer exists." />
      </Screen>
    );
  }

  return (
    <Screen
      inStack
      title="Attendance"
      subtitle={`${formatDayHeading(practice.starts_at)} at ${formatTime(practice.starts_at)} · ${practice.location_name}`}
      onRefresh={load}
    >
      <View style={styles.counts}>
        <Badge label={`${counts.present} here`} tone="success" />
        {counts.absent > 0 ? <Badge label={`${counts.absent} missing`} tone="danger" /> : null}
        {counts.excused > 0 ? <Badge label={`${counts.excused} excused`} tone="warning" /> : null}
        {counts.unmarked > 0 ? <Badge label={`${counts.unmarked} not marked`} /> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {roster.length === 0 ? (
        <EmptyState
          icon="people-outline"
          message="No athletes on the roster yet. Issue a clinic code to get a family in."
        />
      ) : (
        roster.map((athlete) => (
          <Card key={athlete.id}>
            <View style={styles.row}>
              <Avatar name={athlete.full_name} size={34} />
              <Text style={styles.name} numberOfLines={1}>
                {athlete.full_name}
              </Text>
            </View>
            <View style={styles.control}>
              <SegmentedControl
                options={OPTIONS}
                value={marks[athlete.id] ?? ('' as Status)}
                onChange={(next) => void mark(athlete.id, next)}
              />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { ...type.caption, color: c.danger },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { ...type.bodyStrong, color: c.text, flex: 1 },
  control: { marginTop: spacing.md },
});
