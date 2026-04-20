/** @type {import('tailwindcss').Config} */
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
