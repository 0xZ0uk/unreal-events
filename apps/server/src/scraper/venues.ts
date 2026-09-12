import { db, schema } from "@events-tracker/db";
import { count, inArray } from "drizzle-orm";

import { isVagueVenue, venuesMatch, venueTokens } from "./normalize";

/**
 * Venue-row deduplication (RULE 1 wiring). Two sources can mint the same
 * physical place under different spellings (`BLACK BOX` vs `Black Box -
 * Plataforma de Criação Artística de Leiria`), yielding two venue rows whose
 * different slugs then fork event identity. This pass fuses them.
 *
 * STRICT `venuesMatch` ONLY — the same matcher used by resolveOrCreateVenue.
 * Vague/placeholder venue rows ("Leiria (cidade)") never match anything, so
 * a city-level announcement is never used as a hub to collapse every venue
 * into one. Idempotent: a converged DB fuses 0 rows.
 */
export async function mergeDuplicateVenues(): Promise<number> {
	const venues = await db
		.select({
			id: schema.venues.id,
			name: schema.venues.name,
			city: schema.venues.city,
			slug: schema.venues.slug,
		})
		.from(schema.venues);

	const counts = await db
		.select({ venueId: schema.events.venue_id, n: count() })
		.from(schema.events)
		.groupBy(schema.events.venue_id);
	const eventCount = new Map<number, number>();
	for (const c of counts) {
		if (c.venueId != null) eventCount.set(c.venueId, c.n);
	}

	// Union-find on STRICT venuesMatch.
	const parent = new Map<number, number>();
	const find = (x: number): number => {
		const p = parent.get(x);
		if (p === undefined || p === x) {
			if (p === undefined) parent.set(x, x);
			return x;
		}
		const root = find(p);
		parent.set(x, root);
		return root;
	};
	const union = (a: number, b: number): void => {
		const ra = find(a);
		const rb = find(b);
		if (ra !== rb) parent.set(rb, ra);
	};

	for (const v of venues) find(v.id);
	for (const a of venues) {
		for (const b of venues) {
			if (a.id >= b.id) continue;
			if (venuesMatch(a.name, b.name, a.city, b.city)) {
				union(a.id, b.id);
			}
		}
	}

	const byRoot = new Map<number, typeof venues>();
	for (const v of venues) {
		const root = find(v.id);
		const list = byRoot.get(root) ?? [];
		list.push(v);
		byRoot.set(root, list);
	}

	// Canonical row preference: non-vague first, then fewest discriminating
	// tokens, then most events, then lowest id.
	type VenueWithTags = (typeof venues)[number];
	const score = (v: VenueWithTags): [number, number, number, number] => [
		isVagueVenue(v.name, v.city) ? 1 : 0,
		venueTokens(v.name, v.city).length,
		-(eventCount.get(v.id) ?? 0),
		v.id,
	];

	let merged = 0;
	for (const component of byRoot.values()) {
		if (component.length < 2) continue;
		const [canonical] = [...component].sort((a, b) => {
			const sa = score(a);
			const sb = score(b);
			return sa[0] - sb[0] || sa[1] - sb[1] || sa[2] - sb[2] || sa[3] - sb[3];
		});
		if (!canonical) continue;
		const aliasIds = component
			.filter((v) => v.id !== canonical.id)
			.map((v) => v.id);

		// Re-point the alias venues' events at the canonical row, then drop
		// the alias venue rows (event_sources reference events, not venues).
		await db
			.update(schema.events)
			.set({ venue_id: canonical.id })
			.where(inArray(schema.events.venue_id, aliasIds));
		await db.delete(schema.venues).where(inArray(schema.venues.id, aliasIds));

		merged += aliasIds.length;
	}
	return merged;
}

// Standalone execution: bun run src/scraper/venues.ts
if (import.meta.main) {
	const n = await mergeDuplicateVenues();
	console.log(JSON.stringify({ mergedAliases: n }));
}
