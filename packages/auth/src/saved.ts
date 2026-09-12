import { and, desc, eq } from "drizzle-orm";

import { authDb } from "./db.js";
import { savedEvent } from "./schema.js";

/**
 * A user's saved-event slice: idempotent save/unsave and a newest-first slug
 * list, all on the auth database. The unique (user, slug) index is what makes
 * `saveEvent` a no-op when the row already exists.
 */

/** Newest first — the saved page reads newest-saved on top. */
export async function listSavedSlugs(userId: string): Promise<string[]> {
	const rows = await authDb
		.select({ eventSlug: savedEvent.eventSlug })
		.from(savedEvent)
		.where(eq(savedEvent.userId, userId))
		.orderBy(desc(savedEvent.createdAt));

	return rows.map((row) => row.eventSlug);
}

export async function saveEvent(userId: string, slug: string): Promise<void> {
	await authDb
		.insert(savedEvent)
		.values({
			id: crypto.randomUUID(),
			userId,
			eventSlug: slug,
			createdAt: new Date(),
		})
		.onConflictDoNothing();
}

export async function unsaveEvent(userId: string, slug: string): Promise<void> {
	await authDb
		.delete(savedEvent)
		.where(and(eq(savedEvent.userId, userId), eq(savedEvent.eventSlug, slug)));
}
