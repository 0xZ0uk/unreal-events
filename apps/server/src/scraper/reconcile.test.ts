import { describe, expect, test } from "bun:test";

import {
	identityKey,
	planMerge,
	sourceTrust,
	TIME_SOURCE_PRIORITY,
} from "./identity";

describe("sourceTrust", () => {
	test("municipal agenda outranks platforms; viralagenda is last", () => {
		expect(sourceTrust("leiriagenda")).toBeLessThan(sourceTrust("eventbrite"));
		expect(sourceTrust("eventbrite")).toBeLessThan(sourceTrust("ticketline"));
		expect(sourceTrust("ticketline")).toBeLessThan(sourceTrust("viralagenda"));
	});

	test("unknown sources rank below every known source", () => {
		expect(sourceTrust("some-new-source")).toBe(TIME_SOURCE_PRIORITY.length);
		expect(sourceTrust("some-new-source")).toBeGreaterThan(
			sourceTrust("viralagenda"),
		);
	});
});

describe("identityKey", () => {
	test("diacritics/case/punctuation collapse to one key", () => {
		const a = identityKey("Ágora — Música no Castelo", "Castelo de Leiria", 0);
		const b = identityKey("agora musica no castelo", "castelo-de-leiria", 0);
		expect(a).toBe(b);
	});

	test("different Lisbon days are different identities", () => {
		// 2026-09-11 23:30 WEST vs 2026-09-12 00:00 WEST.
		const a = identityKey("X", "venue", 1789165800);
		const b = identityKey("X", "venue", 1789167600);
		expect(a).not.toBe(b);
	});
});

describe("planMerge (same-day sessions vs cross-source dupes)", () => {
	test("DST-shifted viralagenda twin is absorbed into the municipal row", () => {
		const la = {
			id: 19,
			title: "X",
			start_at: 1789158600,
			sources: ["leiriagenda"],
		};
		const va = {
			id: 226,
			title: "X",
			start_at: 1789155000,
			sources: ["viralagenda"],
		};
		const plan = planMerge([la, va]);
		expect(plan.keepers.map((k) => k.id)).toEqual([19]);
		expect(plan.absorbed.get(226)).toBe(19);
	});

	test("two municipal sessions at different times are BOTH kept", () => {
		// A Bebé curiosa: 10:00 + 11:30, both leiriagenda — legitimate sessions.
		const s1 = {
			id: 9,
			title: "X",
			start_at: 1789010400,
			sources: ["leiriagenda"],
		};
		const s2 = {
			id: 13,
			title: "X",
			start_at: 1789015800,
			sources: ["leiriagenda"],
		};
		const va = {
			id: 225,
			title: "X",
			start_at: 1789006800,
			sources: ["viralagenda"],
		};
		const plan = planMerge([s1, s2, va]);
		expect(plan.keepers.map((k) => k.id).sort((a, b) => a - b)).toEqual([
			9, 13,
		]);
		// The VA row is absorbed into its NEAREST session in time (10:00).
		expect(plan.absorbed.get(225)).toBe(9);
	});

	test("each absorbed row goes to its nearest keeper session", () => {
		const s1 = { id: 1, title: "X", start_at: 1000, sources: ["leiriagenda"] };
		const s2 = { id: 2, title: "X", start_at: 9000, sources: ["leiriagenda"] };
		const early = {
			id: 3,
			title: "X",
			start_at: 1200,
			sources: ["viralagenda"],
		};
		const late = {
			id: 4,
			title: "X",
			start_at: 8800,
			sources: ["viralagenda"],
		};
		const plan = planMerge([s1, s2, early, late]);
		expect(plan.absorbed.get(3)).toBe(1);
		expect(plan.absorbed.get(4)).toBe(2);
	});

	test("unattributed rows are always absorbed (orphans)", () => {
		const orphan = { id: 3, title: "X", start_at: 100, sources: [] };
		const known = { id: 4, title: "X", start_at: 9999, sources: ["shotgun"] };
		const plan = planMerge([orphan, known]);
		expect(plan.keepers.map((k) => k.id)).toEqual([4]);
		expect(plan.absorbed.get(3)).toBe(4);
	});
});
