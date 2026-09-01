import { describe, expect, test } from "bun:test";

import { normalizeTitle, normalizeVenueName, slugify } from "./normalize";

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
