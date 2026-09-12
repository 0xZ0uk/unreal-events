// FindLeiria build-time prerender: per-event static HTML pages, per-event OG
// cards, sitemap.xml and robots.txt into the Vite output directory (apps/web/dist).
// Plain Node ESM — no TS, no drizzle. Reads the LIVE Turso database.
//
// Run from apps/web AFTER `vite build`:  node scripts/prerender-events.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { renderOgCard } from "./og-card.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(SCRIPT_DIR, "..");
const DIST = path.join(APP_DIR, "dist");
const SITE = "https://findleiria.vercel.app";
const LISBON_TZ = "Europe/Lisbon";

// ---------------------------------------------------------------- credentials
function loadCredentials() {
	let url = process.env.TURSO_DATABASE_URL || process.env.VITE_TURSO_URL;
	let token = process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_AUTH_TOKEN;

	if ((!url || !token) && fs.existsSync(path.join(APP_DIR, ".env"))) {
		const parsed = {};
		for (const line of fs
			.readFileSync(path.join(APP_DIR, ".env"), "utf8")
			.split("\n")) {
			const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
			if (!m) continue;
			let v = m[2].trim();
			if (
				(v.startsWith('"') && v.endsWith('"')) ||
				(v.startsWith("'") && v.endsWith("'"))
			) {
				v = v.slice(1, -1);
			}
			parsed[m[1]] = v;
		}
		url = url || parsed.VITE_TURSO_URL;
		token = token || parsed.VITE_TURSO_AUTH_TOKEN;
	}

	if (!url || !token) {
		throw new Error(
			"Missing Turso credentials. Set TURSO_DATABASE_URL/TURSO_AUTH_TOKEN (or VITE_TURSO_URL/VITE_TURSO_AUTH_TOKEN) or ensure apps/web/.env has VITE_TURSO_URL and VITE_TURSO_AUTH_TOKEN.",
		);
	}
	return { url, token };
}

// ------------------------------------------------------------------ entities
// Decode common HTML entities + numeric references BEFORE any escaping.
const NAMED = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	rsquo: "\u2019",
	lsquo: "\u2018",
	ldquo: "\u201c",
	rdquo: "\u201d",
	ndash: "\u2013",
	mdash: "\u2014",
	hellip: "\u2026",
	middot: "\u00b7",
	aacute: "á",
	eacute: "é",
	iacute: "í",
	oacute: "ó",
	uacute: "ú",
	agrave: "à",
	egrave: "è",
	igrave: "ì",
	ograve: "ò",
	ugrave: "ù",
	acirc: "â",
	ecirc: "ê",
	icirc: "î",
	ocirc: "ô",
	ucirc: "û",
	atilde: "ã",
	otilde: "õ",
	ccedil: "ç",
	ntilde: "ñ",
	uuml: "ü",
	ouml: "ö",
	auml: "ä",
	euml: "ë",
	iuml: "ï",
	Ccedil: "Ç",
	Aacute: "Á",
	Eacute: "É",
	Iacute: "Í",
	Oacute: "Ó",
	Uacute: "Ú",
	Ntilde: "Ñ",
	deg: "°",
	times: "×",
	raquo: "»",
	laquo: "«",
	euro: "€",
	copy: "©",
	reg: "®",
};

function decodeEntities(text) {
	if (typeof text !== "string" || !text) return text;
	return text.replace(
		/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g,
		(whole, body) => {
			if (body[0] === "#") {
				const hex = body[1] === "x" || body[1] === "X";
				const num = Number.parseInt(
					hex ? body.slice(2) : body.slice(1),
					hex ? 16 : 10,
				);
				if (!Number.isNaN(num) && num > 0 && num <= 0x10ffff) {
					try {
						return String.fromCodePoint(num);
					} catch {
						return whole;
					}
				}
				return whole;
			}
			return body in NAMED ? NAMED[body] : whole;
		},
	);
}

function escapeHTML(text) {
	return String(text)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

// ------------------------------------------------------------- time helpers
function dateOnlyFromEpoch(epochSeconds) {
	const d = new Date(epochSeconds * 1000);
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: LISBON_TZ,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(d);
	const get = (t) => parts.find((p) => p.type === t)?.value;
	return `${get("year")}-${get("month")}-${get("day")}`;
}

const PT_MONTHS = [
	"",
	"jan",
	"fev",
	"mar",
	"abr",
	"mai",
	"jun",
	"jul",
	"ago",
	"set",
	"out",
	"nov",
	"dez",
];

function lisbonDayLabel(epochSeconds) {
	const d = new Date(epochSeconds * 1000);
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: LISBON_TZ,
		day: "numeric",
		month: "numeric",
		year: "numeric",
	}).formatToParts(d);
	const get = (t) => Number(parts.find((p) => p.type === t)?.value);
	return `${get("day")} ${PT_MONTHS[get("month")]} ${get("year")}`;
}

// ---------------------------------------------------------------- JSON-LD
function buildJsonLd(row) {
	// No parseable machine date => no Event JSON-LD at all.
	if (row.date_text) return null;

	const startAt =
		typeof row.start_at === "number" && row.start_at > 0 ? row.start_at : null;
	if (startAt === null) return null; // no machine date, nothing consistent to say

	const url = `${SITE}/evento/${row.slug}`;
	const hasVenue = Boolean(row.venue_name);

	const graph = {
		"@context": "https://schema.org",
		"@type": "Event",
		name: row.title ? decodeEntities(row.title) : "",
		url,
		startDate: dateOnlyFromEpoch(startAt),
		eventStatus: "https://schema.org/EventScheduled",
	};

	if (typeof row.end_at === "number" && row.end_at > 0) {
		graph.endDate = dateOnlyFromEpoch(row.end_at);
	}

	if (row.image_url) {
		graph.image = decodeEntities(row.image_url);
	}

	if (hasVenue) {
		graph.location = {
			"@type": "Place",
			name: decodeEntities(row.venue_name),
			address: {
				"@type": "PostalAddress",
				addressLocality: row.venue_city
					? decodeEntities(row.venue_city)
					: "Leiria",
				addressRegion: "Leiria",
				addressCountry: "PT",
			},
		};
		graph.eventAttendanceMode = "https://schema.org/OfflineEventAttendanceMode";
	}

	if (row.description) {
		graph.description = decodeEntities(row.description);
	}

	if (row.url) {
		graph.offers = { "@type": "Offer", url: decodeEntities(row.url) };
	}

	return graph;
}

// ---------------------------------------------------------------- main
async function main() {
	const t0 = Date.now();
	const { url: dbUrl, token } = loadCredentials();
	const client = createClient({ url: dbUrl, authToken: token });

	const SQL = `SELECT e.slug, e.title, e.description, e.start_at, e.end_at, e.date_text,
      e.image_url, e.url, e.categories, e.updated_at, v.name AS venue_name, v.city AS venue_city
    FROM events e LEFT JOIN venues v ON v.id = e.venue_id
    ORDER BY e.start_at DESC`;

	let result;
	try {
		result = await client.execute(SQL);
	} catch (err) {
		await client.close();
		console.error("[prerender] Turso query FAILED:", err);
		process.exit(1);
	}

	const columns = result.columns;
	const rows = (result.rows || []).map((arr) => {
		const o = {};
		columns.forEach((c, i) => {
			o[c] = arr[i];
		});
		return o;
	});
	await client.close();

	if (rows.length === 0) {
		console.error(
			"[prerender] FAIL: query returned 0 events — refusing to write a build with no pages.",
		);
		process.exit(1);
	}

	// Base page template
	const distIndex = path.join(DIST, "index.html");
	if (!fs.existsSync(distIndex)) {
		console.error(
			"[prerender] FAIL: dist/index.html not found. Run `vite build` first.",
		);
		process.exit(1);
	}
	const baseHtml = fs.readFileSync(distIndex, "utf8");
	const ORIG_TITLE = "<title>FindLeiria — o que se passa em Leiria</title>";
	const ORIG_DESC =
		/<meta\n\s+name="description"\n\s+content="[^"]*"\s*\/>/.exec(
			baseHtml,
		)?.[0];
	if (!ORIG_DESC) {
		console.error(
			"[prerender] FAIL: could not locate the description <meta> tag in dist/index.html.",
		);
		process.exit(1);
	}

	// Idempotency: wipe previous runs
	for (const sub of ["evento", "og"]) {
		fs.rmSync(path.join(DIST, sub), { recursive: true, force: true });
	}

	let pagesWritten = 0;
	const sitemapUrls = [];

	for (const row of rows) {
		const slug = String(row.slug || "").trim();
		if (!slug) throw new Error("Row with empty slug encountered.");
		const titleText = row.title ? decodeEntities(row.title) : "";
		const descText = row.description ? decodeEntities(row.description) : "";

		// ---- OG card
		const hasMachineDate =
			!row.date_text && typeof row.start_at === "number" && row.start_at > 0;
		const dayLabel = hasMachineDate
			? lisbonDayLabel(row.start_at)
			: row.date_text
				? decodeEntities(row.date_text)
				: "";
		const venueLabel = row.venue_name
			? decodeEntities(row.venue_name)
			: "Leiria";
		const png = await renderOgCard({
			title: titleText || "Evento",
			dayLabel,
			venueLabel,
		});
		const ogDir = path.join(DIST, "og");
		fs.mkdirSync(ogDir, { recursive: true });
		fs.writeFileSync(path.join(ogDir, `${slug}.png`), png);

		// ---- per-event HTML page
		const jsonLd = buildJsonLd(row);
		const pageUrl = `${SITE}/evento/${slug}`;
		const ogImageUrl = `${SITE}/og/${slug}.png`;

		let html = baseHtml;
		html = html.replace(
			ORIG_TITLE,
			`<title>${escapeHTML(titleText || "Evento")} — FindLeiria</title>`,
		);
		html = html.replace(
			ORIG_DESC,
			`<meta\n      name="description"\n      content="${escapeHTML(descText || titleText || "")}"\n    />`,
		);

		const headTags =
			`<link rel="canonical" href="${pageUrl}" />\n` +
			`<meta property="og:type" content="article" />\n` +
			`<meta property="og:title" content="${escapeHTML(titleText || "Evento")}" />\n` +
			`<meta property="og:description" content="${escapeHTML(descText || titleText || "")}" />\n` +
			`<meta property="og:image" content="${ogImageUrl}" />\n` +
			`<meta property="og:url" content="${pageUrl}" />\n` +
			`<meta name="twitter:card" content="summary_large_image" />\n` +
			`<meta name="twitter:title" content="${escapeHTML(titleText || "Evento")}" />\n` +
			`<meta name="twitter:description" content="${escapeHTML(descText || titleText || "")}" />\n` +
			`<meta name="twitter:image" content="${ogImageUrl}" />\n` +
			"</head>\n";

		let insertSnippet = headTags;
		if (jsonLd) {
			const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
			insertSnippet = `<script type="application/ld+json">${json}</script>\n${headTags}`;
		}

		const beforeHead = html;
		html = html.replace("</head>\n", insertSnippet);
		if (html === beforeHead) {
			throw new Error(
				`Could not find the </head> insertion point for ${slug} — Vite's index.html changed shape.`,
			);
		}

		const pageDir = path.join(DIST, "evento", slug);
		fs.mkdirSync(pageDir, { recursive: true });
		fs.writeFileSync(path.join(pageDir, "index.html"), html);

		pagesWritten += 1;

		// ---- sitemap entry
		const lastmod =
			typeof row.updated_at === "number" && row.updated_at > 0
				? new Date(row.updated_at * 1000).toISOString().slice(0, 10)
				: new Date(Date.now()).toISOString().slice(0, 10);
		sitemapUrls.push({ loc: pageUrl, lastmod });
	}

	if (pagesWritten !== rows.length) {
		console.error(
			`[prerender] FAIL: wrote ${pagesWritten} event pages but the query returned ${rows.length} rows — aborting.`,
		);
		process.exit(1);
	}

	// ---- sitemap.xml (home + every event page)
	const latest = sitemapUrls.reduce(
		(mx, u) => (u.lastmod > mx ? u.lastmod : mx),
		"",
	);
	const urlXml = sitemapUrls
		.map(
			(u) =>
				`  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`,
		)
		.join("\n");
	const sitemap =
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
		`  <url>\n    <loc>${SITE}/</loc>\n    <lastmod>${latest}</lastmod>\n  </url>\n` +
		`${urlXml}\n</urlset>\n`;
	fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemap);

	// ---- robots.txt
	fs.writeFileSync(
		path.join(DIST, "robots.txt"),
		`User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`,
	);

	const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
	console.log(
		`[prerender] done in ${elapsed}s — ${pagesWritten} event pages, ${sitemapUrls.length} sitemap URLs.`,
	);
}

main().catch((err) => {
	console.error("[prerender] FAIL:", err);
	process.exit(1);
});
