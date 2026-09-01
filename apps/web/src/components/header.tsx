import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, LayoutDashboard, Radio, Sparkles } from "lucide-react";

import { Button } from "@events-tracker/ui/components/button";
import { Separator } from "@events-tracker/ui/components/separator";

import { ModeToggle } from "./mode-toggle";

const links = [
	{ to: "/" as const, label: "Agenda", icon: LayoutDashboard },
	{ to: "/calendario" as const, label: "Calendário", icon: CalendarDays },
	{ to: "/admin" as const, label: "Runs", icon: Radio },
] as const;

export default function Header() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	const isActive = (to: string) =>
		to === "/" ? pathname === "/" : pathname.startsWith(to);

	return (
		<header className="sticky top-0 z-40 w-full border-b border-foreground/[0.08] bg-[var(--arc-canvas)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--arc-canvas)]/80 dark:bg-background dark:border-white/10">
			{/* Eyebrow strap - Arc mono tag */}
			<div className="hidden border-b border-foreground/[0.06] bg-[var(--arc-canvas)] px-4 py-1.5 dark:bg-background lg:block">
				<div className="mx-auto flex max-w-[1280px] items-center justify-between px-8">
					<span
						className="font-mono text-[11px] font-normal uppercase tracking-[1.8px] text-[var(--arc-ink-muted)]"
						style={{ fontFamily: "var(--font-mono)" }}
					>
						Leiria · Portugal — Agenda de eventos diários
					</span>
					<span
						className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-muted)]"
						style={{ fontFamily: "var(--font-mono)" }}
					>
						Scraping diário · 07:00 LISBOA
					</span>
				</div>
			</div>

			{/* Main nav - 64px Arc top-nav */}
			<div className="mx-auto flex h-[64px] max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-8">
				{/* Brand */}
				<Link
					to="/"
					search={{ date: undefined }}
					className="group flex items-center gap-3 rounded-[10px] px-1 py-1 transition-colors"
				>
					<div className="flex size-9 items-center justify-center rounded-[8px] bg-[var(--arc-ink)] text-[var(--arc-canvas)] shadow-[0_5px_10px_rgba(0,0,0,0.12)] dark:bg-white dark:text-black">
						<Sparkles className="size-4" />
					</div>
					<div className="flex flex-col items-start leading-none">
						<span
							className="text-[16px] font-bold tracking-tight text-[var(--arc-ink)] dark:text-white"
							style={{
								fontFamily: "var(--font-display)",
								letterSpacing: "-0.02em",
							}}
						>
							UNREAL
						</span>
						<span
							className="font-mono text-[10px] font-bold uppercase tracking-[1.4px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
							style={{ fontFamily: "var(--font-mono)" }}
						>
							Eventos · Leiria
						</span>
					</div>
				</Link>

				{/* Center nav - pill tabs (students-chip inspired) */}
				<nav className="hidden items-center gap-1.5 md:flex">
					{links.map(({ to, label, icon: Icon }) => {
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
								className="no-underline"
							>
								<span
									className={
										active
											? "inline-flex items-center gap-1.5 rounded-full bg-[var(--arc-ink)] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.4px] text-[var(--arc-canvas)] shadow-[0_5px_10px_rgba(0,0,0,0.12)] transition-all dark:bg-white dark:text-black"
											: "inline-flex items-center gap-1.5 rounded-full bg-transparent px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.4px] text-[var(--arc-ink-muted)] transition-colors hover:bg-[var(--arc-surface-students-grey)] hover:text-[var(--arc-ink)] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
									}
									style={{ fontFamily: "var(--font-sans)" }}
								>
									<Icon className="size-3.5" />
									{label}
								</span>
							</Link>
						);
					})}
				</nav>

				{/* Mobile nav - same but compact */}
				<nav className="flex items-center gap-1 md:hidden">
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
								className="no-underline"
							>
								<span
									className={
										active
											? "inline-flex rounded-full bg-[var(--arc-ink)] px-3 py-1.5 text-xs font-semibold text-[var(--arc-canvas)] dark:bg-white dark:text-black"
											: "inline-flex rounded-full px-3 py-1.5 text-xs font-medium text-[var(--arc-ink-muted)]"
									}
								>
									{label}
								</span>
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
						<Button
							variant="outline"
							size="sm"
							className="rounded-full border-[var(--arc-ink)]/15 bg-transparent font-mono text-[11px] font-bold uppercase tracking-[0.6px] hover:border-[var(--arc-ink)] hover:bg-[var(--arc-ink)] hover:text-[var(--arc-canvas)] dark:border-white/15 dark:text-white dark:hover:bg-white dark:hover:text-black"
						>
							Subscrever ICS
						</Button>
					</a>
					<Separator
						orientation="vertical"
						className="mx-1 hidden h-6 bg-foreground/10 sm:block"
					/>
					<ModeToggle />
				</div>
			</div>
		</header>
	);
}
