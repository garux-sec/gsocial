/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
        },
        surface: 'rgba(30, 30, 46, 0.8)',
        'surface-alt': 'rgba(40, 40, 60, 0.6)',
        positive: {
          DEFAULT: '#22c55e',
          bg: 'rgba(34, 197, 94, 0.12)',
        },
        negative: {
          DEFAULT: '#ef4444',
          bg: 'rgba(239, 68, 68, 0.12)',
        },
        'neutral-accent': '#f59e0b',
        'neutral-bg': 'rgba(245, 158, 11, 0.12)',
      },
    },
  },
  plugins: [],
}
