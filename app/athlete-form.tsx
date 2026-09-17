import { router, useLocalSearchParams } from 'expo-router';
import { AthleteProfileForm } from '../components/AthleteProfileForm';
import { EmptyState, Screen } from '../components/Screen';
import { useAthlete } from '../lib/athlete';
import { useAuth } from '../lib/auth';

/**
 * Editing an athlete's intake form after setup. Reached by the athlete from
 * their own profile, by a parent for the runner they guard, and by a coach from
 * the roster — the `id` parameter says which, and RLS decides whether it works.
 */
export default function AthleteForm() {
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const { profile } = useAuth();
  const { activeAthlete } = useAthlete();

  const athleteId = id ?? activeAthlete?.id ?? profile?.id;
  const athleteName = name ?? activeAthlete?.full_name ?? profile?.full_name ?? 'this athlete';

  if (!athleteId) {
    return (
      <Screen inStack>
        <EmptyState
          icon="person-outline"
          message="No athlete is linked to this account yet. A parent code links you as soon as your runner redeems theirs."
        />
      </Screen>
    );
  }

  return (
    <Screen
      inStack
      title={athleteName}
      subtitle="School, goals, health, and emergency contact."
      avoidKeyboard
    >
      <AthleteProfileForm
        athleteId={athleteId}
        athleteName={athleteName}
        submitLabel="Save changes"
        onSaved={() => router.back()}
      />
    </Screen>
  );
}
