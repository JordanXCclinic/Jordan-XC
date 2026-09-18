import { useCallback, useEffect } from 'react';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Button } from '../components/Button';
import { AppearanceProvider, useAppearance, useTheme } from '../lib/appearance';
import { AthleteProvider } from '../lib/athlete';
import { AuthProvider, useAuth } from '../lib/auth';
import { SUPPORT_EMAIL } from '../lib/legal';
import { lightColors, radius, spacing, stackHeaderFor, type } from '../lib/theme';

// Hold the splash until the session lookup finishes, so the app never flashes
// the sign-in screen at someone who is already signed in.
void SplashScreen.preventAutoHideAsync();

/**
 * Exported from the root layout, so expo-router shows this instead of a white
 * screen when a render throws anywhere in the app. A family at the trailhead
 * gets something they can act on, and a reviewer does not see a blank app.
 *
 * Deliberately the only screen that does not follow the theme: it can be shown
 * when the failure is the provider itself, so it reads the light palette
 * directly rather than a hook that could throw on the way to rendering.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[errorStyles.root, { paddingTop: insets.top + spacing.xxl }]}>
      <ScrollView contentContainerStyle={errorStyles.content}>
        <View style={errorStyles.icon}>
          <Ionicons name="alert-circle" size={26} color={lightColors.danger} />
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
  root: { flex: 1, backgroundColor: lightColors.background },
  content: { padding: spacing.xl, gap: spacing.lg },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: lightColors.dangerTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.display, color: lightColors.text, fontSize: 26 },
  body: { ...type.body, color: lightColors.textMuted },
  detail: {
    ...type.caption,
    color: lightColors.textFaint,
    backgroundColor: lightColors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* Appearance sits outermost so every provider below, and the navigator
          itself, can read the active palette. */}
      <AppearanceProvider>
        <AuthProvider>
          <AthleteProvider>
            <Shell />
          </AthleteProvider>
        </AuthProvider>
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}

/** Inside the provider, so the navigator's own chrome follows the theme too. */
function Shell() {
  const c = useTheme();
  const { scheme } = useAppearance();
  const header = { ...stackHeaderFor(c), headerShown: true };

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Gate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.background },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="profile-setup" options={{ animation: 'fade' }} />
          <Stack.Screen name="photos" options={{ ...header, title: 'Clinic photos' }} />
          <Stack.Screen name="meetings" options={{ ...header, title: 'Meet with Coach' }} />
          <Stack.Screen name="athlete-form" options={{ ...header, title: 'Athlete profile' }} />
          <Stack.Screen name="settings" options={{ ...header, title: 'Settings' }} />
          <Stack.Screen name="post/[id]" options={{ ...header, title: '' }} />
        </Stack>
      </Gate>
    </>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const c = useTheme();

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
    <View style={{ flex: 1, backgroundColor: c.background }} onLayout={onLayout}>
      {children}
    </View>
  );
}
