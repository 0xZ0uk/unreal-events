import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// One page, no routes: no router plugin, no generated route tree.
export default defineConfig({
	server: {
		port: 3300,
		// Auth runs on the dev server, but the browser must only ever see one
		// origin — the same shape production has, where the Vercel function sits
		// beside the SPA. `changeOrigin` stays off so the Host header remains
		// :3300 and better-auth builds the Google callback against it.
		proxy: {
			"/api": { target: "http://localhost:3301" },
		},
	},
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [tailwindcss(), react()],
});
