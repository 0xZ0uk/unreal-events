import { db, schema } from "@events-tracker/db";
import { eq, isNull } from "drizzle-orm";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "events-tracker/0.1 (pedro@porta443.com)";
const MIN_DELAY_MS = 1100; // Nominatim policy: max 1 req/sec
const MAX_REQUESTS = 100;
const TIMEOUT_MS = 15_000;

type NominatimHit = {
	lat: string;
	lon: string;
	display_name: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geocode(query: string): Promise<NominatimHit | null> {
	const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			headers: {
				"User-Agent": USER_AGENT,
				"Accept-Language": "pt",
			},
			signal: controller.signal,
		});
		if (!res.ok) {
			console.error(`  HTTP ${res.status} for "${query}"`);
			return null;
		}
		const data = (await res.json()) as NominatimHit[];
		return data[0] ?? null;
	} catch (err) {
		console.error(`  Nominatim request failed for "${query}": ${(err as Error).message}`);
		return null;
	} finally {
		clearTimeout(timer);
	}
}

const needs = await db.query.venues.findMany({ where: isNull(schema.venues.lat) });

if (needs.length === 0) {
	console.log(JSON.stringify({ venues: 0, geocoded: 0, missed: [], requests: 0 }));
	process.exit(0);
}

if (needs.length > MAX_REQUESTS) {
	console.error(`Refusing to run: ${needs.length} venues exceeds MAX_REQUESTS=${MAX_REQUESTS}`);
	process.exit(1);
}

console.log(`Geocoding ${needs.length} venues…`);

const geocoded: { name: string; lat: number; lng: number }[] = [];
const missed: { name: string; reason: string }[] = [];
let requests = 0;

for (const venue of needs) {
	const city = venue.city ?? "Leiria";
	const query = `${venue.name}, ${city}, Portugal`;
	requests += 1;

	const hit = await geocode(query);
	if (hit) {
		const lat = Number(hit.lat);
		const lng = Number(hit.lon);
		if (Number.isFinite(lat) && Number.isFinite(lng)) {
			await db
				.update(schema.venues)
				.set({
					lat,
					lng,
					...(venue.address ? {} : { address: hit.display_name }),
				})
				.where(eq(schema.venues.id, venue.id));
			geocoded.push({ name: venue.name, lat, lng });
			console.log(`  ok: ${venue.name} → ${lat}, ${lng}`);
		} else {
			missed.push({ name: venue.name, reason: `non-numeric coords (${hit.lat},${hit.lon})` });
			console.log(`  MISS (bad coords): ${venue.name}`);
		}
	} else {
		missed.push({ name: venue.name, reason: "no matching place or request error" });
		console.log(`  MISS: ${venue.name}`);
	}

	await sleep(MIN_DELAY_MS);
}

const result = {
	venues: needs.length,
	geocoded: geocoded.length,
	missed: missed.map((m) => m.name),
	requests,
};

console.log(JSON.stringify(result, null, 2));

if (geocoded.length > 0) {
	console.log(
		"\nSamples:",
		geocoded.slice(0, 3).map((g) => `${g.name} → ${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`),
	);
}