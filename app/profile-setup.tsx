import { useEffect, useRef, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { AthleteProfileForm } from '../components/AthleteProfileForm';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ChipSelect, TextField } from '../components/Field';
import { FullScreenLoader, LoadingState, Screen } from '../components/Screen';
import { useAuth } from '../lib/auth';
import { firstName } from '../lib/format';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { isAthlete, isParent } from '../lib/types';
import { radius, spacing, type, type Palette } from '../lib/theme';
import { useTheme, useThemedStyles } from '../lib/appearance';

type Waiting = { family_id: string; runner_name: string };
type HasPhone = 'yes' | 'no';

const PHONE_OPTIONS = [
  { value: 'yes' as const, label: 'Yes' },
  { value: 'no' as const, label: 'No' },
];

/**
 * The first screen after a code is redeemed. An athlete fills in the full intake
 * form. A parent gives their own details and answers one question: does their
 * runner have a phone?
 *
 *   - Yes: nothing more here. The runner signs in with their own athlete code
 *     and appears on the parent's Profile tab.
 *   - No: the runner's profile appears on this same screen, name filled in from
 *     the codes, and Finish sets the runner up (set_up_runner) and saves it all.
 *
 * Asked here because it is the one moment every parent passes through; the
 * Profile tab keeps a "Runner without a phone?" card only as a fallback.
 */
export default function ProfileSetup() {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  const { profile, role, loading, profileLoaded, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The runner this parent's code came with, if they have no account yet.
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [waitingLoaded, setWaitingLoaded] = useState(false);
  const [hasPhone, setHasPhone] = useState<HasPhone | null>(null);
  const [runnerName, setRunnerName] = useState('');
  const [runnerError, setRunnerError] = useState<string | null>(null);
  // Set once the runner exists, so a retry after a failed save reuses them
  // rather than trying to set the same runner up twice.
  const createdRunner = useRef<string | null>(null);

  const parent = isParent(role);
  const profileId = profile?.id;

  useEffect(() => {
    if (!parent || !profileId) return;
    if (!isSupabaseConfigured) {
      setWaitingLoaded(true);
      return;
    }
    let live = true;
    void supabase.rpc('my_runners_to_set_up').then(({ data }) => {
      if (!live) return;
      const first = ((data as Waiting[] | null) ?? [])[0] ?? null;
      setWaiting(first);
      setRunnerName(first?.runner_name ?? '');
      setWaitingLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [parent, profileId]);

  if (loading || !profileLoaded) return <FullScreenLoader />;
  if (!profile) return <Redirect href="/onboarding" />;

  async function finish() {
    if (!profile) return;
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: name.trim(),
        phone: phone.trim() || null,
        onboarded_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    await refreshProfile();
    setSaving(false);
    router.replace('/(tabs)');
  }

  const athlete = isAthlete(role);

  return (
    <Screen
      title={athlete ? 'Set up your profile' : 'Tell us about you'}
      subtitle={
        athlete
          ? 'Your coaches use this to plan your training and to know who to call. You can change any of it later.'
          : 'Your details, and one question about your runner. Then you’re in.'
      }
      avoidKeyboard
    >
      <View style={styles.welcome}>
        <View style={styles.welcomeIcon}>
          <Ionicons name="checkmark-circle" size={20} color={c.success} />
        </View>
        <Text style={styles.welcomeText}>
          Code accepted{firstName(profile.full_name) ? `, ${firstName(profile.full_name)}` : ''}.
          You are in.
        </Text>
      </View>

      <Card>
        <Text style={styles.cardTitle}>Your details</Text>
        <View style={styles.fields}>
          <TextField
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Sam Runner"
            required
            textContentType="name"
            autoCapitalize="words"
          />
          <TextField
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder="(205) 555-0134"
            hint={
              athlete
                ? 'Optional. Used only for practice-day changes.'
                : 'How the coaches reach you about your athlete.'
            }
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
          />
        </View>
      </Card>

      {athlete ? (
        <AthleteProfileForm
          athleteId={profile.id}
          athleteName={name || profile.full_name}
          submitLabel="Finish and enter the app"
          onSaved={finish}
        />
      ) : !waitingLoaded ? (
        <LoadingState />
      ) : waiting ? (
        <>
          <Card accent="primary">
            <Text style={styles.cardTitle}>Your runner</Text>
            <View style={styles.fields}>
              <ChipSelect
                label={`Does ${firstName(waiting.runner_name) || 'your runner'} have their own phone?`}
                options={PHONE_OPTIONS}
                value={hasPhone}
                onChange={setHasPhone}
                hint={
                  hasPhone === 'yes'
                    ? 'They sign in on their phone with their own athlete code, and appear on your Profile tab.'
                    : hasPhone === 'no'
                      ? 'Set them up below. You’ll see their training and log their runs, and the coaches see them like any other runner.'
                      : undefined
                }
              />
            </View>
          </Card>

          {hasPhone === 'no' ? (
            <>
              <Card>
                <Text style={styles.cardTitle}>Runner’s details</Text>
                <View style={styles.fields}>
                  <TextField
                    label="Runner’s full name"
                    value={runnerName}
                    onChangeText={(next) => {
                      setRunnerName(next);
                      if (runnerError) setRunnerError(null);
                    }}
                    placeholder="Sam Runner"
                    required
                    autoCapitalize="words"
                    maxLength={80}
                    error={runnerError}
                  />
                </View>
              </Card>
              <AthleteProfileForm
                athleteId={createdRunner.current}
                athleteName={runnerName || waiting.runner_name}
                submitLabel="Finish and enter the app"
                beforeSave={async () => {
                  if (!name.trim()) {
                    setError('Please enter your name.');
                    return false;
                  }
                  if (!runnerName.trim()) {
                    setRunnerError('Enter your runner’s name.');
                    return false;
                  }
                  return true;
                }}
                createAthlete={async () => {
                  if (createdRunner.current) return createdRunner.current;
                  const { data, error: rpcError } = await supabase.rpc('set_up_runner', {
                    p_family: waiting.family_id,
                    p_name: runnerName,
                  });
                  if (rpcError || !data) {
                    setRunnerError(rpcError?.message ?? 'Could not set up your runner.');
                    return null;
                  }
                  createdRunner.current = data as string;
                  return createdRunner.current;
                }}
                onSaved={finish}
              />
            </>
          ) : (
            <Button
              label="Enter the app"
              size="lg"
              full
              loading={saving}
              disabled={hasPhone === null}
              onPress={finish}
            />
          )}
        </>
      ) : (
        <>
          <Card accent="primary">
            <Text style={styles.cardTitle}>Your athlete</Text>
            <Text style={styles.cardHint}>
              Your runner appears on your Profile tab once they are linked. The Profile tab is
              also where you fill in their school, goals, and emergency contact.
            </Text>
          </Card>
          <Button
            label="Enter the app"
            size="lg"
            full
            loading={saving}
            onPress={finish}
          />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  welcome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.successTint,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  welcomeIcon: { alignItems: 'center', justifyContent: 'center' },
  welcomeText: { ...type.bodyStrong, color: c.success, flex: 1 },
  cardTitle: { ...type.heading, color: c.text },
  cardHint: { ...type.caption, color: c.textMuted, marginTop: spacing.xs, lineHeight: 17 },
  fields: { gap: spacing.lg, marginTop: spacing.lg },
  error: { ...type.body, color: c.danger },
});
