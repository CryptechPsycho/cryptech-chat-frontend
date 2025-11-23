/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "ct-bg": "#050816",
        "ct-card": "#070B1C",
        "ct-accent": "#4C6FFF",
        "ct-accent-soft": "#22D3EE",
      },
    },
  },
  plugins: [],
};
