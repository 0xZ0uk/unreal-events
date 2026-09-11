/**
 * Text normalization + slug helpers shared by the fingerprint and ingest
 * pipelines. Kept dependency-light and pure so they are trivial to test.
 */

/** Lowercase, strip diacritics (NFD), strip punctuation, collapse whitespace. */
export function normalizeTitle(input: string): string {
	return input
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "") // combining diacritical marks
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
		.replace(/\s+/g, " ");
}

/**
 * Venue name normalization. The site prefixes several venues with a generic
 * descriptor that is not part of the venue's canonical identity — strip the
 * longest matching prefix so we resolve to the seed venue slug.
 */
const VENUE_PREFIXES = [
	"Centro Cultural ",
	"Galeria de Arte da ",
	"Centro de Atividades da ",
] as const;

export function normalizeVenueName(name: string): string {
	let out = name.replace(/\s+/g, " ").trim();
	for (const prefix of VENUE_PREFIXES) {
		if (out.startsWith(prefix)) {
			out = out.slice(prefix.length).trim();
			break;
		}
	}
	return out;
}

/** Characters removed verbatim (joined) rather than turned into a dash. */
const DROP_CHARS = /['’"|·•&]/g;

/**
 * URL-safe slug: lowercase, strip diacritics, drop quote/pipe/amp chars,
 * collapse punctuation/space runs into single hyphens.
 */
export function slugify(input: string): string {
	return input
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(DROP_CHARS, "")
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Cross-source venue identity rules. Two sources can name the same physical
 * place differently (a canonical name plus a long-form descriptor, or a
 * prefixed/district variant), so a raw string comparison misses duplicates.
 * These helpers compare venues by their discriminating words while treating
 * city/district-level placeholders ("Leiria (cidade)", "Concelho de Leiria")
 * as NOT a place — they never match a real venue (see venuesMatch).
 *
 * This is the STRICT matcher used for venue rows and resolveOrCreateVenue.
 * The vaguer cross-source wildcard used for grouping EVENTS lives in
 * identity.ts (venueCompatible); keep those two powers separate.
 */

/** Function words that carry no idiomatic meaning for a venue's identity. */
export const VENUE_STOPWORDS = new Set([
	"de",
	"da",
	"do",
	"das",
	"dos",
	"e",
	"em",
	"no",
	"na",
	"o",
	"a",
	"os",
	"as",
	"para",
	"com",
	"the",
	"of",
]);

/** Descriptor words that indicate a scope/type, not a physical place. */
export const GENERIC_VENUE_TOKENS = new Set([
	"municipal",
	"municipais",
	"cidade",
	"concelho",
	"distrito",
	"varios",
	"varias",
	"espacos",
	"espaco",
	"culturais",
	"cultural",
	"locais",
	"local",
	"online",
	"desconhecido",
]);

/**
 * District municipality names the tracker scopes to. A venue whose only
 * remaining descriptors are these is a city-level announcement ("Leiria
 * (cidade)"), not a place — vague. Used as the fallback when no city is
 * given, so placeholders stay vague even without their city row.
 */
export const DISTRICT_MUNICIPALITY_TOKENS = new Set(["leiria"]);

/**
 * City identity: lowercase, diacritics stripped, parenthetical scope dropped
 * (`Leiria (distrito)` → `leiria`, `Leiria` → `leiria`).
 */
export function normalizeCity(city: string | null | undefined): string {
	return normalizeTitle((city ?? "").replace(/\s*\([^)]*\)\s*/g, " "));
}

/** Split a normalized name into its ordered words. */
function wordsOf(normalized: string): string[] {
	return normalized.split(" ").filter((w) => w.length > 0);
}

/**
 * Discriminating tokens of a venue: normalized name minus stopwords, generic
 * descriptors, tokens shorter than 3 chars, and the city's own tokens.
 * Returns a sorted array of unique tokens.
 */
export function venueTokens(
	name: string,
	city: string | null | undefined = null,
): string[] {
	const normalized = normalizeTitle(normalizeVenueName(name));
	const cityTokens = new Set(wordsOf(normalizeCity(city)));
	const out = new Set<string>();
	for (const word of wordsOf(normalized)) {
		if (word.length < 3) continue;
		if (VENUE_STOPWORDS.has(word)) continue;
		if (GENERIC_VENUE_TOKENS.has(word)) continue;
		if (cityTokens.has(word)) continue;
		out.add(word);
	}
	return [...out].sort();
}

/** Tokens that merely name a city/district municipality (a place, not a venue name). */
function placeNameTokens(city: string | null | undefined): Set<string> {
	const tokens = new Set<string>(DISTRICT_MUNICIPALITY_TOKENS);
	const cityNorm = normalizeCity(city);
	if (cityNorm !== "") {
		for (const w of wordsOf(cityNorm)) tokens.add(w);
	}
	return tokens;
}

/**
 * True when the name is a city/district-level placeholder rather than a
 * physical venue: all of its discriminating tokens are left over as place
 * names (or there are none). `Concelho de Leiria`, `Leiria (cidade)` and
 * `Vários Espaços Culturais` are vague; `Mercado de Leiria` is not. When
 * `city` is null it still works via the district municipality fallback.
 */
export function isVagueVenue(
	name: string,
	city: string | null | undefined = null,
): boolean {
	const tokens = venueTokens(name, city);
	if (tokens.length === 0) return true;
	// Every remaining descriptor is just a city/district name → placeholder.
	const place = placeNameTokens(city);
	return tokens.every((t) => place.has(t));
}

/**
 * STRICT venue equivalence used for merging venue ROWS and for
 * resolveOrCreateVenue. Vague/placeholder venues never match anything (a
 * city-level announcement is not a physical place to fuse into). When both
 * cities are present they must be the same (cross-city venues of the same
 * name stay separate). Otherwise true when the normalized names are equal or
 * one token set is a SUBSET of the other — never mere overlap:
 * `Mercado de Leiria` ⊆ `Mercado Municipal de Leiria` ✓, but
 * `Mercado de Leiria` vs `Teatro José Lúcio da Silva` ✗.
 */
export function venuesMatch(
	a: string,
	b: string,
	aCity: string | null | undefined = null,
	bCity: string | null | undefined = null,
): boolean {
	if (isVagueVenue(a, aCity) || isVagueVenue(b, bCity)) return false;
	const cityA = normalizeCity(aCity);
	const cityB = normalizeCity(bCity);
	if (cityA !== "" && cityB !== "" && cityA !== cityB) return false;

	const nameA = normalizeTitle(normalizeVenueName(a));
	const nameB = normalizeTitle(normalizeVenueName(b));
	if (nameA === nameB) return true;

	const tokensA = venueTokens(a, aCity);
	const tokensB = venueTokens(b, bCity);
	if (tokensA.length === 0 || tokensB.length === 0) return false;
	return (
		tokensA.every((t) => tokensB.includes(t)) ||
		tokensB.every((t) => tokensA.includes(t))
	);
}
