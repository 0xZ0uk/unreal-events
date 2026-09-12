import { isLeiriaDistrict } from "./district";
import { errorMessage } from "./errors";
import { toEpochInLisbon } from "./fingerprint";
import { defaultFetchText } from "./http";
import { decodeEntities, venueTokens } from "./normalize";
import { loadState, saveState } from "./state";
import type { RawEvent } from "./types";

/**
 * nocartaz — venue-hub aggregator (SLICE_10 Tier 2, promoted to a shared
 * source once the hub turned out to be server-rendered).
 *
 * Earlier recon filed this site as Tier 2 because `/eventos/` (the national
 * index) is a JS-driven shell. The *district* hubs are not: `/distrito/<slug>/`
 * is an Astro page that renders every card server-side, so one request returns
 * the whole district roster — no pagination, no JSON-LD index needed.
 *
 *   listing   https://www.nocartaz.pt/distrito/leiria/
 *   cards     `article.event-card` + `data-*` attributes (203 live 2026-09-12)
 *   detail    /eventos/<16-hex-id>/ with a schema.org Event (@type Event,
 *             Festival, MusicEvent…) carrying name, startDate, location
 *             (Place > PostalAddress.addressLocality) and description.
 *
 * What the card already carries, per event:
 *   data-id         the site's own event id — used as this source's event key
 *   data-concelho   the hub's filing (EMPTY for aggregator-fed rows)
 *   data-venue      venue slug (`tjls-leiria`, `bandsintown-leiria`, …)
 *   data-date       `YYYY-MM-DD`
 *   data-starts-at  `YYYY-MM-DDTHH:mm:ss`, WITH a `+01:00` suffix on some rows
 *                   and bare Lisbon wall clock on others — both shapes are
 *                   accepted, see `epochFromRaw`
 *   data-genre      slug taxonomy (`literatura`, `rock-pop`, `exposicao`, …)
 *   data-free       `1` for free entry
 *
 * District gate. The hub files cards by concelho, and for its own venue hubs
 * that value is a real Leiria-district concelho. Rows it picked up from
 * aggregator feeds (bandsintown / 3cket / ecultura) sometimes carry NO
 * concelho and are not in the district at all — live example: a concert at
 * "Sociedade Recreativa Operária de Santarém" parked on the Leiria hub. The
 * gate therefore runs on the RESOLVED city (detail `addressLocality`, falling
 * back to the card's own concelho), never on the route label.
 *
 * End dates: the detail JSON-LD carries NO `endDate`, even for multi-day
 * festivals — the range lives only in prose ("de 4 a 13 de setembro em…"). So
 * `endAt` stays null rather than being invented from a sentence; a
 * multi-day festa ships as a single-day card dated on its first day.
 *
 * Incremental state (`state/nocartaz.json`): `{ details: { <id>: … } }` — the
 * parsed detail of every card currently on the page. A card whose detail is
 * cached is emitted from the cache (no refetch), so the description/image a
 * second run writes never degrades to card-only data; unseen ids fetch once,
 * and the map is pruned to the ids the page still lists.
 */

export const ORIGIN = "https://www.nocartaz.pt";
export const LISTING = `${ORIGIN}/distrito/leiria/`;

/** Safety net on detail fetches per run; unseen ids are retried next run. */
export const MAX_DETAIL_REQUESTS = 400;
/** A source date counts as live until one day past its end. */
export const PAST_TOLERANCE_S = 86_400;
/** Attempts on the listing page before the source reports itself failed. */
export const PAGE_ATTEMPTS = 3;
/** Backoff between listing attempts (ms), indexed by attempt. */
export const PAGE_BACKOFF_MS: readonly number[] = [2_000, 6_000];

/**
 * `data-genre` slug → canonical category. Slugs are the hub's own taxonomy;
 * the canonical labels are the ones `canonicalizeCategories` already knows, so
 * a genre with no mapping is dropped instead of leaking a slug into the
 * filter dropdown.
 */
export const GENRE_CATEGORIES: Record<string, string> = {
	literatura: "Literatura",
	conferencia: "Conferências",
	"rock-pop": "Concertos",
	jazz: "Concertos",
	"musica-classica": "Concertos",
	opera: "Concertos",
	folk: "Concertos",
	eletronica: "Clubbing",
	exposicao: "Museus & Exposições",
	festival: "Festivais",
	cinema: "Cinema",
	infantil: "Infantil",
	teatro: "Teatro",
	performance: "Teatro",
	outro: "Outros",
};

export function categoriesFor(genre: string): string[] {
	const label = GENRE_CATEGORIES[genre.trim().toLowerCase()];
	return label ? [label] : [];
}

/**
 * `data-venue` is the FEED a row came from (`museu-vidro-marinha-grande`,
 * `cm-mgrande-eventos`, `agenda-obidos`), and for feed-fed rows the venue
 * field repeats the feed's own name instead of naming a room — live examples:
 * a beach walk in São Pedro de Moel filed under "Museu do Vidro - Marinha
 * Grande", a photography biennial under "Festas de Nossa Senhora da Nazaré —
 * Sítio", a CM agenda as "Câmara Municipal da Marinha Grande - Agenda". Such a
 * row knows its concelho, not its venue: shipping the feed name both lies on
 * the card and blocks cross-source fusion (identity groups by title+day and
 * then needs compatible venues), which is what the collected dupes looked like.
 * Two signals, both from the live page: the venue name repeats the feed slug's
 * words, or it is labelled "agenda".
 */
export function isFeedVenue(slug: string, venue: string): boolean {
	const slugTokens = venueTokens(slug.replace(/[-\/]/g, " "));
	const nameTokens = new Set(venueTokens(venue));
	if (
		slugTokens.length > 0 &&
		slugTokens.every((token) => nameTokens.has(token))
	) {
		return true;
	}
	return /agenda/i.test(venue);
}

export interface NocartazCard {
	/** the site's own event id (`06009145e171bc07`) */
	id: string;
	title: string;
	/** venue display name, without the `· Concelho` chip */
	venue: string;
	/** `data-concelho`, empty on aggregator-fed rows */
	city: string;
	/** `data-date` — day granularity, always present */
	date: string;
	/** `data-starts-at` — clock time, offset-suffixed on some rows */
	startsAt: string;
	genre: string;
	free: boolean;
	/** `.when` chip, e.g. `sex 11 set · 21:30` — day-precision `dateText` */
	when: string;
	/** `data-venue` — the hub feed the row came from (`tjls-leiria`) */
	venueSlug: string;
	description: string | null;
	imageUrl: string | null;
	url: string;
}

export interface NocartazDetail {
	title: string | null;
	startAt: string | null;
	endAt: string | null;
	venue: string | null;
	city: string | null;
	description: string | null;
	imageUrl: string | null;
}

/** Cached parse of one detail page — the shape stored in state. */
export type CachedDetail = NocartazDetail;

export interface NocartazState {
	details: Record<string, CachedDetail>;
}

export const DEFAULT_STATE: NocartazState = { details: {} };

export interface ScrapeResult {
	events: RawEvent[];
	failures: number;
	firstError: string | null;
	pagesFetched: number;
	/** Cards found on the hub page. */
	discovered: number;
}

export interface ScrapeDeps {
	fetchText: (url: string) => Promise<string>;
	sleep: (ms: number) => Promise<void>;
	loadState: () => NocartazState;
	saveState: (s: NocartazState) => void;
	now: number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const randomDelay = () => 350 + Math.floor(Math.random() * 300);

function stripTags(html: string): string {
	return html
		.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/(p|div|li|h[1-6])>/gi, " ")
		.replace(/<[^>]*>/g, " ");
}

function textOf(html: string): string {
	return decodeEntities(stripTags(html)).replace(/\s+/g, " ").trim();
}

function cardAttr(attrs: string, name: string): string {
	const m = new RegExp(`data-${name}="([^"]*)"`).exec(attrs);
	return m ? decodeEntities(m[1] ?? "").trim() : "";
}

/**
 * Every card the hub renders. The `data-*` attributes are the machine-readable
 * half; the title/venue/description come from markup, so both are read here
 * and the attribute wins whenever the two disagree.
 */
export function parseCards(html: string): NocartazCard[] {
	const out: NocartazCard[] = [];
	const seen = new Set<string>();
	for (const match of html.matchAll(
		/<article class="event-card[^"]*"([^>]*)>([\s\S]*?)<\/article>/g,
	)) {
		const attrs = match[1] ?? "";
		const body = match[2] ?? "";
		const id = cardAttr(attrs, "id");
		if (!id || seen.has(id)) {
			continue;
		}
		seen.add(id);

		// `<span class="where"><span>Venue</span><span class="concelho">· City</span></span>`
		const where = /class="where">([\s\S]*?)<\/span>\s*<div/.exec(body)?.[1] ?? "";
		const cityChip = /<span class="concelho">([\s\S]*?)<\/span>/.exec(where)?.[1];
		const venue = /<span>([\s\S]*?)<\/span>/.exec(where)?.[1];

		out.push({
			id,
			title: textOf(/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(body)?.[1] ?? ""),
			venue: venue ? textOf(venue) : "",
			city: cityChip
				? textOf(cityChip).replace(/^[·\s]+/, "")
				: cardAttr(attrs, "concelho"),
			date: cardAttr(attrs, "date"),
			startsAt: cardAttr(attrs, "starts-at"),
			genre: cardAttr(attrs, "genre"),
			free: cardAttr(attrs, "free") === "1",
			when: textOf(/class="when"[^>]*>([\s\S]*?)<\/span>/.exec(body)?.[1] ?? ""),
			venueSlug: cardAttr(attrs, "venue"),
			description:
				textOf(/<p class="pitch-line">([\s\S]*?)<\/p>/.exec(body)?.[1] ?? "") ||
				null,
			imageUrl:
				/<div class="card-thumb">[\s\S]*?<img[^>]+src="([^"]+)"/.exec(body)?.[1] ??
				null,
			url: `${ORIGIN}/eventos/${id}/`,
		});
	}
	return out;
}

/** The schema.org Event block of a detail page, when the page has one. */
function eventNode(html: string): Record<string, unknown> | null {
	for (const block of html.matchAll(
		/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
	)) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(block[1] ?? "");
		} catch {
			continue;
		}
		const nodes: unknown[] = Array.isArray(parsed)
			? parsed
			: (parsed as { "@graph"?: unknown[] })?.["@graph"] ?? [parsed];
		for (const node of nodes) {
			if (
				typeof node === "object" &&
				node !== null &&
				typeof (node as { startDate?: unknown }).startDate === "string"
			) {
				return node as Record<string, unknown>;
			}
		}
	}
	return null;
}

function str(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0
		? decodeEntities(value).trim()
		: null;
}

export function parseDetail(html: string): NocartazDetail {
	const node = eventNode(html);
	if (!node) {
		return {
			title: null,
			startAt: null,
			endAt: null,
			venue: null,
			city: null,
			description: null,
			imageUrl: null,
		};
	}
	const location = (node.location ?? {}) as {
		name?: unknown;
		address?: { addressLocality?: unknown };
	};
	const image = Array.isArray(node.image) ? node.image[0] : node.image;
	return {
		title: str(node.name),
		startAt: str(node.startDate),
		endAt: str(node.endDate),
		venue: str(location.name),
		city: str(location.address?.addressLocality),
		description: str(node.description),
		imageUrl: str(image),
	};
}

/**
 * Epoch seconds for either shape the hub publishes: an absolute timestamp
 * (`2026-09-19T20:00:11+01:00`) or Lisbon wall clock with no zone at all
 * (`2026-09-13T00:00:00`). The second shape is read against Europe/Lisbon
 * rather than the host clock, so a container in UTC does not shift a 21:30
 * concert onto the next day.
 */
export function epochFromRaw(raw: string | null | undefined): number | null {
	if (!raw) {
		return null;
	}
	const value = raw.trim();
	if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) {
		const ms = Date.parse(value);
		return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
	}
	const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value);
	if (!m?.[1] || !m[2] || !m[3]) {
		return null;
	}
	try {
		return toEpochInLisbon(
			Number(m[1]),
			Number(m[2]),
			Number(m[3]),
			m[4] ? Number(m[4]) : 0,
			m[5] ? Number(m[5]) : 0,
		);
	} catch {
		return null; // impossible calendar date in the source chip
	}
}

export function toRawEvent(
	card: NocartazCard,
	detail: NocartazDetail | null,
	now: number,
	isInScope: (city: string | null | undefined) => boolean,
): RawEvent | null {
	const title = (detail?.title ?? card.title).replace(/\s+/g, " ").trim();
	if (!title) {
		return null;
	}

	const city = detail?.city ?? card.city ?? null;
	if (!isInScope(city)) {
		return null;
	}

	const startAt =
		epochFromRaw(detail?.startAt) ??
		epochFromRaw(card.startsAt) ??
		epochFromRaw(card.date);
	if (startAt == null) {
		// The hub always dates its cards; a card without a readable date is a
		// markup change, not a dateless event — drop it rather than mint one.
		return null;
	}

	let endAt = epochFromRaw(detail?.endAt);
	if (endAt != null && endAt <= startAt) {
		endAt = null;
	}
	if ((endAt ?? startAt) + PAST_TOLERANCE_S < now) {
		return null; // already over
	}

	const venue = (detail?.venue ?? card.venue).trim();
	// Feed rows name the feed, not a room (see isFeedVenue): the concelho is
	// the most specific place such a row actually knows.
	const venueName = isFeedVenue(card.venueSlug, venue) ? city || venue : venue || city;

	return {
		title,
		slug: `nocartaz-${card.id}`,
		description: detail?.description ?? card.description,
		startAt,
		endAt,
		// `date_text` marks UNDATED rows (they never expire and the digest lists
		// them separately) and the reconcile pass skips them — every card here
		// carries a machine date, so it stays null. A card with no clock time
		// gets its day at midnight, the same convention regiaoleiria uses.
		dateText: null,
		venueName,
		city,
		categories: categoriesFor(card.genre),
		imageUrl: card.imageUrl ?? detail?.imageUrl ?? null,
		url: card.url,
	};
}

export async function scrape(
	deps: ScrapeDeps = {
		fetchText: defaultFetchText,
		sleep: defaultSleep,
		loadState: () => loadState("nocartaz", DEFAULT_STATE),
		saveState: (s) => saveState("nocartaz", s),
		now: Math.floor(Date.now() / 1000),
	},
	isInScope: (city: string | null | undefined) => boolean = isLeiriaDistrict,
): Promise<ScrapeResult> {
	let failures = 0;
	let firstError: string | null = null;
	let pagesFetched = 0;
	let detailRequests = 0;
	const delay = () => deps.sleep(randomDelay());

	const state = deps.loadState();
	const cached = state.details;

	let html: string | null = null;
	for (let attempt = 0; attempt < PAGE_ATTEMPTS; attempt++) {
		try {
			await delay();
			html = await deps.fetchText(LISTING);
			pagesFetched++;
			break;
		} catch (err) {
			firstError ??= errorMessage(err);
			if (attempt < PAGE_ATTEMPTS - 1) {
				await deps.sleep(PAGE_BACKOFF_MS[attempt] ?? 5_000);
			}
		}
	}
	if (html === null) {
		return {
			events: [],
			failures: failures + 1,
			firstError: `${LISTING}: ${firstError ?? "unknown error"}`,
			pagesFetched,
			discovered: 0,
		};
	}

	const cards = parseCards(html);
	const events: RawEvent[] = [];
	// Only ids the page still lists stay cached: the hub drops an event once it
	// is over, so the map tracks the live roster instead of growing forever.
	const details: Record<string, CachedDetail> = {};

	for (const card of cards) {
		let detail = cached[card.id] ?? null;
		if (!detail) {
			if (detailRequests < MAX_DETAIL_REQUESTS) {
				try {
					await delay();
					const detailHtml = await deps.fetchText(card.url);
					pagesFetched++;
					detailRequests++;
					detail = parseDetail(detailHtml);
				} catch (err) {
					// Keep the card: its own attributes are enough for a card.
					// Nothing is cached, so the detail is retried next run.
					failures++;
					firstError ??= `${card.url}: ${errorMessage(err)}`;
					detail = null;
				}
			} else {
				failures++;
				firstError ??= `${card.url}: detail budget exhausted`;
			}
		}
		if (detail) {
			details[card.id] = detail;
		}
		const raw = toRawEvent(card, detail, deps.now, isInScope);
		if (raw) {
			events.push(raw);
		}
	}

	deps.saveState({ details });

	return {
		events,
		failures,
		firstError,
		pagesFetched,
		discovered: cards.length,
	};
}
