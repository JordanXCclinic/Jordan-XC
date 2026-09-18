import * as Haptics from 'expo-haptics';
import { forwardRef } from 'react';
import { ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, shadow, spacing, type, type Palette } from '../lib/theme';
import { useTheme, useThemedStyles } from '../lib/appearance';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
};

const fills = (c: Palette): Record<Variant, ViewStyle> => ({
  primary: { backgroundColor: c.primarySurface },
  secondary: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: c.danger },
});

const inks = (c: Palette): Record<Variant, string> => ({
  primary: c.textInverse,
  secondary: c.text,
  ghost: c.primary,
  danger: c.textInverse,
});

export const Button = forwardRef<View, Props>(function Button(
  { label, onPress, variant = 'primary', size = 'md', icon, loading, disabled, full, style },
  ref
) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);
  const blocked = Boolean(disabled || loading);
  const ink = inks(c)[variant];

  function handlePress() {
    // A short tick on the way out makes the app feel responsive even while the
    // network round-trip is still in flight. Web has no haptics engine.
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      accessibilityLabel={label}
      onPress={handlePress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' && styles.lg,
        fills(c)[variant],
        variant !== 'ghost' && shadow.card,
        full && styles.full,
        pressed && styles.pressed,
        blocked && styles.blocked,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={ink} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={ink} style={styles.icon} /> : null}
          <Text style={[styles.label, size === 'lg' && styles.labelLg, { color: ink }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
});

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  base: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  lg: { minHeight: 54, borderRadius: radius.lg },
  full: { alignSelf: 'stretch' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  blocked: { opacity: 0.45 },
  icon: { marginRight: -2 },
  label: { ...type.bodyStrong },
  labelLg: { fontSize: 16 },
});
