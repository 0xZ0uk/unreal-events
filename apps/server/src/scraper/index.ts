/**
 * Source registry. Each upstream scraper follows the same contract
 * `() => Promise<RawEvent[]>` so future sources slot in here and reuse the
 * shared normalize/fingerprint/ingest pipeline.
 */
import { scrape as scrapeBol } from "./bol";
import { scrape as scrapeCisterfestas } from "./cisterfestas";
import { scrape as scrapeCmLeiriarss } from "./cmleiriarss";
import { isLeiriaDistrict } from "./district";
import { scrape as scrapeEventbrite } from "./eventbrite";
import { scrape as scrapeFestasearraiais } from "./festasearraiais";
import { scrape as scrapeLeiriagenda } from "./leiriagenda";
import { scrape as scrapeShotgun } from "./shotgun";
import { scrape as scrapeTicketline } from "./ticketline";
import { scrape as scrapeViralagenda } from "./viralagenda";

/** Shotgun: the Centro region page mixes all "Centro" Portugal events —
 * the Leiria-district decision runs per event on the JSON-LD address
 * (locality, falling back to venue-name evidence). */
const scrapeShotgunDistrict = async () =>
	scrapeShotgun(undefined, (evidence) => isLeiriaDistrict(evidence));

/** SLICE_7 sources run the district gate inside their own modules. */
const scrapeFestasearraiaisDistrict = async () =>
	scrapeFestasearraiais(undefined, (city) => isLeiriaDistrict(city));

const scrapeCisterfestasDistrict = async () =>
	scrapeCisterfestas(undefined, (place) => isLeiriaDistrict(place));

export const sources = {
	leiriagenda: scrapeLeiriagenda,
	cmleiriarss: scrapeCmLeiriarss,
	bol: scrapeBol,
	eventbrite: scrapeEventbrite,
	viralagenda: scrapeViralagenda,
	ticketline: scrapeTicketline,
	festasearraiais: scrapeFestasearraiaisDistrict,
	cisterfestas: scrapeCisterfestasDistrict,
	shotgun: scrapeShotgunDistrict,
} as const;

export type SourceId = keyof typeof sources;
