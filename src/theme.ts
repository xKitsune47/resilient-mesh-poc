import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

/** Polish flag: white + crimson red. */
const brand = {
  primary: '#DC143C',
  secondary: '#9E1B32',
};

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: brand.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: '#FFDADF',
    onPrimaryContainer: '#410010',
    secondary: brand.secondary,
    onSecondary: '#FFFFFF',
    secondaryContainer: '#FFE5E8',
    onSecondaryContainer: '#3F0010',
    tertiary: brand.secondary,
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#FFE5E8',
    onTertiaryContainer: '#3F0010',
    background: '#FFFFFF',
    onBackground: '#1A1A1A',
    surface: '#FFFFFF',
    onSurface: '#1A1A1A',
    surfaceVariant: '#F4F1F1',
    onSurfaceVariant: '#5A5555',
    outline: '#8C8585',
    outlineVariant: '#E5DEDF',
    inverseSurface: '#2B2B2B',
    inverseOnSurface: '#F5F5F5',
    inversePrimary: '#FFB3BE',
    surfaceDisabled: 'rgba(26, 26, 26, 0.12)',
    onSurfaceDisabled: 'rgba(26, 26, 26, 0.38)',
    elevation: {
      level0: 'transparent',
      level1: '#FFFFFF',
      level2: '#FCF8F8',
      level3: '#FAF4F5',
      level4: '#F9F2F3',
      level5: '#F7EFF0',
    },
  },
};

/** True dark: black + neutral grays, no hue. */
export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: 3,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#E6E6E6',
    onPrimary: '#121212',
    primaryContainer: '#333333',
    onPrimaryContainer: '#F2F2F2',
    secondary: '#BDBDBD',
    onSecondary: '#121212',
    secondaryContainer: '#2A2A2A',
    onSecondaryContainer: '#E6E6E6',
    tertiary: '#BDBDBD',
    onTertiary: '#121212',
    tertiaryContainer: '#2A2A2A',
    onTertiaryContainer: '#E6E6E6',
    background: '#000000',
    onBackground: '#EDEDED',
    surface: '#121212',
    onSurface: '#EDEDED',
    surfaceVariant: '#1F1F1F',
    onSurfaceVariant: '#B3B3B3',
    outline: '#7A7A7A',
    outlineVariant: '#2E2E2E',
    inverseSurface: '#EDEDED',
    inverseOnSurface: '#1A1A1A',
    inversePrimary: '#3D3D3D',
    surfaceDisabled: 'rgba(237, 237, 237, 0.12)',
    onSurfaceDisabled: 'rgba(237, 237, 237, 0.38)',
    backdrop: 'rgba(0, 0, 0, 0.6)',
    elevation: {
      level0: 'transparent',
      level1: '#161616',
      level2: '#1B1B1B',
      level3: '#202020',
      level4: '#222222',
      level5: '#262626',
    },
  },
};

/** Semantic colors not covered by MD3. */
export const statusColors = {
  connected: '#22A06B',
  searching: '#E2A400',
  offline: '#8A8F8E',
  error: '#D64545',
};
