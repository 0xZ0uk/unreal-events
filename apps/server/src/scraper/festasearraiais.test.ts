import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
	categoryForTitle,
	parseDetailLd,
	parseEventSitemap,
	parseSitemapIndex,
	toRawEvent,
} from "./festasearraiais";
import { toEpochInLisbon } from "./fingerprint";

const detail2024 = readFileSync(
	new URL(
		"./__fixtures__/festasearraiais-tremoceira-2024.html",
		import.meta.url,
	),
	"utf-8",
);
const detail2026 = readFileSync(
	new URL(
		"./__fixtures__/festasearraiais-vestiaria-2026.html",
		import.meta.url,
	),
	"utf-8",
);
const sitemapXml = readFileSync(
	new URL("./__fixtures__/festasearraiais-sitemap.xml", import.meta.url),
	"utf-8",
);

describe("parseSitemapIndex", () => {
	test("extracts the sitemap-eventos sub-sitemaps only", () => {
		const subs = parseSitemapIndex(
			`<sitemapindex>
				<sitemap><loc>https://festasearraiais.pt/sitemap-static.xml</loc></sitemap>
				<sitemap><loc>https://festasearraiais.pt/sitemap-eventos.xml</loc></sitemap>
				<sitemap><loc>https://festasearraiais.pt/sitemap-eventos-2.xml</loc></sitemap>
				<sitemap><loc>https://festasearraiais.pt/sitemap-distritos.xml</loc></sitemap>
			</sitemapindex>`,
		);
		expect(subs).toEqual([
			"https://festasearraiais.pt/sitemap-eventos.xml",
			"https://festasearraiais.pt/sitemap-eventos-2.xml",
		]);
	});
});

describe("parseEventSitemap (real fixture, 4103 urls)", () => {
	test("parses every url block with its lastmod", () => {
		const entries = parseEventSitemap(sitemapXml);
		expect(entries.length).toBe(4103);
		// Tremoceira is NOT in the sitemap (the site skipped it — the gap
		// that motivated SLICE_7). A September festa that IS there:
		const barosa = entries.find((e) => e.url.includes("barosa"));
		expect(barosa?.url).toContain("festa-em-honra-de-s-mateus-2026-barosa");
		expect(barosa?.lastmod.length).toBeGreaterThan(0);
	});
});

describe("parseDetailLd (real pages)", () => {
	test("picks the Event block out of the @graph page", () => {
		const ld = parseDetailLd(detail2024);
		expect(ld?.name).toBe("Festas da Tremoceira 2024 - Porto de Mós");
		expect(ld?.startDate).toBe("2024-08-30");
	});

	test("returns null when no Event JSON-LD exists", () => {
		expect(parseDetailLd("<html><body>nope</body></html>")).toBeNull();
	});
});

describe("toRawEvent (real JSON-LD)", () => {
	test("Tremoceira 2024: inclusive endDate lands at Sep 1 23:59:59 Lisbon", () => {
		const ld = parseDetailLd(detail2024);
		expect(ld).not.toBeNull();
		const raw = toRawEvent(ld as Record<string, unknown>, "https://x");
		expect(raw?.title).toBe("Festas da Tremoceira 2024 - Porto de Mós");
		expect(raw?.startAt).toBe(toEpochInLisbon(2024, 8, 30));
		// endDate 2024-09-02 is INCLUSIVE → end of last day = Sep 2 00:00 − 1s
		expect(raw?.endAt).toBe(toEpochInLisbon(2024, 9, 2) + 86_399);
		expect(raw?.venueName).toBe("Tremoceira, Pedreiras");
		expect(raw?.city).toBe("Porto de Mós");
		expect(raw?.slug).toBe("fe-https:.x");
		expect(raw?.dateText).toBeNull();
		expect(raw?.categories).toEqual(["Tradição"]);
		expect(raw?.imageUrl).toContain("cdn.festasearraiais.pt");
	});

	test("Vestiaria 2026 (ongoing): 28 Aug → 8 Sep inclusive end", () => {
		const ld = parseDetailLd(detail2026);
		const raw = toRawEvent(ld as Record<string, unknown>, "https://y");
		expect(raw?.startAt).toBe(toEpochInLisbon(2026, 8, 28));
		expect(raw?.endAt).toBe(toEpochInLisbon(2026, 9, 8) + 86_399);
		expect(raw?.city).toBe("Alcobaça");
	});

	test("single-day event without endDate pins end = start", () => {
		const raw = toRawEvent(
			{
				name: "Feira do Livro 2026",
				startDate: "2026-10-03",
				location: {
					name: "Jardim do Castelo",
					address: { addressLocality: "Leiria" },
				},
			},
			"https://festasearraiais.pt/eventos/feira-do-livro-2026-12345",
		);
		expect(raw?.startAt).toBe(toEpochInLisbon(2026, 10, 3));
		expect(raw?.endAt).toBe(toEpochInLisbon(2026, 10, 3));
	});

	test("category heuristic: feira/festival/mercado/default", () => {
		expect(categoryForTitle("Feira dos Enchidos 2026")).toBe(
			"Mercados e Feiras",
		);
		expect(categoryForTitle("Mercado Barroco 2026")).toBe("Mercados e Feiras");
		expect(categoryForTitle("Festival de Folclore 2026")).toBe("Festivais");
		expect(categoryForTitle("Festas da Vila 2026")).toBe("Tradição");
	});
});
