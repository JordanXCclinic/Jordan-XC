import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { EmptyState, LoadingState } from './Screen';
import { formatDuration } from '../lib/format';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { PERSONAL_BEST_COLUMNS,
  PB_EVENTS,
  type AthleteProfile,
  type PersonalBest,
} from '../lib/types';
import { radius, spacing, type, type Palette } from '../lib/theme';
import { useTheme, useThemedStyles } from '../lib/appearance';

/**
 * Read-only view of an athlete's intake form. Shared by the Profile tab and the
 * coach's roster so the coach is never looking at a staler layout than the
 * family is.
 */
export function AthleteSummary({
  athleteId,
  onFill,
  fillLabel = 'Fill in the profile',
}: {
  athleteId: string;
  /**
   * Offered when nothing is filled in yet, so an empty profile is a button
   * rather than a dead end. Left out on the coach's roster, which only reads.
   */
  onFill?: () => void;
  fillLabel?: string;
}) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [bests, setBests] = useState<PersonalBest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // Read through the function rather than the table: it applies the same
    // can_view_athlete() check and writes an audit_log row when the reader is
    // staff, which is how a coach opening a minor's health record gets recorded.
    const [{ data: row }, { data: pbRows }] = await Promise.all([
      supabase.rpc('staff_view_athlete_profile', { p_athlete: athleteId }),
      supabase.from('personal_bests').select(PERSONAL_BEST_COLUMNS).eq('athlete_id', athleteId),
    ]);
    setProfile((row as AthleteProfile | null) ?? null);
    setBests((pbRows as PersonalBest[] | null) ?? []);
    setLoading(false);
  }, [athleteId]);

  // On focus, not just on mount: coming back from the form should show what
  // was just saved.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading) return <LoadingState />;

  if (!profile && bests.length === 0) {
    if (onFill) {
      return (
        <Card accent="primary">
          <View style={styles.privateHead}>
            <Ionicons name="clipboard-outline" size={16} color={c.primary} />
            <Text style={styles.cardTitle}>Not filled in yet</Text>
          </View>
          <Text style={styles.body}>
            School, grade, goals, best times, and an emergency contact. It takes a couple of
            minutes, and the coaches use it to plan training.
          </Text>
          <Button label={fillLabel} icon="create-outline" full onPress={onFill} style={styles.fillButton} />
        </Card>
      );
    }
    return (
      <EmptyState
        icon="clipboard-outline"
        message="This profile has not been filled in yet."
      />
    );
  }

  // Keep the events in race order rather than whatever order they came back in.
  const ordered = [...bests].sort(
    (a, b) => PB_EVENTS.indexOf(a.event as never) - PB_EVENTS.indexOf(b.event as never)
  );

  return (
    <>
      {profile?.school || profile?.grade ? (
        <Card>
          <Text style={styles.cardTitle}>School</Text>
          <View style={styles.facts}>
            {profile.school ? <Fact label="School" value={profile.school} /> : null}
            {profile.grade ? <Fact label="Grade" value={profile.grade} /> : null}
          </View>
        </Card>
      ) : null}

      {ordered.length > 0 ? (
        <Card>
          <Text style={styles.cardTitle}>Personal bests</Text>
          <View style={styles.pbGrid}>
            {ordered.map((best) => (
              <View key={best.id} style={styles.pb}>
                <Text style={styles.pbEvent}>{best.event}</Text>
                <Text style={styles.pbTime}>{formatDuration(best.result_seconds)}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {profile?.goals ? (
        <Card>
          <Text style={styles.cardTitle}>Goals</Text>
          <Text style={styles.body}>{profile.goals}</Text>
        </Card>
      ) : null}

      {profile?.emergency_contact_name ? (
        <Card accent="primary">
          <View style={styles.privateHead}>
            <Ionicons name="lock-closed" size={15} color={c.primary} />
            <Text style={styles.cardTitle}>Emergency contact</Text>
          </View>
          <Text style={styles.contactName}>{profile.emergency_contact_name}</Text>
          {profile.emergency_contact_relationship ? (
            <Text style={styles.contactMeta}>{profile.emergency_contact_relationship}</Text>
          ) : null}
          {profile.emergency_contact_phone ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Call ${profile.emergency_contact_name}`}
              onPress={() => void Linking.openURL(`tel:${profile.emergency_contact_phone}`)}
              style={({ pressed }) => [styles.call, pressed && styles.pressed]}
            >
              <Ionicons name="call" size={16} color={c.primary} />
              <Text style={styles.callText}>{profile.emergency_contact_phone}</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  fillButton: { marginTop: spacing.lg },
  cardTitle: { ...type.heading, color: c.text },
  body: { ...type.body, color: c.textMuted },
  facts: { gap: spacing.md, marginTop: spacing.md },
  fact: { gap: 2 },
  factLabel: { ...type.caption, color: c.textFaint },
  factValue: { ...type.body, color: c.text },
  pbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  pb: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minWidth: 92,
    gap: 2,
  },
  pbEvent: { ...type.caption, color: c.textFaint },
  pbTime: { ...type.heading, color: c.primary },
  privateHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  block: { marginTop: spacing.md, gap: 2 },
  blockLabel: { ...type.caption, color: c.textFaint },
  contactName: { ...type.bodyStrong, color: c.text, marginTop: spacing.sm },
  contactMeta: { ...type.caption, color: c.textMuted },
  call: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  pressed: { opacity: 0.7 },
  callText: { ...type.bodyStrong, color: c.primary },
});
