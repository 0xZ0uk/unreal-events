import { eventStats, listEvents, listInput, undatedEvents } from "@events-tracker/api/queries/events";
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
export const db = createBrowserDb(env.VITE_TURSO_URL, env.VITE_TURSO_AUTH_TOKEN);

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
export type UndatedEvent = Awaited<ReturnType<typeof undatedEvents>>[number];
export type EventStats = Awaited<ReturnType<typeof eventStats>>;

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
							limit: 500,
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
};

/** The window query caps at 500 rows; beyond that the page says so. */
export const WINDOW_LIMIT = 500;
