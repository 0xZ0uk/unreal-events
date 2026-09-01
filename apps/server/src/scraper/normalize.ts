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
