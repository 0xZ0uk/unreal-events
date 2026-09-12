import { describe, expect, test } from "bun:test";

import {
	isLeiriaDistrict,
	LEIRIA_DISTRICT_MUNICIPALITIES,
	normalizePlace,
} from "./district";

describe("normalizePlace", () => {
	test("strips diacritics, case, dashes, extra spaces", () => {
		expect(normalizePlace("Caldas da Rainha")).toBe("caldas da rainha");
		expect(normalizePlace("caldas-da-rainha")).toBe("caldas da rainha");
		expect(normalizePlace("  PEDRÓGÃO   Grande ")).toBe("pedrogao grande");
		expect(normalizePlace("Figueiró dos Vinhos")).toBe("figueiro dos vinhos");
	});
});

describe("isLeiriaDistrict (the 16 municipalities)", () => {
	test("accepts every district municipality in any spelling", () => {
		expect(isLeiriaDistrict("Leiria")).toBe(true);
		expect(isLeiriaDistrict("Marinha Grande")).toBe(true);
		expect(isLeiriaDistrict("Caldas da Rainha")).toBe(true);
		expect(isLeiriaDistrict("caldas-da-rainha")).toBe(true);
		expect(isLeiriaDistrict("ALCOBAÇA")).toBe(true);
		expect(isLeiriaDistrict("Batalha")).toBe(true);
		expect(isLeiriaDistrict("Nazaré")).toBe(true);
		expect(isLeiriaDistrict("Óbidos")).toBe(true);
		expect(isLeiriaDistrict("Pombal")).toBe(true);
		expect(isLeiriaDistrict("Porto de Mós")).toBe(true);
		expect(isLeiriaDistrict("Pedrógão Grande")).toBe(true);
		expect(isLeiriaDistrict("Alvaiázere")).toBe(true);
		expect(isLeiriaDistrict("Castanheira de Pêra")).toBe(true);
		expect(isLeiriaDistrict("Figueiró dos Vinhos")).toBe(true);
	});

	// SLICE_10: the roster shipped with 14 entries — Ansião and Peniche were
	// missing, so both municipal agendas gated themselves out and the DB never
	// carried a single row for either concelho.
	test("Ansião and Peniche are district (the roster is 16, not 14)", () => {
		expect(isLeiriaDistrict("Ansião")).toBe(true);
		expect(isLeiriaDistrict("ansiao")).toBe(true);
		expect(isLeiriaDistrict("Peniche")).toBe(true);
		expect(isLeiriaDistrict("PENICHE")).toBe(true);
	});

	test("list is exactly the 16 district municipalities", () => {
		expect(LEIRIA_DISTRICT_MUNICIPALITIES.length).toBe(16);
	});
});

describe("isLeiriaDistrict (freguesias and loose forms)", () => {
	test("freguesias of the municipality of Leiria are district", () => {
		expect(isLeiriaDistrict("Marrazes")).toBe(true);
		expect(isLeiriaDistrict("Caranguejeira")).toBe(true);
		expect(isLeiriaDistrict("Bajouca")).toBe(true);
		expect(isLeiriaDistrict("Santa Eufémia")).toBe(true);
		expect(isLeiriaDistrict("Colmeias")).toBe(true);
		expect(isLeiriaDistrict("Ortigosa")).toBe(true);
		expect(isLeiriaDistrict("Monte Real")).toBe(true);
		expect(isLeiriaDistrict("Maceira")).toBe(true);
		expect(isLeiriaDistrict("Maceirinha")).toBe(true);
		expect(isLeiriaDistrict("Pedrogão")).toBe(true);
	});

	test("loose forms embedding 'leiria' are district", () => {
		expect(isLeiriaDistrict("Leiria e arredores")).toBe(true);
		expect(isLeiriaDistrict("Leiria (cidade)")).toBe(true);
		expect(isLeiriaDistrict("Leira")).toBe(true); // leiriagenda typo
		expect(isLeiriaDistrict("Teatro José Lúcio da Silva - Leiria")).toBe(true);
	});

	test("everything outside the district is rejected", () => {
		expect(isLeiriaDistrict("Lisboa")).toBe(false);
		expect(isLeiriaDistrict("Lisbon")).toBe(false);
		expect(isLeiriaDistrict("Porto")).toBe(false);
		expect(isLeiriaDistrict("Coimbra")).toBe(false);
		expect(isLeiriaDistrict("Tomar")).toBe(false);
		expect(isLeiriaDistrict("Santarém")).toBe(false);
		expect(isLeiriaDistrict("Faro")).toBe(false);
		expect(isLeiriaDistrict("Oeiras")).toBe(false);
		expect(isLeiriaDistrict("Costa de Caparica")).toBe(false);
		expect(isLeiriaDistrict("?")).toBe(false);
		expect(isLeiriaDistrict("N/D")).toBe(false);
		expect(isLeiriaDistrict("")).toBe(false);
		expect(isLeiriaDistrict(null)).toBe(false);
		expect(isLeiriaDistrict(undefined)).toBe(false);
	});
});

// SLICE_7: Oleiros (Castelo Branco) leaked through /leir/ on the first
// festasearraiais run — the stem check needs a word boundary.
describe("district gate — Oleiros exclusion (SLICE_7)", () => {
	test("Oleiros is NOT Leiria district", () => {
		expect(isLeiriaDistrict("Oleiros")).toBe(false);
		expect(isLeiriaDistrict("oleiros")).toBe(false);
	});

	test("Leiria stems still match after the boundary fix", () => {
		expect(isLeiriaDistrict("Leira")).toBe(true);
		expect(isLeiriaDistrict("Leiria (cidade)")).toBe(true);
		expect(isLeiriaDistrict("Leiria e arredores")).toBe(true);
	});
});

// pullfrog nitpick on the Óbidos source: its venue tails are attributed to
// Óbidos unless the district roster recognizes them, so a Caldas da Rainha
// parish named on an Óbidos-agenda card was credited to the wrong concelho.
describe("district gate — neighbour freguesias reach us through other agendas", () => {
	test("Caldas da Rainha parishes that appear beside Óbidos events are district", () => {
		expect(isLeiriaDistrict("Foz do Arelho")).toBe(true);
		expect(isLeiriaDistrict("Salir do Porto")).toBe(true);
		expect(isLeiriaDistrict("Tornada")).toBe(true);
		expect(isLeiriaDistrict("Carvalhal Benfeito")).toBe(true);
	});

	test("still no free pass for places outside the district", () => {
		expect(isLeiriaDistrict("Arelho")).toBe(false);
		expect(isLeiriaDistrict("Serra do Bouro")).toBe(false);
	});
});
