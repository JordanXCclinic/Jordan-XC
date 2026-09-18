import { Stack } from 'expo-router';
import { stackHeaderFor } from '../../../lib/theme';
import { useTheme } from '../../../lib/appearance';

export default function CoachLayout() {
  const c = useTheme();

  return (
    <Stack screenOptions={{ ...stackHeaderFor(c), headerShown: true }}>
      {/* The dashboard renders its own large title, so it needs no bar. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="codes" options={{ title: 'Clinic codes' }} />
      <Stack.Screen name="announcements" options={{ title: 'Announcements' }} />
      <Stack.Screen name="practices" options={{ title: 'Schedule' }} />
      <Stack.Screen name="posts" options={{ title: 'Learn' }} />
      <Stack.Screen name="meetings" options={{ title: 'Meetings' }} />
      <Stack.Screen name="plans/index" options={{ title: 'Training plans' }} />
      <Stack.Screen name="plans/[id]" options={{ title: 'Plan' }} />
      <Stack.Screen name="attendance/[id]" options={{ title: 'Attendance' }} />
      <Stack.Screen name="roster/index" options={{ title: 'Roster' }} />
      <Stack.Screen name="roster/[id]" options={{ title: '' }} />
    </Stack>
  );
}
