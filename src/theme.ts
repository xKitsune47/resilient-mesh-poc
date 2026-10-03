import { configureFonts, MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

/** Design tokens – see DESIGN.md (single source of truth for the visual language). */
export const radius = { xs: 4, sm: 8, md: 12, lg: 16, full: 9999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, gutter: 16 } as const;

// System typeface; hierarchy comes from weight and size (DESIGN.md → Typography).
const fonts = configureFonts({
  config: {
    headlineLarge: { fontSize: 32, fontWeight: '700', lineHeight: 38, letterSpacing: -0.32 }, // display
    titleLarge: { fontSize: 20, fontWeight: '600', lineHeight: 26, letterSpacing: 0 }, // title-lg
    titleMedium: { fontSize: 17, fontWeight: '600', lineHeight: 23, letterSpacing: 0 }, // title-md
    bodyLarge: { fontSize: 16, fontWeight: '400', lineHeight: 23, letterSpacing: 0 }, // body-lg
    bodyMedium: { fontSize: 14, fontWeight: '400', lineHeight: 20, letterSpacing: 0 }, // body-md
    labelMedium: { fontSize: 13, fontWeight: '500', lineHeight: 17, letterSpacing: 0 }, // label-md
    labelSmall: { fontSize: 11, fontWeight: '500', lineHeight: 14, letterSpacing: 0 }, // label-sm
  },
});

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 4,
  fonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#0052A5',
    onPrimary: '#FFFFFF',
    primaryContainer: '#D6E6F8',
    onPrimaryContainer: '#0A2A52',
    // Crimson is an identity accent only – never an action colour.
    secondary: '#D4213D',
    onSecondary: '#FFFFFF',
    // Paper paints chips / tonal buttons / segmented buttons with the secondary container: keep them blue.
    secondaryContainer: '#D6E6F8',
    onSecondaryContainer: '#0A2A52',
    tertiary: '#0052A5',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#D6E6F8',
    onTertiaryContainer: '#0A2A52',
    error: '#D32F2F',
    onError: '#FFFFFF',
    background: '#F2F5FA',
    onBackground: '#1A2233',
    surface: '#FFFFFF',
    onSurface: '#1A2233',
    surfaceVariant: '#E8EEF6',
    onSurfaceVariant: '#5B6577',
    outline: '#8A94A6',
    outlineVariant: '#DDE3EC',
    inverseSurface: '#1A2233',
    inverseOnSurface: '#F2F5FA',
    inversePrimary: '#4A9EF0',
    surfaceDisabled: '#E8EEF6',
    onSurfaceDisabled: '#8A94A6',
    backdrop: 'rgba(26, 34, 51, 0.4)',
    elevation: {
      level0: 'transparent',
      level1: '#FFFFFF',
      level2: '#FFFFFF',
      level3: '#FFFFFF',
      level4: '#FFFFFF',
      level5: '#FFFFFF',
    },
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: 4,
  fonts,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#4A9EF0',
    onPrimary: '#06213F',
    primaryContainer: '#17406E',
    onPrimaryContainer: '#D6E6F8',
    secondary: '#D4213D',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#17406E',
    onSecondaryContainer: '#D6E6F8',
    tertiary: '#4A9EF0',
    onTertiary: '#06213F',
    tertiaryContainer: '#17406E',
    onTertiaryContainer: '#D6E6F8',
    background: '#15171B',
    onBackground: '#F1F3F6',
    surface: '#23262B',
    onSurface: '#F1F3F6',
    surfaceVariant: '#2D3137',
    onSurfaceVariant: '#A4ACB9',
    outline: '#6B7482',
    outlineVariant: '#343941',
    inverseSurface: '#F1F3F6',
    inverseOnSurface: '#15171B',
    inversePrimary: '#0052A5',
    surfaceDisabled: '#2D3137',
    onSurfaceDisabled: '#6B7482',
    backdrop: 'rgba(0, 0, 0, 0.6)',
    // No shadows in dark mode: levels are told apart by a lighter surface.
    elevation: {
      level0: 'transparent',
      level1: '#23262B',
      level2: '#282B31',
      level3: '#2D3137',
      level4: '#30343B',
      level5: '#343941',
    },
  },
};

/** Semantic colors not covered by MD3. */
export const statusColors = {
  connected: '#22A06B',
  searching: '#E2A400',
  offline: '#8A8F8E',
  error: '#D32F2F',
};
