/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Merriweather', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      colors: {
        primary: { DEFAULT: '#0d9488', light: '#f0fdf4', dark: '#0f766e' },
        accent: '#0284c7',
      },
    },
  },
  plugins: [],
}
