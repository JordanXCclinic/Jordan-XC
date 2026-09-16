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
      <Stack.Screen name="codes" options={{ title: 'Clinic codes' }} />
    </Stack>
  );
}
