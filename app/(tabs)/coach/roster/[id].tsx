import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { AthleteSummary } from '../../../../components/AthleteSummary';
import {
  AthleteTrainingWeeks,
  type RosterAssignment,
} from '../../../../components/AthleteTrainingWeeks';
import { Avatar } from '../../../../components/Avatar';
import { Badge } from '../../../../components/Badge';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { EmptyState, LoadingState, Screen, SectionHeader } from '../../../../components/Screen';
import { confirmDestructive } from '../../../../lib/confirm';
import { roleLabel } from '../../../../lib/format';
import { isSupabaseConfigured, supabase } from '../../../../lib/supabase';
import { PROFILE_COLUMNS, type AppRole, type Profile } from '../../../../lib/types';
import { spacing, type, type Palette } from '../../../../lib/theme';
import { useTheme, useThemedStyles } from '../../../../lib/appearance';

type AssignmentRow = {
  plan_id: string;
  starts_on: string;
  pace_group: number | null;
  // A many-to-one embed, which PostgREST returns as an object; read an array
  // too rather than trust the inference.
  training_plans: { name: string } | { name: string }[] | null;
};

export default function AthleteDetail() {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const { id } = useLocalSearchParams<{ id: string }>();
  const [athlete, setAthlete] = useState<Profile | null>(null);
  const [guardians, setGuardians] = useState<Profile[]>([]);
  const [assignment, setAssignment] = useState<RosterAssignment | null>(null);
  /** Bumped on pull-to-refresh so the training section reloads with the rest. */
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [{ data: row }, { data: links }, { data: assigned }] = await Promise.all([
      supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle(),
      supabase.from('guardian_links').select('guardian_id').eq('athlete_id', id),
      supabase
        .from('plan_assignments')
        .select('plan_id, starts_on, pace_group, training_plans(name)')
        .eq('athlete_id', id)
        .order('starts_on', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setAthlete((row as Profile | null) ?? null);

    const current = assigned as AssignmentRow | null;
    const plan = Array.isArray(current?.training_plans)
      ? current?.training_plans[0]
      : current?.training_plans;
    setAssignment(
      current && plan
        ? {
            plan_id: current.plan_id,
            starts_on: current.starts_on,
            pace_group: current.pace_group,
            name: plan.name,
          }
        : null
    );
    setRefreshKey((key) => key + 1);

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

  async function removeFromClinic() {
    if (!athlete) return;
    setRemoveError(null);

    // Asked of the database rather than worked out here, so the names in the
    // confirmation are exactly the people the removal will take.
    const { data: preview, error: previewError } = await supabase.rpc('remove_from_clinic', {
      p_athlete: athlete.id,
      p_dry_run: true,
    });
    if (previewError) {
      setRemoveError(previewError.message);
      return;
    }

    const people = (preview as { person_name: string; person_role: AppRole }[] | null) ?? [];
    const parents = people.filter((person) => person.person_role === 'parent').map((p) => p.person_name);

    const confirmed = await confirmDestructive(
      `Remove ${athlete.full_name}?`,
      [
        `${athlete.full_name} loses access to the app, and their intake form, training logs and bookings are deleted.`,
        parents.length > 0
          ? `${parents.join(' and ')} ${parents.length === 1 ? 'is' : 'are'} removed too, with no other athlete in the clinic.`
          : null,
        'This cannot be undone. Coming back would take a new code.',
      ]
        .filter(Boolean)
        .join('\n\n'),
      'Remove'
    );
    if (!confirmed) return;

    setRemoving(true);
    const { error } = await supabase.rpc('remove_from_clinic', { p_athlete: athlete.id });
    setRemoving(false);
    if (error) {
      setRemoveError(error.message);
      return;
    }
    router.back();
  }

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
            <Ionicons name="call" size={16} color={c.primary} />
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
                <Ionicons name="call" size={16} color={c.primary} />
                <Text style={styles.callText}>{guardian.phone}</Text>
              </Pressable>
            ) : null}
          </Card>
        ))
      )}

      <AthleteTrainingWeeks athleteId={athlete.id} assignment={assignment} refreshKey={refreshKey} />

      <View style={styles.remove}>
        <Button
          label="Remove from clinic"
          variant="danger"
          icon="person-remove-outline"
          loading={removing}
          onPress={() => void removeFromClinic()}
          full
        />
        <Text style={styles.removeNote}>
          For an athlete who has left, or a test account. You will see exactly who is removed before
          anything happens.
        </Text>
        {removeError ? <Text style={styles.removeError}>{removeError}</Text> : null}
      </View>
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  identityText: { flex: 1, gap: spacing.sm },
  name: { ...type.title, color: c.text },
  call: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  callText: { ...type.bodyStrong, color: c.primary },
  pressed: { opacity: 0.7 },
  edit: { ...type.label, color: c.primary },
  guardianName: { ...type.bodyStrong, color: c.text },
  remove: { marginTop: spacing.xxl, gap: spacing.sm },
  removeNote: { ...type.caption, color: c.textMuted, textAlign: 'center' },
  removeError: { ...type.caption, color: c.danger, textAlign: 'center' },
});
