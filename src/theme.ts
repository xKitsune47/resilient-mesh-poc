import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

const brand = {
  primary: '#0B8A6F',
  secondary: '#3A6B8C',
};

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: brand.primary,
    primaryContainer: '#C9F2E6',
    onPrimaryContainer: '#00382C',
    secondary: brand.secondary,
    secondaryContainer: '#D3E6F5',
    background: '#F6F8F7',
    surface: '#FFFFFF',
    surfaceVariant: '#E6ECEA',
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  roundness: 3,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#5FD6B7',
    onPrimary: '#00382C',
    primaryContainer: '#0F5343',
    onPrimaryContainer: '#C9F2E6',
    secondary: '#9CC9EA',
    secondaryContainer: '#244B63',
    background: '#0F1413',
    surface: '#161C1B',
    surfaceVariant: '#26302E',
  },
};

/** Semantic colors not covered by MD3. */
export const statusColors = {
  connected: '#22A06B',
  searching: '#E2A400',
  offline: '#8A8F8E',
  error: '#D64545',
};
