import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Card } from './Card';
import { ChipSelect, TextField } from './Field';
import { LoadingState } from './Screen';
import { useAuth } from '../lib/auth';
import { firstName, formatDuration, parseDuration } from '../lib/format';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { ATHLETE_PROFILE_COLUMNS,
  GRADES,
  PB_EVENTS,
  PERSONAL_BEST_COLUMNS,
  type AthleteProfile,
  type PersonalBest,
} from '../lib/types';
import { spacing, type, type Palette } from '../lib/theme';
import { useTheme, useThemedStyles } from '../lib/appearance';

type Props = {
  athleteId: string;
  /** Shown in the header so a parent can see which runner they are editing. */
  athleteName: string;
  submitLabel: string;
  onSaved: () => void;
};

type Draft = {
  school: string;
  grade: string | null;
  goals: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
};

const EMPTY: Draft = {
  school: '',
  grade: null,
  goals: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relationship: '',
};

const GRADE_OPTIONS = GRADES.map((grade) => ({ value: grade, label: grade }));

/**
 * The intake form, used both at first sign-in and whenever it needs updating.
 * One component so an athlete and their parent always see the same fields, and
 * so an edit later cannot drift from what was collected at setup.
 */
export function AthleteProfileForm({ athleteId, athleteName, submitLabel, onSaved }: Props) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  const { profile } = useAuth();
  // The same form is filled in by the athlete, a parent, and a coach, so it
  // addresses whoever is actually holding the phone.
  const self = profile?.id === athleteId;
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [times, setTimes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeErrors, setTimeErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [{ data: profileRow }, { data: bests }] = await Promise.all([
      supabase
        .from('athlete_profiles')
        .select(ATHLETE_PROFILE_COLUMNS)
        .eq('athlete_id', athleteId)
        .maybeSingle(),
      supabase.from('personal_bests').select(PERSONAL_BEST_COLUMNS).eq('athlete_id', athleteId),
    ]);

    const existing = profileRow as AthleteProfile | null;
    if (existing) {
      setDraft({
        school: existing.school ?? '',
        grade: existing.grade,
        goals: existing.goals ?? '',
        emergency_contact_name: existing.emergency_contact_name ?? '',
        emergency_contact_phone: existing.emergency_contact_phone ?? '',
        emergency_contact_relationship: existing.emergency_contact_relationship ?? '',
      });
    }

    const filled: Record<string, string> = {};
    for (const best of (bests as PersonalBest[] | null) ?? []) {
      filled[best.event] = formatDuration(best.result_seconds) ?? '';
    }
    setTimes(filled);
    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function onSave() {
    // Validate every time before writing anything, so a typo in one event does
    // not save half a form.
    const parsed: { event: string; seconds: number }[] = [];
    const problems: Record<string, string> = {};

    for (const event of PB_EVENTS) {
      const raw = times[event]?.trim();
      if (!raw) continue;
      const seconds = parseDuration(raw);
      if (seconds === null) problems[event] = 'Use mm:ss, like 18:23';
      else parsed.push({ event, seconds });
    }

    setTimeErrors(problems);
    if (Object.keys(problems).length > 0) {
      setError('Check the times highlighted below.');
      return;
    }

    setSaving(true);
    setError(null);

    const { error: profileError } = await supabase.from('athlete_profiles').upsert(
      {
        athlete_id: athleteId,
        school: draft.school.trim() || null,
        grade: draft.grade,
        goals: draft.goals.trim() || null,
        emergency_contact_name: draft.emergency_contact_name.trim() || null,
        emergency_contact_phone: draft.emergency_contact_phone.trim() || null,
        emergency_contact_relationship: draft.emergency_contact_relationship.trim() || null,
      },
      { onConflict: 'athlete_id' }
    );

    if (profileError) {
      setSaving(false);
      setError(profileError.message);
      return;
    }

    if (parsed.length > 0) {
      const { error: bestsError } = await supabase.from('personal_bests').upsert(
        parsed.map((best) => ({
          athlete_id: athleteId,
          event: best.event,
          result_seconds: best.seconds,
        })),
        { onConflict: 'athlete_id,event' }
      );
      if (bestsError) {
        setSaving(false);
        setError(bestsError.message);
        return;
      }
    }

    // A time cleared in the form should disappear from the athlete's card.
    const cleared = PB_EVENTS.filter((event) => !times[event]?.trim());
    if (cleared.length > 0) {
      await supabase
        .from('personal_bests')
        .delete()
        .eq('athlete_id', athleteId)
        .in('event', cleared);
    }

    setSaving(false);
    onSaved();
  }

  if (loading) return <LoadingState label="Loading profile" />;

  return (
    <>
      <Card>
        <Text style={styles.cardTitle}>School</Text>
        <View style={styles.fields}>
          <TextField
            label="School"
            value={draft.school}
            onChangeText={(next) => set('school', next)}
            placeholder="Mountain Brook High School"
          />
          <ChipSelect
            label="Grade this fall"
            options={GRADE_OPTIONS}
            value={draft.grade}
            onChange={(next) => set('grade', next)}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Personal bests</Text>
        <Text style={styles.cardHint}>
          {self
            ? 'Anything you have run. Leave the rest blank \u2014 you can add them as the season goes.'
            : `Anything ${firstName(athleteName)} has run. Leave the rest blank \u2014 they can be added as the season goes.`}
        </Text>
        <View style={styles.fields}>
          {PB_EVENTS.map((event) => (
            <TextField
              key={event}
              label={event}
              value={times[event] ?? ''}
              onChangeText={(next) => setTimes((current) => ({ ...current, [event]: next }))}
              placeholder="18:23"
              keyboardType="numbers-and-punctuation"
              error={timeErrors[event]}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Goals</Text>
        <View style={styles.fields}>
          <TextField
            label={self ? 'What do you want out of this summer?' : `What does ${firstName(athleteName)} want out of this summer?`}
            value={draft.goals}
            onChangeText={(next) => set('goals', next)}
            placeholder="Break 18:00 in the 5K and make varsity."
            multiline
          />
        </View>
      </Card>

      <Card accent="primary">
        <View style={styles.privateHeading}>
          <Ionicons name="lock-closed" size={16} color={c.primary} />
          <Text style={styles.cardTitle}>Emergency contact</Text>
        </View>
        <Text style={styles.cardHint}>
          Who the coaches call first if something happens. Only{' '}
          {self ? 'you' : firstName(athleteName)}, {self ? 'your' : 'their'} parent or guardian,
          and clinic staff can see it.
        </Text>
        <View style={styles.fields}>
          <TextField
            label="Name"
            value={draft.emergency_contact_name}
            onChangeText={(next) => set('emergency_contact_name', next)}
            placeholder="Pat Runner"
            textContentType="name"
          />
          <TextField
            label="Phone"
            value={draft.emergency_contact_phone}
            onChangeText={(next) => set('emergency_contact_phone', next)}
            placeholder="(205) 555-0134"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
          />
          <TextField
            label="Relationship"
            value={draft.emergency_contact_relationship}
            onChangeText={(next) => set('emergency_contact_relationship', next)}
            placeholder="Mother"
          />
        </View>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label={submitLabel} size="lg" full loading={saving} onPress={onSave} />
    </>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  cardTitle: { ...type.heading, color: c.text },
  cardHint: { ...type.caption, color: c.textMuted, marginTop: spacing.xs, lineHeight: 17 },
  fields: { gap: spacing.lg, marginTop: spacing.lg },
  privateHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  error: { ...type.body, color: c.danger },
});
