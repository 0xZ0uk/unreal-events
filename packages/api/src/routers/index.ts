import { publicProcedure, router } from "../index";
import { eventsRouter } from "./events";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	events: eventsRouter,
});
export type AppRouter = typeof appRouter;
