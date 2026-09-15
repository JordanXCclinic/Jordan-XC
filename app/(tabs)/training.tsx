import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EmptyState, Screen } from '../../components/Screen';
import { useAuth } from '../../lib/auth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { colors, radius, spacing } from '../../lib/theme';
import type { Workout } from '../../lib/types';

const DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type AssignedPlan = { id: string; name: string; description: string | null };

export default function Training() {
  const { session, role } = useAuth();
  const [plan, setPlan] = useState<AssignedPlan | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user) return;

    supabase
      .from('plan_assignments')
      .select('training_plans(id, name, description)')
      .eq('athlete_id', session.user.id)
      .limit(1)
      .single()
      .then(({ data }) => {
        const assigned = (data as { training_plans: AssignedPlan } | null)?.training_plans ?? null;
        setPlan(assigned);
        if (!assigned) return;
        supabase
          .from('workouts')
          .select('id, plan_id, week_number, day_of_week, title, description, distance_miles, intensity')
          .eq('plan_id', assigned.id)
          .order('week_number', { ascending: true })
          .order('day_of_week', { ascending: true })
          .then(({ data: rows }) => setWorkouts((rows as Workout[]) ?? []));
      });
  }, [session?.user?.id]);

  const subtitle =
    role === 'private_client' ? 'Your one-on-one plan' : 'Your clinic training plan';

  return (
    <Screen title="Training" subtitle={subtitle}>
      {!plan ? (
        <EmptyState message="No plan assigned yet. Your coach will assign one before the season starts." />
      ) : (
        <>
          <Text style={styles.planName}>{plan.name}</Text>
          {plan.description ? <Text style={styles.planDesc}>{plan.description}</Text> : null}
          {workouts.map((workout) => (
            <View key={workout.id} style={styles.card}>
              <Text style={styles.day}>
                Week {workout.week_number} · {DAYS[workout.day_of_week]}
              </Text>
              <Text style={styles.title}>{workout.title}</Text>
              {workout.distance_miles ? (
                <Text style={styles.detail}>{workout.distance_miles} mi</Text>
              ) : null}
              {workout.description ? (
                <Text style={styles.detail}>{workout.description}</Text>
              ) : null}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  planName: { fontSize: 20, fontWeight: '700', color: colors.text },
  planDesc: { fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  day: { fontSize: 13, fontWeight: '600', color: colors.primary },
  title: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: spacing.xs },
  detail: { fontSize: 15, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 21 },
});
