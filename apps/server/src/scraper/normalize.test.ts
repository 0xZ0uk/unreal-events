import { describe, expect, test } from "bun:test";

import {
	isVagueVenue,
	normalizeCity,
	normalizeTitle,
	normalizeVenueName,
	slugify,
	venuesMatch,
	venueTokens,
} from "./normalize";

describe("normalizeTitle", () => {
	test("lowercases", () => {
		expect(normalizeTitle("Tattoo Artes")).toBe("tattoo artes");
	});
	test("strips diacritics", () => {
		expect(normalizeTitle("José Cláudio em Leiria")).toBe(
			"jose claudio em leiria",
		);
	});
	test("strips punctuation and collapses spaces", () => {
		expect(normalizeTitle("  A   Memória! — do Cheiro  ")).toBe(
			"a memoria do cheiro",
		);
	});
});

describe("normalizeVenueName + slugify", () => {
	test("Mercado de Sant'Ana resolves to the seed venue slug", () => {
		const name = normalizeVenueName("Centro Cultural Mercado de Sant'Ana");
		expect(name).toBe("Mercado de Sant'Ana");
		expect(slugify(name)).toBe("mercado-de-santana");
	});
	test("gallery prefix strips to the library seed slug", () => {
		expect(
			slugify(
				normalizeVenueName(
					"Galeria de Arte da Biblioteca Municipal Afonso Lopes Vieira",
				),
			),
		).toBe("biblioteca-municipal-afonso-lopes-vieira");
	});
	test("slugify handles plain venue", () => {
		expect(slugify("Teatro José Lúcio da Silva")).toBe(
			"teatro-jose-lucio-da-silva",
		);
	});
});

describe("normalizeCity", () => {
	test("drops parenthetical scope and diacritics", () => {
		expect(normalizeCity("Leiria (distrito)")).toBe("leiria");
		expect(normalizeCity("Leiria")).toBe("leiria");
		expect(normalizeCity("Marinha Grande")).toBe("marinha grande");
	});
	test("null/undefined collapse to empty", () => {
		expect(normalizeCity(null)).toBe("");
		expect(normalizeCity(undefined)).toBe("");
	});
});

describe("venueTokens", () => {
	test("drops stopwords, generics, short and city tokens", () => {
		expect(
			venueTokens(
				"Black Box - Plataforma de Criação Artística de Leiria",
				"Leiria",
			),
		).toEqual(["artistica", "black", "box", "criacao", "plataforma"]);
	});
	test("Mercado de Leiria keeps only its discriminating token", () => {
		expect(venueTokens("Mercado de Leiria", "Leiria")).toEqual(["mercado"]);
	});
});

describe("isVagueVenue", () => {
	test("city/district placeholders are vague", () => {
		expect(isVagueVenue("Concelho de Leiria", "Leiria")).toBe(true);
		expect(isVagueVenue("Leiria (cidade)", "Leiria")).toBe(true);
		expect(isVagueVenue("Vários Espaços Culturais", "Leiria")).toBe(true);
	});
	test("Leiria (cidade) stays vague with no city passed", () => {
		expect(isVagueVenue("Leiria (cidade)", null)).toBe(true);
	});
	test("a real venue is not vague", () => {
		expect(isVagueVenue("Mercado de Leiria", "Leiria")).toBe(false);
		expect(
			isVagueVenue("Biblioteca Municipal Afonso Lopes Vieira", "Leiria"),
		).toBe(false);
	});
});

describe("venuesMatch (strict cross-source venue identity)", () => {
	const L = "Leiria";
	test("BLACK BOX matches its long-form canonical name (both directions)", () => {
		const box = "BLACK BOX";
		const full = "Black Box - Plataforma de Criação Artística de Leiria";
		expect(venuesMatch(box, full, L, L)).toBe(true);
		expect(venuesMatch(full, box, L, L)).toBe(true);
	});
	test("Black Box Leiria matches BLACK BOX", () => {
		expect(venuesMatch("Black Box Leiria", "BLACK BOX", L, L)).toBe(true);
	});
	test("library matches its - Leiria suffix variant", () => {
		expect(
			venuesMatch(
				"Biblioteca Municipal Afonso Lopes Vieira",
				"Biblioteca Municipal Afonso Lopes Vieira - Leiria",
				L,
				L,
			),
		).toBe(true);
	});
	test("Mercado de Leiria is a subset of Mercado Municipal de Leiria", () => {
		expect(
			venuesMatch("Mercado de Leiria", "Mercado Municipal de Leiria", L, L),
		).toBe(true);
	});
	test("theatre matches its (Leiria) suffix variant", () => {
		expect(
			venuesMatch(
				"Teatro José Lúcio da Silva",
				"Teatro José Lúcio Da Silva (Leiria)",
				L,
				L,
			),
		).toBe(true);
	});
	test("intercultural centre matches its church variant", () => {
		expect(
			venuesMatch(
				"Centro de Diálogo Intercultural de Leiria - Igreja da Misericórdia",
				"Centro De Diálogo Intercultural De Leiria",
				L,
				L,
			),
		).toBe(true);
	});
	test("different venues do NOT match (subset, never overlap)", () => {
		expect(
			venuesMatch("Mercado de Leiria", "Teatro José Lúcio da Silva", L, L),
		).toBe(false);
	});
	test("same-name venues in different cities do NOT match", () => {
		expect(
			venuesMatch("Mercado de Leiria", "Mercado de Leiria", L, "Lisboa"),
		).toBe(false);
	});
	test("two different venues with the same title+day stay separate (fixture 10)", () => {
		expect(
			venuesMatch(
				"Núcleo Sporting Clube de Portugal da Marinha Grande",
				"Hotel Cristal Praia, Praia da Vieira",
				"Marinha Grande",
				"Marinha Grande",
			),
		).toBe(false);
	});
});
