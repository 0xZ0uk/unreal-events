export const FETCH_TIMEOUT_MS = 15000;
export const FETCH_RETRIES = 2;
export const RETRY_BACKOFF_MS = 800;

/**
 * Fetch with a hard timeout and bounded retries. 4xx responses are terminal;
 * network errors, timeouts and 5xx are retried.
 */
export async function defaultFetchText(url: string): Promise<string> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
		if (attempt > 0) {
			await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * attempt));
		}
		try {
			const res = await fetch(url, {
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			});
			if (!res.ok) {
				const err = new Error(`GET ${url} -> HTTP ${res.status}`);
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