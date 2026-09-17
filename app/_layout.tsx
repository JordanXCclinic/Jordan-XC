import { useCallback, useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AthleteProvider } from '../lib/athlete';
import { AuthProvider, useAuth } from '../lib/auth';
import { colors, stackHeader } from '../lib/theme';

// Hold the splash until the session lookup finishes, so the app never flashes
// the sign-in screen at someone who is already signed in.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AthleteProvider>
          <StatusBar style="dark" />
          <Gate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
              <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
              <Stack.Screen name="profile-setup" options={{ animation: 'fade' }} />
              <Stack.Screen
                name="photos"
                options={{ ...stackHeader, headerShown: true, title: 'Clinic photos' }}
              />
              <Stack.Screen
                name="meetings"
                options={{ ...stackHeader, headerShown: true, title: 'Meet with Coach' }}
              />
              <Stack.Screen
                name="athlete-form"
                options={{ ...stackHeader, headerShown: true, title: 'Athlete profile' }}
              />
              <Stack.Screen
                name="post/[id]"
                options={{ ...stackHeader, headerShown: true, title: '' }}
              />
            </Stack>
          </Gate>
        </AthleteProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  const onLayout = useCallback(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  // Belt and braces: if something goes wrong in the session lookup, the splash
  // still comes down rather than leaving the app stuck on the logo.
  useEffect(() => {
    const timer = setTimeout(() => void SplashScreen.hideAsync(), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={onLayout}>
      {children}
    </View>
  );
}
