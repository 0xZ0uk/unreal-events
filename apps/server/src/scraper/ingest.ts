import { db, schema } from "@events-tracker/db";
import { eq } from "drizzle-orm";

import { canonicalizeCategories } from "./categories";
import { fingerprint, fingerprintUndated } from "./fingerprint";
import { normalizeVenueName, slugify } from "./normalize";
import { purgePastEvents } from "./purge";
import { reconcileIdentities } from "./reconcile";
import type { RawEvent } from "./types";

/** Resolve (by normalized slug) or create a venue, returning its stable id. */
async function resolveOrCreateVenue(
	venueName: string,
	city: string | null,
): Promise<number> {
	const name = normalizeVenueName(venueName);
	const slug = slugify(name) || "venue-desconhecido";

	const existing = await db.query.venues.findFirst({
		where: eq(schema.venues.slug, slug),
	});
	if (existing) {
		return existing.id;
	}

	const inserted = await db
		.insert(schema.venues)
		.values({
			name: name || venueName.trim(),
			slug,
			// District scope: an unresolvable city still belongs to the tracker
			// (the sources pre-filter by district); label it honestly.
			city: city ?? "Leiria (distrito)",
		})
		.onConflictDoNothing({ target: schema.venues.slug })
		.returning({ id: schema.venues.id });
	if (inserted[0]) {
		return inserted[0].id;
	}
	const row = await db.query.venues.findFirst({
		where: eq(schema.venues.slug, slug),
	});
	if (!row) {
		throw new Error(`Failed to resolve or create venue: ${slug}`);
	}
	return row.id;
}

interface EventWrite {
	action: "inserted" | "updated" | "unchanged" | "skippedPast";
}

/** Upsert a single raw event into events + event_sources. */
async function upsertEvent(raw: RawEvent, source: string): Promise<EventWrite> {
	const now = Math.floor(Date.now() / 1000);
	// Past guard (end-aware, SLICE_7): archive-y sources (CM Leiria RSS serves
	// its full historical agenda; Cister FM lists past festas) emit events
	// whose date is already gone. Skip only when the event has FULLY ENDED —
	// `(endAt ?? startAt) < now`. A past startAt alone must NOT drop an
	// ongoing multi-day festa (Vestiaria 28 Aug–8 Sep, Tremoceira 4–7 Sep) —
	// those are exactly the events users want mid-festa. Never write them:
	// they'd be invisible to queries but bloat the DB and get purged moments
	// later. Skips BEFORE venue resolution so stale raws can't even mint
	// venue rows.
	const guardAt = raw.endAt ?? raw.startAt;
	if (guardAt != null && guardAt < now) {
		return { action: "skippedPast" };
	}
	const venueId = await resolveOrCreateVenue(raw.venueName, raw.city);
	// Deterministic venue ref independent of DB state → stable across scrapes.
	const venueRef = slugify(normalizeVenueName(raw.venueName));
	// Canonical taxonomy (SLICE_6): collapse variants, drop platform names.
	// Applied on both write paths; change detection below compares canonical
	// values so re-scrapes converge instead of flip-flopping.
	const categories = canonicalizeCategories(raw.categories);
	// Undated raws hash a literal UNDATED marker so re-scrapes dedupe instead
	// of minting a new fingerprint per ingestion timestamp.
	const fp =
		raw.startAt != null
			? fingerprint(raw.title, venueRef, raw.startAt)
			: fingerprintUndated(raw.title, venueRef);

	const existing = await db.query.events.findFirst({
		where: eq(schema.events.fingerprint, fp),
	});

	if (existing) {
		// Cross-source reconciliation: a second source seeing the same event
		// may carry a category the first lacked, or a time the first lacked.
		// Union categories (no data loss), backfill blanks — never overwrite
		// the first source's values, so re-scrapes converge instead of
		// flip-flopping between sources' fields.
		const existingCats = (existing.categories ?? []) as string[];
		const mergedCats = [...new Set([...existingCats, ...categories])].sort();
		const mergedEnd =
			existing.end_at ?? (raw.startAt != null ? raw.endAt : null);
		const mergedUrl = existing.url ?? raw.url;
		const changed =
			JSON.stringify(existingCats) !== JSON.stringify(mergedCats) ||
			existing.end_at !== mergedEnd ||
			existing.url !== mergedUrl;
		if (changed) {
			await db
				.update(schema.events)
				.set({
					categories: mergedCats,
					end_at: mergedEnd,
					url: mergedUrl,
					updated_at: now,
				})
				.where(eq(schema.events.id, existing.id));
		}
		// Always attempt the source-attribution insert: onConflictDoNothing is
		// the existence check. Skipping on `unchanged` would break cross-source
		// attribution (source B matching a pre-existing event from source A).
		await db
			.insert(schema.eventSources)
			.values({
				event_id: existing.id,
				source,
				source_event_id: raw.slug,
				source_url: raw.url,
				first_seen_at: now,
			})
			.onConflictDoNothing({
				target: [schema.eventSources.event_id, schema.eventSources.source],
			});
		return { action: changed ? "updated" : "unchanged" };
	}

	const fp12 = fp.slice(0, 12);
	const insertedSlug = `${slugify(raw.title) || "evento"}-${fp12}`;
	const inserted = await db
		.insert(schema.events)
		.values({
			title: raw.title,
			slug: insertedSlug,
			description: raw.description,
			// Undated raws get the ingestion epoch as a calendar placeholder;
			// date_text marks them so views can exclude/flag them.
			start_at: raw.startAt ?? now,
			end_at: raw.endAt,
			venue_id: venueId,
			image_url: raw.imageUrl,
			url: raw.url,
			categories,
			date_text: raw.dateText,
			fingerprint: fp,
			created_at: now,
			updated_at: now,
		})
		.onConflictDoNothing({ target: schema.events.fingerprint })
		.returning({ id: schema.events.id });

	const eventId = inserted[0]?.id;
	if (!eventId) {
		// Concurrent insert won the race — treat as pre-existing.
		return { action: "unchanged" };
	}
	if (raw.startAt != null) {
		// Ghost cleanup: an UNDATED twin of this event (same normalized
		// title + venue) is now superseded by the dated row. event_sources
		// rows cascade with it.
		await db
			.delete(schema.events)
			.where(
				eq(schema.events.fingerprint, fingerprintUndated(raw.title, venueRef)),
			);
	}
	await db
		.insert(schema.eventSources)
		.values({
			event_id: eventId,
			source,
			source_event_id: raw.slug,
			source_url: raw.url,
			first_seen_at: now,
		})
		.onConflictDoNothing({
			target: [schema.eventSources.event_id, schema.eventSources.source],
		});
	return { action: "inserted" };
}

export interface IngestResult {
	itemsFound: number;
	itemsNew: number;
	itemsUpdated: number;
	/** Dated raws whose start_at was already past — refused by the guard. */
	itemsSkippedPast: number;
	/** Expired dated rows deleted by the post-scrape purge. */
	itemsPurged: number;
	itemsFailed: number;
	error: string | null;
	runId: number | null;
}

export interface ScrapeMeta {
	/** Raw items the scraper saw, including ones it failed to parse/fetch. */
	found: number;
	/** Items dropped before ingest (fetch/parse failures). */
	failures: number;
	/** First scrape-stage error, recorded even if ingest itself succeeded. */
	firstError: string | null;
}

/** Upsert all raw events and record a scrape_runs row. */
export async function ingest(
	rawEvents: RawEvent[],
	source: string,
	meta: ScrapeMeta = { found: rawEvents.length, failures: 0, firstError: null },
): Promise<IngestResult> {
	const startedAt = Math.floor(Date.now() / 1000);
	let itemsNew = 0;
	let itemsUpdated = 0;
	let itemsSkippedPast = 0;
	let itemsFailed = meta.failures;
	let error = meta.firstError;

	for (const raw of rawEvents) {
		try {
			const res = await upsertEvent(raw, source);
			if (res.action === "inserted") {
				itemsNew++;
			} else if (res.action === "updated") {
				itemsUpdated++;
			} else if (res.action === "skippedPast") {
				itemsSkippedPast++;
			}
		} catch (err) {
			itemsFailed++;
			if (!error) {
				error = err instanceof Error ? err.message : String(err);
			}
		}
	}

	// Post-scrape hygiene: the DB should only hold today-or-future dated
	// events. Anything that expired since the last cycle goes now (guard
	// alone can't remove rows that were valid when first ingested).
	let itemsPurged = 0;
	try {
		itemsPurged = await purgePastEvents();
	} catch (purgeErr) {
		// Never fail the run over cleanup; surface it in the run record.
		const msg = purgeErr instanceof Error ? purgeErr.message : String(purgeErr);
		error = error ?? `purge failed: ${msg}`;
	}

	// Identity reconciliation: collapse rows that are the same real-world
	// event but hashed differently due to source time disagreements (e.g.
	// Viral Agenda's DST-shifted JSON-LD). Merges categories + attributions
	// onto the earliest row; no-op on a converged DB.
	try {
		await reconcileIdentities();
	} catch (recErr) {
		const msg = recErr instanceof Error ? recErr.message : String(recErr);
		error = error ?? `reconcile failed: ${msg}`;
	}

	const finishedAt = Math.floor(Date.now() / 1000);
	const run = await db
		.insert(schema.scrapeRuns)
		.values({
			source,
			started_at: startedAt,
			finished_at: finishedAt,
			items_found: meta.found,
			items_new: itemsNew,
			items_failed: itemsFailed,
			error,
		})
		.returning({ id: schema.scrapeRuns.id });

	return {
		itemsFound: meta.found,
		itemsNew,
		itemsUpdated,
		itemsSkippedPast,
		itemsPurged,
		itemsFailed,
		error,
		runId: run[0]?.id ?? null,
	};
}

export const ingestEvent = upsertEvent;
