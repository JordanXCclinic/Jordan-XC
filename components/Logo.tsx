import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { brand, radius, shadow } from '../lib/theme';

type Props = {
  size?: number;
  /** Sets the badge in a white circle — for navy backgrounds. */
  ring?: boolean;
  /** Give this only where the logo carries meaning; elsewhere it is decorative. */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The clinic badge, as it appears inside the app. This reads the transparent
 * logo rather than the app icon: the icon has to be an opaque square for iOS,
 * and its corners would show through the circle on the sign-in screen.
 */
export function Logo({ size = 44, ring, label, style }: Props) {
  const image = (
    <Image
      source={require('../assets/logo.png')}
      style={{ width: '100%', height: '100%' }}
      contentFit="contain"
      transition={220}
      // Decorative marks stay out of the screen reader's way; the screens that
      // use one as a heading pass a label instead.
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    />
  );

  if (!ring) {
    return <View style={[{ width: size, height: size }, style]}>{image}</View>;
  }

  return (
    <View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, padding: size * 0.1 },
        style,
      ]}
    >
      {image}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    backgroundColor: brand.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    ...shadow.raised,
  },
});
