import { buildDigest, parseKeywords } from "./digest-core";

/**
 * Digest CLI — the entrypoint Hermes cron calls. Reads the DB directly.
 *
 * Usage:
 *   bun run src/digest-cli.ts                  # full upcoming digest
 *   bun run src/digest-cli.ts --new 24         # events added in last 24h
 *   DIGEST_KEYWORDS=tattoo,jazz bun run ...    # keyword watchlist (env)
 */
const argv = process.argv.slice(2);
const newIdx = argv.indexOf("--new");
const newHours =
	newIdx >= 0 ? Number.parseInt(argv[newIdx + 1] ?? "24", 10) : undefined;

const keywords = parseKeywords(process.env.DIGEST_KEYWORDS);

const digest = await buildDigest({
	keywords,
	...(newHours != null ? { newHours } : {}),
});

const fmtEvent = (e: (typeof digest.events)[number]) =>
	`• ${e.when} — ${e.title}${e.venue ? ` @ ${e.venue}` : ""}${e.url ? `\n  ${e.url}` : ""}`;

const lines: string[] = [];
if (digest.total === 0) {
	lines.push("Sem eventos futuros agendados.");
} else {
	if (keywords.length > 0) {
		lines.push(
			`Agenda Leiria — ${digest.total} eventos futuros, ${digest.hits} na watchlist (${keywords.join(", ")}):`,
		);
	} else {
		lines.push(`Agenda Leiria — ${digest.total} eventos futuros:`);
	}
	lines.push("");
	const matched = digest.events.filter((e) => e.match);
	const rest = digest.events.filter((e) => !e.match);
	for (const e of matched) {
		lines.push(`⭐ ${fmtEvent(e)}`);
	}
	if (matched.length > 0 && rest.length > 0) {
		lines.push("");
	}
	for (const e of rest) {
		lines.push(fmtEvent(e));
	}
}

console.log(lines.join("\n"));
