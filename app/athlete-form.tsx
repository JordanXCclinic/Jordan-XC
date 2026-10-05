import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AthleteProfileForm } from '../components/AthleteProfileForm';
import { Card } from '../components/Card';
import { TextField } from '../components/Field';
import { EmptyState, Screen } from '../components/Screen';
import { useAthlete } from '../lib/athlete';
import { useAuth } from '../lib/auth';
import { useThemedStyles } from '../lib/appearance';
import { firstName } from '../lib/format';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { isParent } from '../lib/types';
import { spacing, type, type Palette } from '../lib/theme';

/**
 * An athlete's intake form. Reached by the athlete from their own profile, by
 * a parent for the runner they guard, and by a coach from the roster — the
 * `id` parameter says which, and RLS decides whether it works.
 *
 * For a runner without a phone, whose parent set them up, this is also where
 * the parent fills in the profile the runner would have filled in themselves
 * at first sign-in, their name included. `setup` marks that first visit,
 * straight after "Set up … without a phone".
 */
export default function AthleteForm() {
  const styles = useThemedStyles(makeStyles);
  const { id, name, setup } = useLocalSearchParams<{ id?: string; name?: string; setup?: string }>();
  const { profile, role } = useAuth();
  const { activeAthlete, refresh } = useAthlete();

  const athleteId = id ?? activeAthlete?.id ?? profile?.id;
  const [runnerName, setRunnerName] = useState(
    name ?? activeAthlete?.full_name ?? profile?.full_name ?? ''
  );
  const [managed, setManaged] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Read the runner's own row for their current name and whether a parent
  // manages them. A parent can read their runner's profile through
  // can_view_athlete(); anyone else gets nothing back and keeps the defaults.
  useEffect(() => {
    if (!isSupabaseConfigured || !athleteId) return;
    let live = true;
    void supabase
      .from('profiles')
      .select('full_name, managed')
      .eq('id', athleteId)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { full_name: string; managed: boolean } | null;
        if (!live || !row) return;
        setRunnerName(row.full_name);
        setManaged(Boolean(row.managed));
      });
    return () => {
      live = false;
    };
  }, [athleteId]);

  if (!athleteId) {
    return (
      <Screen inStack>
        <EmptyState
          icon="person-outline"
          message="No athlete is linked to this account yet. Set up a runner without a phone from the Profile tab, or wait for your runner to sign in with their own code."
        />
      </Screen>
    );
  }

  // Only the parent of a runner without a phone edits the name here. Anyone
  // else's name is theirs to change, and the database enforces the same rule.
  const editsName = managed && isParent(role);
  const first = firstName(runnerName) || 'your runner';
  const firstVisit = setup === '1';

  async function saveName(): Promise<boolean> {
    if (!editsName || !athleteId) return true;
    if (!runnerName.trim()) {
      setNameError('Enter your runner’s name.');
      return false;
    }
    setNameError(null);
    const { error } = await supabase.rpc('update_managed_runner', {
      p_athlete: athleteId,
      p_name: runnerName,
    });
    if (error) {
      setNameError(error.message);
      return false;
    }
    return true;
  }

  return (
    <Screen
      inStack
      title={firstVisit ? `Tell us about ${first}` : runnerName || 'Athlete profile'}
      subtitle={
        firstVisit
          ? 'The coaches use this to plan their training and to know who to call. You can change any of it later.'
          : 'School, goals, best times, and emergency contact.'
      }
      avoidKeyboard
    >
      {editsName ? (
        <Card>
          <Text style={styles.cardTitle}>Runner’s details</Text>
          <View style={styles.fields}>
            <TextField
              label="Full name"
              value={runnerName}
              onChangeText={(next) => {
                setRunnerName(next);
                if (nameError) setNameError(null);
              }}
              placeholder="Sam Runner"
              required
              autoCapitalize="words"
              maxLength={80}
              error={nameError}
              hint="As the coaches should see it on the roster."
            />
          </View>
        </Card>
      ) : null}

      <AthleteProfileForm
        athleteId={athleteId}
        athleteName={runnerName || 'this athlete'}
        submitLabel={firstVisit ? `Save ${first}’s profile` : 'Save changes'}
        beforeSave={saveName}
        onSaved={() => {
          // The name may have changed: the Profile tab and switcher read it
          // from the athlete list.
          void refresh();
          router.back();
        }}
      />
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    cardTitle: { ...type.heading, color: c.text },
    fields: { gap: spacing.lg, marginTop: spacing.lg },
  });
