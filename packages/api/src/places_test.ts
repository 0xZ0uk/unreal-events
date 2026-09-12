import { describe, expect, test } from "bun:test";

import {
	DISTRICT_MUNICIPALITIES,
	municipalityOf,
	normalizePlace,
} from "./places";

describe("normalizePlace", () => {
	test("strips diacritics, case, dashes, extra spaces", () => {
		expect(normalizePlace("Caldas da Rainha")).toBe("caldas da rainha");
		expect(normalizePlace("caldas-da-rainha")).toBe("caldas da rainha");
		expect(normalizePlace("  PEDRÓGÃO   Grande ")).toBe("pedrogao grande");
		expect(normalizePlace("Mira d'Aire")).toBe("mira d'aire");
	});
});

describe("the district roster", () => {
	test("is the 16 municipalities of Distrito de Leiria", () => {
		expect(DISTRICT_MUNICIPALITIES.length).toBe(16);
		expect(new Set(DISTRICT_MUNICIPALITIES).size).toBe(16);
	});

	test("includes Ansião and Peniche", () => {
		// Both were missing and both have a configured municipal source, so
		// every event they parsed was gated out on `city`.
		expect(DISTRICT_MUNICIPALITIES).toContain("Ansião");
		expect(DISTRICT_MUNICIPALITIES).toContain("Peniche");
	});
});

describe("municipalityOf", () => {
	test("a município resolves to itself, in any spelling", () => {
		expect(municipalityOf("Óbidos")).toBe("Óbidos");
		expect(municipalityOf("obidos")).toBe("Óbidos");
		expect(municipalityOf("CALDAS DA RAINHA")).toBe("Caldas da Rainha");
		expect(municipalityOf("porto-de-mos")).toBe("Porto de Mós");
	});

	test("a freguesia resolves to its município", () => {
		expect(municipalityOf("Marrazes")).toBe("Leiria");
		expect(municipalityOf("Barreira")).toBe("Leiria");
		expect(municipalityOf("Carvide")).toBe("Leiria");
		expect(municipalityOf("Gaeiras")).toBe("Óbidos");
		expect(municipalityOf("Ordem")).toBe("Marinha Grande");
		expect(municipalityOf("São Pedro de Moel")).toBe("Marinha Grande");
		expect(municipalityOf("Calvaria de Cima")).toBe("Porto de Mós");
		expect(municipalityOf("Mira de Aire")).toBe("Porto de Mós");
		expect(municipalityOf("Alfeizerão")).toBe("Alcobaça");
		expect(municipalityOf("Benedita")).toBe("Alcobaça");
	});

	test("both spellings of the same place fold together", () => {
		expect(municipalityOf("Mira d'Aire")).toBe(municipalityOf("Mira de Aire"));
		expect(municipalityOf("Castanheira de Pêra")).toBe(
			municipalityOf("Castanheira de Pera"),
		);
	});

	test("returns null instead of guessing", () => {
		expect(municipalityOf("Lisboa")).toBeNull();
		expect(municipalityOf("Tomar")).toBeNull();
		expect(municipalityOf("")).toBeNull();
		expect(municipalityOf(null)).toBeNull();
		expect(municipalityOf(undefined)).toBeNull();
	});
});

/**
 * The concelho facet used to list 36 options for a 16-concelho district: every
 * freguesia a source reported as `city` became its own concelho, which split
 * Leiria's events across 10 values and offered "Óbidos" next to "Gaeiras".
 *
 * These are the exact city values the live database held (with how many events
 * each carried) when the fold shipped. Every one of them must land on a
 * município — a null here means the dropdown grows a new fake concelho.
 */
const LIVE_CITY_VALUES: readonly string[] = [
	"Leiria",
	"Óbidos",
	"Marinha Grande",
	"Alcobaça",
	"Caldas da Rainha",
	"Pombal",
	"Nazaré",
	"Bombarral",
	"Porto de Mós",
	"Peniche",
	"Alvaiázere",
	"Marrazes",
	"Figueiró dos Vinhos",
	"Colmeias",
	"Castanheira de Pera",
	"Caranguejeira",
	"Batalha",
	"Pedrógão Grande",
	"Milagres",
	"Carreira",
	"São Pedro de Moel",
	"Serro Ventoso",
	"Santa Eufémia",
	"Ordem",
	"Mira de Aire",
	"Mira d'Aire",
	"Gaeiras",
	"Cortes",
	"Castanheira de Pêra",
	"Carvide",
	"Calvaria de Cima",
	"Benedita",
	"Barreira",
	"Arrimal",
	"Alvados",
	"Alfeizerão",
];

describe("the concelho facet", () => {
	test("every city value in the live database folds onto a município", () => {
		const unfolded = LIVE_CITY_VALUES.filter(
			(city) => municipalityOf(city) === null,
		);
		expect(unfolded).toEqual([]);
	});

	test("the fold only ever yields real district municipalities", () => {
		const folded = new Set(
			LIVE_CITY_VALUES.map((city) => municipalityOf(city)),
		);
		for (const municipality of folded) {
			if (municipality === null) continue;
			expect(DISTRICT_MUNICIPALITIES).toContain(municipality);
		}
	});

	test("freguesias stop being concelhos: Leiria survives as one option", () => {
		const leiria = LIVE_CITY_VALUES.filter(
			(city) => municipalityOf(city) === "Leiria",
		);
		// The 10 freguesias that used to be separate concelhos.
		expect(leiria).toContain("Marrazes");
		expect(leiria).toContain("Barreira");
		expect(leiria).toContain("Colmeias");
		expect(leiria).toContain("Caranguejeira");
		expect(leiria).toContain("Carvide");
		expect(leiria.length).toBeGreaterThan(1);
	});
});
