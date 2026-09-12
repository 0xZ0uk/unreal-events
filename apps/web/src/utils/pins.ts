import { concelhoOf } from "./concelho";

/**
 * The pins layer's data (SLICE_14, Layer 2).
 *
 * A row only becomes a pin when the pipeline placed its venue inside the
 * concelho the venue itself claims — the check lives in the geocoder, so by the
 * time a coordinate reaches here it has already passed point-in-polygon. What
 * is left for this module is the part the database cannot answer: which of
 * those coordinates are allowed on the map, and how they are grouped.
 *
 * Two rules, both about not inventing places:
 *
 * - `scope=concelho` is a município's own name ("Óbidos", "Marinha Grande").
 *   Those rows carry every listing a source never located; pinning them would
 *   put one dot where a whole concelho's worth of events was filed. They are
 *   drawn as the area, by the layer above this one.
 * - A `lugar` is a settlement, not a building. It is honest as a dot at the
 *   village and dishonest as a venue, so it keeps its own scope and the map
 *   draws it differently.
 */

export type PinScope = "venue" | "lugar";

export type PinRow = {
	venueSlug: string | null;
	venueName: string | null;
	venueCity: string | null;
	venueLat: number | null;
	venueLng: number | null;
	venueScope: string | null;
};

export type Pin = {
	slug: string;
	name: string;
	/** The município the venue's city folds onto, for the label. */
	concelho: string;
	scope: PinScope;
	lat: number;
	lng: number;
	count: number;
};

/**
 * Drawn only if the number is a real point on Earth. A bad coordinate is a
 * pipeline bug, and the map's job is to be boring about it rather than to place
 * a dot off the coast of Africa.
 */
function place(row: PinRow): { lat: number; lng: number } | null {
	const { venueLat: lat, venueLng: lng } = row;
	if (lat === null || lng === null) return null;
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
	if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
	return { lat, lng };
}

/** The name a pin is drawn and filtered under; empty when the row has none. */
function named(row: PinRow): boolean {
	return Boolean(
		(row.venueName ?? "").trim() && (row.venueSlug ?? row.venueName),
	);
}

/** The map's own scope vocabulary, with anything unknown read as a building. */
function scopeOf(raw: string | null): PinScope | "concelho" {
	if (raw === "concelho") return "concelho";
	if (raw === "lugar") return "lugar";
	return "venue";
}

/**
 * One pin per place, busiest first.
 *
 * Grouped by venue slug — the same key the `?local=` filter and the venue facet
 * use, so a pin click and a filter selection are the same statement. A row
 * whose venue has no slug falls back to its name, which is what a reader would
 * recognise anyway; a row with neither is skipped rather than drawn as
 * "unknown".
 *
 * Ties break by name so pins do not reshuffle between renders.
 */
export function pinTallies(rows: PinRow[]): Pin[] {
	const places = new Map<string, Pin>();
	for (const row of rows) {
		const at = place(row);
		if (!at) continue;
		const scope = scopeOf(row.venueScope);
		if (scope === "concelho") continue;
		const name = row.venueName?.trim() ?? "";
		const key = row.venueSlug ?? name.toLowerCase();
		if (!key || !name) continue;

		const existing = places.get(key);
		if (existing) {
			existing.count++;
			continue;
		}
		places.set(key, {
			slug: row.venueSlug ?? key,
			name,
			concelho: concelhoOf(row.venueCity),
			scope,
			lat: at.lat,
			lng: at.lng,
			count: 1,
		});
	}

	return [...places.values()].sort(
		(a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt"),
	);
}

/** The ceiling the bubble radius is scaled to. Never zero, so an empty window stays sane. */
export function busiestPin(pins: Pin[]): number {
	return pins.reduce((max, pin) => (pin.count > max ? pin.count : max), 0);
}

/**
 * Radius in pixels, on a square root — the same reasoning as the choropleth
 * ramp: one venue can hold a tenth of the window, and a linear scale would make
 * every other pin the same size. The floor keeps a single-event pin visible;
 * the ceiling keeps the busiest from swallowing the city it sits in.
 */
export function pinRadius(count: number, max: number): number {
	const MIN = 3.5;
	const MAX = 13;
	if (count <= 0 || max <= 0) return MIN;
	return MIN + (MAX - MIN) * Math.sqrt(count / max);
}

export type PinCoverage = {
	/** Rows with a place on the map. */
	placed: number;
	/** Of those, the ones drawn as a building. */
	pinned: number;
	/** Of those, the ones drawn as a settlement. */
	settlements: number;
	/** Every row in the window, placed or not. */
	total: number;
};

/**
 * How much of the window the pins actually cover.
 *
 * The choropleth shades every event by concelho; the pins can only draw the
 * ones whose venue was placed. Those are two different denominators, and a
 * reader comparing them deserves to be told rather than left to conclude the
 * pins are wrong.
 */
export function pinCoverage(rows: PinRow[]): PinCoverage {
	let pinned = 0;
	let settlements = 0;
	for (const row of rows) {
		if (!place(row)) continue;
		const scope = scopeOf(row.venueScope);
		if (scope === "concelho" || !named(row)) continue;
		if (scope === "lugar") settlements++;
		else pinned++;
	}
	return {
		placed: pinned + settlements,
		pinned,
		settlements,
		total: rows.length,
	};
}
