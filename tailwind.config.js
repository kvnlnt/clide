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
          bg: "#141414",
          surface: "#0a0a0a",
          panel: "#222121",
          border: "#3d3c3c",
          muted: "#575757",
        },
      },
    },
  },
  plugins: [],
};
