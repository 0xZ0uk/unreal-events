/**
 * Event lifecycle rules — pure, no DB.
 */
export interface LifecycleEvent {
	start_at: number;
	end_at: number | null;
	/** Non-null ⇒ undated row: start_at is an ingestion placeholder. */
	date_text: string | null;
}

/**
 * A dated event is expired once its last known instant has passed:
 * `end_at` when present, otherwise `start_at`. Undated rows are never
 * expired — their start_at carries no real meaning.
 */
export function isExpired(event: LifecycleEvent, now: number): boolean {
	if (event.date_text != null) return false;
	const last = event.end_at ?? event.start_at;
	return last < now;
}
