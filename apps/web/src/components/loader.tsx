import { Loader2 } from "lucide-react";

export default function Loader() {
	return (
		<div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-[var(--arc-canvas)] pt-12 dark:bg-zinc-950">
			<div className="flex size-10 items-center justify-center rounded-full bg-[var(--arc-ink)] text-[var(--arc-canvas)] dark:bg-white dark:text-black">
				<Loader2 className="size-5 animate-spin" />
			</div>
			<p
				className="font-mono text-[11px] font-bold uppercase tracking-[1.4px] text-[var(--arc-ink-muted)] dark:text-zinc-500"
				style={{ fontFamily: "var(--font-mono)" }}
			>
				A carregar
			</p>
		</div>
	);
}
