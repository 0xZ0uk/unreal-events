/**
 * Source registry. Each upstream scraper follows the same contract
 * `() => Promise<RawEvent[]>` so future sources slot in here and reuse the
 * shared normalize/fingerprint/ingest pipeline.
 */
import { scrape as scrapeBol } from "./bol";
import { scrape as scrapeCmLeiriarss } from "./cmleiriarss";
import { scrape as scrapeEventbrite } from "./eventbrite";
import { scrape as scrapeLeiriagenda } from "./leiriagenda";
import { scrape as scrapeTicketline } from "./ticketline";
import { scrape as scrapeViralagenda } from "./viralagenda";

export const sources = {
	leiriagenda: scrapeLeiriagenda,
	cmleiriarss: scrapeCmLeiriarss,
	bol: scrapeBol,
	eventbrite: scrapeEventbrite,
	viralagenda: scrapeViralagenda,
	ticketline: scrapeTicketline,
} as const;

export type SourceId = keyof typeof sources;

export * from "./fingerprint";
export * from "./ingest";
export * from "./normalize";
export * from "./types";
