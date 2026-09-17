import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../../components/Button';
import { Card, ListRow } from '../../../../components/Card';
import { ChipSelect, TextField } from '../../../../components/Field';
import { EmptyState, LoadingState, Screen, SectionHeader } from '../../../../components/Screen';
import { useAuth } from '../../../../lib/auth';
import { isSupabaseConfigured, supabase } from '../../../../lib/supabase';
import {
  AUDIENCE_LABELS,
  TRAINING_PLAN_COLUMNS,
  type Audience,
  type TrainingPlan,
} from '../../../../lib/types';
import { colors, spacing, type } from '../../../../lib/theme';

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: 'clinic', label: AUDIENCE_LABELS.clinic },
  { value: 'private', label: AUDIENCE_LABELS.private },
  { value: 'everyone', label: AUDIENCE_LABELS.everyone },
];

type PlanRow = TrainingPlan & { workouts: { count: number }[]; plan_assignments: { count: number }[] };

export default function CoachPlans() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState<Audience>('clinic');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // The embedded counts save two round trips per plan on this list.
    const { data } = await supabase
      .from('training_plans')
      .select(`${TRAINING_PLAN_COLUMNS}, workouts(count), plan_assignments(count)`)
      .order('created_at', { ascending: false })
      .limit(40);
    setPlans((data as PlanRow[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!profile) return;
    if (!name.trim()) {
      setError('Give the plan a name.');
      return;
    }

    setSaving(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from('training_plans')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        audience,
        created_by: profile.id,
      })
      .select('id')
      .single();

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setName('');
    setDescription('');
    // Straight into the new plan: the next thing to do is write week one.
    if (data?.id) router.push(`/(tabs)/coach/plans/${data.id}`);
  }

  return (
    <Screen
      inStack
      title="Training plans"
      subtitle="Write a plan once, then assign it to the athletes it fits."
      onRefresh={load}
      avoidKeyboard
    >
      <Card accent="primary">
        <Text style={styles.cardTitle}>New plan</Text>
        <View style={styles.fields}>
          <TextField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Summer base — high school"
            required
          />
          <TextField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Eight weeks of aerobic base with two quality days a week."
            multiline
          />
          <ChipSelect label="Who it is for" options={AUDIENCES} value={audience} onChange={setAudience} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Create plan" full loading={saving} onPress={create} style={styles.submit} />
      </Card>

      <SectionHeader title="Plans" />

      {loading ? (
        <LoadingState />
      ) : plans.length === 0 ? (
        <EmptyState icon="barbell-outline" message="No plans yet. Create one above." />
      ) : (
        plans.map((plan) => (
          <ListRow
            key={plan.id}
            icon="barbell"
            title={plan.name}
            subtitle={`${plan.workouts[0]?.count ?? 0} workouts · ${
              plan.plan_assignments[0]?.count ?? 0
            } assigned`}
            onPress={() => router.push(`/(tabs)/coach/plans/${plan.id}`)}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { ...type.heading, color: colors.text },
  fields: { gap: spacing.lg, marginTop: spacing.lg },
  submit: { marginTop: spacing.lg },
  error: { ...type.caption, color: colors.danger, marginTop: spacing.md },
});
