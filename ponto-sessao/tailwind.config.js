/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mel queimado (botões escuros)
        honey: {
          50: '#faf6f0',
          100: '#f4ede1',
          200: '#e8dcc4',
          300: '#dccaa6',
          400: '#d0b888',
          500: '#b8956a',
          600: '#9d7d55',
          700: '#7a6345',
          800: '#5d4d38',
          900: '#4a3d2d',
          950: '#3a2d22',
        },
        // Ouro/Dourado para acentos
        gold: {
          50: '#fffef8',
          100: '#fffdf0',
          200: '#fffae0',
          300: '#fff8d6',
          400: '#fff5c2',
          500: '#f5e6a8',
          600: '#e6d080',
          700: '#d4b960',
          800: '#c5a540',
          900: '#b8932d',
          950: '#8a6e1f',
        },
      },
    },
  },
  plugins: [],
}
