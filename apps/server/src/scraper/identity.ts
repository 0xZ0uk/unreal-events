/**
 * Cross-source identity rules — pure, no DB.
 *
 * Rows whose fingerprints differ can still be the same real-world event:
 * sources disagree on wall-clock time (Viral Agenda's JSON-LD is one hour
 * early during DST). Group dated rows by (normalized title, venue ref,
 * Lisbon day) — the identity key.
 *
 * Within a group, rows attributed to the HIGHEST-trust source are the
 * canonical session set (distinct start times are legitimate same-day
 * sessions — SLICE_6 keeps those). Lower-trust rows are merged into their
 * nearest canonical session; their categories and source attributions
 * follow. Same-tier rows are never merged into each other.
 */

import { lisbonDay } from "./fingerprint";
import { normalizeTitle, slugify } from "./normalize";

/** Which source to trust for TIME, most-trusted first. Municipal agenda
 * (leiriagenda) is authoritative; Viral Agenda is last — its JSON-LD is
 * DST-shifted. A row's trust is the BEST source attributing it. */
export const TIME_SOURCE_PRIORITY = [
	"leiriagenda",
	"eventbrite",
	"ticketline",
	"shotgun",
	"bol",
	"cmleiriarss",
	"viralagenda",
] as const;

export function sourceTrust(source: string): number {
	const i = (TIME_SOURCE_PRIORITY as readonly string[]).indexOf(source);
	return i === -1 ? TIME_SOURCE_PRIORITY.length : i;
}

export interface IdentityRow {
	id: number;
	title: string;
	start_at: number;
	/** All sources attributing this row (best trust wins). */
	sources: string[];
}

export function rowTrust(row: IdentityRow): number {
	return row.sources.length === 0
		? TIME_SOURCE_PRIORITY.length
		: Math.min(...row.sources.map(sourceTrust));
}

/** Stable identity key: same title+venue+Lisbon-day ⇒ same real-world show. */
export function identityKey(
	title: string,
	venueRef: string,
	startAt: number,
): string {
	return `${normalizeTitle(title)}|${slugify(venueRef)}|${lisbonDay(startAt)}`;
}

export interface MergePlan {
	/** Canonical session rows (highest-trust tier), one per distinct time. */
	keepers: IdentityRow[];
	/** Non-canonical row id → canonical (keeper) row id it merges into. */
	absorbed: Map<number, number>;
}

/** Plan the merge for one identity group. No I/O, fully deterministic. */
export function planMerge(rows: IdentityRow[]): MergePlan {
	const bestTrust = Math.min(...rows.map(rowTrust));
	const canonical = rows.filter((r) => rowTrust(r) === bestTrust);
	// One keeper per distinct start (a time can only appear once per tier —
	// same title+venue+time ⇒ same fingerprint ⇒ wouldn't be in this group).
	const keepers: IdentityRow[] = [];
	for (const r of [...canonical].sort(
		(a, b) => a.start_at - b.start_at || a.id - b.id,
	)) {
		if (!keepers.some((k) => k.start_at === r.start_at)) {
			keepers.push(r);
		}
	}
	const absorbed = new Map<number, number>();
	for (const r of rows) {
		if (keepers.some((k) => k.id === r.id)) continue;
		let best: IdentityRow | undefined;
		let bestDelta = Number.POSITIVE_INFINITY;
		for (const k of keepers) {
			const delta = Math.abs(k.start_at - r.start_at);
			if (delta < bestDelta) {
				bestDelta = delta;
				best = k;
			}
		}
		if (best) {
			absorbed.set(r.id, best.id);
		}
	}
	return { keepers, absorbed };
}
