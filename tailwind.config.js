/** @type {import('tailwindcss').Config} */
// Brand scales live in src/theme/colors.ts (shared with JS for navigation chrome).
// gray and green are remapped so existing classes pick up the brand palette.
const palette = {
  gray: {
    50: '#F7F5F0', 100: '#EFECE5', 200: '#E2DED4', 300: '#CBC6B9', 400: '#9C978B', 500: '#7A766B',
    600: '#5B5A52', 700: '#3F433C', 800: '#28312B', 900: '#19231E', 950: '#101814',
  },
  green: {
    50: '#EEF6F1', 100: '#D6EADD', 200: '#AED4BB', 300: '#7FB894', 400: '#529A71', 500: '#347F57',
    600: '#256646', 700: '#1D5339', 800: '#1B412F', 900: '#1A3226', 950: '#0E1D16',
  },
  gold: { 300: '#E2CD8B', 400: '#D4BA66', 500: '#C8A94C', 600: '#A88B35' },
};

module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ...palette,
        primary: '#C8A94C',
        bg: '#1A3226',
        'bg-light': '#F5F0E8',
        muted: '#78716C',
        accent: '#E26A2C',
      },
    },
  },
  plugins: [],
};
