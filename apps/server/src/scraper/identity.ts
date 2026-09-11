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

import { isDistrictLocality } from "./district";
import { lisbonDay } from "./fingerprint";
import {
	isVagueVenue,
	normalizeCity,
	normalizeTitle,
	slugify,
	venuesMatch,
} from "./normalize";

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
	/** Canonical session rows (highest-trust tier), one per time cluster. */
	keepers: IdentityRow[];
	/** Non-canonical row id → canonical (keeper) row id it merges into. */
	absorbed: Map<number, number>;
}

/**
 * Start times within this many seconds (inclusive) are the same session.
 * Sources disagree on wall-clock by one hour (DST/format shifts), so a
 * sub-hour skew is one concert, not two. 3600s apart ⇒ ONE keeper; 5400s
 * apart (a real 10:00 + 11:30 double header) ⇒ TWO.
 */
export const SESSION_WINDOW_SECONDS = 3600;

/** Plan the merge for one identity component. No I/O, fully deterministic. */
export function planMerge(rows: IdentityRow[]): MergePlan {
	const bestTrust = Math.min(...rows.map(rowTrust));
	const canonical = rows.filter((r) => rowTrust(r) === bestTrust);
	// One keeper per CLUSTER of starts within SESSION_WINDOW_SECONDS, walked
	// sorted by start then id. A cluster's earliest row is its keeper: a
	// DST-shifted twin (3600s off) coalesces into the cross-source keeper
	// instead of minting a fake second session, while a genuine double
	// header (>3600s apart) still yields two keepers. Its own time is kept.
	const keepers: IdentityRow[] = [];
	let clusterStart: number | null = null;
	for (const r of [...canonical].sort(
		(a, b) => a.start_at - b.start_at || a.id - b.id,
	)) {
		if (
			clusterStart === null ||
			r.start_at - clusterStart > SESSION_WINDOW_SECONDS
		) {
			clusterStart = r.start_at;
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

/**
 * Component grouping (RULE 2 + RULE 3): rows that differ ONLY by how a
 * source names the venue (or name the venue vaguely) can still be the same
 * real-world show. Group dated rows by (normalized title, Lisbon day), then
 * union rows whose venues are COMPATIBLE within each group. Distinct title
 * or distinct day is a hard boundary — never collapsed.
 */

/** Group key for event identity: normalized title + Lisbon day. */
export function dayIdentityKey(title: string, startAt: number): string {
	return `${normalizeTitle(title)}|${lisbonDay(startAt)}`;
}

export interface ComponentRow {
	id: number;
	title: string;
	start_at: number;
	venue: string | null;
	city: string | null;
}

/**
 * Venue compatibility for EVENT identity (the wildcard). Vague/placeholder
 * venues are city-level announcements: two vague venues match regardless of
 * the venue name, and a vague venue matches a specific venue when both rows
 * are in the same city. Two specific venues only match under the STRICT
 * `venuesMatch`. This is intentionally LOSER than `venuesMatch` — it lets
 * duplicate EVENT rows fuse — but it must NEVER be used to merge venue ROWS
 * (a vague "Leiria (cidade)" row treated as a hub would collapse every
 * Leiria venue into one). Venue-row merging stays strictly `venuesMatch`.
 *
 * `aStart`/`bStart` (optional) unlock one further wildcard for the case where
 * two rows agree on the event but not on the CITY string: a concelho-level
 * placeholder ("Marinha Grande" as the municipal agenda's venue) against a
 * specific venue whose city is a parish of that same concelho ("Ordem",
 * "São Pedro de Moel"). Accepted only for a NON-municipality locality AND the
 * same session (≤ SESSION_WINDOW_SECONDS), so it cannot fuse a same-titled
 * same-day event across concelhos.
 */
export function venueCompatible(
	aVenue: string | null,
	bVenue: string | null,
	aCity: string | null,
	bCity: string | null,
	aStart: number | null = null,
	bStart: number | null = null,
): boolean {
	// No venue either side: only an exact match groups (mirrors the old
	// empty-venue identity key — never cross-wire an unlocated roster to a
	// specific venue).
	if (aVenue == null || bVenue == null) return aVenue === bVenue;
	const aVague = isVagueVenue(aVenue, aCity);
	const bVague = isVagueVenue(bVenue, bCity);
	if (aVague && bVague) return true;
	if (aVague || bVague) {
		if (normalizeCity(aCity ?? "") === normalizeCity(bCity ?? "")) return true;
		const specificCity = aVague ? bCity : aCity;
		return (
			isDistrictLocality(specificCity) &&
			aStart !== null &&
			bStart !== null &&
			Math.abs(aStart - bStart) <= SESSION_WINDOW_SECONDS
		);
	}
	return venuesMatch(aVenue, bVenue, aCity, bCity);
}

/**
 * Split dated rows into components of the same real-world event: group by
 * (normalized title, Lisbon day), then union-find on venue-compatible venues
 * within each group. Returns the components as arrays of rows; the caller
 * Runs `planMerge` once per component.
 */
export function planComponents<T extends ComponentRow>(rows: T[]): T[][] {
	const byDay = new Map<string, T[]>();
	for (const r of rows) {
		const key = dayIdentityKey(r.title, r.start_at);
		const list = byDay.get(key) ?? [];
		list.push(r);
		byDay.set(key, list);
	}

	const components: T[][] = [];
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

	for (const group of byDay.values()) {
		parent.clear();
		for (const r of group) find(r.id);
		for (const a of group) {
			for (const b of group) {
				if (a.id >= b.id) continue;
				if (
					venueCompatible(
						a.venue,
						b.venue,
						a.city,
						b.city,
						a.start_at,
						b.start_at,
					)
				) {
					union(a.id, b.id);
				}
			}
		}
		const byRoot = new Map<number, T[]>();
		for (const r of group) {
			const root = find(r.id);
			const list = byRoot.get(root) ?? [];
			list.push(r);
			byRoot.set(root, list);
		}
		for (const comp of byRoot.values()) components.push(comp);
	}
	return components;
}
