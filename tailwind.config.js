/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#db0011', // HSBC Red
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#450a0a',
        },
        secondary: '#333333',
        profit: '#00847d', // HSBC Success Green
        loss: '#db0011',   // HSBC Error Red
        gold: '#c29b40',   // HSBC Accent Gold
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}

