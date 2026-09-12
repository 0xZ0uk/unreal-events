import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Env for the auth runtime only.
 *
 * Deliberately separate from `@events-tracker/env/server`: the auth function
 * lives on Vercel and has no business requiring the events `DATABASE_URL` or
 * `CORS_ORIGIN` just to boot. Two databases, two env modules.
 */
export const authEnv = createEnv({
	server: {
		// libSQL URL of the auth database. `file:...` in dev, `libsql://...` in prod.
		AUTH_DATABASE_URL: z.string().min(1),
		// Only set when AUTH_DATABASE_URL points at a remote Turso database.
		AUTH_TURSO_TOKEN: z.string().min(1).optional(),
		// Signs session cookies. Rotating it logs everyone out.
		BETTER_AUTH_SECRET: z.string().min(32),
		// Public origin of the app, used for callback URLs and trusted origins.
		BETTER_AUTH_URL: z.url(),
		// Comma-separated extra origins (vercel previews, localhost ports).
		AUTH_TRUSTED_ORIGINS: z.string().optional(),
		GOOGLE_CLIENT_ID: z.string().min(1),
		GOOGLE_CLIENT_SECRET: z.string().min(1),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	runtimeEnv: process.env,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});

/**
 * Loopback spellings of the public origin, added in development only.
 *
 * `localhost` and `127.0.0.1` are the same machine but not the same origin, so
 * a dev server bound to one and a browser that typed the other ends in a 403
 * `INVALID_ORIGIN` that looks like a broken sign-in. Only ever added outside
 * production: on a real host an unexpected origin is a real attack.
 */
function developmentLoopbackAliases(): string[] {
	if (authEnv.NODE_ENV === "production") return [];

	const { protocol, port } = new URL(authEnv.BETTER_AUTH_URL);
	const suffix = port ? `:${port}` : "";

	return ["localhost", "127.0.0.1", "[::1]"].map(
		(host) => `${protocol}//${host}${suffix}`,
	);
}

/** Every origin the browser may send auth requests from. */
export function getTrustedOrigins(): string[] {
	const extra = (authEnv.AUTH_TRUSTED_ORIGINS ?? "")
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);

	return [
		...new Set([
			authEnv.BETTER_AUTH_URL,
			...developmentLoopbackAliases(),
			...extra,
		]),
	];
}
