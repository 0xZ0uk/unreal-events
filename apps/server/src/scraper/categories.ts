import { normalizeTitle } from "./normalize";

/**
 * Canonical event taxonomy (SLICE_6).
 *
 * Sources send their own labels (and some used to inject platform names as
 * categories). Everything flows through `canonicalizeCategories` at ingest so
 * the filter dropdown stays small: singular/plural and variant labels collapse
 * into one canonical form; platform names are dropped; unknown labels pass
 * through untouched (never lose data) and are reported by `unknownCategory`.
 */

/** The canonical labels, in display order (filters + badges follow this). */
export const CANONICAL_CATEGORIES = [
	"Cultura",
	"Música",
	"Concertos",
	"Festivais",
	"Clubbing",
	"Teatro",
	"Dança",
	"Cinema",
	"Literatura",
	"Encontros",
	"Conferências",
	"Workshop",
	"Museus & Exposições",
	"Mercados e Feiras",
	"Tradição",
	"Infantil",
	"Comedy",
	"Desporto",
	"Gastronomia",
	"Natureza",
	"Outros",
] as const;

/**
 * Raw label (any case/diacritics/plural variant) → canonical label(s).
 * Keys are normalized with `normalizeTitle` at module init, so write them in
 * natural form. Array values expand a compound source label into two themes.
 */
const ALIASES_RAW: Record<string, string | string[]> = {
	// Música
	Concerto: "Concertos",
	// Teatro / Dança
	"Teatro e Dança": ["Teatro", "Dança"],
	Performance: "Teatro",
	Danças: "Dança",
	// Cinema
	"Cinema e Vídeo": "Cinema",
	Exibição: "Cinema",
	// Museus & Exposições
	Museus: "Museus & Exposições",
	Exposições: "Museus & Exposições",
	Exposição: "Museus & Exposições",
	// Literatura
	Biblioteca: "Literatura",
	"Lançamento de livro": "Literatura",
	// Encontros
	Conversa: "Encontros",
	// Conferências
	Conferência: "Conferências",
	Palestra: "Conferências",
	Fórum: "Conferências",
	"Apresentações, conferências e encontros": ["Conferências", "Encontros"],
	// Workshop
	Oficina: "Workshop",
	"Oficina pedagógica": "Workshop",
	Formação: "Workshop",
	// Mercados e Feiras
	Feira: "Mercados e Feiras",
	// Cultura (generic source buckets)
	Eventos: "Cultura",
	"Jornadas Europeias do Património": "Cultura",
	// Infantil
	"Animação Infantil": "Infantil",
	// Comedy
	"Stand Up Comedy": "Comedy",
	"Stand-up Comedy": "Comedy",
	// Desporto
	"Bem Estar": "Desporto",
	// Outros (honest bucket for rare one-off labels)
	"Passeios e Visitas": "Outros",
	"Visita guiada": "Outros",
	"Percurso / Roteiro": "Outros",
	Lazer: "Outros",
	"Outros eventos": "Outros",
	Evento: "Outros",
	Outras: "Outros",
	Jogos: "Outros",
	Fotografia: "Outros",
};

/** Platform/scraper names that must never surface as event categories. */
const DROPPED_RAW = ["Shotgun", "Eventbrite", "Ticketline", "Viral Agenda"];

const canonicalByNorm = new Map<string, string>(
	CANONICAL_CATEGORIES.map((c) => [normalizeTitle(c), c]),
);

const aliases = new Map<string, string | string[]>(
	Object.entries(ALIASES_RAW).map(([k, v]) => [normalizeTitle(k), v]),
);

const dropped = new Set(DROPPED_RAW.map((d) => normalizeTitle(d)));

/** Rank used for stable output order: canonical order first, unknowns after. */
function rank(label: string): number {
	const idx = CANONICAL_CATEGORIES.indexOf(
		label as (typeof CANONICAL_CATEGORIES)[number],
	);
	return idx >= 0 ? idx : CANONICAL_CATEGORIES.length;
}

/**
 * Map raw source categories onto the canonical taxonomy.
 * Pure: no DB, no I/O. Deterministic order (taxonomy order, then alphabetical
 * within unknowns) so change detection in ingest never flip-flops.
 */
export function canonicalizeCategories(raw: string[]): string[] {
	const out = new Set<string>();
	for (const label of raw) {
		const norm = normalizeTitle(label);
		if (!norm) continue;
		if (dropped.has(norm)) continue;
		const mapped = aliases.get(norm) ?? canonicalByNorm.get(norm);
		if (mapped != null) {
			for (const c of Array.isArray(mapped) ? mapped : [mapped]) {
				out.add(c);
			}
		} else {
			// Unknown label: pass through untouched.
			out.add(label);
		}
	}
	return [...out].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "pt"));
}

/**
 * Report helper for backfill/ingest logs: returns the label only when it is
 * UNMAPPED — i.e. it passes through untouched because no alias or canonical
 * form covers it. Canonical, alias-resolved, and dropped labels return null
 * (they resolve deterministically; nothing to surface).
 */
export function unknownCategory(label: string): string | null {
	const norm = normalizeTitle(label);
	if (!norm || dropped.has(norm)) return null;
	if (aliases.has(norm) || canonicalByNorm.has(norm)) return null;
	return label;
}
