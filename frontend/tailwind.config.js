/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: '#1E1E2E', raised: '#2A2A3C', border: '#3A3A4C' },
        safety: { yellow: '#F59E0B', orange: '#F97316' },
        violation: { red: '#EF4444', 'red-dim': '#7F1D1D' },
        compliant: { green: '#22C55E', 'green-dim': '#14532D' },
        neutral: { gray: '#6B7280', blue: '#3B82F6' },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
