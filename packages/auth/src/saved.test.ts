import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";

// `bun test` shares one module registry across a package's test files, so
// `authEnv` and the module-level `authDb` are process-wide singletons: whoever
// imports `db.ts` first pins AUTH_DATABASE_URL for everyone. So this file only
// supplies a throwaway local file DB when the env was not already configured,
// and never overrides or closes what a sibling test file set up. The `file:`
// prefix guarantees we are on a local file — never the remote Turso database,
// even though the outer shell exports an AUTH_DATABASE_URL and AUTH_TURSO_TOKEN.
if (!process.env.BETTER_AUTH_SECRET) {
	process.env.AUTH_DATABASE_URL = `file:${mkdtempSync(join(tmpdir(), "findleiria-saved-"))}/auth.db`;
	process.env.AUTH_TURSO_TOKEN = "";
	process.env.BETTER_AUTH_SECRET = "test-secret-long-enough-to-sign-cookies";
	process.env.BETTER_AUTH_URL = "http://localhost:3300";
	process.env.GOOGLE_CLIENT_ID = "google-client-id-test";
	process.env.GOOGLE_CLIENT_SECRET = "google-client-secret-test";
}

const { authDb: db } = await import("./db");
const schema = await import("./schema");
const { listSavedSlugs, saveEvent, unsaveEvent } = await import("./saved");

// Idempotent: the migration journal already records applied migrations, so
// running this against a database auth.test.ts migrated is a no-op.
beforeAll(async () => {
	await migrate(db, { migrationsFolder: "src/migrations" });
});

async function createUser(id: string, email: string) {
	const now = new Date();
	await db.insert(schema.user).values({
		id,
		name: "Teste",
		email,
		emailVerified: false,
		createdAt: now,
		updatedAt: now,
	});
}

async function savedCount(userId: string): Promise<number> {
	const rows = await db
		.select({ id: schema.savedEvent.id })
		.from(schema.savedEvent)
		.where(eq(schema.savedEvent.userId, userId));
	return rows.length;
}

describe("saved events", () => {
	test("saveEvent twice stays one row (idempotent)", async () => {
		const userId = crypto.randomUUID();
		await createUser(userId, `${userId}@teste.pt`);

		try {
			await saveEvent(userId, "concerto-de-verao");
			await saveEvent(userId, "concerto-de-verao");

			expect(await savedCount(userId)).toBe(1);
			expect(await listSavedSlugs(userId)).toEqual(["concerto-de-verao"]);
		} finally {
			await db.delete(schema.user).where(eq(schema.user.id, userId));
		}
	});

	test("lists newest-saved first", async () => {
		const userId = crypto.randomUUID();
		await createUser(userId, `${userId}@teste.pt`);

		try {
			// Insert at distinct instants: `created_at` is epoch seconds, so three
			// back-to-back `saveEvent` calls can land in the same second and the
			// tie-break is undefined. Direct inserts make the ordering explicit.
			const base = Math.floor(Date.now() / 1000);
			await db.insert(schema.savedEvent).values([
				{
					id: crypto.randomUUID(),
					userId,
					eventSlug: "primeiro",
					createdAt: new Date(base * 1000),
				},
				{
					id: crypto.randomUUID(),
					userId,
					eventSlug: "segundo",
					createdAt: new Date((base + 1) * 1000),
				},
				{
					id: crypto.randomUUID(),
					userId,
					eventSlug: "terceiro",
					createdAt: new Date((base + 2) * 1000),
				},
			]);

			expect(await listSavedSlugs(userId)).toEqual([
				"terceiro",
				"segundo",
				"primeiro",
			]);
		} finally {
			await db.delete(schema.user).where(eq(schema.user.id, userId));
		}
	});

	test("unsaveEvent empties the list and is idempotent", async () => {
		const userId = crypto.randomUUID();
		await createUser(userId, `${userId}@teste.pt`);

		try {
			await saveEvent(userId, "concerto-de-verao");
			await unsaveEvent(userId, "concerto-de-verao");
			await unsaveEvent(userId, "concerto-de-verao");

			expect(await listSavedSlugs(userId)).toEqual([]);
			expect(await savedCount(userId)).toBe(0);
		} finally {
			await db.delete(schema.user).where(eq(schema.user.id, userId));
		}
	});

	test("deleting the user cascades their saved rows away", async () => {
		const userId = crypto.randomUUID();
		await createUser(userId, `${userId}@teste.pt`);
		await saveEvent(userId, "concerto-de-verao");

		await db.delete(schema.user).where(eq(schema.user.id, userId));

		expect(await savedCount(userId)).toBe(0);
	});
});
