/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#1a3c34', light: '#5a8f7a', accent: '#71b394', muted: '#e8f0ed' },
      },
    },
  },
  plugins: [],
}
