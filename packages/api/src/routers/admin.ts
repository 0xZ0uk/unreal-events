import { publicProcedure, router } from "../index";
import { runsInput, scrapeRuns } from "../queries/events";

/** Thin tRPC wrapper over `../queries/events#scrapeRuns` (SLICE_8). */
export const adminRouter = router({
	/** Latest scrape runs, newest first. */
	runs: publicProcedure
		.input(runsInput)
		.query(({ ctx, input }) => scrapeRuns(ctx.db, input)),
});
