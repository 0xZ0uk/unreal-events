/**
 * The FindLeiria wordmark.
 *
 * The mark is a location pin in the page's own angular language — four
 * straight edges, no rounded stroke, no second hue — with its core knocked out
 * to the canvas colour so it survives at 19px where a stroked pin would smear.
 * "LEIRIA" carries the accent, so the name still reads as two words.
 */
export function Wordmark({ className = "" }: { className?: string }) {
	return (
		<span className={`inline-flex items-center gap-2 ${className}`}>
			<svg
				viewBox="0 0 20 24"
				className="h-[19px] w-auto shrink-0 text-primary"
				aria-hidden="true"
				focusable="false"
			>
				<path d="M10 0.8 L19.2 9.5 L10 23.2 L0.8 9.5 Z" fill="currentColor" />
				<circle cx="10" cy="9.1" r="2.8" fill="var(--background)" />
			</svg>
			<span className="p443-wordmark">
				FIND<span className="text-primary">LEIRIA</span>
			</span>
		</span>
	);
}
