import type { SourceId } from "./index";
import { sources } from "./index";
import { ingest } from "./ingest";

const requested = process.argv[2] ?? "leiriagenda";

if (!(requested in sources)) {
	console.error(
		`Unknown source "${requested}". Known sources: ${Object.keys(sources).join(", ")}`,
	);
	process.exit(1);
}

const scrape = sources[requested as SourceId];

const startedAt = Date.now();
const rawEvents = await scrape();
const result = await ingest(rawEvents, requested);
const elapsedMs = Date.now() - startedAt;

console.log(
	JSON.stringify(
		{
			source: requested,
			elapsedMs,
			found: result.itemsFound,
			new: result.itemsNew,
			updated: result.itemsUpdated,
			failed: result.itemsFailed,
			error: result.error,
			runId: result.runId,
		},
		null,
		2,
	),
);

if (result.error) {
	process.exitCode = 1;
}
