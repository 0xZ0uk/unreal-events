import { describe, expect, test } from "bun:test";

import {
	CANONICAL_CATEGORIES,
	canonicalizeCategories,
	unknownCategory,
} from "./categories";
import { normalizeTitle } from "./normalize";

describe("canonicalizeCategories", () => {
	test("every canonical label is its own fixed point", () => {
		for (const c of CANONICAL_CATEGORIES) {
			expect(canonicalizeCategories([c])).toEqual([c]);
			// and distinct under normalization (map keys can't collide)
			expect(normalizeTitle(c)).not.toBe("");
		}
	});

	test("singular/plural and variant labels collapse", () => {
		expect(canonicalizeCategories(["Concerto"])).toEqual(["Concertos"]);
		expect(canonicalizeCategories(["Museus"])).toEqual(["Museus & Exposições"]);
		expect(canonicalizeCategories(["Exposição"])).toEqual([
			"Museus & Exposições",
		]);
		expect(canonicalizeCategories(["Oficina"])).toEqual(["Workshop"]);
		expect(canonicalizeCategories(["Oficina pedagógica"])).toEqual([
			"Workshop",
		]);
		expect(canonicalizeCategories(["Conferência"])).toEqual(["Conferências"]);
		expect(canonicalizeCategories(["Feira"])).toEqual(["Mercados e Feiras"]);
	});

	test("case/diacritic-insensitive matching", () => {
		expect(canonicalizeCategories(["CONCERTOS"])).toEqual(["Concertos"]);
		expect(canonicalizeCategories(["música"])).toEqual(["Música"]);
		expect(canonicalizeCategories(["stand up comedy"])).toEqual(["Comedy"]);
	});

	test("compound labels expand into two themes", () => {
		expect(canonicalizeCategories(["Teatro e Dança"])).toEqual([
			"Teatro",
			"Dança",
		]);
	});

	test("platform names are dropped", () => {
		expect(canonicalizeCategories(["Shotgun"])).toEqual([]);
		expect(canonicalizeCategories(["Eventbrite"])).toEqual([]);
		expect(canonicalizeCategories(["Ticketline"])).toEqual([]);
		expect(canonicalizeCategories(["Viral Agenda"])).toEqual([]);
	});

	test("unknown labels pass through untouched", () => {
		expect(canonicalizeCategories(["Queijo"])).toEqual(["Queijo"]);
	});

	test("output deduped and ordered by taxonomy, unknowns last", () => {
		const out = canonicalizeCategories([
			"Workshop",
			"Cultura",
			"Zzz Custom",
			"Concerto",
			"Workshop",
		]);
		expect(out).toEqual(["Cultura", "Concertos", "Workshop", "Zzz Custom"]);
	});

	test("empty / symbol-only input", () => {
		expect(canonicalizeCategories([])).toEqual([]);
		expect(canonicalizeCategories(["***"])).toEqual([]);
	});

	test("real source payload shapes", () => {
		// leiriagenda card style
		expect(canonicalizeCategories(["Biblioteca", "Literatura"])).toEqual([
			"Literatura",
		]);
		// cmleiria rss style
		expect(canonicalizeCategories(["Cultura", "Música"])).toEqual([
			"Cultura",
			"Música",
		]);
	});
});

describe("unknownCategory", () => {
	test("canonical labels return null", () => {
		expect(unknownCategory("Cultura")).toBeNull();
		expect(unknownCategory("Museus & Exposições")).toBeNull();
	});

	test("aliases and dropped labels resolve (not reported); unmapped are", () => {
		expect(unknownCategory("Concerto")).toBeNull();
		expect(unknownCategory("Shotgun")).toBeNull();
		expect(unknownCategory("Queijo")).toBe("Queijo");
	});
});
