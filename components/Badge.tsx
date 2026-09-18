import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, type, type Palette } from '../lib/theme';
import { useTheme, useThemedStyles } from '../lib/appearance';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

// A function of the palette rather than a constant: the pairings are the same
// in both themes, the colours behind them are not.
const tones = (c: Palette): Record<Tone, { bg: string; ink: string }> => ({
  neutral: { bg: c.surfaceSunken, ink: c.textMuted },
  primary: { bg: c.primaryTint, ink: c.primary },
  success: { bg: c.successTint, ink: c.success },
  warning: { bg: c.warningTint, ink: c.warning },
  danger: { bg: c.dangerTint, ink: c.danger },
});

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  const { bg, ink } = tones(c)[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: ink }]}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  text: { ...type.caption, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' },
});
