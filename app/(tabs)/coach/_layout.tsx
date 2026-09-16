import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function CoachLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* The screen renders its own large title, so the bar keeps just the back control. */}
      <Stack.Screen name="codes" options={{ title: '' }} />
    </Stack>
  );
}
