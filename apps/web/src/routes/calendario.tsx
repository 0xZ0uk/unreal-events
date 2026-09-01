import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowUpRight,
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	Rss,
	Sparkles,
} from "lucide-react";

import { Badge } from "@events-tracker/ui/components/badge";
import { Button } from "@events-tracker/ui/components/button";
import { Card } from "@events-tracker/ui/components/card";
import { Separator } from "@events-tracker/ui/components/separator";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/calendario")({
	validateSearch: (search) => ({
		y:
			typeof search.y === "number"
				? search.y
				: search.y != null
					? Number(search.y)
					: undefined,
		m:
			typeof search.m === "number"
				? search.m
				: search.m != null
					? Number(search.m)
					: undefined,
	}),
	component: CalendarComponent,
});

const pad = (n: number) => String(n).padStart(2, "0");

function lisbonDayKey(epochSec: number): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Lisbon",
	}).format(new Date(epochSec * 1000));
}

function lisbonMidnightEpoch(dateStr: string): number {
	const parts = dateStr.split("-");
	const base = Math.floor(
		Date.UTC(
			Number(parts[0]),
			Number(parts[1]) - 1,
			Number(parts[2]),
			0,
			0,
			0,
		) / 1000,
	);
	for (const cand of [base, base - 3600, base + 3600]) {
		if (lisbonDayKey(cand) === dateStr) {
			return cand;
		}
	}
	return base;
}

function fmtTime(epochSec: number): string {
	const hour = new Date(epochSec * 1000).toLocaleString("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: "Europe/Lisbon",
	});
	return hour === "00:00" ? "" : hour;
}

type Event = {
	id: number;
	title: string;
	startAt: number;
	venueName: string | null;
	venueCity: string | null;
};

function currentLisbonDate(): { y: number; m: number } {
	const now = Math.floor(Date.now() / 1000);
	const key = lisbonDayKey(now).split("-");
	return { y: Number(key[0]), m: Number(key[1]) };
}

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const monthFmt = new Intl.DateTimeFormat("pt-PT", { month: "long" });

function monthName(year: number, month: number): string {
	const label = monthFmt.format(new Date(year, month - 1, 1));
	return label.charAt(0).toUpperCase() + label.slice(1);
}

function CalendarComponent() {
	const search = Route.useSearch();
	const today = currentLisbonDate();
	const year = search.y ?? today.y;
	const month = search.m ?? today.m;

	const navigate = useNavigate();

	const query = useQuery(trpc.events.calendar.queryOptions({ year, month }));

	const events = query.data ?? [];

	const byDay = new Map<string, Event[]>();
	let monthCount = 0;
	for (const ev of events) {
		const key = lisbonDayKey(ev.startAt);
		if (key.startsWith(`${year}-${pad(month)}`)) {
			monthCount += 1;
		}
		const bucket = byDay.get(key);
		if (bucket) bucket.push(ev);
		else byDay.set(key, [ev]);
	}

	const firstEpoch = lisbonMidnightEpoch(`${year}-${pad(month)}-01`);
	const firstWeekday = new Date(firstEpoch * 1000).getDay();
	const offset = (firstWeekday + 6) % 7;
	const CELLS = 42;
	const gridEpochs = Array.from(
		{ length: CELLS },
		(_, i) => firstEpoch + (i - offset) * 86400,
	);

	const monthKeyStart = `${year}-${pad(month)}-01`;
	const todayKey = lisbonDayKey(Math.floor(Date.now() / 1000));

	const goMonth = (delta: number) => {
		let y = year;
		let m = month + delta;
		if (m < 1) {
			m = 12;
			y -= 1;
		} else if (m > 12) {
			m = 1;
			y += 1;
		}
		navigate({
			to: "/calendario",
			search: { y, m },
		});
	};

	const monthEventsLabel =
		monthCount === 1 ? "1 evento" : `${monthCount} eventos`;

	return (
		<div className="min-h-[calc(100vh-64px)] bg-[var(--arc-canvas)] dark:bg-zinc-950">
			{/* Hero - cream */}
			<div className="mx-auto max-w-[1280px] px-4 pt-8 pb-6 sm:px-8 sm:pt-10">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--arc-ink)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-canvas)] dark:bg-white dark:text-black">
							<CalendarDays className="size-3.5" />
							Vista mensal
						</div>
						<h1
							className="text-[40px] font-bold leading-[0.95] tracking-[-1.6px] text-[var(--arc-ink)] dark:text-white sm:text-[40px]"
							style={{ fontFamily: "var(--font-display)" }}
						>
							Calendário
						</h1>
						<p
							className="mt-2 flex items-center gap-2 text-sm text-[var(--arc-ink-muted)] dark:text-zinc-400"
							style={{ fontFamily: "var(--font-dek)" }}
						>
							<span
								data-testid="calendar-month"
								className="rounded-full bg-white px-3 py-1 font-mono text-xs font-bold uppercase tracking-wide text-[var(--arc-ink)] shadow-sm ring-1 ring-foreground/10 dark:bg-zinc-900 dark:text-white dark:ring-white/10"
								style={{ fontFamily: "var(--font-mono)" }}
							>
								{monthName(year, month)} {year}
							</span>
							<span
								data-testid="calendar-count"
								className="font-mono text-xs font-medium uppercase tracking-wide dark:text-zinc-400"
								style={{ fontFamily: "var(--font-mono)" }}
							>
								· {monthEventsLabel}
							</span>
						</p>
					</div>

					<div className="flex shrink-0 items-center gap-2">
						<Link
							to="/"
							search={{ date: undefined }}
							className="inline-flex items-center gap-1.5 rounded-full border border-[var(--arc-ink)]/15 bg-white px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink)] shadow-sm transition-colors hover:border-[var(--arc-ink)] hover:bg-[var(--arc-ink)] hover:text-[var(--arc-canvas)] dark:border-white/15 dark:bg-zinc-900 dark:text-white dark:hover:bg-white dark:hover:text-black"
						>
							<ArrowLeft className="size-3.5" />
							Agenda
						</Link>
						<a
							href="http://localhost:3301/events.ics"
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1.5 rounded-full bg-[var(--arc-primary)] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-white shadow-sm transition-colors hover:bg-[var(--arc-primary-deep)]"
						>
							<Rss className="size-3.5" />
							Subscrever ICS
							<ArrowUpRight className="size-3" />
						</a>
					</div>
				</div>
			</div>

			{/* Blue voltage month control bar - single per page? We use blue band here as control header */}
			<div className="w-full bg-[var(--arc-primary)] px-4 py-4 sm:px-8">
				<div className="mx-auto flex max-w-[1280px] items-center justify-between">
					<Button
						variant="outline"
						size="sm"
						onClick={() => goMonth(-1)}
						data-testid="cal-prev"
						aria-label="Mês anterior"
						className="size-9 rounded-full border-white/20 bg-white/10 p-0 text-white backdrop-blur hover:bg-white hover:text-[var(--arc-primary)]"
					>
						<ChevronLeft className="size-4" />
					</Button>

					<div className="flex items-center gap-3">
						<div className="hidden size-8 items-center justify-center rounded-full bg-white/15 sm:flex">
							<Sparkles className="size-4 text-white" />
						</div>
						<span
							className="text-[20px] font-bold tracking-tight text-white"
							style={{
								fontFamily: "var(--font-display)",
								letterSpacing: "-0.02em",
							}}
						>
							{monthName(year, month)} {year}
						</span>
						<Badge className="hidden bg-white text-[var(--arc-primary)] hover:bg-white sm:inline-flex">
							{monthEventsLabel}
						</Badge>
					</div>

					<Button
						variant="outline"
						size="sm"
						onClick={() => goMonth(1)}
						data-testid="cal-next"
						aria-label="Mês seguinte"
						className="size-9 rounded-full border-white/20 bg-white/10 p-0 text-white backdrop-blur hover:bg-white hover:text-[var(--arc-primary)]"
					>
						<ChevronRight className="size-4" />
					</Button>
				</div>
			</div>

			{/* Grid */}
			<div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">
				<Card className="overflow-hidden rounded-[12px] border border-foreground/10 bg-white p-0 shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:bg-zinc-900 dark:border-white/10">
					{/* Weekday header - mono eyebrow */}
					<div className="grid grid-cols-7 border-b border-foreground/10 bg-[var(--arc-surface-students)]/50 dark:bg-zinc-800/50 dark:border-white/10">
						{WEEKDAYS.map((w) => (
							<div
								key={w}
								className="px-2 py-3 text-center font-mono text-[11px] font-bold uppercase tracking-[1.4px] text-[var(--arc-ink-students)] dark:text-zinc-400"
								style={{ fontFamily: "var(--font-mono)" }}
							>
								{w}
							</div>
						))}
					</div>

					<div className="grid grid-cols-7">
						{Array.from({ length: CELLS }, (_, i) => {
							const epoch = gridEpochs[i];
							const key = lisbonDayKey(epoch);
							const inMonth = key.startsWith(monthKeyStart);
							const dayNum = Number(key.split("-")[2]);
							const dayEvents = byDay.get(key) ?? [];
							const isToday = key === todayKey;
							const renderable = dayEvents.slice(0, 2);
							const overflow = dayEvents.length - renderable.length;

							return (
								<button
									type="button"
									key={key}
									onClick={() => navigate({ to: "/", search: { date: key } })}
									className={`group flex min-h-[112px] flex-col items-stretch gap-1 p-2 text-left transition-colors hover:bg-[var(--arc-primary)]/[0.04] dark:hover:bg-white/[0.04] ${
										i % 7 !== 6
											? "border-r border-foreground/10 dark:border-white/10"
											: ""
									} ${i < CELLS - 7 ? "border-b border-foreground/10 dark:border-white/10" : ""} ${
										inMonth
											? "bg-white dark:bg-zinc-900"
											: "bg-[var(--arc-surface-students)]/40 dark:bg-zinc-950"
									}`}
								>
									<span
										className={`self-start rounded-full px-2 py-1 font-mono text-xs font-bold tabular-nums transition-colors ${
											isToday
												? "bg-[var(--arc-primary)] text-white shadow-sm"
												: inMonth
													? "bg-transparent text-[var(--arc-ink)] group-hover:bg-[var(--arc-ink)] group-hover:text-[var(--arc-canvas)] dark:text-white dark:group-hover:bg-white dark:group-hover:text-black"
													: "text-[var(--arc-ink-students-soft)] dark:text-zinc-500"
										}`}
										style={{ fontFamily: "var(--font-mono)" }}
									>
										{dayNum}
									</span>
									<div className="mt-1 flex flex-col gap-1">
										{renderable.map((ev) => (
											<span
												key={ev.id}
												className="truncate rounded-[6px] bg-[var(--arc-primary)]/10 px-1.5 py-1 text-[11px] font-medium leading-tight text-[var(--arc-primary-deep)] ring-1 ring-[var(--arc-primary)]/10 group-hover:bg-[var(--arc-primary)] group-hover:text-white group-hover:ring-[var(--arc-primary)] dark:bg-[var(--arc-primary)]/20 dark:text-white dark:ring-white/10"
											>
												<span
													className="font-mono text-[11px] font-bold tabular-nums"
													style={{ fontFamily: "var(--font-mono)" }}
												>
													{fmtTime(ev.startAt)}
												</span>{" "}
												<span className="font-medium">{ev.title}</span>
											</span>
										))}
										{overflow > 0 && (
											<span
												className="px-1 font-mono text-[11px] font-bold text-[var(--arc-primary)] dark:text-white"
												style={{ fontFamily: "var(--font-mono)" }}
											>
												+{overflow} mais
											</span>
										)}
										{dayEvents.length === 0 && inMonth && (
											<span className="hidden px-1 font-mono text-[10px] uppercase tracking-wide text-transparent group-hover:text-[var(--arc-ink-muted)] sm:block dark:group-hover:text-zinc-500">
												Ver dia →
											</span>
										)}
									</div>
								</button>
							);
						})}
					</div>
				</Card>

				<div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-500">
					<span className="inline-flex items-center gap-1.5">
						<span className="size-2 rounded-full bg-[var(--arc-primary)]" />{" "}
						Hoje
					</span>
					<Separator orientation="vertical" className="h-3" />
					<span>Clique num dia para filtrar a agenda</span>
				</div>
			</div>

			<footer className="border-t border-foreground/10 bg-[var(--arc-canvas)] px-4 py-8 sm:px-8 dark:bg-zinc-950 dark:border-white/10">
				<div className="mx-auto flex max-w-[1280px] items-center justify-between font-mono text-[11px] uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-500">
					<span>Europe/Lisbon · Segunda a Domingo</span>
					<Link
						to="/"
						search={{ date: undefined }}
						className="hover:text-[var(--arc-ink)] dark:hover:text-white"
					>
						Voltar à agenda →
					</Link>
				</div>
			</footer>
		</div>
	);
}
