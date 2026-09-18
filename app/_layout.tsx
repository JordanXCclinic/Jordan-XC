import { useCallback, useEffect } from 'react';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Button } from '../components/Button';
import { AthleteProvider } from '../lib/athlete';
import { AuthProvider, useAuth } from '../lib/auth';
import { SUPPORT_EMAIL } from '../lib/legal';
import { colors, radius, spacing, type } from '../lib/theme';
import { stackHeader } from '../lib/theme';

/**
 * Exported from the root layout, so expo-router shows this instead of a white
 * screen when a render throws anywhere in the app. A family at the trailhead
 * gets something they can act on, and a reviewer does not see a blank app.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[errorStyles.root, { paddingTop: insets.top + spacing.xxl }]}>
      <ScrollView contentContainerStyle={errorStyles.content}>
        <View style={errorStyles.icon}>
          <Ionicons name="alert-circle" size={26} color={colors.danger} />
        </View>

        <Text style={errorStyles.title}>Something went wrong</Text>
        <Text style={errorStyles.body}>
          The app hit a problem it could not recover from on its own. Trying again
          usually clears it.
        </Text>

        <Button label="Try again" size="lg" full onPress={() => retry()} />

        <Button
          label="Tell the clinic"
          variant="secondary"
          full
          onPress={() =>
            void WebBrowser.openBrowserAsync(
              `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Jordan XC app problem')}` +
                `&body=${encodeURIComponent(`What happened:\n\n\n---\n${error.message}`)}`
            )
          }
        />

        {/* The message is kept visible rather than hidden behind a build flag:
            when a parent emails about a problem, this is what makes it fixable. */}
        <Text style={errorStyles.detail} selectable>
          {error.message}
        </Text>
      </ScrollView>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.lg },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.display, color: colors.text, fontSize: 26 },
  body: { ...type.body, color: colors.textMuted },
  detail: {
    ...type.caption,
    color: colors.textFaint,
    fontFamily: undefined,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
});

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
                name="settings"
                options={{ ...stackHeader, headerShown: true, title: 'Settings' }}
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
