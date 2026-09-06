import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
	inferEpochs,
	parseDateRange,
	parseDetailCard,
	parseListingLinks,
	slugFor,
	toRawEvent,
	YEAR_TOLERANCE_S,
} from "./cisterfestas";
import { toEpochInLisbon } from "./fingerprint";

const detailHtml = readFileSync(
	new URL("./__fixtures__/cister-tremoceira.html", import.meta.url),
	"utf-8",
);
const listingHtml = readFileSync(
	new URL("./__fixtures__/cister-listing.html", import.meta.url),
	"utf-8",
);

/** 2026-09-05 12:00 UTC ≈ "now" for deterministic tests. */
const NOW = Math.floor(Date.UTC(2026, 8, 5, 12, 0, 0) / 1000);

describe("parseListingLinks (real page-1 fixture)", () => {
	test("extracts unique salaodefestas urls", () => {
		const links = parseListingLinks(listingHtml);
		expect(links.length).toBeGreaterThan(40);
		expect(
			links.every((l) => l.startsWith("https://cister.fm/salaodefestas/")),
		).toBe(true);
		expect(links).toContain(
			"https://cister.fm/salaodefestas/festas-da-tremoceira-4-a-7-de-setembro/",
		);
	});
});

describe("parseDetailCard (real Tremoceira page)", () => {
	test("title, dateText and venue come off the Elementor card", () => {
		const card = parseDetailCard(detailHtml);
		expect(card.title).toBe("Festas da Tremoceira, 4 a 7 de Setembro");
		expect(card.dateText).toBe("4 a 7 de Setembro");
		expect(card.venue?.trim()).toBe("Tremoceira");
	});
});

describe("parseDateRange", () => {
	test("two-day range with month", () => {
		expect(parseDateRange("4 a 7 de Setembro")).toEqual({
			startDay: 4,
			endDay: 7,
			month: 9,
		});
	});

	test("single day with month", () => {
		expect(parseDateRange("22 de Agosto")).toEqual({
			startDay: 22,
			endDay: 22,
			month: 8,
		});
	});

	test("monthless range → null (stays dateText)", () => {
		expect(parseDateRange("dias 5 e 6")).toBeNull();
	});
});

describe("inferEpochs (year inference is anti-phantom)", () => {
	test("current year fits: 4–7 Sep 2026 from Sep 5 'now'", () => {
		const got = inferEpochs({ startDay: 4, endDay: 7, month: 9 }, NOW);
		expect(got?.startAt).toBe(toEpochInLisbon(2026, 9, 4));
		expect(got?.endAt).toBe(toEpochInLisbon(2026, 9, 7, 23, 59));
	});

	test("already-past festa this year → null (NOT next year)", () => {
		// 22 Aug 2026 ended ~2 weeks before NOW
		expect(inferEpochs({ startDay: 22, endDay: 22, month: 8 }, NOW)).toBeNull();
	});

	test("future beyond the announce horizon → null (not phantom 2027)", () => {
		// 22 de Agosto when "now" is mid-October 2026: 2027 candidate is 300+
		// days out — beyond ANNOUNCE_HORIZON_S, so it must not roll.
		const october = Math.floor(Date.UTC(2026, 9, 15, 12, 0, 0) / 1000);
		expect(
			inferEpochs({ startDay: 22, endDay: 22, month: 8 }, october),
		).toBeNull();
	});

	test("next year only when inside the horizon (Dec 'now' → next year festa)", () => {
		// now = mid-December 2026; a "4 a 7 de Setembro" post would be 2027's
		// festa announced early? No — ~9 months out, beyond the horizon → null.
		const december = Math.floor(Date.UTC(2026, 11, 15, 12, 0, 0) / 1000);
		expect(
			inferEpochs({ startDay: 4, endDay: 7, month: 9 }, december),
		).toBeNull();
	});
});

describe("toRawEvent", () => {
	test("Tremoceira 2026 becomes a dated, in-district RawEvent", () => {
		const card = parseDetailCard(detailHtml);
		const raw = toRawEvent(
			"https://cister.fm/salaodefestas/festas-da-tremoceira-4-a-7-de-setembro/",
			card,
			NOW,
		);
		expect(raw?.title).toBe("Festas da Tremoceira, 4 a 7 de Setembro");
		expect(raw?.startAt).toBe(toEpochInLisbon(2026, 9, 4));
		expect(raw?.endAt).toBe(toEpochInLisbon(2026, 9, 7, 23, 59));
		expect(raw?.venueName).toBe("Tremoceira");
		expect(raw?.city).toBe("Tremoceira");
		expect(raw?.slug).toBe("cf-festas-da-tremoceira-4-a-7-de-setembro");
		expect(raw?.dateText).toBeNull();
	});

	test("past festa returns null (drop, not placeholder)", () => {
		const got = toRawEvent(
			"https://cister.fm/salaodefestas/algo-22-de-agosto/",
			{
				title: "Algo, 22 de Agosto",
				dateText: "22 de Agosto",
				venue: "Alcobaça",
			},
			NOW,
		);
		expect(got).toBeNull();
	});

	test("monthless date stays dateText-only with null epochs", () => {
		const got = toRawEvent(
			"https://cister.fm/salaodefestas/dias-5-e-6-x/",
			{ title: "X, dias 5 e 6", dateText: "dias 5 e 6", venue: "Leiria" },
			NOW,
		);
		expect(got?.startAt).toBeNull();
		expect(got?.dateText).toBe("dias 5 e 6");
	});
});

describe("slugFor", () => {
	test("cf- prefix from the detail slug", () => {
		expect(
			slugFor(
				"https://cister.fm/salaodefestas/festas-da-tremoceira-4-a-7-de-setembro/",
			),
		).toBe("cf-festas-da-tremoceira-4-a-7-de-setembro");
	});
});

describe("tolerances", () => {
	test("YEAR_TOLERANCE_S is one day", () => {
		expect(YEAR_TOLERANCE_S).toBe(86_400);
	});
});
