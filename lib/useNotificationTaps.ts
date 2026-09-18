import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';

// The web build has no notification module behind these calls, and reading the
// last response there throws rather than returning nothing. Coaches do use the
// web build, so this has to be a no-op rather than a crash.
const SUPPORTED = Platform.OS !== 'web';

/**
 * Sends someone to the screen a notification was about.
 *
 * The Edge Function puts a route in the payload; without this a push opens the
 * app wherever the person last left it, which for "practice moved to 7am" means
 * they still have to go and find it.
 */
export function useNotificationTaps(ready: boolean) {
  const handled = useRef<string | null>(null);

  // Covers the cold start: a notification that launched the app is waiting here
  // rather than arriving through the listener.
  const last = SUPPORTED ? Notifications.useLastNotificationResponse() : null;

  useEffect(() => {
    if (!SUPPORTED || !ready || !last) return;

    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;

    const path = last.notification.request.content.data?.path;
    if (typeof path === 'string' && path.startsWith('/')) {
      router.push(path as never);
    }
  }, [ready, last]);

  useEffect(() => {
    if (!SUPPORTED || !ready) return;

    // And the warm case, where the app is already open.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const id = response.notification.request.identifier;
      if (handled.current === id) return;
      handled.current = id;

      const path = response.notification.request.content.data?.path;
      if (typeof path === 'string' && path.startsWith('/')) {
        router.push(path as never);
      }
    });

    return () => subscription.remove();
  }, [ready]);
}
