import { describe, expect, test } from "bun:test";

import {
	type Db,
	eventBySlug,
	eventDirectory,
	eventsBySlugs,
	listEvents,
	listInput,
	WINDOW_MAX,
} from "./events";

/**
 * The window cap is a safety valve, not a page size.
 *
 * When it drops below what a 90-day window actually holds, the furthest-future
 * events disappear with no error and no failed request — the page simply shows
 * fewer days than the data has. It sat at 500 while the live window held 501.
 */
describe("listInput", () => {
	test("defaults to the whole window rather than a page", () => {
		expect(listInput.parse({}).limit).toBe(WINDOW_MAX);
	});

	test("accepts the limit the agenda page asks for", () => {
		expect(listInput.parse({ limit: WINDOW_MAX }).limit).toBe(WINDOW_MAX);
	});

	/**
	 * Guards the headroom: the window grows ~120 events/week, so a cap that
	 * leaves room for only today's 501 rows would slip back into silent
	 * truncation within months.
	 */
	test("leaves headroom above a full 90-day window", () => {
		expect(WINDOW_MAX).toBeGreaterThanOrEqual(1000);
	});

	test("is still a cap — an unbounded fetch is not the fix", () => {
		expect(listInput.safeParse({ limit: WINDOW_MAX + 1 }).success).toBe(false);
		expect(listInput.safeParse({ limit: 0 }).success).toBe(false);
	});
});

/**
 * Chainable stand-in for the drizzle client. These cover what the queries hand
 * back — mapping and the not-found contract — not the SQL itself, which the
 * build-time prerender exercises for real against the live database.
 */
function stubDb(rows: Record<string, unknown>[]): Db {
	const chain: Record<string, unknown> = {
		orderBy: () => Promise.resolve(rows),
		limit: () => Promise.resolve(rows),
	};

	chain.select = () => chain;
	chain.from = () => chain;
	chain.leftJoin = () => chain;
	chain.where = () => chain;

	return chain as unknown as Db;
}

const detailRow = {
	id: 7,
	title: "Concerto de Verão",
	slug: "concerto-de-verao",
	start_at: 1_790_000_000,
	end_at: null,
	venue_id: 3,
	image_url: null,
	url: "https://exemplo.pt/concerto",
	categories: ["Música"],
	date_text: null,
	venueName: "Teatro José Lúcio da Silva",
	venueCity: "Leiria",
	venueSlug: "teatro-jose-lucio-da-silva",
	description: "Uma noite de música no centro da cidade.",
	updated_at: 1_789_000_000,
};

describe("eventBySlug", () => {
	test("returns the description and the update stamp the page needs", async () => {
		const event = await eventBySlug(stubDb([detailRow]), "concerto-de-verao");

		expect(event).toMatchObject({
			slug: "concerto-de-verao",
			title: "Concerto de Verão",
			description: "Uma noite de música no centro da cidade.",
			updatedAt: 1_789_000_000,
			venueName: "Teatro José Lúcio da Silva",
			categories: ["Música"],
		});
	});

	/** A slug that no longer exists must be a 404, not an empty page. */
	test("is null for an unknown slug", async () => {
		expect(await eventBySlug(stubDb([]), "nao-existe")).toBeNull();
	});

	test("carries an absent description as null rather than undefined", async () => {
		const event = await eventBySlug(
			stubDb([{ ...detailRow, description: null }]),
			"concerto-de-verao",
		);

		expect(event?.description).toBeNull();
	});

	/**
	 * The window query shed descriptions to cut the agenda payload by a third;
	 * only the detail query pays for them. If a row's description leaked into
	 * list output, the payload would grow again without anyone noticing.
	 */
	test("never leaks into the agenda list payload", async () => {
		const [event] = await listEvents(stubDb([detailRow]), listInput.parse({}));

		expect(event).toBeDefined();
		expect("description" in (event as object)).toBe(false);
		expect("updatedAt" in (event as object)).toBe(false);
	});
});

describe("eventDirectory", () => {
	test("maps every row for the prerender and the sitemap", async () => {
		const events = await eventDirectory(
			stubDb([detailRow, { ...detailRow, slug: "outro", description: null }]),
		);

		expect(events).toHaveLength(2);
		expect(events[0]).toMatchObject({
			slug: "concerto-de-verao",
			updatedAt: 1_789_000_000,
		});
		expect(events[1]).toMatchObject({ slug: "outro", description: null });
	});

	test("is empty rather than throwing on an empty database", async () => {
		expect(await eventDirectory(stubDb([]))).toEqual([]);
	});
});

describe("eventsBySlugs", () => {
	test("returns [] without running for an empty slug list", async () => {
		// The stub chain resolves rows for anything, so a non-[]
		// result here would mean the query ran despite the shortcut.
		expect(await eventsBySlugs(stubDb([]), [])).toEqual([]);
	});

	test("maps matched slugs to the public row shape", async () => {
		const events = await eventsBySlugs(stubDb([detailRow]), [
			"concerto-de-verao",
		]);

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			slug: "concerto-de-verao",
			title: "Concerto de Verão",
			venueName: "Teatro José Lúcio da Silva",
			categories: ["Música"],
		});
		// Shed descriptions exactly like the agenda list payload.
		expect("description" in (events[0] as object)).toBe(false);
	});

	/**
	 * Unlike the agenda, same-day sessions keep their own identity here — the
	 * saved page must count two saved sessions as two rows, not glue them.
	 */
	test("does not merge same-day sessions", async () => {
		const second = {
			...detailRow,
			id: 8,
			slug: "concerto-de-verao-2",
			title: "Concerto de Verão — sessão 2",
		};
		const events = await eventsBySlugs(stubDb([detailRow, second]), [
			"concerto-de-verao",
			"concerto-de-verao-2",
		]);

		expect(events).toHaveLength(2);
	});

	test("lets slugs that no longer resolve drop out of the result", async () => {
		const events = await eventsBySlugs(stubDb([detailRow]), [
			"concerto-de-verao",
			"nao-existe",
		]);

		expect(events.map((e) => e.slug)).toEqual(["concerto-de-verao"]);
	});
});
