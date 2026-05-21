/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Summit Clean brand palette
        // Mapped to override Tailwind defaults so existing classes
        // (bg-stone-50, text-amber-700, etc.) auto-pick up the new colors
        // without needing to touch component code.
        stone: {
          50:  '#FAF8F4',  // Warm cream — primary page background
          100: '#F2EEE5',  // Slightly darker cream — section/light bg
          200: '#E8E3DA',  // Warm border / divider
          300: '#D5CFC2',  // Stronger border / disabled bg
          400: '#9F9689',  // Muted accent / icon
          500: '#6B6258',  // Warm grey — muted/secondary text
          600: '#4F4842',  // Body secondary
          700: '#2B2622',  // Near-black — body text
          800: '#1C1916',  // Stronger near-black
          900: '#0A0A0A',  // Deep black — header bars / dark backgrounds
          950: '#000000',  // Pure black
        },
        amber: {
          50:  '#FAF3E5',  // Pale gold tint — highlight bg
          100: '#F0DDB5',  // Light gold — badges
          200: '#E5C896',  // Lighter gold
          300: '#DAB377',  // Mid-light gold
          400: '#D2A668',  // Mid gold
          500: '#C99B5C',  // Summit Clean primary gold
          600: '#B68749',  // Slightly deeper gold
          700: '#9F7438',  // Dark gold (for "amber-700" text accents)
          800: '#7F5B2A',  // Very dark gold
          900: '#5C411F',  // Deep brown-gold
        },
        // Emerald (success/done) — softened to fit warmer palette but still readable
        emerald: {
          50:  '#E8F5EE',
          100: '#CCE9D7',
          200: '#9FD3B5',
          300: '#73BD93',
          500: '#3F9D6F',
          600: '#318759',
          700: '#266B47',
          800: '#1F5538',
        },
      },
    },
  },
  plugins: [],
};
