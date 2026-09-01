export const FETCH_TIMEOUT_MS = 15000;
export const FETCH_RETRIES = 2;
export const RETRY_BACKOFF_MS = 800;

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
