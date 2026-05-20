/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Only activate dark mode with an explicit class, never automatically
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy primary colors (kept for any remaining usage)
        primary: {
          50: '#f0f9f9',
          100: '#ccefed',
          200: '#99dfdb',
          300: '#5fcbc5',
          400: '#2fb5ae',
          500: '#14A89C',
          600: '#0e8a84',
          700: '#0A6B66',
          800: '#0A373A',
          900: '#072526',
          950: '#041414',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
