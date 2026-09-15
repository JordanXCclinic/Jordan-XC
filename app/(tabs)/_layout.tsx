import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { isCoach } from '../../lib/types';
import { colors } from '../../lib/theme';

export default function TabsLayout() {
  const { session, profile, role, loading, profileLoaded } = useAuth();

  if (!loading && !session) return <Redirect href="/sign-in" />;
  if (session && profileLoaded && !profile) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="training" options={{ title: 'Training' }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn' }} />
      <Tabs.Screen
        name="coach"
        options={{ title: 'Coach', href: isCoach(role) ? undefined : null }}
      />
    </Tabs>
  );
}
