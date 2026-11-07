import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f1ff', 100: '#e9e3ff', 200: '#d6ccff', 300: '#b9abff',
          400: '#9384ff', 500: '#6d5bff', 600: '#5747e6', 700: '#4537c4',
          800: '#3a2fa8', 900: '#2f2878',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;