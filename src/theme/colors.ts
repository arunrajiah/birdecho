/**
 * BirdEcho palette. Tailwind's `gray` and `green` are remapped to these scales in
 * tailwind.config.js, so every `gray-*` / `green-*` class uses the brand colours:
 * warm stone neutrals tinted toward the forest green, and a forest green scale.
 */
export const gray = {
  50: '#F7F5F0',
  100: '#EFECE5',
  200: '#E2DED4',
  300: '#CBC6B9',
  400: '#9C978B',
  500: '#7A766B',
  600: '#5B5A52',
  700: '#3F433C',
  800: '#28312B',
  900: '#19231E',
  950: '#101814',
} as const;

export const green = {
  50: '#EEF6F1',
  100: '#D6EADD',
  200: '#AED4BB',
  300: '#7FB894',
  400: '#529A71',
  500: '#347F57',
  600: '#256646',
  700: '#1D5339',
  800: '#1B412F',
  900: '#1A3226',
  950: '#0E1D16',
} as const;

export const gold = {
  300: '#E2CD8B',
  400: '#D4BA66',
  500: '#C8A94C',
  600: '#A88B35',
} as const;

export const colors = {
  primary: gold[500],
  bg: green[900],
  bgLight: '#F5F0E8',
  muted: '#78716C',
  accent: '#E26A2C',
} as const;

/** Navigation chrome (headers, tab bar) for each colour scheme. */
export function chrome(isDark: boolean) {
  return {
    canvas: isDark ? gray[950] : gray[50],
    surface: isDark ? gray[900] : '#FFFFFF',
    text: isDark ? gray[50] : gray[900],
    border: isDark ? gray[800] : gray[200],
    tint: isDark ? green[300] : green[700],
    inactive: isDark ? gray[500] : gray[400],
  };
}
