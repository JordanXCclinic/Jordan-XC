import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { EmptyState, Screen, SectionHeader } from '../../components/Screen';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useAthlete } from '../../lib/athlete';
import { useAuth } from '../../lib/auth';
import {
  firstName,
  formatDayHeading,
  formatMiles,
  formatRelative,
  formatTime,
} from '../../lib/format';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { currentWeekNumber, planDayToday } from '../../lib/training';
import {
  ANNOUNCEMENT_COLUMNS,
  PRACTICE_COLUMNS,
  WORKOUT_COLUMNS,
  isAthlete,
  isCoach,
  type Announcement,
  type Practice,
  type Workout,
} from '../../lib/types';
import { colors, radius, shadow, spacing, type } from '../../lib/theme';

export default function Home() {
  const { profile, role } = useAuth();
  const { athletes, activeAthleteId, setActiveAthleteId } = useAthlete();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [practice, setPractice] = useState<Practice | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    const [{ data: news }, { data: practices }] = await Promise.all([
      supabase
        .from('announcements')
        .select(ANNOUNCEMENT_COLUMNS)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(20),
      supabase
        .from('practices')
        .select(PRACTICE_COLUMNS)
        .gte('starts_at', new Date().toISOString())
        .neq('status', 'cancelled')
        .order('starts_at', { ascending: true })
        .limit(1),
    ]);

    setAnnouncements((news as Announcement[] | null) ?? []);
    setPractice(((practices as Practice[] | null) ?? [])[0] ?? null);

    if (!activeAthleteId) {
      setWorkout(null);
      return;
    }

    // Today's session comes from wherever the athlete is in their plan, which
    // depends on when the plan was assigned rather than on the calendar date.
    const { data: assignment } = await supabase
      .from('plan_assignments')
      .select('plan_id, starts_on')
      .eq('athlete_id', activeAthleteId)
      .order('starts_on', { ascending: false })
      .limit(1)
      .maybeSingle();

    const assigned = assignment as { plan_id: string; starts_on: string } | null;
    if (!assigned) {
      setWorkout(null);
      return;
    }

    const { data: today } = await supabase
      .from('workouts')
      .select(WORKOUT_COLUMNS)
      .eq('plan_id', assigned.plan_id)
      .eq('week_number', currentWeekNumber(assigned.starts_on))
      .eq('day_of_week', planDayToday())
      .maybeSingle();

    setWorkout((today as Workout | null) ?? null);
  }, [activeAthleteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const greeting = firstName(profile?.full_name) ? `Hey, ${firstName(profile?.full_name)}` : 'Welcome';
  const viewingOwn = isAthlete(role);

  return (
    <Screen
      title={greeting}
      subtitle={
        isCoach(role)
          ? 'Clinic at a glance'
          : viewingOwn
            ? 'Here is what is next'
            : 'Here is what is next for your athlete'
      }
      onRefresh={load}
    >
      {athletes.length > 1 ? (
        <SegmentedControl
          options={athletes.map((athlete) => ({
            value: athlete.id,
            label: firstName(athlete.full_name),
          }))}
          value={activeAthleteId ?? athletes[0]!.id}
          onChange={setActiveAthleteId}
        />
      ) : null}

      <NextPractice practice={practice} />

      {workout ? (
        <Card accent="primary" onPress={() => router.push('/(tabs)/training')}>
          <Text style={styles.kicker}>Today&rsquo;s workout</Text>
          <Text style={styles.workoutTitle}>{workout.title}</Text>
          <View style={styles.metaRow}>
            {formatMiles(workout.distance_miles) ? (
              <Badge label={formatMiles(workout.distance_miles)!} tone="primary" />
            ) : null}
            {workout.intensity ? <Badge label={workout.intensity} /> : null}
          </View>
          {workout.description ? (
            <Text style={styles.workoutBody} numberOfLines={3}>
              {workout.description}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <View style={styles.quickRow}>
        <QuickAction
          icon="chatbubbles"
          label="Meet with Coach"
          onPress={() => router.push('/meetings')}
        />
        <QuickAction icon="images" label="Clinic photos" onPress={() => router.push('/photos')} />
      </View>

      <SectionHeader title="Announcements" />

      {announcements.length === 0 ? (
        <EmptyState
          icon="megaphone-outline"
          message="No announcements yet. Practice changes and clinic news land here first."
        />
      ) : (
        announcements.map((item) => (
          <Card key={item.id}>
            <View style={styles.announcementHead}>
              <Text style={styles.announcementTitle}>{item.title}</Text>
              <Text style={styles.announcementWhen}>
                {formatRelative(item.published_at ?? item.created_at)}
              </Text>
            </View>
            <Text style={styles.announcementBody}>{item.body}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

function NextPractice({ practice }: { practice: Practice | null }) {
  if (!practice) {
    return (
      <EmptyState
        icon="calendar-outline"
        message="Nothing on the schedule yet. Practices show up here as soon as a coach posts them."
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/(tabs)/schedule')}
      style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}
    >
      <View style={styles.heroTop}>
        <Text style={styles.heroKicker}>Next practice</Text>
        <Text style={styles.heroRelative}>{formatRelative(practice.starts_at)}</Text>
      </View>
      <Text style={styles.heroDay}>{formatDayHeading(practice.starts_at)}</Text>
      <Text style={styles.heroTime}>{formatTime(practice.starts_at)}</Text>
      <View style={styles.heroFoot}>
        <Ionicons name="location" size={15} color={colors.textOnPrimary} />
        <Text style={styles.heroLocation} numberOfLines={1}>
          {practice.location_name}
        </Text>
      </View>
      {practice.status === 'moved' ? (
        <View style={styles.heroFlag}>
          <Text style={styles.heroFlagText}>TIME OR PLACE CHANGED</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.quick, pressed && styles.quickPressed]}
    >
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.xs,
    ...shadow.raised,
  },
  heroPressed: { opacity: 0.94 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroKicker: { ...type.overline, color: colors.textOnPrimary },
  heroRelative: { ...type.caption, color: colors.textOnPrimary },
  heroDay: { ...type.title, color: colors.textInverse, marginTop: spacing.sm },
  heroTime: { ...type.display, color: colors.textInverse, fontSize: 34 },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  heroLocation: { ...type.body, color: colors.textOnPrimary, flex: 1 },
  heroFlag: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  heroFlagText: { ...type.caption, color: colors.textInverse, fontWeight: '700', letterSpacing: 0.5 },
  kicker: { ...type.overline, color: colors.primary },
  workoutTitle: { ...type.heading, color: colors.text, marginTop: spacing.xs },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  workoutBody: { ...type.body, color: colors.textMuted, marginTop: spacing.sm },
  quickRow: { flexDirection: 'row', gap: spacing.md },
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  quickPressed: { opacity: 0.85 },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { ...type.label, color: colors.text, textAlign: 'center' },
  announcementHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  announcementTitle: { ...type.heading, color: colors.text, flex: 1 },
  announcementWhen: { ...type.caption, color: colors.textFaint },
  announcementBody: { ...type.body, color: colors.textMuted, marginTop: spacing.sm },
});
