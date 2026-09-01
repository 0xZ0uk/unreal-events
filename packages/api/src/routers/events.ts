import { db, schema } from "@events-tracker/db";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
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
	date_text: schema.events.date_text,
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
	date_text: string | null;
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
		dateText: row.date_text,
	};
}

const listInput = z.object({
	limit: z.number().int().min(1).max(500).default(500),
	offset: z.number().int().min(0).default(0),
	venueSlug: z.string().optional(),
	category: z.string().optional(),
	dateFrom: z.number().int().optional(),
	dateTo: z.number().int().optional(),
	city: z.string().optional(),
	includeUndated: z.boolean().default(false),
});

export const eventsRouter = router({
	list: publicProcedure.input(listInput).query(async ({ input }) => {
		const conditions = [];
		if (!input.includeUndated) {
			conditions.push(isNull(schema.events.date_text));
		}
		if (input.venueSlug) {
			conditions.push(eq(schema.venues.slug, input.venueSlug));
		}
		if (input.category) {
			conditions.push(
				sql`${schema.events.categories} like ${`%"${input.category}"%`}`,
			);
		}
		if (input.dateFrom !== undefined) {
			conditions.push(gte(schema.events.start_at, input.dateFrom));
		}
		if (input.dateTo !== undefined) {
			conditions.push(lte(schema.events.start_at, input.dateTo));
		}
		if (input.city) {
			conditions.push(eq(schema.venues.city, input.city));
		}

		const rows = await db
			.select(eventSelect)
			.from(schema.events)
			.leftJoin(schema.venues, eq(schema.events.venue_id, schema.venues.id))
			.where(conditions.length > 0 ? and(...conditions) : undefined)
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
			.where(
				and(gte(schema.events.start_at, now), isNull(schema.events.date_text)),
			)
			.orderBy(schema.events.start_at);

		return rows.map(toPublicEvent);
	}),

	undated: publicProcedure.query(async () => {
		const rows = await db
			.select(eventSelect)
			.from(schema.events)
			.leftJoin(schema.venues, eq(schema.events.venue_id, schema.venues.id))
			.where(sql`${schema.events.date_text} is not null`)
			.orderBy(desc(schema.events.id));

		return rows.map(toPublicEvent);
	}),

	venues: publicProcedure.query(async () => {
		const rows = await db
			.select({
				id: schema.venues.id,
				name: schema.venues.name,
				slug: schema.venues.slug,
				city: schema.venues.city,
			})
			.from(schema.venues)
			.orderBy(schema.venues.name);

		return rows;
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
