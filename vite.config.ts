import { defineConfig } from "vite";

export default defineConfig({
  plugins: [],
  root: "src/views/main",
  build: {
    outDir: "../../../dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
