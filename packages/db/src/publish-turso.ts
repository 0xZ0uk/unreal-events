/**
 * Mirror the local SQLite DB into Turso — the database the deployed site
 * actually reads.
 *
 * Nothing else publishes `local.db`: the scraper writes local SQLite, the site
 * reads Turso, and until this runs the two drift apart (the site keeps serving
 * an older copy of the district — that is why the calendar showed 211 events
 * after a run that had ingested 434). Full-table mirror in FK order inside a
 * single write transaction, so a half-published DB is impossible; counts are
 * printed on both sides.
 *
 *   bun run db:publish                    # from packages/db, uses the repo .env
 *   DATABASE_URL=… TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… bun run db:publish
 */
import { Database } from "bun:sqlite";

import { createClient } from "@libsql/client";

/** Parents first: inserts in this order, deletes in reverse. */
const TABLES = ["venues", "events", "event_sources", "scrape_runs"] as const;

type Table = (typeof TABLES)[number];

const databaseUrl = process.env.DATABASE_URL ?? "";
const localPath = databaseUrl.replace(/^file:/, "");
const tursoUrl = process.env.TURSO_DATABASE_URL;
// Turso hands out per-token permissions: the site's read token is read-only,
// so publishing needs the read/write one (TURSO_RW_TOKEN in the credentials
// file). Fall back to TURSO_AUTH_TOKEN for a single-token setup.
const tursoToken = process.env.TURSO_RW_TOKEN ?? process.env.TURSO_AUTH_TOKEN;

if (localPath === "" || localPath === databaseUrl) {
	console.error(
		"db:publish needs DATABASE_URL as a local file URL (file:…/local.db).",
	);
	process.exit(1);
}
if (!tursoUrl || !tursoToken) {
	console.error("db:publish needs TURSO_DATABASE_URL and TURSO_RW_TOKEN.");
	process.exit(1);
}

const local = new Database(localPath, { readonly: true });
const turso = createClient({ url: tursoUrl, authToken: tursoToken });

const statements: { sql: string; args: (string | number | null)[] }[] = [];
for (const table of [...TABLES].reverse()) {
	statements.push({ sql: `DELETE FROM ${table}`, args: [] });
}

const counts = new Map<Table, number>();
for (const table of TABLES) {
	const remote = (await turso.execute(`PRAGMA table_info(${table})`)).rows;
	const remoteColumns = remote.map((r) => String(r.name));
	const columns = local
		.query<{ name: string }, []>(`PRAGMA table_info(${table})`)
		.all()
		.map((c) => c.name);
	if (remoteColumns.length === 0) {
		console.error(`Turso has no ${table} table — run db:push first.`);
		process.exit(1);
	}
	const missing = columns.filter((c) => !remoteColumns.includes(c));
	if (missing.length > 0) {
		console.error(`Turso ${table} is missing columns: ${missing.join(", ")}`);
		process.exit(1);
	}

	const rows = local.query<Record<string, unknown>, []>(`SELECT * FROM ${table}`).all();
	counts.set(table, rows.length);
	const placeholders = columns.map(() => "?").join(", ");
	for (const row of rows) {
		statements.push({
			sql: `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
			args: columns.map((c) => {
				const value = row[c];
				return typeof value === "bigint" ? Number(value) : (value as never);
			}),
		});
	}
	console.log(
		`${table}: ${rows.length} rows, ${remote.length} columns → mirrored`,
	);
}

const started = Date.now();
await turso.batch(statements, "write");
console.log(
	`published ${statements.length - TABLES.length} rows to Turso in ${Date.now() - started}ms`,
);

const now = Math.floor(Date.now() / 1000);
const check = await turso.execute(
	"SELECT (SELECT count(*) FROM events) AS total, (SELECT count(*) FROM events WHERE date_text IS NULL AND start_at >= ?) AS upcoming, (SELECT count(*) FROM venues) AS venues",
	[now],
);
const row = check.rows[0];
console.log(`Turso now: ${JSON.stringify(row)}`);
local.close();
process.exit(0);
