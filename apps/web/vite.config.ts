import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// One page, no routes: no router plugin, no generated route tree.
export default defineConfig({
	server: {
		port: 3300,
	},
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [tailwindcss(), react()],
});
