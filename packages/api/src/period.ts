/**
 * Quick date filters for the agenda (SLICE_10).
 *
 * Pure Lisbon-local maths over `YYYY-MM-DD` day keys. It lives next to
 * `grouping.ts` so it can be unit-tested and so the chips and the deep-link
 * parser can never disagree about what "Fim de semana" covers.
 *
 * Day keys compare lexically, so a range test is a string compare — no
 * timezone edges, same trick the filter itself uses.
 */

import { lisbonDayKey } from "./grouping";

export type PeriodPresetId =
	| "hoje"
	| "amanha"
	| "fim-de-semana"
	| "7-dias"
	| "30-dias";

export type PeriodPreset = { id: PeriodPresetId; label: string };

export const PERIOD_PRESETS: readonly PeriodPreset[] = [
	{ id: "hoje", label: "Hoje" },
	{ id: "amanha", label: "Amanhã" },
	{ id: "fim-de-semana", label: "Fim de semana" },
	{ id: "7-dias", label: "7 dias" },
	{ id: "30-dias", label: "30 dias" },
];

/** Lisbon day key of an instant, defaulting to now. */
export function todayKey(nowMs: number = Date.now()): string {
	return lisbonDayKey(Math.floor(nowMs / 1000));
}

/** Shift a day key by whole days without touching any clock. */
export function shiftDayKey(key: string, days: number): string {
	const [y, m, d] = key.split("-").map(Number);
	const shifted = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
	const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
	const day = String(shifted.getUTCDate()).padStart(2, "0");
	return `${shifted.getUTCFullYear()}-${month}-${day}`;
}

/** 0 = Monday … 6 = Sunday, derived from the key itself. */
export function weekdayIndex(key: string): number {
	const [y, m, d] = key.split("-").map(Number);
	const day = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
	return (day + 6) % 7;
}

/**
 * The range a preset covers.
 *
 * "Fim de semana" is the Saturday–Sunday of the week you are in: on a Friday it
 * means tomorrow and Sunday, on a Saturday and Sunday it means today (a weekend
 * that has already started is not "next weekend"). Months and years roll over
 * through `shiftDayKey`, so 30 dias works across 31 December.
 */
export function presetRange(
	id: PeriodPresetId,
	today: string,
): { from: string; to: string } {
	switch (id) {
		case "hoje":
			return { from: today, to: today };
		case "amanha": {
			const tomorrow = shiftDayKey(today, 1);
			return { from: tomorrow, to: tomorrow };
		}
		case "fim-de-semana": {
			const saturday = shiftDayKey(today, 5 - weekdayIndex(today));
			const sunday = shiftDayKey(saturday, 1);
			return {
				from: saturday < today ? today : saturday,
				to: sunday < today ? today : sunday,
			};
		}
		case "7-dias":
			return { from: today, to: shiftDayKey(today, 6) };
		case "30-dias":
			return { from: today, to: shiftDayKey(today, 29) };
	}
}

/**
 * Which preset (if any) the current range equals — so a shared link that carries
 * `de`/`ate` still lights up the right chip, and a hand-picked range lights none.
 */
export function activePreset(
	from: string,
	to: string,
	today: string,
): PeriodPresetId | null {
	if (!from && !to) return null;
	for (const preset of PERIOD_PRESETS) {
		const range = presetRange(preset.id, today);
		if (range.from === from && range.to === to) return preset.id;
	}
	return null;
}
