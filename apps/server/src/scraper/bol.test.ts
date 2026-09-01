import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
	buildRawEvents,
	isLeiriaVenue,
	parseDetailSessions,
	parseListingLinks,
} from "./bol";
import { toEpochInLisbon } from "./fingerprint";

const listingHtml = readFileSync(
	new URL("./__fixtures__/bol.html", import.meta.url),
	"utf-8",
);
const detailHtml = readFileSync(
	new URL("./__fixtures__/bol-detail.html", import.meta.url),
	"utf-8",
);

describe("parseListingLinks (offline fixture)", () => {
	test("extracts every unique event id (fixture has 60 unique links)", () => {
		const links = parseListingLinks(listingHtml);
		expect(links.length).toBe(60);
		// ids are unique (dedup by id)
		const ids = new Set(links.map((l) => l.id));
		expect(ids.size).toBe(links.length);
	});

	test("venue slug is the LAST hyphen segment; event slug is the middle", () => {
		const links = parseListingLinks(listingHtml);
		expect(links.length).toBeGreaterThan(0);

		const viana = links.find((l) => l.id === 176997);
		expect(viana?.venueSlug).toBe("c_c_viana_do_castelo");
		expect(viana?.eventSlug).toBe(
			"antonio_zambujo_oracao_ao_tempo_viana_do_castelo",
		);
		expect(viana?.url).toContain("/Comprar/Bilhetes/176997");

		// multi-token venue slug splits cleanly off the event slug
		const loz = links.find((l) => l.id === 168837);
		expect(loz?.venueSlug).toBe("coliseu_de_lisboa");
		expect(loz?.eventSlug).toBe("iolanda");

		const aula = links.find((l) => l.id === 175339);
		expect(aula?.venueSlug).toBe("aula_magna");
	});

	test("a listing that repeats a link is still deduped by id", () => {
		const links = parseListingLinks(
			listingHtml.replace(
				"/Comprar/Bilhetes/168837-iolanda-coliseu_de_lisboa/",
				"/Comprar/Bilhetes/168837-iolanda-coliseu_de_lisboa/",
			),
		);
		const dup = links.filter((l) => l.id === 168837);
		expect(dup.length).toBe(1);
	});
});

describe("isLeiriaVenue (Leiria pre-filter)", () => {
	test("matches known Leiria venue slugs", () => {
		expect(isLeiriaVenue("...-teatro_miguel_franco/")).toBe(true);
		expect(isLeiriaVenue("...-mercado_de_santana/")).toBe(true);
		expect(isLeiriaVenue("teatro_miguel_franco")).toBe(true);
		expect(isLeiriaVenue("mercado_de_santana")).toBe(true);
		expect(isLeiriaVenue("casa_da_musica_de_leiria")).toBe(true);
	});

	test("rejects non-Leiria venue slugs", () => {
		expect(isLeiriaVenue("c_c_viana_do_castelo")).toBe(false);
		expect(isLeiriaVenue("coliseu_de_lisboa")).toBe(false);
		expect(isLeiriaVenue("ccb")).toBe(false);
		expect(isLeiriaVenue("coliseu_porto_ageas")).toBe(false);
		expect(isLeiriaVenue("aula_magna")).toBe(false);
	});
});

describe("parseDetailSessions (offline fixture)", () => {
	const sessions = parseDetailSessions(detailHtml, "https://x/176997");

	test("parses the single session date (2026-12-05) with its 21:30 time", () => {
		expect(sessions.length).toBe(1);
		expect(sessions[0]?.hasTime).toBe(true);
		// 2026-12-05 21:30 Europe/Lisbon
		expect(sessions[0]?.startAt).toBe(toEpochInLisbon(2026, 12, 5, 21, 30));
	});

	test("epoch is exact (Europe/Lisbon, December 2026)", () => {
		expect(sessions[0]?.startAt).toBe(1796506200);
	});
});

describe("buildRawEvents (offline fixture)", () => {
	test("merges a listing card + detail into one RawEvent per session", () => {
		const card = {
			id: 176997,
			url: "https://www.bol.pt/Comprar/Bilhetes/176997-antonio_zambujo_oracao_ao_tempo_viana_do_castelo-c_c_viana_do_castelo/",
			eventSlug: "antonio_zambujo_oracao_ao_tempo_viana_do_castelo",
			venueSlug: "c_c_viana_do_castelo",
		};
		const events = buildRawEvents(card, detailHtml);
		expect(events.length).toBe(1);
		expect(events[0]?.title).toBe(
			"Antonio Zambujo Oracao Ao Tempo Viana Do Castelo",
		);
		// Pre-filter: Viana do Castelo is NOT Leiria → city null.
		expect(events[0]?.city).toBeNull();
		expect(events[0]?.venueName).toBe("C C Viana Do Castelo");
		expect(events[0]?.categories).toEqual([]);
		expect(events[0]?.dateText).toBeNull();
		expect(events[0]?.description).toBeNull();
		expect(events[0]?.startAt).toBe(1796506200);
		expect(events[0]?.endAt).toBeNull();
		expect(events[0]?.url).toBe(card.url);
	});

	test("city resolves to Leiria for a Leiria venue slug", () => {
		const card = {
			id: 1,
			url: "https://x/Comprar/Bilhetes/1-fake-teatro_miguel_franco-teatro_miguel_franco/",
			eventSlug: "fake",
			venueSlug: "teatro_miguel_franco",
		};
		const events = buildRawEvents(card, detailHtml);
		expect(events[0]?.city).toBe("Leiria");
	});
});