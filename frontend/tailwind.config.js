/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gaming: {
          950: '#090a0f',
          900: '#0f111a',
          850: '#151824',
          800: '#1b1f30',
          700: '#282e47',
          accent: '#00f0ff',
          neon: '#7928ca',
          alert: '#ff0055',
          success: '#00df89'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}

