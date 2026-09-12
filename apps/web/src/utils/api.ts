import {
	eventBySlug,
	eventStats,
	eventsBySlugs,
	listEvents,
	listInput,
	undatedEvents,
	WINDOW_MAX,
} from "@events-tracker/api/queries/events";
import { createBrowserDb } from "@events-tracker/db/browser";
import { env } from "@events-tracker/env/web";
import { QueryClient, queryOptions } from "@tanstack/react-query";

/**
 * Read API for the static page (SLICE_8/9).
 *
 * There is no server in production: this opens a libSQL-over-HTTP client
 * straight to Turso in the browser and hands react-query plain `queryOptions`.
 * The query functions come from `@events-tracker/api/queries/events`, the same
 * module the tRPC router wraps, so the browser and the (dev-only) server run
 * identical SQL.
 *
 * Three reads, and the agenda window is the only one that carries rows.
 */
export const db = createBrowserDb(
	env.VITE_TURSO_URL,
	env.VITE_TURSO_AUTH_TOKEN,
);

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 5 * 60_000,
			// A failed read should admit it quickly rather than retrying for
			// half a minute behind a skeleton.
			retry: 1,
			refetchOnWindowFocus: false,
		},
	},
});

export type PublicEvent = Awaited<ReturnType<typeof listEvents>>[number];

/**
 * One row of the reader's saved list. Narrower than `PublicEvent`: the agenda
 * merges a day's sessions into one row, while a saved slug is always a single
 * event, so there is no `sessionStarts` to fold in.
 */
export type SavedListEvent = Awaited<ReturnType<typeof eventsBySlugs>>[number];
export type UndatedEvent = Awaited<ReturnType<typeof undatedEvents>>[number];
export type EventStats = Awaited<ReturnType<typeof eventStats>>;
export type EventDetail = Awaited<ReturnType<typeof eventBySlug>>;

export const api = {
	/** Every event starting inside the window, oldest first. */
	window: {
		queryOptions: (from: number, to: number) =>
			queryOptions({
				queryKey: ["agenda", "window", from, to],
				queryFn: () =>
					listEvents(
						db,
						listInput.parse({
							dateFrom: from,
							dateTo: to,
							includeUndated: false,
							limit: WINDOW_MAX,
						}),
					),
			}),
	},
	/** Announced but undated — shown separately, never mixed into the days. */
	undated: {
		queryOptions: () =>
			queryOptions({
				queryKey: ["agenda", "undated"],
				queryFn: () => undatedEvents(db),
			}),
	},
	stats: {
		queryOptions: () =>
			queryOptions({
				queryKey: ["agenda", "stats"],
				queryFn: () => eventStats(db),
			}),
	},
	event: {
		queryOptions: (slug: string) =>
			queryOptions({
				queryKey: ["event", slug],
				queryFn: () => eventBySlug(db, slug),
			}),
	},
	/**
	 * The events behind the reader's saved slugs. The list itself is not an
	 * event read — it comes from `/api/saved` — so this is keyed by the slugs
	 * it was handed and stays disabled until there are any, which is also what
	 * keeps a signed-out visit from querying Turso at all.
	 */
	saved: {
		queryOptions: (slugs: string[]) =>
			queryOptions({
				queryKey: ["saved", "events", ...slugs],
				queryFn: () => eventsBySlugs(db, slugs),
				enabled: slugs.length > 0,
			}),
	},
};

/**
 * The window query's row cap, shared with the query itself so the truncation
 * notice can only fire when the safety valve really trips — not while the page
 * is simply showing everything the window holds.
 */
export const WINDOW_LIMIT = WINDOW_MAX;
