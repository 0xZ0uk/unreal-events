import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

/**
 * Browser-safe db entry (SLICE_8): an in-browser libSQL client speaking
 * SQL-over-HTTP to a remote Turso database. Env-free — the caller supplies the
 * url and optional authToken — so this module is safe to bundle into the SPA.
 */
export function createBrowserDb(url: string, authToken?: string) {
	const client = createClient({
		url,
		authToken,
	});
	return drizzle({ client, schema });
}

export { schema };