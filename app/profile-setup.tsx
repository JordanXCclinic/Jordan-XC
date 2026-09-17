import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { AthleteProfileForm } from '../components/AthleteProfileForm';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { TextField } from '../components/Field';
import { FullScreenLoader, Screen } from '../components/Screen';
import { useAuth } from '../lib/auth';
import { firstName } from '../lib/format';
import { supabase } from '../lib/supabase';
import { isAthlete } from '../lib/types';
import { colors, radius, spacing, type } from '../lib/theme';

/**
 * The first screen after a code is redeemed. An athlete fills in the full intake
 * form; a parent gives their own details and fills their runner's in afterwards,
 * which keeps this screen short for whoever signs in on the drive home.
 */
export default function ProfileSetup() {
  const { profile, role, loading, profileLoaded, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
          : 'Then you can fill in your athlete’s profile and see everything they see.'
      }
      avoidKeyboard
    >
      <View style={styles.welcome}>
        <View style={styles.welcomeIcon}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
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
      ) : (
        <>
          <Card accent="primary">
            <Text style={styles.cardTitle}>Your athlete</Text>
            <Text style={styles.cardHint}>
              Your parent code links you to your runner automatically. Once you are in, open
              the Profile tab to fill in their school, goals, and emergency contact.
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

const styles = StyleSheet.create({
  welcome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.successTint,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  welcomeIcon: { alignItems: 'center', justifyContent: 'center' },
  welcomeText: { ...type.bodyStrong, color: colors.success, flex: 1 },
  cardTitle: { ...type.heading, color: colors.text },
  cardHint: { ...type.caption, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 17 },
  fields: { gap: spacing.lg, marginTop: spacing.lg },
  error: { ...type.body, color: colors.danger },
});
