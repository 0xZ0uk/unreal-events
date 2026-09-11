import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildIcs } from "./digest-core";

/**
 * ICS CLI — writes the public calendar feed the static SPA serves.
 *
 * SLICE_8: with no Hono server in production, `/events.ics` cannot be a route.
 * The daily runner regenerates the file into `apps/web/public/` and commits it,
 * so Vercel publishes it as a static asset on the next redeploy.
 *
 * Usage:
 *   bun run src/ics-cli.ts                       # -> apps/web/public/events.ics
 *   DIGEST_KEYWORDS=tattoo bun run src/ics-cli.ts
 *   bun run src/ics-cli.ts --out /tmp/events.ics
 */
const argv = process.argv.slice(2);
const outIdx = argv.indexOf("--out");
const out = resolve(
	outIdx >= 0
		? (argv[outIdx + 1] ?? "apps/web/public/events.ics")
		: new URL("../../../apps/web/public/events.ics", import.meta.url).pathname,
);

const keywords = (process.env.DIGEST_KEYWORDS ?? "")
	.split(",")
	.map((k) => k.trim().toLowerCase())
	.filter(Boolean);

const ics = await buildIcs(keywords);

await mkdir(dirname(out), { recursive: true });
await Bun.write(out, ics);

const events = ics.split("BEGIN:VEVENT").length - 1;
console.log(`Wrote ${events} event(s) to ${out}`);
