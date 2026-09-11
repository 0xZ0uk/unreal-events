import { publicProcedure, router } from "../index";
import {
	calendarInput,
	eventStats,
	eventsByDay,
	eventsCalendar,
	listEvents,
	listInput,
	undatedEvents,
	venues,
} from "../queries/events";

/**
 * Thin tRPC wrappers over `../queries/events` (SLICE_8). The query bodies live
 * in the queries module so the browser bundle can run them without dragging
 * `@trpc/server` in; this router keeps validating input + shaping the wire
 * contract for any non-browser caller.
 */
export const eventsRouter = router({
	list: publicProcedure
		.input(listInput)
		.query(({ ctx, input }) => listEvents(ctx.db, input)),

	byDay: publicProcedure.query(({ ctx }) => eventsByDay(ctx.db)),

	calendar: publicProcedure
		.input(calendarInput)
		.query(({ ctx, input }) => eventsCalendar(ctx.db, input)),

	undated: publicProcedure.query(({ ctx }) => undatedEvents(ctx.db)),

	venues: publicProcedure.query(({ ctx }) => venues(ctx.db)),

	stats: publicProcedure.query(({ ctx }) => eventStats(ctx.db)),
});
