/**
 * Leiria district scope (SLICE_6 scope correction).
 *
 * Original design filtered everything to the MUNICIPALITY of Leiria (city =
 * "Leiria"). Pedro corrected this on review: the tracker covers the whole
 * DISTRICT of Leiria — all 14 municipalities:
 *
 *   Alcobaça, Alvaiázere, Batalha, Bombarral, Caldas da Rainha,
 *   Castanheira de Pêra, Figueiró dos Vinhos, Leiria, Marinha Grande,
 *   Nazaré, Óbidos, Pedrógão Grande, Porto de Mós, Pombal
 *
 * Freguesia-level city values (e.g. Marrazes, Bajouca, Caranguejeira —
 * parishes of the municipality of Leiria; Pedrogão — parish of Leiria;
 * Maceira — parish of Leiria) all belong to the district too.
 *
 * This module is the single authority for "is this event in scope" so every
 * source filters identically and the UI copy matches the scraper reality.
 */

/** The 14 municipalities of Distrito de Leiria (normalized, lowercase). */
export const LEIRIA_DISTRICT_MUNICIPALITIES = [
	"alcobaca",
	"alvaiazere",
	"batalha",
	"bombarral",
	"caldas da rainha",
	"castanheira de pera",
	"figueiro dos vinhos",
	"leiria",
	"marinha grande",
	"nazare",
	"obidos",
	"pedrogao grande",
	"porto de mos",
	"pombal",
] as const;

/**
 * Normalize a city/locality string for district comparison: lowercase,
 * strip diacritics, unify separators, collapse whitespace.
 * "Caldas da Rainha" / "caldas-da-rainha" / "Caldas  da  rainha" all match.
 */
export function normalizePlace(raw: string): string {
	return raw
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[-_]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Freguesias (parishes) observed in source data, by municipality:
 * - of Leiria: Marrazes, Barosa, Colmeias, Caranguejeira, Bajouca,
 *   Santa Eufémia, Ortigosa, Monte Real, Maceira, Maceirinha, Pousos, Cortes…
 * - of Marinha Grande: Maceira (freguesia), Pedrogão is Leiria's.
 * Parish names are unique enough inside this domain to match directly.
 */
const KNOWN_PARISHES = [
	"marrazes",
	"barosa",
	"colmeias",
	"caranguejeira",
	"bajouca",
	"santa eufemia",
	"ortigosa",
	"monte real",
	"maceira",
	"maceirinha",
	"pousos",
	"cortes",
	"pedrogao",
	"carreira",
	"picos",
	"parceiros",
	"amieira",
	"barreira",
	"chainca",
	"coimbrao",
	"bidoeira de cima",
	"bidoeira de baixo",
	"regueira de pontes",
	"telhada",
	"vilar",
	"milagres",
	"memoria",
	"graca",
	"guia",
	"lameiro",
	"montes",
	"pelos",
	"carvide",
	"casal dos arcade",
	// freguesias seen in live data (SLICE_6 district run):
	"sao pedro de moel",
	"vieira de leiria",
	"mira d'aire",
	"mira de aire",
	"juncal",
	"sao jorge",
	"ordem",
	"benedita",
	"ribafria",
] as const;

/** Anything embedding the district name is in scope ("leiria e arredores",
 *  "leiria (cidade)", the "Leira" typo the leiriagenda source emits, venue
 *  names containing the word, etc.). The typo check keeps the leira/leiria
 *  stem (leir*) so "Leira" and "Leiriao"-style mangles still match. */
function mentionsLeiriaName(norm: string): boolean {
	return /leir/.test(norm);
}

/**
 * District scope test. Accepts:
 *  - any of the 14 district municipalities (normalized)
 *  - freguesias of the municipality of Leiria (they ARE district)
 *  - strings embedding "leiria" ("Leiria e arredores", "Leiria (cidade)")
 *  - "Leira" typos (leiriagenda source emits these)
 * Rejects: Lisboa, Porto, Coimbra, Tomar, Santarém, Faro, "?", null, "N/D"…
 */
export function isLeiriaDistrict(city: string | null | undefined): boolean {
	if (!city) {
		return false;
	}
	const norm = normalizePlace(city);
	if (norm.length === 0 || norm === "?" || norm === "n/d") {
		return false;
	}
	if (mentionsLeiriaName(norm)) {
		return true;
	}
	if ((LEIRIA_DISTRICT_MUNICIPALITIES as readonly string[]).includes(norm)) {
		return true;
	}
	return (KNOWN_PARISHES as readonly string[]).includes(norm);
}
