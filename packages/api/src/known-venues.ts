/**
 * Curated "known venues" — real places we know by fact sit in the district,
 * even though the upstream source never localizes them. The same idea as the
 * places roster: hand-vetted data lives here in @events-tracker/api, the gate
 * logic lives in the scraper. Yes — this is a list the owner vets by hand;
 * entries are added one at a time with a `note`, never a guess.
 *
 * Why it exists (SLICE_17): NoCartaz never localizes some aggregator-fed rows.
 * O Pica Miolos, a bar in the city of Leiria, is filed by NoCartaz under its
 * COIMBRA district hub — the row carries no locality anywhere (the detail's
 * JSON-LD has `location.name = "Portugal"`, no `addressLocality`, and an
 * `addressRegion` that is the aggregator's guess). The place gate has nothing
 * to gate on, so the event was invisible to the tracker.
 *
 * The venue name lives in exactly one place: the card title's ` @ ` suffix
 * ("<artist> @ <venue>"). `knownVenueFor` matches that evidence against this
 * allowlist so a row with no locality still gates in.
 */

import { DISTRICT_MUNICIPALITIES, normalizePlace } from "./places";

export interface KnownVenue {
	/** Canonical venue name as we want it stored. */
	name: string;
	/** Other spellings the sources use (English names, without articles, typos). */
	aliases: readonly string[];
	/** The concelho the venue sits in (one of the 16 district municipalities). */
	city: string;
	/** Why we know it — a reviewer must be able to re-check. */
	note: string;
}

export const KNOWN_LEIRIA_VENUES: readonly KnownVenue[] = [
	{
		name: "O Pica Miolos",
		aliases: ["Pica Miolos"],
		city: "Leiria",
		note:
			"A bar in the city of Leiria. NoCartaz files its events under the Coimbra " +
			"district hub (bandsintown feed) with no locality on the row — detail " +
			'location.name is "Portugal", no addressLocality, addressRegion Coimbra — ' +
			"so they never reach the Leiria hub. Live: /eventos/1a7f6837bb86d0cd/ " +
			"(Baleia Baleia Baleia @ O Pica Miolos) and /eventos/28592c47db0ef640/ " +
			"(Chimera Black @ O Pica Miolos), both present only in the Coimbra hub's " +
			"JSON-LD ItemList.",
	},
];

/** Normalize into lowercase accent-stripped, punctuation-collapsed tokens. */
function normTokens(s: string): string[] {
	return normalizePlace(s)
		.split(" ")
		.filter((t) => t.length > 0);
}

/**
 * True when `needle` appears as a CONTIGUOUS token subsequence of `haystack` —
 * so `["o","pica","miolos"]` matches inside `["baleia","baleia","baleia","o",
 * "pica","miolos"]` (a title like "Baleia Baleia Baleia @ O Pica Miolos") and as
 * a bare "O Pica Miolos". Token-granularity means an entry never matches a mere
 * partial word.
 */
function isContiguousSubsequence(
	needle: string[],
	haystack: string[],
): boolean {
	if (needle.length === 0 || needle.length > haystack.length) {
		return false;
	}
	outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
		for (let j = 0; j < needle.length; j++) {
			if (haystack[i + j] !== needle[j]) {
				continue outer;
			}
		}
		return true;
	}
	return false;
}

/**
 * The curated venue whose name (or alias) the evidence names, or null.
 *
 * Normalize the evidence (lowercase, strip accents and punctuation), then match
 * an entry when its normalized name appears as a contiguous token subsequence
 * of the evidence. Entries are deliberately NOT single generic tokens (no
 * "Maiorca", no "Pombal") — those collide with places outside the district.
 */
export function knownVenueFor(
	evidence: string | null | undefined,
): KnownVenue | null {
	if (!evidence) {
		return null;
	}
	const tokens = normTokens(evidence);
	for (const venue of KNOWN_LEIRIA_VENUES) {
		if (isContiguousSubsequence(normTokens(venue.name), tokens)) {
			return venue;
		}
		for (const alias of venue.aliases) {
			if (isContiguousSubsequence(normTokens(alias), tokens)) {
				return venue;
			}
		}
	}
	return null;
}

const MUNICIPALITY_BY_NORM = new Map(
	DISTRICT_MUNICIPALITIES.map((m) => [normalizePlace(m), m]),
);

/**
 * Districts whose municipality name is MULTI-WORD must match as the full
 * phrase — "marinha" alone is a common word, "porto de mos" vs "porto". A
 * single resolved municipality name is only trusted when the whole phrase
 * appears contiguously.
 */
const FULL_PHRASE_MUNICIPALITIES = [
	"caldas da rainha",
	"marinha grande",
	"porto de mos",
	"castanheira de pera",
	"pedrogao grande",
	"figueiro dos vinhos",
];

/**
 * Single-token municipality names that are unambiguous enough in a title.
 * "pombal" and "batalha" are deliberately EXCLUDED — too generic in free text
 * ("Marquês de Pombal" would false-positive a Pombal event).
 */
const SINGLE_TOKEN_MUNICIPALITIES = [
	"alcobaca",
	"alvaiazere",
	"ansiao",
	"bombarral",
	"leiria",
	"nazare",
	"obidos",
	"peniche",
];

/**
 * The district municipality a TITLE names, or null when it names none (or
 * nothing trustworthy).
 *
 * This is the SLICE_17 owner addition for aggregator feed rows — 3cket,
 * ecultura, ticketline, bol, blueticket, dgartes — whose locality resolution is
 * EMPTY: no detail `addressLocality` AND no card `data-concelho`, and whose
 * detail page shows "Portugal ()" with a blank Sala/Concelho. The only place
 * such a row says where it is is its own title. Live rows this exists for:
 *
 *   https://www.nocartaz.pt/eventos/bf59ce3abcea354c/  "ORFEU E EURÍDICE - FESTIVAL
 *       DE ÓPERA DE ÓBIDOS 2026"   (blueticket-leiria, data-concelho="")
 *   https://www.nocartaz.pt/eventos/b9d51a952adb2655/  "Caldas da Rainha Ladies
 *       Open - Caminhada Solidária" (3cket-leiria, data-concelho="")
 *
 * TITLE only — the description and any free-text body are never consulted. This
 * must never override a real city: it only answers when the row has NO locality
 * at all. The value returned is the canonical display name from the places
 * roster ("Caldas da Rainha", "Óbidos").
 */
export function titlePlaceCity(
	title: string | null | undefined,
): string | null {
	if (!title) {
		return null;
	}
	const tokens = normTokens(title);
	for (const norm of FULL_PHRASE_MUNICIPALITIES) {
		if (isContiguousSubsequence(normTokens(norm), tokens)) {
			return MUNICIPALITY_BY_NORM.get(norm) ?? null;
		}
	}
	const titleSet = new Set(tokens);
	for (const norm of SINGLE_TOKEN_MUNICIPALITIES) {
		if (titleSet.has(norm)) {
			return MUNICIPALITY_BY_NORM.get(norm) ?? null;
		}
	}
	return null;
}
