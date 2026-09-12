import type { SourceId } from "./index";
import { sources } from "./index";
import { runSource } from "./runner";

/**
 * Scraper runner.
 *
 *   bun run src/scraper/run.ts            → run EVERY source sequentially
 *   bun run src/scraper/run.ts leiriagenda → run one source
 *
 * Per-source failures are counted, never fatal — one dead source doesn't
 * stop the rest. That includes a source that *throws*: `runSource` records it
 * as a failure (with its `scrape_runs` row) and the batch carries on. Output:
 * one JSON block per run.
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
	console.log(JSON.stringify(await runSource(id, sources[id]), null, 2));
}
