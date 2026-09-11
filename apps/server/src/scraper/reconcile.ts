import { db, schema } from "@events-tracker/db";
import { and, eq, isNull } from "drizzle-orm";
import { fingerprint } from "./fingerprint";
import { planComponents, planMerge } from "./identity";

/**
 * Cross-source identity reconciliation (post-scrape repair pass).
 * Pure rules in identity.ts; this module owns the DB work.
 *
 * Splits dated rows into identity COMPONENTS via planComponents (title+day
 * group, then venue-compatible union-find — RULE 2/3), then within each
 * component the highest-trust tier forms the canonical session set; rows
 * from lower-trust tiers are absorbed into their nearest canonical session
 * within SESSION_WINDOW_SECONDS: categories union, attributions move, keeper
 * times untouched. Idempotent — a converged DB is a no-op.
 */
export async function reconcileIdentities(): Promise<number> {
	const now = Math.floor(Date.now() / 1000);

	const rows = await db
		.select({
			id: schema.events.id,
			title: schema.events.title,
			start_at: schema.events.start_at,
			end_at: schema.events.end_at,
			categories: schema.events.categories,
			fingerprint: schema.events.fingerprint,
			venue: schema.venues.name,
			city: schema.venues.city,
		})
		.from(schema.events)
		.leftJoin(schema.venues, eq(schema.events.venue_id, schema.venues.id))
		.where(isNull(schema.events.date_text));

	const attributions = await db
		.select({
			event_id: schema.eventSources.event_id,
			source: schema.eventSources.source,
		})
		.from(schema.eventSources);
	const sourcesByEvent = new Map<number, string[]>();
	for (const a of attributions) {
		const list = sourcesByEvent.get(a.event_id) ?? [];
		list.push(a.source);
		sourcesByEvent.set(a.event_id, list);
	}

	const components = planComponents(rows);

	let merged = 0;
	for (const group of components) {
		if (group.length < 2) continue;
		const fps = new Set(group.map((r) => r.fingerprint));
		if (fps.size < 2) continue; // already one identity (same-day sessions)

		const withSources = group.map((r) => ({
			id: r.id,
			title: r.title,
			start_at: r.start_at,
			sources: sourcesByEvent.get(r.id) ?? [],
		}));
		const plan = planMerge(withSources);
		const keeperIds = new Set(plan.keepers.map((k) => k.id));
		const keepers = group.filter((r) => keeperIds.has(r.id));
		const absorbedRows = group.filter((r) => plan.absorbed.has(r.id));
		if (absorbedRows.length === 0) continue;

		// Union categories across the whole identity group.
		const catSet = new Set<string>();
		for (const r of group) {
			for (const c of (r.categories ?? []) as string[]) catSet.add(c);
		}

		// Move absorbed rows' attributions to their assigned keeper session
		// (nearest in time), then delete the absorbed rows.
		const absorbedByKeeper = new Map<number, number[]>();
		for (const [absorbedId, keeperId] of plan.absorbed) {
			const list = absorbedByKeeper.get(keeperId) ?? [];
			list.push(absorbedId);
			absorbedByKeeper.set(keeperId, list);
		}
		for (const [keeperId, absorbedIds] of absorbedByKeeper) {
			for (const absorbedId of absorbedIds) {
				const srcs = await db
					.select({
						id: schema.eventSources.id,
						source: schema.eventSources.source,
					})
					.from(schema.eventSources)
					.where(eq(schema.eventSources.event_id, absorbedId));
				for (const s of srcs) {
					const clash = await db
						.select({ id: schema.eventSources.id })
						.from(schema.eventSources)
						.where(
							and(
								eq(schema.eventSources.event_id, keeperId),
								eq(schema.eventSources.source, s.source),
							),
						);
					if (clash.length > 0) {
						await db
							.delete(schema.eventSources)
							.where(eq(schema.eventSources.id, s.id));
					} else {
						await db
							.update(schema.eventSources)
							.set({ event_id: keeperId })
							.where(eq(schema.eventSources.id, s.id));
					}
				}
				await db.delete(schema.events).where(eq(schema.events.id, absorbedId));
			}
		}

		// Keepers: re-fingerprint (identity has converged) and store the
		// unioned categories. Times stay untouched — canonical tier decides.
		for (const k of keepers) {
			await db
				.update(schema.events)
				.set({
					categories: [...catSet].sort(),
					fingerprint: fingerprint(k.title, k.venue ?? "", k.start_at),
					updated_at: now,
				})
				.where(eq(schema.events.id, k.id));
		}
		merged++;
	}
	return merged;
}

// Standalone execution: bun run src/scraper/reconcile.ts
if (import.meta.main) {
	const n = await reconcileIdentities();
	console.log(JSON.stringify({ mergedGroups: n }));
}
