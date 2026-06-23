/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/mainview/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["Menlo", "Monaco", "Consolas", "monospace"],
      },
      colors: {
        clide: {
          bg: "#151212",
          surface: "#0f0d0d",
          panel: "#1e1c1c",
          border: "#3d3c3c",
          muted: "#575757",
        },
      },
    },
  },
  plugins: [],
};
