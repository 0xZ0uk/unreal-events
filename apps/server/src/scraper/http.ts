export const FETCH_TIMEOUT_MS = 15000;
export const FETCH_RETRIES = 2;
export const RETRY_BACKOFF_MS = 800;

/**
 * Fallback fetch via curl. Bun's fetch (uWebSockets-based) hard-fails with
 * `Malformed_HTTP_Response` on hosts that emit malformed header values
 * (Ticketline: "Unexpected whitespace after header value"). curl is lenient
 * and handles those fine, so on a non-HTTP-status fetch error we retry once
 * through the shell before giving up.
 */
async function curlFetchText(url: string): Promise<string> {
	const proc = Bun.spawnSync([
		"curl",
		"-sL",
		"--max-time",
		String(Math.ceil(FETCH_TIMEOUT_MS / 1000)),
		"-A",
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
		url,
	]);
	const out = proc.stdout.toString();
	if (proc.exitCode !== 0 || out.length === 0) {
		throw new Error(
			`curl fallback failed for ${url}: exit ${proc.exitCode}, ${proc.stderr.toString().slice(0, 120)}`,
		);
	}
	return out;
}

/** Whether an error is Bun's malformed-response fetch failure. */
function isMalformedResponse(err: unknown): boolean {
	return (
		err instanceof Error && err.message.includes("Malformed_HTTP_Response")
	);
}

/**
 * Fetch with a hard timeout and bounded retries. Retry policy:
 * - network errors / timeouts / 5xx: retried with linear backoff
 * - 429 (rate limit): retried with a LONG backoff (cooldown), because
 *   sources like Eventbrite/Shotgun throttle aggressively and a short
 *   retry just burns the attempt budget
 * - other 4xx: terminal (no retry)
 */
export async function defaultFetchText(url: string): Promise<string> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
		if (attempt > 0) {
			let backoff = RETRY_BACKOFF_MS * attempt;
			if (isRateLimited(lastError)) {
				backoff = RATE_LIMIT_BACKOFF_MS * attempt;
			}
			await new Promise((r) => setTimeout(r, backoff));
		}
		try {
			const res = await fetch(url, {
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			});
			if (!res.ok) {
				const err = new Error(`GET ${url} -> HTTP ${res.status}`);
				if (res.status === 429) {
					throw Object.assign(err, { retryable: true, rateLimited: true });
				}
				if (res.status < 500) {
					throw Object.assign(err, { retryable: false });
				}
				throw Object.assign(err, { retryable: true });
			}
			return res.text();
		} catch (err) {
			// Bun fetch cannot parse some hosts' malformed response headers
			// (e.g. Ticketline). curl is lenient — use it once as a fallback
			// before the retry/backoff machinery.
			if (isMalformedResponse(err)) {
				try {
					return await curlFetchText(url);
				} catch (curlErr) {
					lastError = curlErr;
					continue;
				}
			}
			lastError = err;
			if (
				err &&
				typeof err === "object" &&
				"retryable" in err &&
				err.retryable === false
			) {
				throw err;
			}
		}
	}
	throw lastError;
}

export function isRateLimited(err: unknown): boolean {
	return (
		err != null &&
		typeof err === "object" &&
		"rateLimited" in err &&
		(err as { rateLimited?: boolean }).rateLimited === true
	);
}

/** Backoff before a 429 retry, ms (attempt N gets N× this). */
export const RATE_LIMIT_BACKOFF_MS = 4000;
