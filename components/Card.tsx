import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, shadow, spacing, type, type Palette } from '../lib/theme';
import { useTheme, useThemedStyles } from '../lib/appearance';

type CardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  /** Draws the left edge in navy — used for anything the reader must not miss. */
  accent?: 'primary' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, onPress, accent, style }: CardProps) {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const accentStyle =
    accent === 'primary'
      ? { borderLeftWidth: 4, borderLeftColor: c.primary }
      : accent === 'danger'
        ? { borderLeftWidth: 4, borderLeftColor: c.danger }
        : null;

  if (!onPress) return <View style={[styles.card, accentStyle, style]}>{children}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, accentStyle, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

type RowProps = {
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  right?: React.ReactNode;
};

/** A tappable line item: icon, two lines of text, and a chevron or custom right side. */
export function ListRow({ title, subtitle, meta, icon, onPress, right }: RowProps) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  const body = (
    <>
      {icon ? (
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={18} color={c.primary} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (meta ? <Text style={styles.rowMeta}>{meta}</Text> : null)}
      {onPress && !right ? (
        <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
      ) : null}
    </>
  );

  if (!onPress) return <View style={[styles.card, styles.row]}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.row, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  card: {
    backgroundColor: c.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: c.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...type.bodyStrong, color: c.text },
  rowSubtitle: { ...type.caption, color: c.textMuted, lineHeight: 17 },
  rowMeta: { ...type.caption, color: c.textFaint },
});
