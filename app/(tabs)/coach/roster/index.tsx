import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../../../components/Avatar';
import { Badge } from '../../../../components/Badge';
import { TextField } from '../../../../components/Field';
import { EmptyState, LoadingState, Screen } from '../../../../components/Screen';
import { isSupabaseConfigured, supabase } from '../../../../lib/supabase';
import { PROFILE_COLUMNS, type Profile } from '../../../../lib/types';
import { colors, radius, shadow, spacing, type } from '../../../../lib/theme';

export default function Roster() {
  const [athletes, setAthletes] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .in('role', ['athlete', 'private_client'])
      .order('full_name');
    setAthletes((data as Profile[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return athletes;
    return athletes.filter((athlete) => athlete.full_name.toLowerCase().includes(needle));
  }, [athletes, search]);

  return (
    <Screen
      inStack
      title="Roster"
      subtitle={`${athletes.length} ${athletes.length === 1 ? 'athlete' : 'athletes'}`}
      onRefresh={load}
      avoidKeyboard
    >
      {athletes.length > 6 ? (
        <TextField
          label="Search"
          value={search}
          onChangeText={setSearch}
          placeholder="Name"
          autoCapitalize="none"
        />
      ) : null}

      {loading ? (
        <LoadingState />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="people-outline"
          message={
            athletes.length === 0
              ? 'No athletes yet. Issue a clinic code to a registered family to get them in.'
              : 'No athlete by that name.'
          }
        />
      ) : (
        shown.map((athlete) => (
          <Pressable
            key={athlete.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/(tabs)/coach/roster/[id]',
                params: { id: athlete.id },
              })
            }
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Avatar name={athlete.full_name} />
            <View style={styles.text}>
              <Text style={styles.name}>{athlete.full_name}</Text>
              {athlete.graduation_year ? (
                <Text style={styles.meta}>Class of {athlete.graduation_year}</Text>
              ) : null}
            </View>
            {athlete.role === 'private_client' ? (
              <Badge label="One-on-one" tone="primary" />
            ) : null}
            {!athlete.onboarded_at ? <Badge label="Setup pending" tone="warning" /> : null}
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.card,
  },
  pressed: { opacity: 0.9 },
  text: { flex: 1 },
  name: { ...type.bodyStrong, color: colors.text },
  meta: { ...type.caption, color: colors.textMuted },
});
