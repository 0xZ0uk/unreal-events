import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import * as cheerio from "cheerio";

import { fingerprint, lisbonDay, toEpochInLisbon } from "./fingerprint";
import { parseDateNode } from "./leiriagenda";

describe("Europe/Lisbon timezone math", () => {
	test("14:00 on 2026-09-04 in Lisbon is UTC+1", () => {
		expect(toEpochInLisbon(2026, 9, 4, 14, 0)).toBe(1788526800);
	});
	test("21:30 on 2026-09-04 in Lisbon", () => {
		expect(toEpochInLisbon(2026, 9, 4, 21, 30)).toBe(1788553800);
	});
	test("no-time event is pinned to 00:00 local", () => {
		expect(toEpochInLisbon(2026, 9, 4)).toBe(1788476400);
	});
	test("lisbonDay returns local calendar date", () => {
		expect(lisbonDay(toEpochInLisbon(2026, 9, 4, 14, 0))).toBe("2026-09-04");
		expect(lisbonDay(toEpochInLisbon(2026, 9, 6, 23, 0))).toBe("2026-09-06");
	});
});

describe("fingerprint", () => {
	test("is stable and deterministic", () => {
		const a = fingerprint(
			"Tattoo Artes",
			"mercado-de-santana",
			toEpochInLisbon(2026, 9, 4, 14, 0),
		);
		const b = fingerprint(
			"Tattoo Artes",
			"Centro Cultural Mercado de Sant'Ana",
			toEpochInLisbon(2026, 9, 4, 14, 0),
		);
		expect(a).toBe(b);
		expect(a).toMatch(/^[0-9a-f]{40}$/);
	});
	test("a later start date yields a different fingerprint", () => {
		const a = fingerprint("X", "v", toEpochInLisbon(2026, 9, 4));
		const b = fingerprint("X", "v", toEpochInLisbon(2026, 9, 5));
		expect(a).not.toBe(b);
	});

	test("same-day twin sessions (18h30 vs 21h30) get distinct fingerprints", () => {
		const $ = cheerio.load(
			readFileSync(
				new URL("./__fixtures__/proximos.html", import.meta.url),
				"utf-8",
			),
		);
		const title = "A Memória do Cheiro das Coisas";
		const venueRef = "Teatro Miguel Franco";

		const startOf = (slug: string): number => {
			const a = $(`a[href$="/${slug}"]`).first();
			expect(a.length).toBe(1);
			const parts = parseDateNode($, a, "inicio");
			if (!parts) {
				throw new Error(`card ${slug} missing a parseable start date`);
			}
			return toEpochInLisbon(
				parts.year,
				parts.month,
				parts.day,
				parts.hour,
				parts.minute,
			);
		};

		// Two real-world cards from the fixture: same show, same day, same
		// venue — but an 18:30 session and a 21:30 session.
		const early = startOf("a-memoria-do-cheiro-das-coisas");
		const late = startOf("a-memoria-do-cheiro-das-coisas-2");

		// Same Lisbon calendar day, different time-of-day.
		expect(early).not.toBe(late);
		expect(lisbonDay(early)).toBe(lisbonDay(late));

		const fpEarly = fingerprint(title, venueRef, early);
		const fpLate = fingerprint(title, venueRef, late);
		expect(fpEarly).not.toBe(fpLate);
	});
});
