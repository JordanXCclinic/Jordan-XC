import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EmptyState, Screen } from '../../components/Screen';
import { useAuth } from '../../lib/auth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { colors, radius, spacing } from '../../lib/theme';
import type { Announcement } from '../../lib/types';

export default function Home() {
  const { profile, signOut } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase
      .from('announcements')
      .select('id, title, body, audience, published_at')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setAnnouncements((data as Announcement[]) ?? []));
  }, []);

  const firstName = profile?.full_name?.split(' ')[0];

  return (
    <Screen
      title={firstName ? `Hey, ${firstName}` : 'Jordan XC Clinic'}
      subtitle="Latest from the coaches"
    >
      {announcements.length === 0 ? (
        <EmptyState message="No announcements yet. Practice changes and clinic news will show up here." />
      ) : (
        announcements.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.body}</Text>
          </View>
        ))
      )}

      <Pressable style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  cardBody: { fontSize: 15, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 21 },
  signOut: { marginTop: spacing.lg, alignSelf: 'flex-start' },
  signOutText: { color: colors.textMuted, fontSize: 15 },
});
