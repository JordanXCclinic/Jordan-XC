import { useNetworkState } from 'expo-network';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../lib/appearance';
import { spacing, type, type Palette } from '../lib/theme';

/**
 * Sits under the tab bar whenever the phone has no usable connection.
 *
 * Practices happen on trails, which is exactly where signal goes. Without this
 * the app shows empty screens that look like the coach posted nothing, and a
 * family drives home thinking there is no practice.
 */
export function OfflineBanner() {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const network = useNetworkState();

  // Undefined means "not determined yet" — only an explicit false is offline,
  // so the banner never flashes while the first check is still running.
  const offline = network.isInternetReachable === false || network.isConnected === false;
  if (!offline) return null;

  return (
    <View style={styles.bar} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={16} color={c.warning} />
      <Text style={styles.text}>
        No connection. You are seeing what was loaded last.
      </Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      backgroundColor: c.warningTint,
    },
    text: { ...type.caption, color: c.warning, flexShrink: 1 },
  });
