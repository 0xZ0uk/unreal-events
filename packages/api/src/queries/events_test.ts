import { describe, expect, test } from "bun:test";

import { listInput, WINDOW_MAX } from "./events";

/**
 * The window cap is a safety valve, not a page size.
 *
 * When it drops below what a 90-day window actually holds, the furthest-future
 * events disappear with no error and no failed request — the page simply shows
 * fewer days than the data has. It sat at 500 while the live window held 501.
 */
describe("listInput", () => {
	test("defaults to the whole window rather than a page", () => {
		expect(listInput.parse({}).limit).toBe(WINDOW_MAX);
	});

	test("accepts the limit the agenda page asks for", () => {
		expect(listInput.parse({ limit: WINDOW_MAX }).limit).toBe(WINDOW_MAX);
	});

	/**
	 * Guards the headroom: the window grows ~120 events/week, so a cap that
	 * leaves room for only today's 501 rows would slip back into silent
	 * truncation within months.
	 */
	test("leaves headroom above a full 90-day window", () => {
		expect(WINDOW_MAX).toBeGreaterThanOrEqual(1000);
	});

	test("is still a cap — an unbounded fetch is not the fix", () => {
		expect(listInput.safeParse({ limit: WINDOW_MAX + 1 }).success).toBe(false);
		expect(listInput.safeParse({ limit: 0 }).success).toBe(false);
	});
});
