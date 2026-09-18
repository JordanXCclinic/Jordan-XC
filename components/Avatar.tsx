import { StyleSheet, Text, View } from 'react-native';
import { radius, type, type Palette } from '../lib/theme';
import { useTheme, useThemedStyles } from '../lib/appearance';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {

  const c = useTheme();

  const styles = useThemedStyles(makeStyles);

  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityElementsHidden
    >
      <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  avatar: {
    backgroundColor: c.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  text: { ...type.heading, color: c.primary },
});
