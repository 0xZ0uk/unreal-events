import { db, schema } from "@events-tracker/db";
import { desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../index";

const eventSelect = {
	id: schema.events.id,
	title: schema.events.title,
	slug: schema.events.slug,
	description: schema.events.description,
	start_at: schema.events.start_at,
	end_at: schema.events.end_at,
	venue_id: schema.events.venue_id,
	image_url: schema.events.image_url,
	url: schema.events.url,
	categories: schema.events.categories,
	venueName: schema.venues.name,
	venueCity: schema.venues.city,
	venueSlug: schema.venues.slug,
};

type EventRow = {
	id: number;
	title: string;
	slug: string;
	description: string | null;
	start_at: number;
	end_at: number | null;
	venue_id: number | null;
	image_url: string | null;
	url: string | null;
	categories: string[] | null;
	venueName: string | null;
	venueCity: string | null;
	venueSlug: string | null;
};

function toPublicEvent(row: EventRow) {
	return {
		id: row.id,
		title: row.title,
		slug: row.slug,
		description: row.description,
		startAt: row.start_at,
		endAt: row.end_at,
		venueId: row.venue_id,
		venueName: row.venueName,
		venueCity: row.venueCity,
		venueSlug: row.venueSlug,
		imageUrl: row.image_url,
		url: row.url,
		categories: row.categories ?? [],
	};
}

export const eventsRouter = router({
	list: publicProcedure
		.input(
			z.object({
				limit: z.number().int().min(1).max(500).default(200),
				offset: z.number().int().min(0).default(0),
			}),
		)
		.query(async ({ input }) => {
			const rows = await db
				.select(eventSelect)
				.from(schema.events)
				.leftJoin(schema.venues, eq(schema.events.venue_id, schema.venues.id))
				.orderBy(schema.events.start_at)
				.limit(input.limit)
				.offset(input.offset);

			return rows.map(toPublicEvent);
		}),

	byDay: publicProcedure.query(async () => {
		const now = Math.floor(Date.now() / 1000);

		const rows = await db
			.select(eventSelect)
			.from(schema.events)
			.leftJoin(schema.venues, eq(schema.events.venue_id, schema.venues.id))
			.where(gte(schema.events.start_at, now))
			.orderBy(schema.events.start_at);

		return rows.map(toPublicEvent);
	}),

	stats: publicProcedure.query(async () => {
		const [eventCount, venueCount, latestRun] = await Promise.all([
			db.select({ count: sql<number>`count(*)` }).from(schema.events),
			db.select({ count: sql<number>`count(*)` }).from(schema.venues),
			db
				.select()
				.from(schema.scrapeRuns)
				.orderBy(desc(schema.scrapeRuns.started_at))
				.limit(1),
		]);

		const latest = latestRun[0];

		return {
			totalEvents: Number(eventCount[0]?.count ?? 0),
			totalVenues: Number(venueCount[0]?.count ?? 0),
			lastRunAt: latest?.started_at ?? null,
			lastRunFound: latest?.items_found ?? null,
			lastRunNew: latest?.items_new ?? null,
		};
	}),
});
