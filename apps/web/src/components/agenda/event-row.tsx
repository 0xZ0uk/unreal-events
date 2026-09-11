import { ExternalLink } from "lucide-react";
import { Fragment, type ReactNode, useState } from "react";
import { MICRO } from "./layout";

export type RowProps = {
	title: string;
	href: string | null;
	imageUrl: string | null;
	/** `19:30`, a dash, or the source's own date text — decided by the caller. */
	time: ReactNode;
	/** ISO instant, so the clock is a real `<time>`; omitted for announcements. */
	dateTime?: string;
	/** Extra context that belongs with the venue, e.g. a source's raw date text. */
	note?: string | null;
	venue: string | null;
	city: string | null;
	chips: string[];
	/** Other session clocks on the same day, already formatted. */
	extraSessions: string[];
};

/**
 * One agenda line.
 *
 * Mobile leads with the clock and no thumbnail: at 320px a 44px picture plus a
 * 44px clock leaves too little for a title the sources write at up to 97
 * characters. From `sm` up the row opens into thumb + clock + text, where the
 * posters earn their space.
 */
export function EventRow({ title, href, imageUrl, time, dateTime, note, venue, city, chips, extraSessions }: RowProps) {
	const [broken, setBroken] = useState(false);

	const timeClass = "col-start-1 row-start-1 pt-0.5 font-mono text-[13px] leading-tight tabular-nums text-muted-foreground sm:col-start-2 sm:text-[14px]";
	const place = venue && city ? `${venue} · ${city}` : (venue ?? city ?? null);
	const meta = [note, place].filter((part): part is string => Boolean(part));

	const body = (
		<>
			<span className="col-start-1 row-start-1 hidden size-16 overflow-hidden rounded-[4px] bg-card outline-1 -outline-offset-1 outline-border sm:block">
				{imageUrl && !broken ? (
					<img
						src={imageUrl}
						alt=""
						loading="lazy"
						decoding="async"
						onError={() => setBroken(true)}
						className="size-full object-cover"
					/>
				) : null}
			</span>

			{dateTime ? (
				<time dateTime={dateTime} className={timeClass}>
					{time}
				</time>
			) : (
				<span className={timeClass}>{time}</span>
			)}

			<div className="col-start-2 row-start-1 min-w-0 sm:col-start-3">
				<h3 className="line-clamp-3 text-[17px] font-semibold leading-snug sm:line-clamp-2">{title}</h3>
				<p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
					{meta.map((part, index) => (
						<Fragment key={part}>
							{index > 0 ? <span aria-hidden="true">·</span> : null}
							<span className="min-w-0 max-w-full truncate">{part}</span>
						</Fragment>
					))}
					{chips.map((chip) => (
						<span key={chip} className={`${MICRO} shrink-0 rounded-[2px] border border-border px-1.5 py-0.5`}>
							{chip}
						</span>
					))}
					{extraSessions.length > 0 ? (
						<span className="shrink-0 font-mono text-[12px] tabular-nums">também às {extraSessions.join(", ")}</span>
					) : null}
				</p>
			</div>

			{href ? (
				<ExternalLink
					aria-hidden="true"
					strokeWidth={1.5}
					className="col-start-4 row-start-1 mt-1 hidden size-3.5 text-muted-foreground/60 sm:block motion-safe:transition-colors group-hover:text-foreground"
				/>
			) : null}
		</>
	);

	const shape =
		"group -mx-2 grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-x-3 rounded-[4px] px-2 py-3 sm:grid-cols-[4rem_3.5rem_minmax(0,1fr)_1rem] sm:gap-x-4";

	return (
		<li>
			{href ? (
				<a
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					className={`${shape} focus-ring motion-safe:transition-colors hover:bg-card`}
				>
					{body}
					<span className="sr-only">(abre num novo separador)</span>
				</a>
			) : (
				<div className={shape}>{body}</div>
			)}
		</li>
	);
}
