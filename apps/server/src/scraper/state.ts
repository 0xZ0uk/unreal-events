import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Tiny JSON state persistence for incremental scrapers.
 *
 * Each source keeps a gitignored `state/<id>.json` file holding the
 * discovery cursor (lastmod watermark / seen id set) so steady-state runs
 * fetch a handful of pages instead of the whole history. State is
 * best-effort: a missing/corrupt file just means "start fresh" — the
 * fingerprint pipeline makes re-ingestion a no-op either way.
 */

const STATE_DIR = join(import.meta.dir, "state");

export interface StateFile<T extends object = Record<string, unknown>> {
	data: T;
}

export function loadState<T extends object>(id: string, fallback: T): T {
	try {
		const raw = readFileSync(join(STATE_DIR, `${id}.json`), "utf-8");
		return { ...fallback, ...(JSON.parse(raw) as T) };
	} catch {
		return fallback;
	}
}

export function saveState<T extends object>(id: string, data: T): void {
	mkdirSync(STATE_DIR, { recursive: true });
	writeFileSync(join(STATE_DIR, `${id}.json`), JSON.stringify(data, null, 2));
}

// Ensure the state dir exists so the gitignore entry is what actually
// excludes it (empty dirs carry no git status anyway).
mkdirSync(STATE_DIR, { recursive: true });

// Re-export dirname for callers that want the resolved path.
export { STATE_DIR };
