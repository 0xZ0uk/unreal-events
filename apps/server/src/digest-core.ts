import { db, schema } from "@events-tracker/db";
import { and, asc, eq, gte, isNull } from "drizzle-orm";

/**
 * Shared digest/ICS core (SLICE_3). Used by the /digest + /events.ics Hono
 * routes and by digest-cli.ts (cron runs the CLI directly against the DB —
 * no server needed).
 */

export function parseKeywords(raw: string | undefined | null): string[] {
	return (raw ?? "")
		.split(",")
		.map((k) => k.trim().toLowerCase())
		.filter((k) => k.length > 0);
}

export function foldText(s: string): string {
	return s
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
}

export function matchesKeywords(text: string, keywords: string[]): boolean {
	if (keywords.length === 0) {
		return false;
	}
	const folded = foldText(text);
	return keywords.some((k) => folded.includes(foldText(k)));
}

export interface DigestEvent {
	id: number;
	title: string;
	venue: string;
	city: string | null;
	when: string;
	startAt: number;
	url: string | null;
	source: string | null;
	match: boolean;
}

export interface DigestOptions {
	/** Epoch seconds — events starting after this (default: now). */
	since?: number;
	keywords: string[];
	/**
	 * When set, only events ingested within the last N hours are included
	 * (start_at still >= since) — the "what's new" digest mode.
	 */
	newHours?: number;
}

export async function buildDigest(
	opts: DigestOptions,
): Promise<{
	since: number;
	keywords: string[];
	total: number;
	hits: number;
	events: DigestEvent[];
}> {
	const since = opts.since ?? Math.floor(Date.now() / 1000);
	const conditions = [
		gte(schema.events.start_at, since),
		isNull(schema.events.date_text),
	];
	if (opts.newHours != null) {
		conditions.push(
			gte(schema.events.created_at, Math.floor(Date.now() / 1000) - opts.newHours * 3600),
		);
	}

	const rows = await db
		.select({
			id: schema.events.id,
			title: schema.events.title,
			description: schema.events.description,
			start_at: schema.events.start_at,
			url: schema.events.url,
			categories: schema.events.categories,
			venueName: schema.venues.name,
			venueCity: schema.venues.city,
			source: schema.eventSources.source,
		})
		.from(schema.events)
		.leftJoin(schema.venues, eq(schema.events.venue_id, schema.venues.id))
		.leftJoin(
			schema.eventSources,
			eq(schema.eventSources.event_id, schema.events.id),
		)
		.where(and(...conditions))
		.orderBy(asc(schema.events.start_at))
		.limit(500);

	const events = rows.map((r) => {
		const venue = r.venueName ?? "Local desconhecido";
		const when = new Date(r.start_at * 1000).toLocaleString("pt-PT", {
			timeZone: "Europe/Lisbon",
			weekday: "long",
			day: "2-digit",
			month: "long",
			hour: "2-digit",
			minute: "2-digit",
		});
		const text = `${r.title} ${venue} ${(r.categories ?? []).join(" ")} ${r.description ?? ""}`;
		return {
			id: r.id,
			title: r.title,
			venue,
			city: r.venueCity,
			when,
			startAt: r.start_at,
			url: r.url,
			source: r.source,
			match: matchesKeywords(text, opts.keywords),
		};
	});

	return {
		since,
		keywords: opts.keywords,
		total: events.length,
		hits: events.filter((e) => e.match).length,
		events,
	};
}

/** RFC 5545 text calendar of upcoming events (undated rows excluded). */
export async function buildIcs(keywords: string[]): Promise<string> {
	const rows = await db
		.select({
			id: schema.events.id,
			title: schema.events.title,
			description: schema.events.description,
			start_at: schema.events.start_at,
			end_at: schema.events.end_at,
			url: schema.events.url,
			venueName: schema.venues.name,
		})
		.from(schema.events)
		.leftJoin(schema.venues, eq(schema.events.venue_id, schema.venues.id))
		.where(and(gte(schema.events.start_at, Date.now() / 1000), isNull(schema.events.date_text)))
		.orderBy(asc(schema.events.start_at))
		.limit(1000);

	const esc = (s: string) =>
		s
			.replace(/\\/g, "\\\\")
			.replace(/;/g, "\\;")
			.replace(/,/g, "\\,")
			.replace(/\n/g, "\\n");

	// RFC 5545 UTC form: yyyymmddThhmmssZ (toISOString already ends in Z).
	const fmt = (epoch: number) =>
		new Date(epoch * 1000)
			.toISOString()
			.replace(/[-:]/g, "")
			.replace(/\.\d{3}/, "");

	const ics: string[] = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//events-tracker//Leiria//PT",
		"CALSCALE:GREGORIAN",
	];
	for (const r of rows) {
		const venue = r.venueName ?? "Local desconhecido";
		if (
			keywords.length > 0 &&
			!matchesKeywords(`${r.title} ${venue} ${r.description ?? ""}`, keywords)
		) {
			continue;
		}
		ics.push(
			"BEGIN:VEVENT",
			`UID:event-${r.id}@events-tracker.local`,
			`DTSTAMP:${fmt(Math.floor(Date.now() / 1000))}`,
			`DTSTART:${fmt(r.start_at)}`,
			...(r.end_at ? [`DTEND:${fmt(r.end_at)}`] : []),
			`SUMMARY:${esc(r.title)}`,
			`LOCATION:${esc(venue)}`,
			...(r.url ? [`URL:${r.url}`] : []),
			...(r.description
				? [`DESCRIPTION:${esc(r.description.slice(0, 300))}`]
				: []),
			"END:VEVENT",
		);
	}
	ics.push("END:VCALENDAR");
	return ics.join("\r\n");
}
