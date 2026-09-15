import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EmptyState, Screen } from '../../components/Screen';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { colors, radius, spacing } from '../../lib/theme';
import type { Practice } from '../../lib/types';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function Schedule() {
  const [practices, setPractices] = useState<Practice[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase
      .from('practices')
      .select('id, starts_at, ends_at, location_name, meeting_point, notes, status, audience')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(30)
      .then(({ data }) => setPractices((data as Practice[]) ?? []));
  }, []);

  return (
    <Screen title="Schedule" subtitle="Upcoming practices and meets">
      {practices.length === 0 ? (
        <EmptyState message="Nothing on the schedule yet. Practices added by a coach will appear here." />
      ) : (
        practices.map((practice) => (
          <View key={practice.id} style={styles.card}>
            <Text style={styles.when}>{formatWhen(practice.starts_at)}</Text>
            <Text style={styles.location}>{practice.location_name}</Text>
            {practice.meeting_point ? (
              <Text style={styles.detail}>Meet at {practice.meeting_point}</Text>
            ) : null}
            {practice.notes ? <Text style={styles.detail}>{practice.notes}</Text> : null}
            {practice.status !== 'scheduled' ? (
              <Text style={styles.status}>{practice.status.toUpperCase()}</Text>
            ) : null}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  when: { fontSize: 14, fontWeight: '600', color: colors.primary },
  location: { fontSize: 17, fontWeight: '600', color: colors.text, marginTop: spacing.xs },
  detail: { fontSize: 15, color: colors.textMuted, marginTop: spacing.xs },
  status: { fontSize: 13, fontWeight: '700', color: colors.danger, marginTop: spacing.sm },
});
