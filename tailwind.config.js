/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/mainview/**/*.{html,js,ts,jsx,tsx}", "./src/companion/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["Menlo", "Monaco", "Consolas", "monospace"],
      },
      colors: {
        clide: {
          bg: "#151212",
          // A subtle lift above `bg`, not a darker well — cards should read
          // as part of the page, not as black boxes punched into it.
          surface: "#1c1a1a",
          panel: "#211f1f",
          border: "#2a2828",
          muted: "#575757",
        },
      },
    },
  },
  plugins: [],
};
