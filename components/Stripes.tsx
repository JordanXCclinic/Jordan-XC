import { StyleSheet, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

/**
 * The clinic's speed stripes: short slanted bars, the way a race kit or a track
 * lane is marked. Purely decoration — hidden from screen readers and never
 * takes a touch.
 *
 * Red appears in this app in two forms, and they have to stay distinguishable.
 * Solid red means "look at this": a pinned announcement, a practice that moved,
 * a delete button. Slanted red, drawn by this component, is only ever
 * decoration. Anything new in red should pick one form on purpose; a solid red
 * ornament would dilute the warnings, and a slanted red warning would be read
 * as decoration and missed.
 */
export function Stripes({
  colors,
  width = 6,
  height = 26,
  gap = 5,
  skew = -22,
  style,
}: {
  /** One bar per colour, left to right. */
  colors: ColorValue[];
  width?: number;
  height?: number;
  gap?: number;
  /** Degrees. Negative leans the bars forward, like something moving. */
  skew?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.row, { gap }, style]}
    >
      {colors.map((color, index) => (
        <View
          key={index}
          style={{
            width,
            height,
            backgroundColor: color,
            transform: [{ skewX: `${skew}deg` }],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
