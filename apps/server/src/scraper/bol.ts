import * as cheerio from "cheerio";

import { toEpochInLisbon } from "./fingerprint";
import type { RawEvent } from "./types";

/**
 * BOL (www.bol.pt/musica_festivais) parse + Leiria venue pre-filter layer.
 *
 * Pure functions only: this module is NOT wired into the source registry yet.
 * The fixtures in __fixtures__/bol*.html drive all tests offline.
 */

/** Known Leiria-relevant venue substrings (venue slugs are underscore-form). */
export const LEIRIA_VENUE_KEYWORDS = [
	"leiria",
	"miguel_franco",
	"lucio",
	"santana",
	"sant_ana",
	"castelo_de_leiria",
	"mimo",
	"expo",
] as const;

/** BTW candidates are validated against these real non-Leiria slugs. */

/**
 * Arrays of words that, when title-cased, would collide in naive runs. Kept
 * explicit so title-case output stays deterministic for slug-derived names.
 */

/**
 * True when a venue slug points at a Leiria-area venue. Match is a plain
 * substring scan over the underscore-form slug. Everything else is rejected.
 */
export function isLeiriaVenue(venueSlug: string): boolean {
	const slug = venueSlug.replace(/^\/+|\/+$/g, "");
	return LEIRIA_VENUE_KEYWORDS.some((k) => slug.includes(k));
}

/** A listing-page BOL event link (id, canonical url, and both embedded slugs). */
export interface ListingLink {
	id: number;
	url: string;
	/** Event slug (e.g. `antonio_zambujo_oracao_ao_tempo_viana_do_castelo`). */
	eventSlug: string;
	/** Venue slug (e.g. `c_c_viana_do_castelo`). */
	venueSlug: string;
}

const LISTING_LINK_RE =
	/\/Comprar\/Bilhetes\/(\d+)-([a-z0-9_]+(?:-[a-z0-9_]+)*)\/?/i;

/** Strip a trailing slash and any `?query`/`#frag`; keep a leading `/`. */
function cleanSegment(seg: string): string {
	return seg
		.trim()
		.replace(/\/+$/, "")
		.replace(/\?.*$|#.*$/, "");
}

/**
 * Parse every /Comprar/Bilhetes/<id>-<event_slug>-<venue_slug>/ listing link.
 *
 * The path segment after the event id has the shape `<event_slug>-<venue_slug>`
 * where both slugs use underscores for word separation (verified across the
 * fixture's 42 unique links: none of the embedded slugs contains a literal
 * hyphen). We therefore take the LAST hyphen-separated token as the venue slug
 * and everything in between (re-joined with `-`) as the event slug. Events
 * whose link appears multiple times on the page are deduplicated by id.
 */
export function parseListingLinks(html: string): ListingLink[] {
	const $ = cheerio.load(html);
	const seen = new Set<number>();
	const links: ListingLink[] = [];
	$('a[href*="/Comprar/Bilhetes/"]').each((_, el) => {
		const href = ($(el).attr("href") ?? "").trim();
		const m = href.match(LISTING_LINK_RE);
		if (!m) {
			return;
		}
		const id = Number.parseInt(m[1] ?? "", 10);
		if (!Number.isFinite(id) || seen.has(id)) {
			return;
		}
		// `<event_slug>-<venue_slug>`; last hyphen token is the venue.
		const parts = (m[2] ?? "").split("-").filter(Boolean);
		if (parts.length < 2) {
			return;
		}
		seen.add(id);
		links.push({
			id,
			url: cleanSegment(href),
			eventSlug: parts.slice(0, -1).join("-"),
			venueSlug: parts[parts.length - 1] ?? "",
		});
	});
	return links;
}

const PT_MONTHS: Record<string, number> = {
	jan: 1,
	fev: 2,
	mar: 3,
	abr: 4,
	mai: 5,
	jun: 6,
	jul: 7,
	ago: 8,
	set: 9,
	out: 10,
	nov: 11,
	dez: 12,
};

export interface DetailSession {
	startAt: number;
	hasTime: boolean;
}

/** `21h30` → [21, 30]; `21:30` → [21, 30]. Null when no time token exists. */
function parseTimeToken(text: string): [number, number] | null {
	const h24 = text.match(/(\d{1,2})h(\d{0,2})\b/);
	if (h24) {
		return [
			Number.parseInt(h24[1] ?? "0", 10),
			Number.parseInt(h24[2] ?? "0", 10),
		];
	}
	const colon = text.match(/(\d{1,2}):(\d{2})\b/);
	if (colon) {
		return [
			Number.parseInt(colon[1] ?? "0", 10),
			Number.parseInt(colon[2] ?? "0", 10),
		];
	}
	return null;
}

/**
 * Parse the session date(s) out of a BOL detail page. One entry per session.
 *
 * Real fixture shape (bol-detail.html): the `.datas-sessoes` container holds a
 * `.datas` block whose `.sessao > .ano/.mes/.dia` encodes a date, and a
 * `.proxima-sessao` span carries the literal date + time ("05 dez 2026 21:30").
 * The date itself resolves to an epoch in Europe/Lisbon; a missing/absent time
 * token yields hasTime=false with the session pinned to 00:00 local.
 */
export function parseDetailSessions(
	html: string,
	url: string,
): DetailSession[] {
	const $ = cheerio.load(html);
	const container = $(".datas-sessoes").first();
	const scope = container.length > 0 ? container : $(".datas").first();

	// Session dates: `.datas .sessao` blocks with `.ano/.mes/.dia` (PT month).
	type DateParts = { year: number; month: number; day: number };
	const dates: DateParts[] = [];
	scope.find(".sessao").each((_, el) => {
		const year = Number.parseInt($(el).find(".ano").first().text(), 10);
		const monthText = $(el).find(".mes").first().text();
		const month =
			PT_MONTHS[monthText.match(/[a-z]{3}/i)?.[0]?.toLowerCase() ?? ""];
		const day = Number.parseInt($(el).find(".dia").first().text(), 10);
		if (
			Number.isFinite(year) &&
			year >= 2000 &&
			month &&
			Number.isFinite(day)
		) {
			dates.push({ year, month, day });
		}
	});
	// Fallback: dd/mm/yyyy tokens inside the container (task-documented shape).
	if (dates.length === 0) {
		for (const m of scope
			.text()
			.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
			dates.push({
				year: Number.parseInt(m[3] ?? "", 10),
				month: Number.parseInt(m[2] ?? "", 10),
				day: Number.parseInt(m[1] ?? "", 10),
			});
		}
	}

	// Session times: literals in `.proxima-sessao span`. We deliberately do NOT
	// read the countdown `.inline.horas` block (its `.valor` fields are empty;
	// it is a live countdown, not a session time).
	const times: [number, number][] = [];
	scope.find(".proxima-sessao span").each((_, el) => {
		const t = parseTimeToken($(el).text());
		if (t) {
			times.push(t);
		}
	});

	const sessions: DetailSession[] = [];
	dates.forEach((d, i) => {
		const time = times[i] ?? times[times.length - 1] ?? null;
		sessions.push({
			startAt: toEpochInLisbon(
				d.year,
				d.month,
				d.day,
				time?.[0] ?? 0,
				time?.[1] ?? 0,
			),
			hasTime: time !== null,
		});
	});
	if (sessions.length === 0) {
		throw new Error(`BOL detail page has no parseable session date: ${url}`);
	}
	return sessions;
}

/** Turn an underscore/hyphen slug into a title-cased display string. */
export function slugToTitle(slug: string): string {
	return slug
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.split(" ")
		.map((w) => (w ? w[0]?.toUpperCase() + w.slice(1) : w))
		.join(" ");
}

/**
 * Merge a BOL listing card with its detail html into RawEvents — one per
 * session. Title/venue strings are derived from the embedded slugs; city is
 * `Leiria` only when the venue pre-filter agrees, else null.
 */
export function buildRawEvents(
	card: ListingLink,
	detailHtml: string,
): RawEvent[] {
	const venueName = slugToTitle(card.venueSlug);
	return parseDetailSessions(detailHtml, card.url).map((s) => ({
		title: slugToTitle(card.eventSlug),
		slug: card.eventSlug,
		description: null,
		startAt: s.startAt,
		endAt: null,
		dateText: null,
		venueName,
		city: isLeiriaVenue(card.venueSlug) ? "Leiria" : null,
		categories: [],
		imageUrl: null,
		url: card.url,
	}));
}
