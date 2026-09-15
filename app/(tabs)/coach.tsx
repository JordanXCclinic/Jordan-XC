import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EmptyState, Screen } from '../../components/Screen';
import { useAuth } from '../../lib/auth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { isCoach, type Profile } from '../../lib/types';
import { colors, radius, spacing } from '../../lib/theme';

export default function Coach() {
  const { role } = useAuth();
  const [roster, setRoster] = useState<Profile[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured || !isCoach(role)) return;
    supabase
      .from('profiles')
      .select('id, full_name, role, date_of_birth, phone, graduation_year')
      .in('role', ['athlete', 'private_client'])
      .order('full_name', { ascending: true })
      .then(({ data }) => setRoster((data as Profile[]) ?? []));
  }, [role]);

  if (!isCoach(role)) {
    return (
      <Screen title="Coach">
        <EmptyState message="Coach tools are only available to clinic staff." />
      </Screen>
    );
  }

  return (
    <Screen title="Coach" subtitle={`${roster.length} athletes on the roster`}>
      {roster.length === 0 ? (
        <EmptyState message="No athletes yet. Once accounts are created they will show up here." />
      ) : (
        roster.map((athlete) => (
          <View key={athlete.id} style={styles.row}>
            <Text style={styles.name}>{athlete.full_name}</Text>
            <Text style={styles.meta}>
              {athlete.role === 'private_client' ? 'One-on-one' : 'Clinic'}
              {athlete.graduation_year ? ` · ${athlete.graduation_year}` : ''}
            </Text>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
});
