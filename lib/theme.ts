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

/**
 * Two palettes with identical keys. Screens never pick one — they read the
 * active palette from useTheme(), so a component cannot accidentally hard-code
 * the light one.
 *
 * Two roles look alike and are not:
 *  - `primary` is a foreground. It sits on the page and has to be readable
 *    against `background`, so in dark mode it lightens.
 *  - `primarySurface` is a fill, with `textInverse` on top of it. It has to
 *    stay dark enough for white text, so in dark mode it barely moves.
 * One navy could do both jobs on a white page. On a near-black one it cannot.
 */
export const lightColors = {
  primary: brand.navy,
  primaryDeep: '#00265E',
  /** Navy at ~8% over white — selected chips, info panels. */
  primaryTint: '#E7EDF7',
  /** Filled navy: buttons, the next-practice card, the sign-in screen. */
  primarySurface: brand.navy,

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
  /**
   * Text on a brand-coloured fill. White in both themes, because the fill it
   * sits on is navy or red in both — it is not the inverse of `text`.
   */
  textInverse: brand.white,
  /** Muted text on navy — readable without shouting. */
  textOnPrimary: '#C7D5EC',

  success: '#15703F',
  successTint: '#E6F3EC',
  warning: '#9A6200',
  warningTint: '#FBF0DE',
  danger: brand.red,
  /** Filled destructive buttons, with white on top. */
  dangerSurface: brand.red,
  dangerTint: '#FAEAEC',

  overlay: 'rgba(16, 19, 25, 0.45)',
};

export type Palette = typeof lightColors;

export const darkColors: Palette = {
  // Lightened well past the logo navy so it reads as a link or an icon against
  // the near-black page.
  primary: '#7FA9F0',
  primaryDeep: '#9DBEF5',
  primaryTint: '#152239',
  // Barely moved: white still has to sit on this.
  primarySurface: '#12305F',

  accent: '#F2707E',
  accentDeep: '#F79AA4',
  accentTint: '#2E1620',

  background: '#080D18',
  surface: '#101A2E',
  surfaceSunken: '#0B1322',
  border: '#1D2942',
  borderStrong: '#2B3A57',

  text: '#F2F5FA',
  textMuted: '#A9B5C9',
  textFaint: '#7B8799',
  textInverse: brand.white,
  textOnPrimary: '#C3D5F2',

  success: '#5BC48D',
  successTint: '#10281D',
  warning: '#E3A94F',
  warningTint: '#2B2214',
  danger: '#F2707E',
  // Not the lightened red: white on that is 2.8:1. The fill stays saturated so
  // "Delete for good" is still legible.
  dangerSurface: '#B62A38',
  dangerTint: '#2E1620',

  overlay: 'rgba(0, 0, 0, 0.62)',
};

/**
 * The light palette, for the few places outside a component that need a colour.
 * Anything rendered should use useTheme() instead.
 */
export const colors = lightColors;

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

/**
 * Shared look for pushed (stack) screens: navy bar, white title, no hairline.
 * Tab screens draw their own large titles instead.
 */
export const stackHeaderFor = (c: Palette) => ({
  headerStyle: { backgroundColor: c.primarySurface },
  headerTintColor: c.textInverse,
  headerTitleStyle: { fontSize: 17, fontWeight: '700' as const, color: c.textInverse },
  headerShadowVisible: false,
  headerBackTitle: 'Back',
});
