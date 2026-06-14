/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#1a3c34',
        'primary-hover': '#2d4a43',
        'primary-active': '#163129',
        'primary-disabled': '#a8c4bc',
        sage: '#5a8f7a',
        'sage-light': '#99d6b3',
        caramel: '#c9a227',
        danger: '#c45c5c',
        ink: '#1a1a1a',
        muted: '#717171',
        canvas: '#ffffff',
        'surface-soft': '#f7f7f7',
        'surface-card': '#ededed',
        'surface-tertiary': '#e4e4e4',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
}
