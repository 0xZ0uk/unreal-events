import type { SourceId } from "./index";
import { sources } from "./index";
import { ingest } from "./ingest";

/**
 * Scraper runner.
 *
 *   bun run src/scraper/run.ts            → run EVERY source sequentially
 *   bun run src/scraper/run.ts leiriagenda → run one source
 *
 * Per-source failures are counted, never fatal — one dead source doesn't
 * stop the rest. Output: one JSON block per run.
 */
const arg = process.argv[2];

const sourceIds = Object.keys(sources) as SourceId[];
const toRun: SourceId[] =
	arg == null || arg === "all" || arg === "--all"
		? sourceIds
		: [arg as SourceId];

if (toRun.length === 0 || toRun.some((id) => !(id in sources))) {
	console.error(
		`Unknown source "${arg ?? ""}". Known sources: all, ${sourceIds.join(", ")}`,
	);
	process.exit(1);
}

for (const id of toRun) {
	const scrape = sources[id];
	const startedAt = Date.now();
	const { events, failures, firstError } = await scrape();
	const result = await ingest(events, id, {
		found: events.length + failures,
		failures,
		firstError,
	});
	const elapsedMs = Date.now() - startedAt;
	console.log(
		JSON.stringify(
			{
				source: id,
				elapsedMs,
				found: result.itemsFound,
				new: result.itemsNew,
				updated: result.itemsUpdated,
				skippedPast: result.itemsSkippedPast,
				purged: result.itemsPurged,
				failed: result.itemsFailed,
				error: result.error,
				runId: result.runId,
			},
			null,
			2,
		),
	);
}
