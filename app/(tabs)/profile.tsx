import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AthleteSummary } from '../../components/AthleteSummary';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Card, ListRow } from '../../components/Card';
import { EmptyState, Screen, SectionHeader } from '../../components/Screen';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useAthlete } from '../../lib/athlete';
import { useAuth } from '../../lib/auth';
import { firstName, roleLabel } from '../../lib/format';
import { isAthlete, isCoach } from '../../lib/types';
import { colors, spacing, type } from '../../lib/theme';
import { CLINIC_URL } from '../sign-in';

export default function ProfileTab() {
  const { profile, role } = useAuth();
  const { athletes, activeAthleteId, setActiveAthleteId, activeAthlete, refresh } = useAthlete();

  if (!profile) return null;

  const own = isAthlete(role);
  const staff = isCoach(role);
  const subject = own ? profile : activeAthlete;

  return (
    <Screen title={own ? 'Me' : 'Profile'} onRefresh={refresh}>
      <Card>
        <View style={styles.identity}>
          <Avatar name={profile.full_name} size={56} />
          <View style={styles.identityText}>
            <Text style={styles.name}>{profile.full_name}</Text>
            <Badge label={roleLabel(profile.role)} tone="primary" />
          </View>
        </View>
        {profile.phone ? <Text style={styles.phone}>{profile.phone}</Text> : null}
      </Card>

      {staff ? (
        <EmptyState
          icon="clipboard-outline"
          message="Staff manage athletes, plans, and announcements from the Coach tab."
        />
      ) : (
        <>
          {athletes.length > 1 ? (
            <>
              <SectionHeader title="Your athletes" />
              <SegmentedControl
                options={athletes.map((athlete) => ({
                  value: athlete.id,
                  label: firstName(athlete.full_name),
                }))}
                value={activeAthleteId ?? athletes[0]!.id}
                onChange={setActiveAthleteId}
              />
            </>
          ) : null}

          {!own && athletes.length === 0 ? (
            <EmptyState
              icon="people-outline"
              message="No athlete linked yet. The link forms as soon as your runner redeems their own code."
            />
          ) : subject ? (
            <>
              <SectionHeader
                title={own ? 'Your profile' : `${firstName(subject.full_name)}’s profile`}
                action={
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: '/athlete-form',
                        params: { id: subject.id, name: subject.full_name },
                      })
                    }
                    hitSlop={8}
                  >
                    <Text style={styles.edit}>Edit</Text>
                  </Pressable>
                }
              />
              <AthleteSummary athleteId={subject.id} />
            </>
          ) : null}
        </>
      )}

      <SectionHeader title="Clinic" />
      <ListRow
        icon="chatbubbles-outline"
        title="Meet with Coach"
        subtitle="Book a one-on-one time"
        onPress={() => router.push('/meetings')}
      />
      <ListRow
        icon="images-outline"
        title="Clinic photos"
        subtitle="Pictures from practices and meets"
        onPress={() => router.push('/photos')}
      />
      <ListRow
        icon="globe-outline"
        title="jordanxcclinic.com"
        subtitle="Registration, payment, and waivers"
        onPress={() => void WebBrowser.openBrowserAsync(CLINIC_URL)}
      />

      <SectionHeader title="Account" />
      <ListRow
        icon="settings-outline"
        title="Settings"
        subtitle="Privacy, your data, and signing out"
        onPress={() => router.push('/settings')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  identityText: { flex: 1, gap: spacing.sm },
  name: { ...type.title, color: colors.text },
  phone: { ...type.body, color: colors.textMuted, marginTop: spacing.md },
  edit: { ...type.label, color: colors.primary },
});
