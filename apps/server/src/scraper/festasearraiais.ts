import { toEpochInLisbon } from "./fingerprint";
import { defaultFetchText } from "./http";
import { loadState, saveState } from "./state";
import type { RawEvent } from "./types";

/**
 * festasearraiais.pt — breadth source (SLICE_7).
 *
 * National registry of popular festas / arraiais. Discovery is via sitemap:
 * `sitemap.xml` (a sitemapindex) → `sitemap-eventos.xml` (+ `-2.xml`), which
 * together enumerate every event page (~4100) with a daily-regenerated
 * `<lastmod>`. We honor robots.txt (everything allowed except `/api/`) — we
 * never call the cleaner `/api/events` JSON, we read the server-rendered
 * detail pages.
 *
 * Detail pages carry one schema.org `Event` JSON-LD block. Dates are
 * date-only (`startDate` 2024-08-30, `endDate` 2024-09-02) where `endDate`
 * is EXCLUSIVE — site copy "(4 dias)" for 30 Aug→2 Sep means inclusive
 * 30 Aug–1 Sep — so the inclusive end lands at `endDate − 1 day`, 23:59
 * Lisbon. There are no JSON-LD categories → a title heuristic picks
 * Mercados e Feiras / Festivais / Tradição (canonicalized at ingest).
 *
 * Incremental state (`state/festasearraiais.json`): `{ seen[] }` of every
 * fetched url. First run is bounded by `MAX_REQUESTS` (politeness); the
 * unfetched backlog continues on the next daily run, newest-lastmod first,
 * so fresh events land before old ones. Re-ingesting a known fingerprint is
 * a no-op, so re-fetching an unchanged page costs nothing.
 */

export const SITE = "https://festasearraiais.pt";
export const SITEMAP_INDEX = `${SITE}/sitemap.xml`;
export const MAX_REQUESTS = 400;

export interface FestasState {
	/**
	 * Every event-page URL ever FETCHED (success or hard failure). Unfetched
	 * urls stay unseen so the backlog continues on the next run — the sitemap
	 * holds ~4100 urls and MAX_REQUESTS bounds each pass, so a cold run
	 * intentionally leaves work behind.
	 */
	seen: string[];
}

export const DEFAULT_STATE: FestasState = { seen: [] };

export interface ScrapeResult {
	events: RawEvent[];
	failures: number;
	firstError: string | null;
	pagesFetched: number;
	/** Diagnostic: all event URLs discovered from the sitemaps (pre-gate). */
	discovered: number;
}

export interface ScrapeDeps {
	fetchText: (url: string) => Promise<string>;
	sleep: (ms: number) => Promise<void>;
	loadState: () => FestasState;
	saveState: (s: FestasState) => void;
	now: number;
}

const defaultSleep = (ms: number) =>
	new Promise<void>((r) => setTimeout(r, ms));
const randomDelay = () => 350 + Math.floor(Math.random() * 300);

/** The sitemapindex sub-sitemap URLs that carry event pages. */
export function parseSitemapIndex(html: string): string[] {
	const out: string[] = [];
	for (const m of html.matchAll(
		/<loc>\s*(https:\/\/[^<]*?sitemap-eventos[^<]*?)\s*<\/loc>/g,
	)) {
		out.push(m[1]?.trim() ?? "");
	}
	return [...new Set(out.filter(Boolean))];
}

export interface SitemapEntry {
	url: string;
	lastmod: string;
}

/** Parse a single event sitemap: `<url>` blocks → `{loc, lastmod}` rows. */
export function parseEventSitemap(html: string): SitemapEntry[] {
	const out: SitemapEntry[] = [];
	const urlBlocks = html.match(/<url>[\s\S]*?<\/url>/g) ?? [];
	for (const block of urlBlocks) {
		const loc = block.match(/<loc>\s*([^<]*?)\s*<\/loc>/)?.[1]?.trim();
		const lastmod = block
			.match(/<lastmod>\s*([^<]*?)\s*<\/lastmod>/)?.[1]
			?.trim();
		if (loc) {
			out.push({ url: loc, lastmod: lastmod ?? "" });
		}
	}
	return out;
}

/** Stable id from the URL tail (`...-5574`). */
export function slugFor(url: string): string {
	const tail = decodeURIComponent(url.split("/eventos/")[1] ?? url);
	return `fe-${tail.replace(/^\/|\/$/g, "").replace(/\/+/g, ".")}`;
}

/** Parse the event-page JSON-LD (`Event`). Mirrors shotgun's block scan. */
export function parseDetailLd(html: string): Record<string, unknown> | null {
	for (const m of html.matchAll(
		/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
	)) {
		try {
			const d = JSON.parse(m[1] ?? "") as Record<string, unknown>;
			const t = Array.isArray(d["@type"]) ? d["@type"][0] : d["@type"];
			if (t === "Event") {
				return d;
			}
		} catch {
			// malformed block — try the next one
		}
	}
	return null;
}

interface LdLocation {
	name?: string;
	address?: {
		addressLocality?: string;
	} | null;
}

function asLocation(v: unknown): LdLocation | null {
	if (v && typeof v === "object") {
		const o = v as Record<string, unknown>;
		const address =
			o.address && typeof o.address === "object"
				? (o.address as Record<string, unknown>)
				: null;
		return {
			name: typeof o.name === "string" ? o.name : undefined,
			address: address
				? {
						addressLocality:
							typeof address.addressLocality === "string"
								? address.addressLocality
								: undefined,
					}
				: null,
		};
	}
	return null;
}

/** Title heuristic → raw category label (canonicalized at ingest). */
export function categoryForTitle(title: string): string {
	if (/^feira/i.test(title) || /mercado/i.test(title)) {
		return "Mercados e Feiras";
	}
	if (/festival/i.test(title)) {
		return "Festivais";
	}
	return "Tradição";
}

/** Parse a date-only `YYYY-MM-DD` → epoch at 00:00 Lisbon. */
function dateOnlyToEpoch(iso: string): number | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
	if (!m) {
		return null;
	}
	try {
		return toEpochInLisbon(Number(m[1]), Number(m[2]), Number(m[3]), 0, 0);
	} catch {
		return null;
	}
}

/** Merge JSON-LD → RawEvent. `startAt`/`endAt` null when dates are unparseable. */
export function toRawEvent(
	ld: Record<string, unknown>,
	url: string,
): RawEvent | null {
	const name = typeof ld.name === "string" ? ld.name.trim() : "";
	if (!name) {
		return null;
	}
	const startDate = typeof ld.startDate === "string" ? ld.startDate : "";
	const endDate = typeof ld.endDate === "string" ? ld.endDate : "";
	const startAt = dateOnlyToEpoch(startDate);
	// endDate is EXCLUSIVE (site copy "(4 dias)" for 30 Aug→2 Sep = inclusive
	// 30 Aug–1 Sep). Inclusive end = endDate's start − 1 second (i.e the
	// previous day, 23:59:59 Lisbon). Missing endDate → same-day slot.
	let endAt: number | null = null;
	if (startAt != null) {
		if (endDate) {
			const endStart = dateOnlyToEpoch(endDate);
			// endDate is INCLUSIVE (verified against site copy: Vestiaria
			// 28/08→08/09 renders "12 dias" = 28..8 inclusive; Tremoceira 2024
			// 30/08→02/09 renders "(4 dias)" = 30,31,1,2). End of the last day,
			// 23:59:59 Lisbon = endDate 00:00 epoch + 86399s.
			endAt = endStart != null ? endStart + 86_399 : null;
		} else {
			endAt = startAt;
		}
	}

	const loc = asLocation(ld.location);
	const addressLocality = loc?.address?.addressLocality?.trim() || "";
	const venueName = loc?.name?.trim() || addressLocality || "Local a definir";
	// City: addressLocality is the concelho ("Porto de Mós", "Alcobaça") and
	// feeds the district gate. When a page lacks locality, fall back to the
	// venue name's first segment (e.g. "Tremoceira" from "Tremoceira,
	// Pedreiras") so the gate still sees place evidence.
	const city =
		addressLocality ||
		(loc?.name ? loc.name.split(",")[0]?.trim() : "") ||
		null;

	const imageRaw = ld.image;
	let imageUrl: string | null = null;
	if (typeof imageRaw === "string") {
		imageUrl = imageRaw;
	} else if (Array.isArray(imageRaw)) {
		const first = imageRaw.find((u) => typeof u === "string");
		imageUrl = (first as string | undefined) ?? null;
	} else if (imageRaw && typeof imageRaw === "object") {
		const u = (imageRaw as Record<string, unknown>).url;
		if (typeof u === "string") {
			imageUrl = u;
		}
	}

	return {
		title: name,
		slug: slugFor(url),
		description:
			typeof ld.description === "string" ? ld.description.trim() : null,
		startAt,
		endAt,
		dateText: null, // JSON-LD dates are machine-readable → no raw date text
		venueName,
		city,
		categories: [categoryForTitle(name)],
		imageUrl,
		url,
	};
}

/**
 * Scrape festasearraiais: sitemap discovery → district-gated detail pages,
 * bounded by MAX_REQUESTS. `isInScope` is injectable for tests; production
 * uses `isLeiriaDistrict`.
 */
export async function scrape(
	deps: ScrapeDeps = {
		fetchText: defaultFetchText,
		sleep: defaultSleep,
		loadState: () => loadState("festasearraiais", DEFAULT_STATE),
		saveState: (s) => saveState("festasearraiais", s),
		now: Math.floor(Date.now() / 1000),
	},
	isInScope: (city: string | null | undefined) => boolean = () => true,
): Promise<ScrapeResult> {
	let requests = 0;
	let failures = 0;
	let firstError: string | null = null;
	let pagesFetched = 0;

	const fetchPage = async (url: string): Promise<string> => {
		if (requests >= MAX_REQUESTS) {
			throw new Error(`request cap ${MAX_REQUESTS} reached`);
		}
		requests++;
		await deps.sleep(randomDelay());
		return deps.fetchText(url);
	};

	// 1. sitemapindex → event sub-sitemaps
	const entry: SitemapEntry[] = [];
	try {
		const indexHtml = await fetchPage(SITEMAP_INDEX);
		pagesFetched++;
		const subSitemaps = parseSitemapIndex(indexHtml);
		for (const sub of subSitemaps) {
			const html = await fetchPage(sub);
			pagesFetched++;
			entry.push(...parseEventSitemap(html));
		}
	} catch (err) {
		return {
			events: [],
			failures,
			firstError: err instanceof Error ? err.message : String(err),
			pagesFetched,
			discovered: 0,
		};
	}

	// Deduplicate by url, newest-lastmod first so the request cap eats the
	// freshest pages first.
	const byUrl = new Map<string, SitemapEntry>();
	for (const e of entry) {
		byUrl.set(e.url, e);
	}
	const all = [...byUrl.values()].sort((a, b) =>
		b.lastmod.localeCompare(a.lastmod),
	);

	// 2. incremental: fetch a url only when it was never fetched. Update
	// detection is fingerprint-based at ingest (a changed page re-ingests as
	// a no-op), so the sitemap lastmod is used only for fetch priority.
	const state = deps.loadState();
	const seen = new Set(state.seen);
	const candidates = all.filter((e) => !seen.has(e.url));

	// 3. detail per candidate (bounded), district-gate on addressLocality.
	const events: RawEvent[] = [];
	const fetched: string[] = [];
	for (const c of candidates) {
		if (requests >= MAX_REQUESTS) {
			break;
		}
		try {
			const html = await fetchPage(c.url);
			pagesFetched++;
			fetched.push(c.url);
			const ld = parseDetailLd(html);
			if (ld) {
				const raw = toRawEvent(ld, c.url);
				if (raw && isInScope(raw.city ?? raw.venueName)) {
					events.push(raw);
				}
			} else {
				failures++;
				if (!firstError) {
					firstError = `no JSON-LD Event on ${c.url}`;
				}
			}
		} catch (err) {
			failures++;
			if (!firstError) {
				firstError = err instanceof Error ? err.message : String(err);
			}
		}
	}

	// 4. Mark FETCHED urls seen (hard failures included — a page that 500s
	// twice shouldn't wedge the run; it re-enters when the site's daily
	// lastmod regen reorders it to the top). Unfetched backlog continues
	// next run.
	deps.saveState({ seen: [...new Set([...state.seen, ...fetched])] });

	return { events, failures, firstError, pagesFetched, discovered: all.length };
}
