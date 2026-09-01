import { publicProcedure, router } from "../index";
import { adminRouter } from "./admin";
import { eventsRouter } from "./events";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	events: eventsRouter,
	admin: adminRouter,
});
export type AppRouter = typeof appRouter;
