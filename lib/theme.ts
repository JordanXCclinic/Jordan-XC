import { Platform, type TextStyle, type ViewStyle } from 'react-native';

// Clinic brand. Grey, navy, and red come off the logo; white and black round
// them out. Everything else in the app is a tint of these.
export const brand = {
  navy: '#003482',
  red: '#C4303F',
  grey: '#D9D9D9',
  white: '#FFFFFF',
  black: '#000000',
};

export const colors = {
  primary: brand.navy,
  /** Pressed states and the dark half of the header gradient. */
  primaryDeep: '#00265E',
  /** Navy at ~8% over white — selected chips, info panels. */
  primaryTint: '#E7EDF7',

  accent: brand.red,
  accentDeep: '#9E2632',
  accentTint: '#FAEAEC',

  background: brand.white,
  /** Cards and inputs sit on this, a lightened logo grey. */
  surface: '#F4F5F7',
  surfaceSunken: '#ECEEF1',
  border: '#E2E5EA',
  borderStrong: brand.grey,

  text: '#101319',
  textMuted: '#5C626C',
  textFaint: '#8A8F99',
  textInverse: brand.white,
  /** Muted text on navy — readable without shouting. */
  textOnPrimary: '#C7D5EC',

  success: '#1B7F4B',
  successTint: '#E6F3EC',
  warning: '#9A6200',
  warningTint: '#FBF0DE',
  danger: brand.red,
  dangerTint: '#FAEAEC',

  overlay: 'rgba(16, 19, 25, 0.45)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

// One type scale for the whole app. Screens pick a role, never a raw font size,
// so headings stay consistent across tabs.
export const type = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, lineHeight: 36 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, lineHeight: 28 },
  heading: { fontSize: 17, fontWeight: '700', letterSpacing: -0.1, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  /** Small all-caps section kickers. */
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, lineHeight: 14 },
} satisfies Record<string, TextStyle>;

// iOS wants shadow props, Android wants elevation, and web wants neither to
// look heavy. Spelled out per platform so cards read the same on all three.
const elevate = (y: number, blur: number, opacity: number, elevation: number): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: brand.black,
      shadowOffset: { width: 0, height: y },
      shadowRadius: blur,
      shadowOpacity: opacity,
    },
    android: { elevation },
    default: { boxShadow: `0 ${y}px ${blur}px rgba(0,0,0,${opacity})` } as ViewStyle,
  }) as ViewStyle;

export const shadow = {
  card: elevate(1, 3, 0.06, 1),
  raised: elevate(4, 12, 0.1, 4),
  header: elevate(2, 8, 0.12, 6),
};

/** Tap targets never get smaller than this, per both platforms' guidelines. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
