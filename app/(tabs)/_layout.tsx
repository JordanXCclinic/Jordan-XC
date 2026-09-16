import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View, type ColorValue } from 'react-native';
import { useAuth } from '../../lib/auth';
import { isCoach } from '../../lib/types';
import { colors } from '../../lib/theme';

const icon =
  (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );

// This layout owns the auth gate. A separate index route would collide with
// (tabs)/index at "/" and swallow every other tab.
export default function TabsLayout() {
  const { session, profile, role, loading, profileLoaded } = useAuth();

  if (loading || (session && !profileLoaded)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/sign-in" />;
  if (!profile) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="training" options={{ title: 'Training', tabBarIcon: icon('walk') }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: icon('book') }} />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          tabBarIcon: icon('clipboard'),
          href: isCoach(role) ? undefined : null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
