import { normalizePlace } from "./district";
import { toEpochInLisbon } from "./fingerprint";
import { defaultFetchText } from "./http";
import { loadState, saveState } from "./state";
import type { RawEvent } from "./types";

/**
 * cisterfestas — depth source (SLICE_7).
 *
 * Cister FM (cister.fm) is the local radio for Alcobaça + Porto de Mós. Its
 * "Salão de Festas" is the only live source for many freguesia-level festas
 * (e.g. Festas da Tremoceira, which every broad registry lacks) — updated
 * whenever the station advertises each festa.
 *
 * Discovery is HTML-only: the WP REST API is blocked (Kadence Security 401)
 * and salao-de-festas posts are absent from the sitemaps. We walk
 * `/salao-de-festas/` + `/page/N/` while a page yields novel
 * `/salaodefestas/<slug>/` urls (observed ~50/page).
 *
 * Detail pages carry a structured Elementor card: a `DATA EVENTO` heading
 * followed by a raw date-range (`4 a 7 de Setembro`) and a `LOCAL` heading
 * followed by the venue/place. No year and no JSON-LD Event → the year is
 * inferred (current year, else +1, only when the event is not well in the
 * past, else the raw text is kept and ingest pins a placeholder). `LOCAL`
 * becomes venueName and the district gate runs on it (isLeiriaDistrict) —
 * the radio only covers Alcobaça/Porto de Mós, so this is nearly always in
 * scope.
 *
 * Incremental state (`state/cisterfestas.json`): `{ seen[] }` of detail URLs.
 * Listing pages are always walked (cheap, ~50/page) but a detail page is
 * fetched only when its URL is not yet seen — first run ≈ listing pages +
 * one detail per unique festa, steady state ≈ a handful.
 */

export const SITE = "https://cister.fm";
export const LISTING_BASE = `${SITE}/salao-de-festas/`;
export const MAX_LISTING_PAGES = 45;
export const MAX_DETAIL_REQUESTS = 400;
/** Year-inference tolerance: a festa counts as "live" until 1 day past. */
export const YEAR_TOLERANCE_S = 86_400;
/**
 * How far ahead a next-year candidate may sit before we call it a phantom.
 * A radio announces next year's festa a couple of months early at most;
 * "22 de Agosto" scraped from a 2025 post must NOT become Aug 2027.
 */
export const ANNOUNCE_HORIZON_S = 150 * 86_400;
/**
 * Stop walking the listing after this many consecutive pages whose slugs
 * contain no month from the recent/future window (currentMonth − 3 … ahead).
 * The listing is newest-first, so a run of month-stale pages means the rest
 * is old news; the detail pass re-checks real years and drops past festas.
 */
export const MAX_STALE_PAGES = 4;

export interface CisterState {
	seen: string[];
}

export const DEFAULT_STATE: CisterState = { seen: [] };

export interface ScrapeResult {
	events: RawEvent[];
	failures: number;
	firstError: string | null;
	pagesFetched: number;
	/** Unique detail URLs discovered across listing pages. */
	discovered: number;
}

export interface ScrapeDeps {
	fetchText: (url: string) => Promise<string>;
	sleep: (ms: number) => Promise<void>;
	loadState: () => CisterState;
	saveState: (s: CisterState) => void;
	now: number;
}

const defaultSleep = (ms: number) =>
	new Promise<void>((r) => setTimeout(r, ms));
const randomDelay = () => 350 + Math.floor(Math.random() * 300);

/** Unique `/salaodefestas/<slug>/` urls on a listing page. */
export function parseListingLinks(html: string): string[] {
	const out = new Set<string>();
	for (const m of html.matchAll(
		/(?:href=["'])?(https:\/\/cister\.fm\/salaodefestas\/[a-z0-9-]+\/)/g,
	)) {
		out.add(m[1] ?? "");
	}
	return [...out].filter(Boolean);
}

/** Stable source id from the detail slug. */
export function slugFor(detailUrl: string): string {
	const slug = (detailUrl.split("/salaodefestas/")[1] ?? "").replace(
		/^\/+|\/+$/g,
		"",
	);
	return `cf-${slug}`;
}

/**
 * Parse the detail-page heading card. Returns `{ title, dateText, venue }`
 * derived from the Elementor headings: a `DATA EVENTO` heading is followed by
 * the raw date range; a `LOCAL` heading is followed by the venue/place. Title
 * falls back to `og:title` with the site suffix stripped.
 */
export function parseDetailCard(html: string): {
	title: string | null;
	dateText: string | null;
	venue: string | null;
} {
	const headings: string[] = [];
	for (const m of html.matchAll(
		/<h[12][^>]*class="[^"]*elementor-heading-title[^"]*"[^>]*>([^<]*)<\/h[12]>/g,
	)) {
		headings.push((m[1] ?? "").trim());
	}

	const dataIdx = headings.findIndex(
		(h) => normalizePlace(h) === "data evento",
	);
	const localIdx = headings.findIndex((h) => normalizePlace(h) === "local");
	const dateText = dataIdx >= 0 ? (headings[dataIdx + 1] ?? null) : null;
	const venue = localIdx >= 0 ? (headings[localIdx + 1] ?? null) : null;

	let title: string | null = headings[0] || null;
	if (!title) {
		const og = html.match(/<meta property="og:title" content="([^"]*)"/);
		title = og
			? (og[1] ?? "").replace(/\s*-\s*Cister FM.*$/i, "").trim() || null
			: null;
	}
	if (!title && venue) {
		title = venue;
	}

	return { title, dateText, venue };
}

const MONTHS: Record<string, number> = {
	janeiro: 1,
	fevereiro: 2,
	marco: 3,
	abril: 4,
	maio: 5,
	junho: 6,
	julho: 7,
	agosto: 8,
	setembro: 9,
	outubro: 10,
	novembro: 11,
	dezembro: 12,
};

interface ParsedRange {
	startDay: number;
	endDay: number;
	month: number;
}

/**
 * Parse a Portuguese day-range ("4 a 7 de Setembro", "dias 5 e 6") into a
 * {startDay, endDay, month}. Returns null when the month is absent (a clearly
 * undated "dias 5 e 6" stays dateText-only).
 */
export function parseDateRange(text: string): ParsedRange | null {
	const norm = text.replace(/\s+/g, " ").replace(/[–—]/g, "-").toLowerCase();
	const m =
		/(?:de\s+)?(\d{1,2})\s*(?:a|e|-)\s*(\d{1,2})\s+de\s+([a-zçãé]+)/.exec(
			norm,
		) || /(\d{1,2})\s+de\s+([a-zçãé]+)/.exec(norm);
	if (m) {
		if (m[3]) {
			// two-day range: 4 a 7 de Setembro
			const month = MONTHS[(m[3] ?? "").replace(/ç/g, "c")];
			if (month != null) {
				return {
					startDay: Number(m[1]),
					endDay: Number(m[2]),
					month,
				};
			}
		}
		// single-day: 4 de Setembro (m[1]=day, m[2]=month)
		const month = MONTHS[(m[2] ?? "").replace(/ç/g, "c")];
		if (month != null) {
			return { startDay: Number(m[1]), endDay: Number(m[1]), month };
		}
	}
	return null;
}

/**
 * Infer year + epochs for a day-range. Tries current year, then next year;
 * accepts a candidate only when the event's end is not already gone
 * (tolerance: 1 day past). When NEITHER candidate fits, the festa is past
 * news — return null so it is dropped, NOT rolled to a phantom future year
 * (deep listing pages are full of 2025/2024 festas).
 */
export function inferEpochs(
	range: ParsedRange,
	nowUnix: number,
): { startAt: number; endAt: number } | null {
	const currentYear = new Date(nowUnix * 1000).getUTCFullYear();
	for (const year of [currentYear, currentYear + 1]) {
		try {
			const startAt = toEpochInLisbon(year, range.month, range.startDay, 0, 0);
			const endAt = toEpochInLisbon(year, range.month, range.endDay, 23, 59);
			if (endAt >= nowUnix - YEAR_TOLERANCE_S) {
				// Next-year candidates must sit inside the announcement horizon,
				// else they're phantom rolls of last year's posts.
				if (year > currentYear && startAt > nowUnix + ANNOUNCE_HORIZON_S) {
					return null;
				}
				return { startAt, endAt };
			}
		} catch {
			// invalid calendar day for this month/year — try next candidate
		}
	}
	return null;
}

/** Merge the detail card into a RawEvent. Null when past/undatable. */
export function toRawEvent(
	detailUrl: string,
	card: {
		title: string | null;
		dateText: string | null;
		venue: string | null;
	},
	nowUnix: number,
): RawEvent | null {
	const title = card.title?.trim() || card.venue?.trim();
	if (!title) {
		return null;
	}
	const venueName = card.venue?.trim() || "Local a definir";
	// The LOCAL heading is a place name ("Tremoceira", "Vestiaria") — feed
	// the raw text to the district gate (isLeiriaDistrict normalizes and
	// matches parishes); don't pre-slug it.
	const city = card.venue?.trim() || null;

	const range = card.dateText ? parseDateRange(card.dateText) : null;
	let startAt: number | null = null;
	let endAt: number | null = null;
	let dateText: string | null = card.dateText;
	if (range) {
		const inferred = inferEpochs(range, nowUnix);
		if (inferred) {
			startAt = inferred.startAt;
			endAt = inferred.endAt;
			dateText = null; // machine-readable now
		} else {
			// No year fits → past festa → DROP it (not a dateText placeholder —
			// ingest would pin "now" and mint a fake dated event).
			return null;
		}
	}

	return {
		title,
		slug: slugFor(detailUrl),
		description: null,
		startAt,
		endAt,
		dateText,
		venueName,
		city,
		categories: ["Tradição"],
		imageUrl: null,
		url: detailUrl,
	};
}

/**
 * Scrape cister.fm: listing pagination → new detail pages, district-gated on
 * the `LOCAL` venue/place name. `isInScope` injectable for tests.
 */
export async function scrape(
	deps: ScrapeDeps = {
		fetchText: defaultFetchText,
		sleep: defaultSleep,
		loadState: () => loadState("cisterfestas", DEFAULT_STATE),
		saveState: (s) => saveState("cisterfestas", s),
		now: Math.floor(Date.now() / 1000),
	},
	isInScope: (city: string | null | undefined) => boolean = () => true,
): Promise<ScrapeResult> {
	let pagesFetched = 0;
	let failures = 0;
	let firstError: string | null = null;
	let detailRequests = 0;

	const fetchText = deps.fetchText;
	const sleepish = deps.sleep;
	const delay = () => sleepish(randomDelay());

	const state = deps.loadState();
	const seen = new Set(state.seen);

	const discovered = new Map<string, URL>();
	// Fresh month names: current month −2 … +3 (mod 12). Month names repeat
	// yearly, so this is a coarse freshness proxy — the detail pass re-checks
	// real years; this only tells the listing walk when to stop.
	const freshMonths = (now: number): string[] => {
		const m = new Date(now * 1000).getUTCMonth(); // 0-based
		const names = [
			"janeiro",
			"fevereiro",
			"marco",
			"abril",
			"maio",
			"junho",
			"julho",
			"agosto",
			"setembro",
			"outubro",
			"novembro",
			"dezembro",
		];
		const out: string[] = [];
		for (let off = -2; off <= 3; off++) {
			out.push(names[(m + off + 12) % 12] ?? "");
		}
		return out.filter(Boolean);
	};
	const fresh = freshMonths(deps.now);
	let stalePages = 0;
	for (let page = 1; page <= MAX_LISTING_PAGES; page++) {
		if (
			detailRequests >= MAX_DETAIL_REQUESTS ||
			stalePages >= MAX_STALE_PAGES
		) {
			break;
		}
		const url = page === 1 ? LISTING_BASE : `${LISTING_BASE}page/${page}/`;
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
			break; // listings are sequential; a gap stops discovery
		}
		const found = parseListingLinks(html);
		let novel = 0;
		let freshSlug = 0;
		for (const u of found) {
			const slug = decodeURIComponent(u.split("/salaodefestas/")[1] ?? "");
			if (fresh.some((mo) => slug.includes(mo))) {
				freshSlug++;
			}
			if (!discovered.has(u)) {
				discovered.set(u, new URL(u));
				if (!seen.has(u)) {
					novel++;
				}
			}
		}
		// Newest-first listing: a page with no fresh-month slugs and nothing
		// unseen is old news; after MAX_STALE_PAGES consecutive such pages,
		// stop (detail pass re-checks real years).
		if (freshSlug === 0 && novel === 0) {
			stalePages++;
		} else {
			stalePages = 0;
		}
	}

	// Fetch details only for urls we've never seen.
	const events: RawEvent[] = [];
	const detailUrls = [...discovered.keys()];
	for (const u of detailUrls) {
		if (seen.has(u)) {
			continue;
		}
		if (detailRequests >= MAX_DETAIL_REQUESTS) {
			break;
		}
		try {
			await delay();
			const html = await fetchText(u);
			detailRequests++;
			pagesFetched++;
			const card = parseDetailCard(html);
			const raw = toRawEvent(u, card, deps.now);
			const gate = card.venue || card.title;
			if (raw && isInScope(gate)) {
				events.push(raw);
			}
		} catch (err) {
			failures++;
			if (!firstError) {
				firstError = err instanceof Error ? err.message : String(err);
			}
		}
	}

	deps.saveState({ seen: [...new Set([...state.seen, ...detailUrls])] });

	return {
		events,
		failures,
		firstError,
		pagesFetched,
		discovered: discovered.size,
	};
}
