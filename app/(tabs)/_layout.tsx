import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, type ColorValue } from 'react-native';
import { FullScreenLoader } from '../../components/Screen';
import { useAuth } from '../../lib/auth';
import { isAthlete, isCoach } from '../../lib/types';
import { shadow, type, type Palette } from '../../lib/theme';
import { useTheme, useThemedStyles } from '../../lib/appearance';

const icon =
  (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );

// This layout owns the auth gate. A separate index route would collide with
// (tabs)/index at "/" and swallow every other tab.
export default function TabsLayout() {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  const { session, profile, role, loading, profileLoaded, onboarded } = useAuth();

  if (loading || (session && !profileLoaded)) return <FullScreenLoader />;

  if (!session) return <Redirect href="/sign-in" />;
  if (!profile) return <Redirect href="/onboarding" />;
  if (!onboarded) return <Redirect href="/profile-setup" />;

  const staff = isCoach(role);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textFaint,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen
        name="training"
        options={{
          title: 'Training',
          tabBarIcon: icon('fitness'),
          // Staff plan training from the Coach tab; they have no plan of their own.
          href: staff ? null : undefined,
        }}
      />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: icon('book') }} />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          tabBarIcon: icon('clipboard'),
          // Hiding the tab is convenience, not authorization — RLS is.
          href: staff ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: isAthlete(role) ? 'Me' : 'Profile',
          tabBarIcon: icon('person-circle'),
        }}
      />
    </Tabs>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  bar: {
    backgroundColor: c.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    ...shadow.card,
  },
  label: { ...type.caption, fontSize: 11, fontWeight: '600' },
  item: {},
});
