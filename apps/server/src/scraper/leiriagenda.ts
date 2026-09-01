import * as cheerio from "cheerio";

import { toEpochInLisbon } from "./fingerprint";
import type { RawEvent } from "./types";

const SITE = "https://leiriagenda.cm-leiria.pt";
export const LISTING_URL = `${SITE}/pt/agenda/proximos-eventos`;

/** Site paginates via `?page=N`; never iterate beyond these budgets. */
export const MAX_PAGES = 30;
export const MAX_REQUESTS = 400;
export const MIN_DELAY_MS = 300;
export const MAX_DELAY_MS = 500;
export const DETAIL_CONCURRENCY = 4;

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

/** A listing-page event card (the coarse fields available without detail). */
export interface ListingCard {
	title: string;
	slug: string;
	venueName: string;
	city: string | null;
	categories: string[];
	imageUrl: string | null;
	url: string;
}

export interface DateParts {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	hasTime: boolean;
}

export function parseDateNode(
	$: cheerio.CheerioAPI,
	root: cheerio.Cheerio<any>,
	kind: "inicio" | "fim",
): DateParts | null {
	// Two listing markup patterns:
	//   A) explicit wrappers `.data-inicio` / `.data-fim` (multi-day cards and
	//      detail pages; time lives in an optional `.hora`).
	//   B) a plain `.date` block with no wrapper — single-day sessions where the
	//      time is embedded in a second `.ano` span (e.g. `<span class="ano">18h30</span>`).
	const wrapped = root.find(`.data-${kind}`).first();
	let el: cheerio.Cheerio<any>;
	if (wrapped.length > 0) {
		el = wrapped;
	} else {
		if (kind === "fim") {
			// Wrapper-less single-day cards carry no separate end date.
			return null;
		}
		const dateBlock = root.find(".date").first();
		el = dateBlock.length > 0 ? dateBlock : root;
	}

	const day = Number.parseInt(el.find(".dia").first().text(), 10);
	const mesText = el.find(".mes").first().text();
	const monthAbbr = mesText.match(/[a-z]{3}/i)?.[0] ?? "";
	const month = PT_MONTHS[monthAbbr.toLowerCase()];
	const anoEl = el.find(".ano").first().text();
	const year =
		Number.parseInt(anoEl, 10) ||
		Number.parseInt(mesText.match(/(\d{4})/)?.[1] ?? "", 10);

	let hour = 0;
	let minute = 0;
	let hasTime = false;
	const hora = el.find(".hora").first().text();
	const horaMatch = hora.match(/(\d{1,2})h(\d{0,2})/);
	if (horaMatch) {
		hour = Number.parseInt(horaMatch[1] ?? "0", 10);
		minute = Number.parseInt(horaMatch[2] ?? "0", 10);
		hasTime = true;
	} else {
		// Pattern B embeds the session time in an `.ano` span (distinct from the
		// year's `.ano`), so scan every `.ano` for an `NhMm` token.
		for (const node of el.find(".ano").get()) {
			const m = $(node)
				.text()
				.match(/(\d{1,2})h(\d{0,2})/);
			if (m) {
				hour = Number.parseInt(m[1] ?? "0", 10);
				minute = Number.parseInt(m[2] ?? "0", 10);
				hasTime = true;
				break;
			}
		}
	}

	if (
		!Number.isFinite(day) ||
		!month ||
		!Number.isFinite(year) ||
		year < 2000
	) {
		return null;
	}
	return { year, month, day, hour, minute, hasTime };
}

/** Extract the url(...) value from an inline background-image style. */
function imageFromStyle(style: string | undefined): string | null {
	if (!style) {
		return null;
	}
	const m = style.match(/url\(\s*(['"]?)(.*?)\1\s*\)/i);
	return m?.[2] ?? null;
}

function collectCategories(
	$: cheerio.CheerioAPI,
	scope: cheerio.Cheerio<any>,
): string[] {
	return [
		...new Set(
			scope
				.find(".categorias small")
				.map((_, s) => $(s).text().trim())
				.get()
				.filter((s) => s.length > 0),
		),
	];
}

/** Parse every event card out of a listing (proximos-eventos) page. */
export function parseListing(html: string): ListingCard[] {
	const $ = cheerio.load(html);
	const cards: ListingCard[] = [];
	$('a[href*="/pt/agenda/"]').each((_, el) => {
		const $a = $(el);
		const href = ($a.attr("href") ?? "").trim();
		if (href.includes("proximos-eventos")) {
			return;
		}
		const slug = href.split("/").filter(Boolean).at(-1) ?? "";
		if (!slug || !parseDateNode($, $a, "inicio")) {
			return;
		}
		cards.push({
			title: $a.find(".proximo_title").first().text().trim(),
			slug,
			venueName: $a.find(".local").first().text().trim(),
			city: $a.find(".localidade").first().text().trim() || null,
			categories: collectCategories($, $a),
			imageUrl: imageFromStyle($a.find(".imagem7x10").first().attr("style")),
			url: href.startsWith("http") ? href : `${SITE}${href}`,
		});
	});
	return cards;
}

/** Parse an event detail page into a fully-resolved event (dates included). */
export function parseDetail(html: string, url: string): RawEvent {
	const $ = cheerio.load(html);
	const scope = $(".titles").first();
	const title = scope.find("h1.title").first().text().trim();
	const slug = url.split("/").filter(Boolean).at(-1) ?? "";

	const start = parseDateNode($, scope, "inicio");
	const end = parseDateNode($, scope, "fim");
	if (!start) {
		throw new Error(`Detail page missing a parseable start date: ${url}`);
	}

	return {
		title,
		slug,
		description:
			$(".text.sinopse").first().find("p").first().text().trim() || null,
		startAt: toEpochInLisbon(
			start.year,
			start.month,
			start.day,
			start.hour,
			start.minute,
		),
		endAt: end
			? toEpochInLisbon(end.year, end.month, end.day, end.hour, end.minute)
			: null,
		venueName: scope.find(".local").first().text().trim(),
		city: scope.find(".localidade").first().text().trim() || null,
		categories: collectCategories($, scope),
		imageUrl: null, // details carry no reliable thumbnail; keep the card's.
		url,
	};
}

/** Merge a listing card with its detail override into a final RawEvent. */
export function mergeCardWithDetail(
	card: ListingCard,
	detail: RawEvent,
): RawEvent {
	return {
		title: detail.title || card.title,
		slug: detail.slug || card.slug,
		description: detail.description,
		startAt: detail.startAt,
		endAt: detail.endAt,
		venueName: detail.venueName || card.venueName,
		city: detail.city ?? card.city,
		categories:
			detail.categories.length > 0 ? detail.categories : card.categories,
		imageUrl: detail.imageUrl ?? card.imageUrl,
		url: detail.url || card.url,
	};
}

/** Total listing pages, discovered from pagination links (page=1..N). */
export function maxPageFromHtml(html: string): number {
	const nums = [...html.matchAll(/[?&]page=(\d+)/g)].map((m) =>
		Number.parseInt(m[1] ?? "0", 10),
	);
	return nums.length > 0 ? Math.max(...nums) : 1;
}

export interface ScrapeDeps {
	fetchText: (url: string) => Promise<string>;
	sleep: (ms: number) => Promise<void>;
}

const FETCH_TIMEOUT_MS = 15000;
const FETCH_RETRIES = 2;
const RETRY_BACKOFF_MS = 800;

/**
 * Fetch with a hard timeout and bounded retries. 4xx responses are terminal;
 * network errors, timeouts and 5xx are retried.
 */
async function defaultFetchText(url: string): Promise<string> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
		if (attempt > 0) {
			await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * attempt));
		}
		try {
			const res = await fetch(url, {
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			});
			if (!res.ok) {
				const err = new Error(`GET ${url} -> HTTP ${res.status}`);
				if (res.status < 500) {
					throw Object.assign(err, { retryable: false });
				}
				throw Object.assign(err, { retryable: true });
			}
			return res.text();
		} catch (err) {
			lastError = err;
			if (
				err &&
				typeof err === "object" &&
				"retryable" in err &&
				err.retryable === false
			) {
				throw err;
			}
		}
	}
	throw lastError;
}

const defaultSleep = (ms: number) =>
	new Promise<void>((r) => setTimeout(r, ms));

const randomDelay = () =>
	MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));

export interface ScrapeResult {
	events: RawEvent[];
	/** Cards that could not be fetched/parsed; run continues without them. */
	failures: number;
	/** First failure message, for the scrape_runs error column. */
	firstError: string | null;
}

/**
 * Scrape Leiriagenda: fetch listing pages, then each event detail page, and
 * return merged RawEvents. Per-card failures are counted, not fatal — a
 * partial run beats no run. Overridable deps keep offline tests real.
 */
export async function scrape(
	deps: ScrapeDeps = { fetchText: defaultFetchText, sleep: defaultSleep },
): Promise<ScrapeResult> {
	let requests = 0;
	// Serial fetch gate: increment + fetch are mutually exclusive, so the
	// request cap is exact even with concurrent workers.
	let chain: Promise<unknown> = Promise.resolve();
	const fetchPage = (url: string): Promise<string> => {
		const next = chain.then(async () => {
			if (requests >= MAX_REQUESTS) {
				throw new Error(`request cap ${MAX_REQUESTS} reached`);
			}
			requests++;
			await deps.sleep(randomDelay());
			return deps.fetchText(url);
		});
		// Swallow to keep the chain alive for queued callers; their own await
		// still sees the original error.
		chain = next.catch(() => {});
		return next;
	};

	const firstHtml = await fetchPage(LISTING_URL);
	const maxPage = Math.min(maxPageFromHtml(firstHtml), MAX_PAGES);

	const cardsBySlug = new Map<string, ListingCard>();
	for (const card of parseListing(firstHtml)) {
		cardsBySlug.set(card.slug, card);
	}
	for (let page = 2; page <= maxPage; page++) {
		if (requests >= MAX_REQUESTS) break;
		try {
			const html = await fetchPage(`${LISTING_URL}?page=${page}`);
			for (const card of parseListing(html)) {
				cardsBySlug.set(card.slug, card);
			}
		} catch (err) {
			// Pagination is best-effort: stop paging, keep what we have.
			console.error(`listing page ${page} failed: ${err}`);
			break;
		}
	}

	const slugs = [...cardsBySlug.keys()];
	const events: RawEvent[] = [];
	let failures = 0;
	let firstError: string | null = null;
	let cursor = 0;
	const worker = async () => {
		while (cursor < slugs.length) {
			const slug = slugs[cursor];
			cursor++;
			const card = slug ? cardsBySlug.get(slug) : undefined;
			if (!card) {
				continue;
			}
			try {
				const html = await fetchPage(card.url);
				const detail = parseDetail(html, card.url);
				events.push(mergeCardWithDetail(card, detail));
			} catch (err) {
				// A dead detail page must not kill the run — count and move on.
				failures++;
				if (!firstError) {
					firstError = err instanceof Error ? err.message : String(err);
				}
			}
		}
	};
	await Promise.all(Array.from({ length: DETAIL_CONCURRENCY }, worker));

	return { events, failures, firstError };
}
