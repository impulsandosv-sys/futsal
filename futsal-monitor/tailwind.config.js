/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f5ff',
          100: '#e0ebff',
          200: '#b8d4ff',
          300: '#85b8ff',
          400: '#4a94ff',
          500: '#1a6dff',
          600: '#0052e6',
          700: '#003db3',
          800: '#00308a',
          900: '#002266',
        },
        surface: {
          50: '#f8f9fb',
          100: '#f0f2f5',
          200: '#e2e6ed',
          300: '#c9d0db',
          400: '#9ba7b9',
          500: '#6b7a93',
          600: '#4d5b72',
          700: '#3a4457',
          800: '#262e3d',
          900: '#161b26',
        }
      }
    },
  },
  plugins: [],
}
