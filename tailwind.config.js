/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6C3CE1',
        secondary: '#00C896',
        accent: '#FF6B35',
        dark: '#1A1A2E',
        'dark-card': '#16213E',
        'dark-border': '#0F3460',
      },
      fontFamily: {
        display: ['Fredoka One', 'cursive'],
        body: ['Nunito', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
