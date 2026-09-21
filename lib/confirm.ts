import { Alert, Platform } from 'react-native';

/**
 * Asks before something irreversible, on both phones and the web.
 *
 * Alert.alert does nothing at all on react-native-web — it is not that the
 * dialog looks wrong, it never appears and the callback never fires. Code that
 * only used Alert.alert therefore either deleted with no confirmation on the
 * web, or did nothing, depending on which branch it took. This routes the web
 * to window.confirm so the question is actually asked.
 *
 * Resolves true only when the person confirms. A web view with dialogs
 * suppressed returns false, which leaves the record alone — the safe way to
 * fail for a delete.
 */
export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel = 'Delete'
): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
      return Promise.resolve(false);
    }
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
