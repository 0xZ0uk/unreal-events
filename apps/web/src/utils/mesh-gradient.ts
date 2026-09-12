/**
 * The tile a poster-less event gets instead of an empty box.
 *
 * A seeded mesh gradient: overlapping soft fields, amber anchored, seeded from
 * the event's own identity so an event keeps the same tile on every render,
 * rebuild and prerender. Random per event, never random per render — a tile
 * that reshuffles on scroll would read as a bug and would not survive the
 * prerender → hydrate handover.
 *
 * Plain CSS `radial-gradient` layers rather than an SVG: one inline style per
 * tile instead of six gradient defs and nodes per row, which matters when the
 * agenda mounts several hundred rows.
 *
 * DESIGN.md keeps amber (#ff8c00) as the single chromatic driver, so the top
 * field is always amber, anchored upper left like a light source; the other
 * fields take the seed's own hue and an analogous neighbour.
 */
export type MeshGradient = {
	backgroundColor: string;
	backgroundImage: string;
};

const AMBER = "255, 140, 0";

/** FNV-1a: small, stable, and identical across builds and clients. */
function hash(input: string): number {
	let value = 0x811c9dc5;
	for (let index = 0; index < input.length; index++) {
		value ^= input.charCodeAt(index);
		value = Math.imul(value, 0x01000193);
	}
	return value >>> 0;
}

/** mulberry32 — the whole point is that the sequence is a pure function of the seed. */
function random(seed: number): () => number {
	let state = seed || 1;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Inclusive integer band, so no field ever lands off-canvas or degenerate. */
function band(next: () => number, min: number, max: number): number {
	return Math.round(min + next() * (max - min));
}

export function meshGradient(seed: string): MeshGradient {
	const next = random(hash(seed));
	// A seed hue inside amber's own neighbourhood gives three warm fields and no
	// counterweight — the tile reads as a flat brown wash. Rotate that band to
	// the opposite side of the wheel; every tile then has a cool field to mix
	// against.
	const raw = band(next, 0, 359);
	const hue = raw >= 10 && raw <= 70 ? (raw + 180) % 360 : raw;
	// Analogous, not complementary: hues 60–120° apart mix cleanly, while
	// near-opposite hues crossing produce the grey-brown wash that makes a tile
	// read as a faded photo.
	const second = (hue + band(next, 60, 120)) % 360;

	// First layer paints on top: amber is the light source, upper left.
	const fields = [
		`radial-gradient(at ${band(next, 8, 32)}% ${band(next, 6, 30)}%, rgba(${AMBER}, 0.8) 0%, rgba(${AMBER}, 0) ${band(next, 52, 66)}%)`,
		`radial-gradient(at ${band(next, 58, 92)}% ${band(next, 10, 42)}%, hsla(${second} 88% 62% / 0.82) 0%, hsla(${second} 88% 62% / 0) ${band(next, 54, 72)}%)`,
		`radial-gradient(at ${band(next, 6, 44)}% ${band(next, 56, 92)}%, hsla(${hue} 80% 57% / 0.78) 0%, hsla(${hue} 80% 57% / 0) ${band(next, 56, 76)}%)`,
		`radial-gradient(at ${band(next, 60, 100)}% ${band(next, 58, 100)}%, hsla(${second} 76% 46% / 0.62) 0%, hsla(${second} 76% 46% / 0) ${band(next, 56, 78)}%)`,
		// Fixed footing over a base light enough to keep its hue: a dark base is
		// what turns uncovered corners into dead black-brown.
		"radial-gradient(at 85% 100%, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0) 72%)",
	];

	return {
		backgroundColor: `hsl(${hue} 48% 17%)`,
		backgroundImage: fields.join(", "),
	};
}
