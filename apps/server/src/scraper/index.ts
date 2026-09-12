/**
 * Source registry. Each upstream scraper follows the same contract
 * `() => Promise<RawEvent[]>` so future sources slot in here and reuse the
 * shared normalize/fingerprint/ingest pipeline.
 */
import { scrape as scrapeBol } from "./bol";
import { scrape as scrapeCaldas } from "./caldas";
import { scrape as scrapeCisterfestas } from "./cisterfestas";
import { scrape as scrapeCmLeiriarss } from "./cmleiriarss";
import { inDistrictScope, isLeiriaDistrict } from "./district";
import { scrape as scrapeEventbrite } from "./eventbrite";
import { scrape as scrapeFestasearraiais } from "./festasearraiais";
import { scrape as scrapeFigueiro } from "./figueiro";
import { scrape as scrapeLeiriagenda } from "./leiriagenda";
import { scrape as scrapeMunicipal } from "./municipal";
import { scrape as scrapeNocartaz } from "./nocartaz";
import { scrape as scrapeObidos } from "./obidos";
import { scrape as scrapeRegiaoleiria } from "./regiaoleiria";
import { scrape as scrapeShotgun } from "./shotgun";
import { scrape as scrapeTicketline } from "./ticketline";
import { scrape as scrapeTurismodocentro } from "./turismodocentro";
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

/** SLICE_9 sources. municipal/regiaoleiria already default to the district
 * gate; the registry wires it explicitly so the scope rule lives in one place.
 * obidos/caldas take it as their second argument. */
const scrapeMunicipalDistrict = async () =>
	scrapeMunicipal(undefined, (place) => isLeiriaDistrict(place));

const scrapeRegiaoleiriaDistrict = async () =>
	scrapeRegiaoleiria(undefined, (place) => isLeiriaDistrict(place));

const scrapeObidosDistrict = async () =>
	scrapeObidos(undefined, (place) => isLeiriaDistrict(place));

const scrapeCaldasDistrict = async () =>
	scrapeCaldas(undefined, (place) => isLeiriaDistrict(place));

/** SLICE_10 + SLICE_17: nocartaz is a venue-hub aggregator. Its Leiria district
 * hub mixes in rows filed from outside the district (Bandsintown/3cket gigs), so
 * the gate runs on the resolved locality, not on the hub route — and since its
 * aggregator rows often carry NO locality at all, the gate is the venue-aware
 * one: a venue we know by fact (O Pica Miolos) places its own events, wherever
 * the hub filed them. */
const scrapeNocartazDistrict = async () =>
	scrapeNocartaz(undefined, (place, venueEvidence) =>
		inDistrictScope(place, venueEvidence),
	);

/** SLICE_10 tier-2 coverage sources. figueiro is a municipal agenda (its city
 * chip is the concelho); turismodocentro gates on the concelho terms of the
 * event board, filing a region-wide row under its first in-district concelho. */
const scrapeFigueiroDistrict = async () =>
	scrapeFigueiro(undefined, (place) => isLeiriaDistrict(place));

const scrapeTurismodocentroDistrict = async () =>
	scrapeTurismodocentro(undefined, (place) => isLeiriaDistrict(place));

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
	municipal: scrapeMunicipalDistrict,
	obidos: scrapeObidosDistrict,
	regiaoleiria: scrapeRegiaoleiriaDistrict,
	caldas: scrapeCaldasDistrict,
	nocartaz: scrapeNocartazDistrict,
	figueiro: scrapeFigueiroDistrict,
	turismodocentro: scrapeTurismodocentroDistrict,
} as const;

export type SourceId = keyof typeof sources;
