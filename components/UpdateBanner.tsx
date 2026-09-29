import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../lib/appearance';
import { radius, spacing, type, type Palette } from '../lib/theme';

/**
 * Tells someone on the web build that a newer version has been published.
 *
 * Pulling down refreshes the data on a screen, not the app itself, and a phone
 * holds on to the page it last loaded — especially from a home screen icon.
 * Every update so far has needed "clear the site from Safari's settings"
 * before anyone could see it. This checks instead, and offers the update.
 *
 * The check asks the live site which bundle its page loads and compares that
 * with the bundle running here. Both come from the build itself, so there is
 * no version number to forget to bump.
 *
 * It never reloads on its own: someone halfway through writing an
 * announcement should not lose it because a deploy landed. The phone builds
 * will get their updates through expo-updates instead, so this is web only.
 */

const ENTRY = /\/entry-([a-f0-9]+)\.js/;
/** At most once a minute, however often the app is switched back to. */
const MIN_GAP_MS = 60_000;

function runningBuild(): string | null {
  const script = document.querySelector<HTMLScriptElement>('script[src*="/entry-"]');
  return script?.src.match(ENTRY)?.[1] ?? null;
}

function appRoot(): string {
  const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/+$/, '');
  return `${window.location.origin}${base}/`;
}

async function liveBuild(): Promise<string | null> {
  // no-store: the question is what the site serves now, not what is saved.
  const response = await fetch(appRoot(), { cache: 'no-store' });
  if (!response.ok) return null;
  return (await response.text()).match(ENTRY)?.[1] ?? null;
}

export function UpdateBanner() {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [ready, setReady] = useState(false);
  const [updating, setUpdating] = useState(false);
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    const now = Date.now();
    if (now - lastCheck.current < MIN_GAP_MS) return;
    lastCheck.current = now;
    try {
      const running = runningBuild();
      // No hashed bundle means a development server, where there is nothing
      // to compare and the page reloads itself anyway.
      if (!running) return;
      const live = await liveBuild();
      if (live && live !== running) setReady(true);
    } catch {
      // Offline, or the site briefly unreachable: the next check will try.
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    void check();
    // Coming back to the app is when a new version is most likely waiting.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => subscription.remove();
  }, [check]);

  if (Platform.OS !== 'web' || !ready) return null;

  async function update() {
    setUpdating(true);
    // Replace the saved copies first — this page and the app's front door, the
    // one a home screen icon opens — so the reload and the next launch get the
    // new version rather than handing back the old one again.
    await Promise.all(
      [window.location.href, appRoot()].map((url) =>
        fetch(url, { cache: 'reload' }).catch(() => undefined)
      )
    );
    window.location.reload();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="A new version of the app is ready. Update now."
      onPress={() => void update()}
      disabled={updating}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
    >
      <Ionicons name="arrow-up-circle" size={18} color={c.textInverse} />
      <Text style={styles.text}>
        {updating ? 'Updating…' : 'A new version of the app is ready'}
      </Text>
      {updating ? null : (
        <View style={styles.action}>
          <Text style={styles.actionText}>Update</Text>
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      backgroundColor: c.primarySurface,
    },
    pressed: { opacity: 0.9 },
    text: { ...type.caption, color: c.textInverse, fontWeight: '600', flex: 1 },
    action: {
      backgroundColor: c.textInverse,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
    },
    // On the white pill, so the navy that sits on white in both themes.
    actionText: { ...type.label, color: c.primarySurface },
  });
