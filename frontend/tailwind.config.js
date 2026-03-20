/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset')],
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f6fbef',
        ink: '#243526',
        accent: '#58cc02',
        accentDark: '#46a302',
        sky: '#1cb0f6',
        positive: '#58cc02',
        danger: '#ff4b4b',
      },
    },
  },
  plugins: [],
};
