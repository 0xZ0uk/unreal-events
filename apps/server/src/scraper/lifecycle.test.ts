import { describe, expect, test } from "bun:test";

import { isExpired } from "./lifecycle";

const NOW = 1_800_000_000;

describe("isExpired", () => {
	test("past start, no end → expired", () => {
		expect(
			isExpired({ start_at: NOW - 100, end_at: null, date_text: null }, NOW),
		).toBe(true);
	});

	test("past end → expired even if start is past too", () => {
		expect(
			isExpired(
				{ start_at: NOW - 200, end_at: NOW - 50, date_text: null },
				NOW,
			),
		).toBe(true);
	});

	test("end in the future → still running, not expired", () => {
		expect(
			isExpired(
				{ start_at: NOW - 200, end_at: NOW + 50, date_text: null },
				NOW,
			),
		).toBe(false);
	});

	test("start exactly now → not expired (today-or-after rule)", () => {
		expect(
			isExpired({ start_at: NOW, end_at: null, date_text: null }, NOW),
		).toBe(false);
	});

	test("future start → not expired", () => {
		expect(
			isExpired({ start_at: NOW + 100, end_at: null, date_text: null }, NOW),
		).toBe(false);
	});

	test("undated rows never expire (start_at is a placeholder)", () => {
		expect(
			isExpired(
				{ start_at: NOW - 999_999, end_at: null, date_text: "em breve" },
				NOW,
			),
		).toBe(false);
		expect(
			isExpired(
				{ start_at: NOW - 999_999, end_at: NOW - 1, date_text: "agosto" },
				NOW,
			),
		).toBe(false);
	});
});
