import { db, schema } from "@events-tracker/db";
import { desc } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../index";

const runsInput = z.object({
	limit: z.number().int().min(1).max(500).default(50),
});

export const adminRouter = router({
	/** Latest scrape runs, newest first. */
	runs: publicProcedure.input(runsInput).query(async ({ input }) => {
		const rows = await db
			.select()
			.from(schema.scrapeRuns)
			.orderBy(desc(schema.scrapeRuns.started_at))
			.limit(input.limit);

		return rows.map((r) => ({
			id: r.id,
			source: r.source,
			startedAt: r.started_at,
			finishedAt: r.finished_at,
			found: r.items_found,
			new: r.items_new,
			failed: r.items_failed,
			error: r.error,
		}));
	}),
});