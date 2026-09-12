import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: "../../apps/server/.env" });
dotenv.config({ path: "../../apps/web/.env" });

const url = process.env.AUTH_DATABASE_URL ?? "file:../../local-auth.db";

export default defineConfig({
	schema: "./src/schema.ts",
	out: "./src/migrations",
	dialect: "turso",
	dbCredentials: {
		url,
		...(process.env.AUTH_TURSO_TOKEN
			? { authToken: process.env.AUTH_TURSO_TOKEN }
			: {}),
	},
});
