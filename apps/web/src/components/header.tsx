import { Separator } from "@events-tracker/ui/components/separator";
import { Link, useRouterState } from "@tanstack/react-router";

import { ModeToggle } from "./mode-toggle";

const links = [
	{ to: "/" as const, label: "Agenda" },
	{ to: "/calendario" as const, label: "Calendário" },
	{ to: "/admin" as const, label: "Runs" },
] as const;

export default function Header() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	const isActive = (to: string) =>
		to === "/" ? pathname === "/" : pathname.startsWith(to);

	return (
		<header className="sticky top-0 z-40 w-full border-[var(--p443-hairline)] border-b bg-[var(--p443-canvas)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--p443-canvas)]/80">
			{/* Eyebrow strap — mono meta line */}
			<div className="hidden border-[var(--p443-hairline)] border-b lg:block">
				<div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-1.5">
					<span className="p443-eyebrow text-[11px]">
						Leiria · Portugal — Agenda de eventos diários
					</span>
					<span className="p443-eyebrow text-[11px]">
						Scraping diário · 07:00 LISBOA
					</span>
				</div>
			</div>

			{/* Main nav */}
			<div className="mx-auto flex h-[64px] max-w-[1100px] items-center justify-between gap-4 px-4 sm:px-6">
				{/* Brand — doorway mark + wordmark (443 always amber) */}
				<Link
					to="/"
					search={{ date: undefined }}
					className="group flex items-center gap-3 px-1 py-1"
				>
					<div aria-hidden="true" className="p443-doorway size-9" />
					<div className="flex flex-col items-start leading-none">
						<span className="p443-wordmark text-[18px]">
							UNREAL<span className="text-[var(--p443-primary)]">443</span>
						</span>
						<span className="p443-eyebrow mt-1 text-[10px]">
							Eventos · Leiria
						</span>
					</div>
				</Link>

				{/* Center nav — sharp tabs, active = amber underline */}
				<nav className="hidden items-center gap-1 md:flex">
					{links.map(({ to, label }) => {
						const active = isActive(to);
						return (
							<Link
								key={to}
								to={to}
								search={
									to === "/calendario"
										? { y: undefined, m: undefined }
										: to === "/"
											? { date: undefined }
											: (undefined as never)
								}
								className={`p443-btn border-b-2 px-3 py-2 text-[13px] uppercase tracking-[0.08em] transition-colors ${
									active
										? "border-[var(--p443-primary)] text-[var(--p443-ink)]"
										: "border-transparent text-[var(--p443-ink-muted)] hover:text-[var(--p443-ink)]"
								}`}
							>
								{label}
							</Link>
						);
					})}
				</nav>

				{/* Mobile nav */}
				<nav className="flex items-center gap-0.5 overflow-x-auto md:hidden">
					{links.map(({ to, label }) => {
						const active = isActive(to);
						return (
							<Link
								key={to}
								to={to}
								search={
									to === "/calendario"
										? { y: undefined, m: undefined }
										: to === "/"
											? { date: undefined }
											: (undefined as never)
								}
								className={`p443-btn px-2 py-1.5 text-[11px] uppercase tracking-[0.04em] whitespace-nowrap ${
									active
										? "border-[var(--p443-primary)] border-b-2 text-[var(--p443-ink)]"
										: "text-[var(--p443-ink-muted)]"
								}`}
							>
								{label}
							</Link>
						);
					})}
				</nav>

				{/* Actions */}
				<div className="flex items-center gap-2">
					<a
						href="http://localhost:3301/events.ics"
						target="_blank"
						rel="noreferrer"
						className="hidden sm:inline-flex"
					>
						<span className="p443-btn border border-[var(--p443-hairline)] px-3 py-2 text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.08em] transition-colors hover:border-[var(--p443-ink-muted)] hover:text-[var(--p443-ink)]">
							Subscrever ICS
						</span>
					</a>
					<Separator
						orientation="vertical"
						className="mx-1 hidden h-6 bg-[var(--p443-hairline)] sm:block"
					/>
					<ModeToggle />
				</div>
			</div>
		</header>
	);
}
