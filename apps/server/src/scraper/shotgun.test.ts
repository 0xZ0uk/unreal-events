import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
	parseDetailLd,
	parseListingLinks,
	slugFor,
	toRawEvent,
} from "./shotgun";

const read = (name: string) =>
	readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf-8");

const cityHtml = read("shotgun-city.html");
const detailHtml = read("shotgun-detail.html");

describe("parseListingLinks (region listing fixture)", () => {
	test("collects every event slug, deduped", () => {
		const slugs = parseListingLinks(cityHtml);
		expect(slugs.length).toBe(14);
		expect(slugs).toContain("last-friday-night-praia-do-pedrogao");
		expect(slugs).toContain("darkroom-sunset-praia-nova-beach-club");
	});
});

describe("parseDetailLd (MusicEvent JSON-LD)", () => {
	test("resolves the Leiria-district event (Pedrogão)", () => {
		const ld = parseDetailLd(detailHtml);
		expect(ld).not.toBeNull();
		expect(ld?.name).toBe("Last Friday Night · Praia Do Pedrógão");
		expect(ld?.startDate).toBe("2026-09-04T21:00:00.000Z");
		expect(ld?.location?.name).toBe("Praia Nova Beach Club");
		expect(ld?.location?.address?.addressLocality).toBe("Pedrogão");
	});

	test("ignores Brand/WebSite/BreadcrumbList blocks", () => {
		const html = `<html><script type="application/ld+json">${JSON.stringify({ "@type": "Brand", name: "Shotgun" })}</script>
		<script type="application/ld+json">${JSON.stringify({ "@type": "BreadcrumbList", itemListElement: [] })}</script></html>`;
		expect(parseDetailLd(html)).toBeNull();
	});
});

describe("toRawEvent", () => {
	test("maps the Pedrogão event with UTC epoch and image", () => {
		const ld = parseDetailLd(detailHtml)!;
		const raw = toRawEvent("last-friday-night-praia-do-pedrogao", ld);
		expect(raw).not.toBeNull();
		expect(raw!.slug).toBe("sg-last-friday-night-praia-do-pedrogao");
		expect(raw!.title).toBe("Last Friday Night · Praia Do Pedrógão");
		// 2026-09-04T21:00:00.000Z = 1788555600
		expect(raw!.startAt).toBe(1788555600);
		expect(raw!.city).toBe("Pedrogão");
		expect(raw!.venueName).toBe("Praia Nova Beach Club");
		// SLICE_6: platform names are no longer injected as categories.
		expect(raw!.categories).toEqual([]);
		expect(raw!.url).toBe(
			"https://shotgun.live/en/events/last-friday-night-praia-do-pedrogao",
		);
	});

	test("null when JSON-LD has no name or start", () => {
		expect(toRawEvent("x", { name: "x", "@type": "Event" })).toBeNull();
	});
});

describe("slugFor", () => {
	test("prefixes sg-", () => {
		expect(slugFor("abc")).toBe("sg-abc");
	});
});
