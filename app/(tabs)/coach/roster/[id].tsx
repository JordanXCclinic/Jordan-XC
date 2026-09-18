import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { AthleteSummary } from '../../../../components/AthleteSummary';
import { Avatar } from '../../../../components/Avatar';
import { Badge } from '../../../../components/Badge';
import { Card } from '../../../../components/Card';
import { EmptyState, LoadingState, Screen, SectionHeader } from '../../../../components/Screen';
import { formatDate, formatDuration, formatMiles, roleLabel } from '../../../../lib/format';
import { isSupabaseConfigured, supabase } from '../../../../lib/supabase';
import {
  PROFILE_COLUMNS,
  WORKOUT_LOG_COLUMNS,
  type Profile,
  type WorkoutLog,
} from '../../../../lib/types';
import { colors, spacing, type } from '../../../../lib/theme';

export default function AthleteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [athlete, setAthlete] = useState<Profile | null>(null);
  const [guardians, setGuardians] = useState<Profile[]>([]);
  const [plan, setPlan] = useState<{ name: string; starts_on: string } | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  /** Names for logs a parent entered, so the coach knows whose account it is. */
  const [loggedByNames, setLoggedByNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [{ data: row }, { data: links }, { data: assignment }, { data: logRows }] =
      await Promise.all([
        supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle(),
        supabase.from('guardian_links').select('guardian_id').eq('athlete_id', id),
        supabase
          .from('plan_assignments')
          .select('starts_on, training_plans(name)')
          .eq('athlete_id', id)
          .order('starts_on', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('workout_logs')
          .select(WORKOUT_LOG_COLUMNS)
          .eq('athlete_id', id)
          .order('logged_on', { ascending: false })
          .limit(10),
      ]);

    setAthlete((row as Profile | null) ?? null);

    const logList = (logRows as WorkoutLog[] | null) ?? [];
    setLogs(logList);

    // Resolve only the entries somebody else wrote — a run the athlete logged
    // themselves needs no attribution.
    const enteredByOthers = [
      ...new Set(
        logList
          .map((log) => log.logged_by)
          .filter((who): who is string => Boolean(who) && who !== id)
      ),
    ];
    if (enteredByOthers.length > 0) {
      const { data: people } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', enteredByOthers);
      const names: Record<string, string> = {};
      for (const person of (people as { id: string; full_name: string }[] | null) ?? []) {
        names[person.id] = person.full_name;
      }
      setLoggedByNames(names);
    } else {
      setLoggedByNames({});
    }

    const assigned = assignment as
      | { starts_on: string; training_plans: { name: string } | null }
      | null;
    setPlan(
      assigned?.training_plans
        ? { name: assigned.training_plans.name, starts_on: assigned.starts_on }
        : null
    );

    const guardianIds = ((links as { guardian_id: string }[] | null) ?? []).map(
      (link) => link.guardian_id
    );
    if (guardianIds.length > 0) {
      const { data: people } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .in('id', guardianIds);
      setGuardians((people as Profile[] | null) ?? []);
    } else {
      setGuardians([]);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen inStack>
        <LoadingState />
      </Screen>
    );
  }

  if (!athlete) {
    return (
      <Screen inStack>
        <EmptyState icon="person-outline" message="That athlete is no longer on the roster." />
      </Screen>
    );
  }

  return (
    <Screen inStack onRefresh={load}>
      <Card>
        <View style={styles.identity}>
          <Avatar name={athlete.full_name} size={56} />
          <View style={styles.identityText}>
            <Text style={styles.name}>{athlete.full_name}</Text>
            <Badge
              label={roleLabel(athlete.role)}
              tone={athlete.role === 'private_client' ? 'primary' : 'neutral'}
            />
          </View>
        </View>
        {athlete.phone ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openURL(`tel:${athlete.phone}`)}
            style={({ pressed }) => [styles.call, pressed && styles.pressed]}
          >
            <Ionicons name="call" size={16} color={colors.primary} />
            <Text style={styles.callText}>{athlete.phone}</Text>
          </Pressable>
        ) : null}
      </Card>

      <SectionHeader
        title="Profile"
        action={
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/athlete-form',
                params: { id: athlete.id, name: athlete.full_name },
              })
            }
            hitSlop={8}
          >
            <Text style={styles.edit}>Edit</Text>
          </Pressable>
        }
      />
      <AthleteSummary athleteId={athlete.id} />

      <SectionHeader title="Guardians" />
      {guardians.length === 0 ? (
        <EmptyState
          icon="people-outline"
          message="No parent linked yet. The link forms when their parent code is redeemed."
        />
      ) : (
        guardians.map((guardian) => (
          <Card key={guardian.id}>
            <Text style={styles.guardianName}>{guardian.full_name}</Text>
            {guardian.phone ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void Linking.openURL(`tel:${guardian.phone}`)}
                style={({ pressed }) => [styles.call, pressed && styles.pressed]}
              >
                <Ionicons name="call" size={16} color={colors.primary} />
                <Text style={styles.callText}>{guardian.phone}</Text>
              </Pressable>
            ) : null}
          </Card>
        ))
      )}

      <SectionHeader title="Training" />
      {plan ? (
        <Card accent="primary">
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.meta}>Started {formatDate(plan.starts_on)}</Text>
        </Card>
      ) : (
        <EmptyState icon="barbell-outline" message="No plan assigned yet." />
      )}

      <SectionHeader title="Recent logs" />
      {logs.length === 0 ? (
        <EmptyState icon="footsteps-outline" message="Nothing logged yet." />
      ) : (
        logs.map((log) => (
          <Card key={log.id}>
            <View style={styles.logHead}>
              <Text style={styles.logDate}>{formatDate(log.logged_on)}</Text>
              {log.effort ? <Badge label={`Effort ${log.effort}/10`} tone="neutral" /> : null}
            </View>
            <Text style={styles.logStats}>
              {[formatMiles(log.distance_miles), formatDuration(log.duration_seconds)]
                .filter(Boolean)
                .join(' · ') || 'Marked done'}
            </Text>
            {log.notes ? <Text style={styles.logNotes}>{log.notes}</Text> : null}
            {log.logged_by && log.logged_by !== athlete.id ? (
              <Text style={styles.logBy}>
                Entered by {loggedByNames[log.logged_by] ?? 'a parent'}
              </Text>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  identityText: { flex: 1, gap: spacing.sm },
  name: { ...type.title, color: colors.text },
  call: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  callText: { ...type.bodyStrong, color: colors.primary },
  pressed: { opacity: 0.7 },
  edit: { ...type.label, color: colors.primary },
  guardianName: { ...type.bodyStrong, color: colors.text },
  planName: { ...type.heading, color: colors.text },
  meta: { ...type.caption, color: colors.textMuted, marginTop: spacing.xs },
  logHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logDate: { ...type.bodyStrong, color: colors.text },
  logStats: { ...type.body, color: colors.primary, marginTop: spacing.xs },
  logNotes: { ...type.body, color: colors.textMuted, marginTop: spacing.xs },
  logBy: { ...type.caption, color: colors.textFaint, marginTop: spacing.sm, fontStyle: 'italic' },
});
