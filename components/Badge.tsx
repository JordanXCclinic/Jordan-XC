import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../lib/theme';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, { bg: string; ink: string }> = {
  neutral: { bg: colors.surfaceSunken, ink: colors.textMuted },
  primary: { bg: colors.primaryTint, ink: colors.primary },
  success: { bg: colors.successTint, ink: colors.success },
  warning: { bg: colors.warningTint, ink: colors.warning },
  danger: { bg: colors.dangerTint, ink: colors.danger },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { bg, ink } = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: ink }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  text: { ...type.caption, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' },
});
