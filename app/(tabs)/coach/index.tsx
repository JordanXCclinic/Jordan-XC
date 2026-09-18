import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Logo } from '../../../components/Logo';
import { EmptyState, Screen, SectionHeader } from '../../../components/Screen';
import { useAuth } from '../../../lib/auth';
import { firstName } from '../../../lib/format';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { isCoach, isHeadCoach } from '../../../lib/types';
import { radius, shadow, spacing, type, type Palette } from '../../../lib/theme';
import { useTheme, useThemedStyles } from '../../../lib/appearance';

type Counts = {
  athletes: number;
  outstandingCodes: number;
  upcomingPractices: number;
  bookedMeetings: number;
  drafts: number;
};

const ZERO: Counts = {
  athletes: 0,
  outstandingCodes: 0,
  upcomingPractices: 0,
  bookedMeetings: 0,
  drafts: 0,
};

const TOOLS = [
  {
    href: '/(tabs)/coach/announcements',
    icon: 'megaphone' as const,
    title: 'Announcements',
    subtitle: 'Practice changes and clinic news',
  },
  {
    href: '/(tabs)/coach/practices',
    icon: 'calendar' as const,
    title: 'Schedule',
    subtitle: 'Post and change practices',
  },
  {
    href: '/(tabs)/coach/plans',
    icon: 'barbell' as const,
    title: 'Training plans',
    subtitle: 'Write workouts and assign them',
  },
  {
    href: '/(tabs)/coach/roster',
    icon: 'people' as const,
    title: 'Roster',
    subtitle: 'Athletes, health notes, contacts',
  },
  {
    href: '/(tabs)/coach/meetings',
    icon: 'chatbubbles' as const,
    title: 'Meetings',
    subtitle: 'Open times and who booked them',
  },
  {
    href: '/(tabs)/coach/posts',
    icon: 'book' as const,
    title: 'Learn',
    subtitle: 'Educational sessions and videos',
  },
  {
    href: '/photos',
    icon: 'images' as const,
    title: 'Photos',
    subtitle: 'Post pictures from practice',
  },
  {
    href: '/(tabs)/coach/codes',
    icon: 'key' as const,
    title: 'Clinic codes',
    subtitle: 'Issue codes to registered families',
  },
];

export default function CoachHome() {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const { profile, role } = useAuth();
  const [counts, setCounts] = useState<Counts>(ZERO);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !isCoach(role)) return;

    const now = new Date().toISOString();
    // head:true asks Postgres for the count without shipping any rows back.
    const count = { count: 'exact' as const, head: true };

    const [athletes, codes, practices, meetings, drafts] = await Promise.all([
      supabase.from('profiles').select('id', count).in('role', ['athlete', 'private_client']),
      isHeadCoach(role)
        ? supabase.from('invite_codes').select('id', count).is('redeemed_at', null)
        : Promise.resolve({ count: 0 }),
      supabase.from('practices').select('id', count).gte('starts_at', now).neq('status', 'cancelled'),
      supabase.from('meeting_slots').select('id', count).gte('starts_at', now).not('booked_for', 'is', null),
      supabase.from('announcements').select('id', count).is('published_at', null),
    ]);

    setCounts({
      athletes: athletes.count ?? 0,
      outstandingCodes: codes.count ?? 0,
      upcomingPractices: practices.count ?? 0,
      bookedMeetings: meetings.count ?? 0,
      drafts: drafts.count ?? 0,
    });
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  // Hiding the tab is convenience; this check is what keeps the screen closed.
  if (!isCoach(role)) {
    return (
      <Screen title="Coach">
        <EmptyState icon="lock-closed-outline" message="Coach tools are for clinic staff only." />
      </Screen>
    );
  }

  return (
    <Screen
      title={`Coach ${firstName(profile?.full_name)}`.trim()}
      subtitle="Everything the clinic runs on"
      onRefresh={load}
      headerRight={<Logo size={46} />}
    >
      <View style={styles.stats}>
        <Stat label="Athletes" value={counts.athletes} />
        <Stat label="Upcoming" value={counts.upcomingPractices} />
        <Stat label="Meetings" value={counts.bookedMeetings} />
      </View>

      {counts.drafts > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/coach/announcements')}
          style={({ pressed }) => [styles.alert, pressed && styles.pressed]}
        >
          <Ionicons name="document-text-outline" size={18} color={c.warning} />
          <Text style={styles.alertText}>
            {counts.drafts} unpublished {counts.drafts === 1 ? 'announcement' : 'announcements'} — nobody
            can see {counts.drafts === 1 ? 'it' : 'them'} yet.
          </Text>
        </Pressable>
      ) : null}

      <SectionHeader title="Tools" />

      <View style={styles.grid}>
        {TOOLS.filter(
          (tool) => tool.href !== '/(tabs)/coach/codes' || isHeadCoach(role)
        ).map((tool) => (
          <Pressable
            key={tool.href}
            accessibilityRole="button"
            accessibilityLabel={tool.title}
            onPress={() => router.push(tool.href as never)}
            style={({ pressed }) => [styles.tool, pressed && styles.pressed]}
          >
            <View style={styles.toolIcon}>
              <Ionicons name={tool.icon} size={20} color={c.primary} />
            </View>
            <Text style={styles.toolTitle}>{tool.title}</Text>
            <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
            {tool.href === '/(tabs)/coach/codes' && counts.outstandingCodes > 0 ? (
              <Text style={styles.toolMeta}>{counts.outstandingCodes} unused</Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: c.primarySurface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: 2,
    ...shadow.card,
  },
  statValue: { ...type.display, color: c.textInverse, fontSize: 26 },
  statLabel: { ...type.caption, color: c.textOnPrimary },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.warningTint,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  alertText: { ...type.caption, color: c.warning, flex: 1, lineHeight: 18 },
  pressed: { opacity: 0.85 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tool: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: c.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow.card,
  },
  toolIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: c.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  toolTitle: { ...type.bodyStrong, color: c.text },
  toolSubtitle: { ...type.caption, color: c.textMuted, lineHeight: 16 },
  toolMeta: { ...type.caption, color: c.accent, fontWeight: '700', marginTop: spacing.xs },
});
