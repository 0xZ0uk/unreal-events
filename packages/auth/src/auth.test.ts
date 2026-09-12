/**
 * Auth round-trip against a real libSQL file database, through the same Hono
 * handler the Vercel function and the dev server use.
 *
 * The point is the schema: a hand-written Drizzle schema is only correct if
 * better-auth can actually read and write it, so every assertion here walks
 * through the adapter rather than mocking it.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";

const dir = mkdtempSync(join(tmpdir(), "findleiria-auth-"));
process.env.AUTH_DATABASE_URL = `file:${join(dir, "auth.db")}`;
process.env.BETTER_AUTH_SECRET = "test-secret-long-enough-to-sign-cookies";
process.env.BETTER_AUTH_URL = "http://localhost:3300";
process.env.GOOGLE_CLIENT_ID = "google-client-id-test";
process.env.GOOGLE_CLIENT_SECRET = "google-client-secret-test";

const { authDb } = await import("./db");
const { authRoutes } = await import("./routes");
const { session: sessionTable, user } = await import("./schema");

const ORIGIN = "http://localhost:3300";
const EMAIL = "conta@findleiria.pt";
const PASSWORD = "uma-password-boa-123";

async function request(
	path: string,
	init: RequestInit & { json?: unknown } = {},
): Promise<Response> {
	const { json: body, headers: extra, ...rest } = init;
	const headers: Record<string, string> = {
		origin: ORIGIN,
		...((extra as Record<string, string>) ?? {}),
	};
	if (body !== undefined) headers["content-type"] = "application/json";

	return authRoutes.request(path, {
		method: body === undefined ? "GET" : "POST",
		...rest,
		headers,
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}

/** Cookie header for a follow-up request, from a response's Set-Cookie. */
function cookies(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((cookie) => cookie.split(";")[0])
		.join("; ");
}

beforeAll(async () => {
	const { migrate } = await import("drizzle-orm/libsql/migrator");
	await migrate(authDb, { migrationsFolder: "src/migrations" });
});

afterAll(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("email + password", () => {
	let sessionCookie = "";

	test("creates the account and starts a session", async () => {
		const response = await request("/api/auth/sign-up/email", {
			json: { email: EMAIL, password: PASSWORD, name: "Zé de Leiria" },
		});

		expect(response.status).toBe(200);
		sessionCookie = cookies(response);
		expect(sessionCookie).toContain("findleiria.session_token");

		const body = (await response.json()) as { user: { email: string } };
		expect(body.user.email).toBe(EMAIL);

		// The row landed in the schema we wrote, not somewhere better-auth guessed.
		const rows = await authDb.select().from(user).where(eq(user.email, EMAIL));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.emailVerified).toBe(false);
		expect(rows[0]?.createdAt).toBeInstanceOf(Date);
	});

	test("rejects a password below the minimum", async () => {
		const response = await request("/api/auth/sign-up/email", {
			json: { email: "curta@findleiria.pt", password: "abc", name: "Curta" },
		});

		expect(response.status).toBe(400);
	});

	test("rejects the same email twice", async () => {
		const response = await request("/api/auth/sign-up/email", {
			json: { email: EMAIL, password: PASSWORD, name: "Outro" },
		});

		expect(response.status).toBeGreaterThanOrEqual(400);
	});

	test("reads the user back from the session cookie", async () => {
		const response = await request("/api/auth/get-session", {
			headers: { cookie: sessionCookie },
		});

		expect(response.status).toBe(200);
		const body = (await response.json()) as { user: { email: string } };
		expect(body.user.email).toBe(EMAIL);
	});

	test("rejects the wrong password", async () => {
		const response = await request("/api/auth/sign-in/email", {
			json: { email: EMAIL, password: "nao-e-esta-123" },
		});

		expect(response.status).toBe(401);
	});

	test("signs back in with the right password", async () => {
		const response = await request("/api/auth/sign-in/email", {
			json: { email: EMAIL, password: PASSWORD },
		});

		expect(response.status).toBe(200);
		expect(cookies(response)).toContain("findleiria.session_token");
	});

	test("signs out, clears the cookie and deletes the session", async () => {
		const before = await authDb.select().from(sessionTable);

		const response = await request("/api/auth/sign-out", {
			json: {},
			headers: { cookie: sessionCookie },
		});

		expect(response.status).toBe(200);

		// What the browser sees: the session cookies come back expired.
		const cleared = response.headers.getSetCookie();
		expect(
			cleared.some((cookie) => cookie.startsWith("findleiria.session_token=;")),
		).toBe(true);
		expect(cleared.every((cookie) => cookie.includes("Max-Age=0"))).toBe(true);

		// What the database sees: that one session is gone. (A replayed
		// pre-sign-out cookie can still read the session for up to
		// `cookieCache.maxAge` — the documented cost of not hitting the
		// database on every page load.)
		const after = await authDb.select().from(sessionTable);
		expect(after).toHaveLength(before.length - 1);
	});
});

describe("google", () => {
	test("builds the authorize URL with our callback", async () => {
		const response = await request("/api/auth/sign-in/social", {
			json: { provider: "google", callbackURL: `${ORIGIN}/` },
		});

		expect(response.status).toBe(200);
		const body = (await response.json()) as { url: string };
		const url = new URL(body.url);

		expect(url.origin + url.pathname).toBe(
			"https://accounts.google.com/o/oauth2/v2/auth",
		);
		expect(url.searchParams.get("client_id")).toBe("google-client-id-test");
		expect(url.searchParams.get("redirect_uri")).toBe(
			`${ORIGIN}/api/auth/callback/google`,
		);
		expect(url.searchParams.get("prompt")).toBe("select_account");
		expect(url.searchParams.get("response_type")).toBe("code");
	});
});
