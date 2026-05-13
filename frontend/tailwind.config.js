/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#0f2d52',     // richer navy (was flat #0c2340)
          green: '#10b981',       // emerald — unchanged
          teal: '#059669',        // emerald dark — unchanged
          dark: '#064e3b',        // sidebar from-color — unchanged
          darker: '#065f46',      // sidebar to-color — unchanged
          bg: '#f6f7f9',          // neutral off-white (was mintish #f0fdf4)
          light: '#f0f4f8',       // neutral light (was mint #ecfdf5)
          muted: '#6b7280',       // consistent muted text token
        },
      },
      fontFamily: {
        display: ['Merriweather', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delay': 'float 6s ease-in-out 2s infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
