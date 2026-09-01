/**
 * Source registry. Each upstream scraper follows the same contract
 * `() => Promise<RawEvent[]>` so future sources slot in here and reuse the
 * shared normalize/fingerprint/ingest pipeline.
 */
import { scrape as scrapeCmLeiriarss } from "./cmleiriarss";
import { scrape as scrapeLeiriagenda } from "./leiriagenda";

export const sources = {
	leiriagenda: scrapeLeiriagenda,
	cmleiriarss: scrapeCmLeiriarss,
} as const;

export type SourceId = keyof typeof sources;

export * from "./fingerprint";
export * from "./ingest";
export * from "./normalize";
export * from "./types";
