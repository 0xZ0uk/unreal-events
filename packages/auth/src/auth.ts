import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";

import type { createAuthDb } from "./db";
import { authDb } from "./db";
import { authEnv, getTrustedOrigins } from "./env";
import * as schema from "./schema";

type AuthDb = ReturnType<typeof createAuthDb>;

/**
 * The better-auth instance.
 *
 * Two sign-in methods, both needed: Google because most people arrive on a
 * phone where typing is the tax, email/password for the rest. No mailer is
 * wired yet, so email verification stays off and Google is the recovery path —
 * hence account linking, which lets someone who signed up with a password later
 * add Google on the same address and keep one account.
 */
export function createAuth(database: AuthDb = authDb) {
	return betterAuth({
		appName: "FindLeiria",
		baseURL: authEnv.BETTER_AUTH_URL,
		secret: authEnv.BETTER_AUTH_SECRET,
		trustedOrigins: getTrustedOrigins(),
		database: drizzleAdapter(database, { provider: "sqlite", schema }),
		emailAndPassword: {
			enabled: true,
			autoSignIn: true,
			minPasswordLength: 8,
			maxPasswordLength: 128,
			requireEmailVerification: false,
		},
		socialProviders: {
			google: {
				clientId: authEnv.GOOGLE_CLIENT_ID,
				clientSecret: authEnv.GOOGLE_CLIENT_SECRET,
				// People share phones here; always offer the account picker.
				prompt: "select_account",
			},
		},
		// Phones get opened once a month, not once a day.
		session: {
			expiresIn: 60 * 60 * 24 * 30,
			updateAge: 60 * 60 * 24,
			// Signed cookie cache: a page load costs no database round-trip.
			// Tradeoff, kept short on purpose: a revoked session still reads as
			// valid for up to a minute if someone replays the old cookie.
			cookieCache: { enabled: true, maxAge: 60 },
		},
		account: {
			accountLinking: { enabled: true, trustedProviders: ["google"] },
		},
		advanced: { cookiePrefix: "findleiria" },
		telemetry: { enabled: false },
	});
}

export const auth = createAuth();
export type Auth = ReturnType<typeof createAuth>;
