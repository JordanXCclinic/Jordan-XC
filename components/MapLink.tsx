import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '../lib/appearance';
import { radius, spacing, type, type Palette } from '../lib/theme';
import { asMapLink, openDirections } from '../lib/maps';

/**
 * A practice's location as one tappable row: the place, the address under it,
 * and a Directions pill, so it is plain the whole row opens maps.
 *
 * A pasted maps link is not shown as the address line — a long URL is noise to
 * a parent — and the row says "Open in Maps" instead.
 */
export function MapLink({
  place,
  address,
  muted,
}: {
  place: string;
  address?: string | null;
  /** A cancelled practice: still tappable, but visibly not the thing to go to. */
  muted?: boolean;
}) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  const given = address?.trim() ?? '';
  const subline = given && !asMapLink(given) ? given : 'Open in Maps';

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Directions to ${place}`}
      accessibilityHint="Opens your maps app"
      onPress={() => void openDirections(place, address)}
      style={({ pressed }) => [styles.row, muted && styles.muted, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Ionicons name="location" size={18} color={c.accent} />
      </View>
      <View style={styles.text}>
        <Text style={styles.place} numberOfLines={2}>
          {place}
        </Text>
        <Text style={styles.address} numberOfLines={2}>
          {subline}
        </Text>
      </View>
      <View style={styles.pill}>
        <Ionicons name="navigate" size={13} color={c.textInverse} />
        <Text style={styles.pillText}>Directions</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.sm,
      padding: spacing.sm,
      paddingRight: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: c.surfaceSunken,
      borderWidth: 1,
      borderColor: c.border,
    },
    muted: { opacity: 0.6 },
    pressed: { opacity: 0.75 },
    icon: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: c.accentTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flex: 1 },
    place: { ...type.bodyStrong, color: c.text },
    address: { ...type.caption, color: c.textMuted, marginTop: 1 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.primarySurface,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    pillText: { ...type.label, color: c.textInverse },
  });
