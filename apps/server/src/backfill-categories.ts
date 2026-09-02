import { db, schema } from "@events-tracker/db";
import { eq } from "drizzle-orm";

import { canonicalizeCategories, unknownCategory } from "./scraper/categories";

/**
 * Backfill CLI — re-canonicalize `events.categories` for all existing rows.
 * Run once after adopting canonical categories (SLICE_6); idempotent.
 *
 * Usage:
 *   bun run src/backfill-categories.ts
 */
let changed = 0;
let untouched = 0;

const rows = await db
	.select({ id: schema.events.id, categories: schema.events.categories })
	.from(schema.events);

const unknown = new Set<string>();

for (const row of rows) {
	const raw = row.categories ?? [];
	const next = canonicalizeCategories(raw);
	for (const label of raw) {
		const unk = unknownCategory(label);
		if (unk) unknown.add(unk);
	}
	if (JSON.stringify(next) !== JSON.stringify(raw)) {
		await db
			.update(schema.events)
			.set({ categories: next, updated_at: Math.floor(Date.now() / 1000) })
			.where(eq(schema.events.id, row.id));
		changed++;
	} else {
		untouched++;
	}
}

console.log(
	`backfill-categories: ${rows.length} events scanned, ${changed} updated, ${untouched} already canonical`,
);
if (unknown.size > 0) {
	console.log(`unmapped labels left as-is (${unknown.size}):`);
	for (const label of [...unknown].sort()) {
		console.log(`  - ${label}`);
	}
}
