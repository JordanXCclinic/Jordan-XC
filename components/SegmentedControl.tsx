import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, type, type Palette } from '../lib/theme';
import { useTheme, useThemedStyles } from '../lib/appearance';

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
};

/** Top-level view switch — parents picking an athlete, coaches picking a week. */
export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const c = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: c.surfaceSunken,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    minHeight: 36,
  },
  segmentSelected: { backgroundColor: c.background },
  text: { ...type.label, color: c.textMuted },
  textSelected: { color: c.primary },
});
