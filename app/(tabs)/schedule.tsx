import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, type Tone } from '../../components/Badge';
import { Card } from '../../components/Card';
import { EmptyState, LoadingState, Screen } from '../../components/Screen';
import { SegmentedControl } from '../../components/SegmentedControl';
import { formatDayHeading, formatTime } from '../../lib/format';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { PRACTICE_COLUMNS, type Practice } from '../../lib/types';
import { spacing, type, type Palette } from '../../lib/theme';
import { useTheme, useThemedStyles } from '../../lib/appearance';

type Range = 'upcoming' | 'past';

const STATUS: Record<Practice['status'], { label: string; tone: Tone } | null> = {
  scheduled: null,
  moved: { label: 'Changed', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

export default function Schedule() {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const [range, setRange] = useState<Range>('upcoming');
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const now = new Date().toISOString();
    const query = supabase.from('practices').select(PRACTICE_COLUMNS).limit(60);

    const { data } =
      range === 'upcoming'
        ? await query.gte('starts_at', now).order('starts_at', { ascending: true })
        : await query.lt('starts_at', now).order('starts_at', { ascending: false });

    setPractices((data as Practice[] | null) ?? []);
    setLoading(false);
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  // Practices read as a diary, so they are grouped under one heading per day
  // rather than repeating the date on every card.
  const days = useMemo(() => {
    const groups = new Map<string, Practice[]>();
    for (const practice of practices) {
      const key = formatDayHeading(practice.starts_at);
      const bucket = groups.get(key);
      if (bucket) bucket.push(practice);
      else groups.set(key, [practice]);
    }
    return [...groups.entries()];
  }, [practices]);

  return (
    <Screen title="Schedule" subtitle="Practices, meets, and clinic sessions" onRefresh={load}>
      <SegmentedControl
        options={[
          { value: 'upcoming', label: 'Upcoming' },
          { value: 'past', label: 'Past' },
        ]}
        value={range}
        onChange={setRange}
      />

      {loading ? (
        <LoadingState />
      ) : days.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          message={
            range === 'upcoming'
              ? 'Nothing scheduled yet. Practices added by a coach appear here right away.'
              : 'No past practices to show.'
          }
        />
      ) : (
        days.map(([day, items]) => (
          <View key={day} style={styles.group}>
            <Text style={styles.day}>{day}</Text>
            {items.map((practice) => {
              const status = STATUS[practice.status];
              return (
                <Card
                  key={practice.id}
                  accent={practice.status === 'cancelled' ? 'danger' : undefined}
                >
                  <View style={styles.head}>
                    <Text
                      style={[
                        styles.time,
                        practice.status === 'cancelled' && styles.struck,
                      ]}
                    >
                      {formatTime(practice.starts_at)}
                      {practice.ends_at ? ` – ${formatTime(practice.ends_at)}` : ''}
                    </Text>
                    {status ? <Badge label={status.label} tone={status.tone} /> : null}
                  </View>

                  <Text style={styles.location}>{practice.location_name}</Text>

                  {practice.meeting_point ? (
                    <View style={styles.detailRow}>
                      <Ionicons name="navigate-outline" size={15} color={c.textFaint} />
                      <Text style={styles.detail}>Meet at {practice.meeting_point}</Text>
                    </View>
                  ) : null}

                  {practice.notes ? (
                    <View style={styles.detailRow}>
                      <Ionicons name="information-circle-outline" size={15} color={c.textFaint} />
                      <Text style={styles.detail}>{practice.notes}</Text>
                    </View>
                  ) : null}
                </Card>
              );
            })}
          </View>
        ))
      )}
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  group: { gap: spacing.md, marginTop: spacing.sm },
  day: { ...type.overline, color: c.textFaint },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  time: { ...type.heading, color: c.primary },
  struck: { textDecorationLine: 'line-through', color: c.textFaint },
  location: { ...type.bodyStrong, color: c.text, marginTop: spacing.xs },
  detailRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'flex-start' },
  detail: { ...type.body, color: c.textMuted, flex: 1 },
});
