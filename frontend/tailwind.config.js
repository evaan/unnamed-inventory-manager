/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Existing surface utilities follow the active neutral theme.
        slate: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => [
            shade, `rgb(var(--neutral-${shade}) / <alpha-value>)`,
          ]),
        ),
        // White accents become charcoal in light mode for readable contrast.
        white: 'rgb(var(--accent) / <alpha-value>)',
        emerald: { 300: 'rgb(var(--success-text) / <alpha-value>)' },
        amber: { 300: 'rgb(var(--warning-text) / <alpha-value>)' },
        rose: { 300: 'rgb(var(--danger-text) / <alpha-value>)' },
      },
    },
  },
  plugins: [],
}
