import { toEpochInLisbon } from "./fingerprint";
import { defaultFetchText } from "./http";
import { loadState, saveState } from "./state";
import type { RawEvent } from "./types";

/**
 * caldas — depth source for the Município de Caldas da Rainha agenda (mcr.pt).
 *
 * mcr.pt is a Next.js municipal site. RECON (2026-09-11) ruled out the
 * merchant-CMS widgets (`event_detail`, `atc_date_start`, `widget_field`
 * "Local:" label) that the task hypothesised — none are present. The agenda
 * is served twice: a clean server-rendered paginated index below, and detail
 * pages whose RSC payload carries `location`/`schedule`/dates with a
 * +00:00 (UTC) offset that the site renders buggy (the visible date card is
 * off by one vs the API's own naive field). Task rule: build the parser on
 * the server-rendered alternative index when the widget path is absent, and
 * do not read Z/UTC-marked fields as wall-clock. So:
 *
 *   Listing: `/agenda?lang=pt&page=N&amount=12`. Server-rendered `events-card`
 *   blocks, 12 per page, totalPages tells the real count (34 on first run;
 *   page walks until one yields zero novel slugs). Each card exposes the slug
 *   (href), title, category, and the authoritative LOCAL start/end dates
 *   (day / "set." month / two-digit year). Detail pages are NOT fetched:
 *   venue and description live only in the fragile RSC `data` blob (+ a buggy
 *   date card), and the contract forbids guessing — unknown venue falls back
 *   to the vague city-level "Caldas da Rainha", description stays null.
 *
 * Dates: reconstructed from the card's day/month/'YY straight into Europe/
 * Lisbon wall-clock via toEpochInLisbon — the fields are local, never UTC.
 * Events whose end is already past are dropped (RETRO_TOLERANCE_S), never
 * rolled forward.
 *
 * Scope: everything on the municipal agenda sits in Caldas da Rainha concelho
 * (= Distrito de Leiria), so isInScope gates on the city alias and drops
 * nothing in practice, but the same injectable hook is kept for tests.
 *
 * Incremental state (`state/caldas.json`): `{ seen: string[] }` of slugs
 * already processed. Steady-state runs re-walk the 3 cheap listing pages to
 * discover new slugs but only emit/record ones not yet seen.
 */

export const SITE = "https://www.mcr.pt";
export const AGENDA_PATH = "/agenda";
export const PAGE_SIZE = 12;
/** Hard cap on listing pages walked (real site: 3 pages, 34 events). */
export const MAX_LISTING_PAGES = 5;
/** An event is "live" until one day after its local end. */
export const RETRO_TOLERANCE_S = 86_400;

export interface CaldasState {
	seen: string[];
}

export const DEFAULT_STATE: CaldasState = { seen: [] };

export interface ScrapeResult {
	events: RawEvent[];
	failures: number;
	firstError: string | null;
	pagesFetched: number;
	/** Unique event slugs seen across listing pages. */
	discovered: number;
}

export interface ScrapeDeps {
	fetchText: (url: string) => Promise<string>;
	sleep: (ms: number) => Promise<void>;
	loadState: () => CaldasState;
	saveState: (s: CaldasState) => void;
	now: number;
}

const defaultSleep = (ms: number) =>
	new Promise<void>((r) => setTimeout(r, ms));
const randomDelay = () => 300 + Math.floor(Math.random() * 300);

/** Lisbon wall-clock derived from a card date tuple. */
export interface CardDate {
	day: number;
	month: number;
	year: number;
}

export interface ListingCard {
	slug: string;
	title: string;
	category: string | null;
	start: CardDate;
	end: CardDate;
}

/** PT month abbreviations as displayed on the cards ("set."). */
const MONTHS: Record<string, number> = {
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

import { decodeEntities } from "./normalize";

/** Decode the entities the listing cards emit — shared with every other
 * source so there is exactly one implementation (see `./normalize`). */
export { decodeEntities };

/** Turn a raw card date field into a {day, month, year} tuple. */
export function parseCardDate(
	dayRaw: string,
	monthRaw: string,
	yearRaw: string,
): CardDate {
	const day = Number(dayRaw.replace(/[^0-9]/g, ""));
	const monthStr = decodeEntities(monthRaw)
		.replace(/[^a-z]/gi, "")
		.toLowerCase()
		.slice(0, 3);
	const month = MONTHS[monthStr];
	const year =
		2000 +
		Number(
			decodeEntities(yearRaw)
				.replace(/[^0-9]/g, "")
				.slice(-2),
		);
	if (!month) {
		throw new Error(`Unrecognized month token "${monthStr}" in card date`);
	}
	if (!Number.isFinite(day) || day < 1 || day > 31) {
		throw new Error(`Unrecognized day token "${dayRaw}" in card date`);
	}
	return { day, month, year };
}

const pick = (block: string, re: RegExp): string | null =>
	re.exec(block)?.[1] ?? null;

/** Parse every server-rendered `events-card` block on a listing page. */
export function parseListingCards(html: string): ListingCard[] {
	const blocks = html.split('<div class="events-card">').slice(1);
	const cards: ListingCard[] = [];
	for (const b of blocks) {
		const slug = pick(b, /href="\/agenda\/([^"]+)"/);
		if (!slug) {
			continue;
		}
		const title = pick(b, /__card-title"><span>([^<]*)<\/span><\/h2>/);
		const category = pick(b, /__card-category">([^<]*)</);
		const sDay = pick(b, /__start-date__day">([^<]*)</);
		const sMonth = pick(b, /__start-date__month">([^<]*)</);
		const sYear = pick(b, /__start-date__year">([^<]*)</);
		const eDay = pick(b, /__end-date__day">([^<]*)</);
		const eMonth = pick(b, /__end-date__month">([^<]*)</);
		const eYear = pick(b, /__end-date__year">([^<]*)</);
		if (!title || !sDay || !sMonth || !sYear) {
			continue;
		}
		const start = parseCardDate(sDay, sMonth, sYear);
		// Single-day cards (e.g. Futsal) omit the end-date block entirely.
		const end =
			eDay && eMonth && eYear
				? parseCardDate(eDay, eMonth, eYear)
				: { ...start };
		cards.push({
			slug,
			title: decodeEntities(title).trim(),
			category: category ? decodeEntities(category).trim() : null,
			start,
			end,
		});
	}
	return cards;
}

/** Stable source id from the agenda slug. */
export function slugFor(slug: string): string {
	return `cl-${slug.replace(/^\/+|\/+$/g, "")}`;
}

/** Lisbon epochs for a card's start/end (end pinned to 23:59 local). */
export function cardEpochs(card: ListingCard): {
	startAt: number;
	endAt: number;
} {
	const startAt = toEpochInLisbon(
		card.start.year,
		card.start.month,
		card.start.day,
		0,
		0,
	);
	const endAt = toEpochInLisbon(
		card.end.year,
		card.end.month,
		card.end.day,
		23,
		59,
	);
	return { startAt, endAt };
}

export const DEFAULT_VENUE = "Caldas da Rainha";

/** Card -> RawEvent. Null when the event's end is already past. */
export function toRawEvent(
	card: ListingCard,
	url: string,
	nowUnix: number,
): RawEvent | null {
	const { startAt, endAt } = cardEpochs(card);
	if (endAt < nowUnix - RETRO_TOLERANCE_S) {
		return null;
	}
	return {
		title: card.title,
		slug: slugFor(card.slug),
		description: null,
		startAt,
		endAt,
		dateText: null,
		venueName: DEFAULT_VENUE,
		city: DEFAULT_VENUE,
		categories: card.category ? [card.category] : [],
		imageUrl: null,
		url,
	};
}

const listingUrl = (page: number) =>
	page === 1
		? `${SITE}${AGENDA_PATH}?lang=pt&amount=${PAGE_SIZE}`
		: `${SITE}${AGENDA_PATH}?lang=pt&page=${page}&amount=${PAGE_SIZE}`;

/**
 * Scrape the mcr.pt agenda: paginated server-rendered listing → novel
 * `events-card` sl/ugs, district-gated on the city alias (the whole agenda is
 * Caldas da Rainha concelho). `isInScope` injectable for tests.
 */
export async function scrape(
	deps: ScrapeDeps = {
		fetchText: defaultFetchText,
		sleep: defaultSleep,
		loadState: () => loadState("caldas", DEFAULT_STATE),
		saveState: (s) => saveState("caldas", s),
		now: Math.floor(Date.now() / 1000),
	},
	isInScope: (city: string | null | undefined) => boolean = () => true,
): Promise<ScrapeResult> {
	let pagesFetched = 0;
	let failures = 0;
	let firstError: string | null = null;

	const fetchText = deps.fetchText;
	const delay = () => deps.sleep(randomDelay());

	const state = deps.loadState();
	const seen = new Set(state.seen);

	const discovered = new Map<string, ListingCard>();
	for (let page = 1; page <= MAX_LISTING_PAGES; page++) {
		const url = listingUrl(page);
		let html: string;
		try {
			await delay();
			html = await fetchText(url);
			pagesFetched++;
		} catch (err) {
			failures++;
			if (!firstError) {
				firstError = err instanceof Error ? err.message : String(err);
			}
			break; // pages are sequential; a gap stops discovery
		}
		const cards = parseListingCards(html);
		for (const c of cards) {
			if (!discovered.has(c.slug)) {
				discovered.set(c.slug, c);
			}
		}
		// Server-rendered pagination ends when a page yields no cards.
		// Walk every data page (the agenda is only 3-4 pages) rather than
		// stopping on a page with no NEW slugs — a steady-state run where page
		// 1 is fully seen must still reach pages 2-3 for newly added items.
		if (cards.length === 0) {
			break;
		}
	}

	// Emit only slugs we've never seen. The listing is already district-local,
	// but the gate still runs on the (injectable) scope predicate.
	const events: RawEvent[] = [];
	const emittedKeys = new Set<string>();
	for (const [slug, card] of discovered) {
		if (seen.has(slug)) {
			continue;
		}
		const url = `${SITE}${AGENDA_PATH}/${slug}`;
		const raw = toRawEvent(card, url, deps.now);
		if (raw && isInScope(raw.city)) {
			// Guard against title+same-day collisions within a run.
			const key = `${raw.title}|${raw.startAt}`;
			if (!emittedKeys.has(key)) {
				emittedKeys.add(key);
				events.push(raw);
			}
		}
	}

	deps.saveState({ seen: [...new Set([...state.seen, ...discovered.keys()])] });

	return {
		events,
		failures,
		firstError,
		pagesFetched,
		discovered: discovered.size,
	};
}
