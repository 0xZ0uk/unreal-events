import type {
	CalendarInput,
	ListInput,
	RunsInput,
} from "@events-tracker/api/queries/events";
import {
	calendarInput,
	eventStats,
	eventsByDay,
	eventsCalendar,
	listEvents,
	listInput,
	runsInput,
	scrapeRuns,
	undatedEvents,
	venues,
} from "@events-tracker/api/queries/events";
import { createBrowserDb } from "@events-tracker/db/browser";
import { env } from "@events-tracker/env/web";
import { QueryCache, QueryClient, queryOptions } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Read API for the static SPA (SLICE_8).
 *
 * There is no server in production: this module opens a libSQL-over-HTTP client
 * straight to Turso in the browser and hands react-query plain `queryOptions`.
 * The query functions come from `@events-tracker/api/queries/events`, which the
 * tRPC router also uses — so the browser and the (dev-only) server run identical
 * SQL. tRPC itself is absent from this bundle: `@trpc/server` throws when it is
 * imported in a browser.
 */
export const db = createBrowserDb(
	env.VITE_TURSO_URL,
	env.VITE_TURSO_AUTH_TOKEN,
);

export const queryClient = new QueryClient({
	queryCache: new QueryCache({
		onError: (error, query) => {
			toast.error(error.message, {
				action: {
					label: "retry",
					onClick: () => {
						query.invalidate();
					},
				},
			});
		},
	}),
});

export const api = {
	events: {
		list: {
			queryOptions: (input?: Partial<ListInput>) =>
				queryOptions({
					queryKey: ["events", "list", input ?? null],
					// Parse through the same schema the router used so defaults
					// (limit/offset/includeUndated) apply exactly as before.
					queryFn: () => listEvents(db, listInput.parse(input ?? {})),
				}),
		},
		byDay: {
			queryOptions: () =>
				queryOptions({
					queryKey: ["events", "byDay"],
					queryFn: () => eventsByDay(db),
				}),
		},
		calendar: {
			queryOptions: (input: CalendarInput) =>
				queryOptions({
					queryKey: ["events", "calendar", input],
					queryFn: () => eventsCalendar(db, calendarInput.parse(input)),
				}),
		},
		undated: {
			queryOptions: () =>
				queryOptions({
					queryKey: ["events", "undated"],
					queryFn: () => undatedEvents(db),
				}),
		},
		venues: {
			queryOptions: () =>
				queryOptions({
					queryKey: ["events", "venues"],
					queryFn: () => venues(db),
				}),
		},
		stats: {
			queryOptions: () =>
				queryOptions({
					queryKey: ["events", "stats"],
					queryFn: () => eventStats(db),
				}),
		},
	},
	admin: {
		runs: {
			queryOptions: (input?: Partial<RunsInput>) =>
				queryOptions({
					queryKey: ["admin", "runs", input ?? null],
					queryFn: () => scrapeRuns(db, runsInput.parse(input ?? {})),
				}),
		},
	},
};
