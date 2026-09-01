/**
 * Raw event as scraped from an upstream source, before normalization,
 * fingerprinting and ingestion. Field values are the closest literal
 * representation of what the source HTML provides.
 */
export interface RawEvent {
	title: string;
	slug: string;
	description: string | null;
	/** Start epoch seconds (UTC). */
	startAt: number;
	/** End epoch seconds (UTC), null when the source gives no end. */
	endAt: number | null;
	venueName: string;
	city: string | null;
	categories: string[];
	imageUrl: string | null;
	url: string;
}
