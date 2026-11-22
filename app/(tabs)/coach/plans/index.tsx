import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../../components/Button';
import { Card, ListRow } from '../../../../components/Card';
import { ChipSelect, TextField } from '../../../../components/Field';
import { EmptyState, LoadingState, Screen, SectionHeader } from '../../../../components/Screen';
import { useAuth } from '../../../../lib/auth';
import { nextWeekStatus, type NextWeekStatus } from '../../../../lib/planStatus';
import { isSupabaseConfigured, supabase } from '../../../../lib/supabase';
import { AUDIENCE_LABELS,
  TRAINING_PLAN_COLUMNS,
  type Audience,
  type TrainingPlan,
} from '../../../../lib/types';
import { spacing, type, type Palette } from '../../../../lib/theme';
import { useTheme, useThemedStyles } from '../../../../lib/appearance';

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: 'clinic', label: AUDIENCE_LABELS.clinic },
  { value: 'private', label: AUDIENCE_LABELS.private },
  { value: 'everyone', label: AUDIENCE_LABELS.everyone },
];

type PlanRow = TrainingPlan & {
  starts_on: string | null;
  workouts: { week_number: number; day_of_week: number }[];
  plan_assignments: { count: number }[];
};

/** "Next week ready", "Next week not written", "Next week: 5 of 7 days", and how it looks. */
function describe(status: NextWeekStatus): { text: string; tone: 'ready' | 'partial' | 'empty' | 'none' } {
  if (status.kind === 'no-start') return { text: 'No start date yet', tone: 'none' };
  if (status.kind === 'later') return { text: 'Starts after next week', tone: 'none' };
  if (status.state === 'ready') return { text: 'Next week ready', tone: 'ready' };
  if (status.state === 'empty') return { text: 'Next week not written', tone: 'empty' };
  return { text: `Next week: ${status.filled} of 7 days`, tone: 'partial' };
}

export default function CoachPlans() {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

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
      .select(`${TRAINING_PLAN_COLUMNS}, starts_on, workouts(week_number, day_of_week), plan_assignments(count)`)
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

  // Only plans someone is on: an unassigned plan has nobody waiting on next week.
  const statuses = plans.map((plan) => ({
    plan,
    assigned: plan.plan_assignments[0]?.count ?? 0,
    status: describe(nextWeekStatus(plan.starts_on, plan.workouts)),
  }));
  const active = statuses.filter((row) => row.assigned > 0 && row.status.tone !== 'none');
  const needWork = active.filter((row) => row.status.tone !== 'ready').length;

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
      {active.length > 0 ? (
        <Text style={[styles.summary, needWork > 0 ? styles.summaryWarn : styles.summaryOk]}>
          {needWork === 0
            ? 'Next week is written for every plan with runners on it.'
            : `${needWork} ${needWork === 1 ? 'plan needs' : 'plans need'} next week written.`}
        </Text>
      ) : null}

      {loading ? (
        <LoadingState />
      ) : plans.length === 0 ? (
        <EmptyState icon="barbell-outline" message="No plans yet. Create one above." />
      ) : (
        statuses.map(({ plan, assigned, status }) => {
          const showStatus = assigned > 0;
          return (
            <ListRow
              key={plan.id}
              icon="barbell"
              title={plan.name}
              subtitle={
                showStatus
                  ? `${status.text} · ${assigned} assigned`
                  : `${plan.workouts.length} workouts · nobody assigned`
              }
              onPress={() => router.push(`/(tabs)/coach/plans/${plan.id}`)}
              right={
                showStatus && status.tone !== 'none' ? (
                  <Ionicons
                    accessibilityLabel={
                      status.tone === 'ready'
                        ? 'Next week written'
                        : status.tone === 'empty'
                          ? 'Next week not written'
                          : 'Next week partly written'
                    }
                    name={
                      status.tone === 'ready'
                        ? 'checkmark-circle'
                        : status.tone === 'empty'
                          ? 'close-circle'
                          : 'ellipse-outline'
                    }
                    size={30}
                    color={
                      status.tone === 'ready' ? c.success : status.tone === 'empty' ? c.danger : c.warning
                    }
                  />
                ) : undefined
              }
            />
          );
        })
      )}
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  cardTitle: { ...type.heading, color: c.text },
  fields: { gap: spacing.lg, marginTop: spacing.lg },
  submit: { marginTop: spacing.lg },
  error: { ...type.caption, color: c.danger, marginTop: spacing.md },
  summary: { ...type.bodyStrong, marginTop: -spacing.sm },
  summaryOk: { color: c.success },
  summaryWarn: { color: c.danger },
});
