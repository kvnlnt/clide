import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Root widened from "src/mainview" to "src" (ticket 138) so the build can
// carry a second page — the voice companion window — alongside the main
// app. Vite mirrors each entry's path relative to root into the output
// (dist/mainview/, dist/companion/), sharing one dist/assets/ bundle.
export default defineConfig({
	plugins: [react()],
	root: "src",
	build: {
		outDir: "../dist",
		emptyOutDir: true,
		rollupOptions: {
			input: {
				mainview: resolve(__dirname, "src/mainview/index.html"),
				companion: resolve(__dirname, "src/companion/index.html"),
			},
		},
	},
	server: {
		port: 5173,
		strictPort: true,
	},
});
