/**
 * Leiria district place taxonomy (SLICE_10).
 *
 * The single authority for two things:
 *
 *  1. Which municipalities this tracker covers (the district has 16, not the
 *     14 the roster shipped with — Ansião and Peniche were missing, which
 *     silently gated every Ansião event out of ingest even though a municipal
 *     source for it exists).
 *  2. Folding a freguesia / lugar back onto its municipality, so the concelho
 *     facet counts "Marrazes" as Leiria instead of offering it as a 38th
 *     concelho next to the 16 real ones.
 *
 * It lives in the shared api package because both sides need it and they must
 * not disagree: apps/server gates every source through it, apps/web facet-folds
 * through it.
 *
 * Only freguesias whose municipality is verifiable are listed. A place that is
 * not listed keeps its own name in the UI — never a guess.
 */

/** The 16 municípios of Distrito de Leiria, display form, alphabetical. */
export const DISTRICT_MUNICIPALITIES = [
	"Alcobaça",
	"Alvaiázere",
	"Ansião",
	"Batalha",
	"Bombarral",
	"Caldas da Rainha",
	"Castanheira de Pêra",
	"Figueiró dos Vinhos",
	"Leiria",
	"Marinha Grande",
	"Nazaré",
	"Óbidos",
	"Pedrógão Grande",
	"Peniche",
	"Pombal",
	"Porto de Mós",
] as const;

export type DistrictMunicipality = (typeof DISTRICT_MUNICIPALITIES)[number];

/**
 * Normalize a city/locality string for comparison: lowercase, strip
 * diacritics, unify separators, collapse whitespace.
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
 * Freguesias and lugares of the district, grouped by the município they belong
 * to. Sources report the worked place ("Ordem", "São Pedro de Moel", "Gaeiras")
 * where a municipal agenda reports the concelho — the same event, two city
 * strings, one concelho. This is the table that maps the first onto the second.
 */
const PARISHES_BY_MUNICIPALITY: Record<DistrictMunicipality, string[]> = {
	// Verified against the município's own freguesia roster.
	Alcobaça: [
		"Alfeizerão",
		"Aljubarrota",
		"Bárrio",
		"Benedita",
		"Cela",
		"Évora de Alcobaça",
		"Maiorga",
		"Pataias",
		"São Martinho do Porto",
		"Turquel",
		"Vestiaria",
	],
	Alvaiázere: [],
	// Roster from the municipal fixture (Alvorge … Santiago da Guarda).
	Ansião: [
		"Alvorge",
		"Avelar",
		"Chão de Couce",
		"Pousaflores",
		"Santiago da Guarda",
	],
	Batalha: [],
	Bombarral: [],
	"Caldas da Rainha": [
		"Carvalhal Benfeito",
		"Foz do Arelho",
		"Ribafria",
		"Salir do Porto",
		"Tornada",
	],
	"Castanheira de Pêra": [],
	"Figueiró dos Vinhos": [],
	Leiria: [
		"Bajouca",
		"Barosa",
		"Barreira",
		"Bidoeira de Baixo",
		"Bidoeira de Cima",
		"Caranguejeira",
		"Carreira",
		"Carvide",
		"Chainça",
		"Coimbrão",
		"Colmeias",
		"Cortes",
		"Graça",
		"Guia",
		"Maceira",
		"Maceirinha",
		"Marrazes",
		"Memória",
		"Milagres",
		"Monte Real",
		"Ortigosa",
		"Parceiros",
		"Pedrógão",
		"Picos",
		"Pousos",
		"Regueira de Pontes",
		"Santa Eufémia",
	],
	"Marinha Grande": ["Ordem", "São Pedro de Moel", "Vieira de Leiria"],
	Nazaré: [],
	// "Amoreira" is deliberately absent: it is an Óbidos freguesia but the name
	// repeats across municípios, and this table never guesses.
	Óbidos: [
		"A-dos-Negros",
		"Gaeiras",
		"Olho Marinho",
		"Sobral da Lagoa",
		"Usseira",
		"Vau",
	],
	"Pedrógão Grande": [],
	// Atouguia da Baleia is verified in the municipal fixture; Ferrel and
	// Serra d'El-Rei are the two remaining rural freguesias of Peniche.
	Peniche: ["Atouguia da Baleia", "Ferrel", "Serra d'El-Rei"],
	Pombal: [],
	"Porto de Mós": [
		"Alcaria",
		"Alqueidão da Serra",
		"Alvados",
		"Arrimal",
		"Calvaria de Cima",
		"Mendiga",
		"Mira d'Aire",
		"Mira de Aire",
		"São Bento",
		"Serro Ventoso",
	],
};

const municipalityByNorm = new Map(
	DISTRICT_MUNICIPALITIES.map((name) => [normalizePlace(name), name]),
);

const parishMunicipalityByNorm = new Map<string, DistrictMunicipality>();
for (const [municipality, parishes] of Object.entries(
	PARISHES_BY_MUNICIPALITY,
) as [DistrictMunicipality, string[]][]) {
	for (const parish of parishes) {
		parishMunicipalityByNorm.set(normalizePlace(parish), municipality);
	}
}

/** Every normalized freguesia/lugar name in the table (gate-friendly). */
export const DISTRICT_PARISHES: readonly string[] = [
	...parishMunicipalityByNorm.keys(),
].sort();

/** True when the string names one of the 16 district municipalities. */
export function isDistrictMunicipality(
	city: string | null | undefined,
): boolean {
	if (!city) return false;
	return municipalityByNorm.has(normalizePlace(city));
}

/**
 * The município a place belongs to, or null when we cannot place it.
 *
 * Accepts a município ("Óbidos" → Óbidos) or one of its freguesias/lugares
 * ("Gaeiras" → Óbidos). Returns null rather than guessing, so an unknown place
 * stays visible under its own name.
 */
export function municipalityOf(
	city: string | null | undefined,
): DistrictMunicipality | null {
	if (!city) return null;
	const norm = normalizePlace(city);
	if (!norm) return null;
	return (
		municipalityByNorm.get(norm) ?? parishMunicipalityByNorm.get(norm) ?? null
	);
}
