/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── DAE Palette ──────────────────────────────────────
        cream:  '#F5EFE0',   // light background / surface
        olive: {
          DEFAULT: '#4A5C2A',
          light:   '#5E7335',
          dark:    '#364320',
        },
        amber: {
          DEFAULT: '#C88A2A',
          light:   '#D9A04A',
          dark:    '#9E6B1A',
        },
        sand:   '#D4C9A8',   // muted / neutral
      },
    },
  },
  plugins: [],
}

