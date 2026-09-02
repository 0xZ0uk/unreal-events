import { Badge } from "@events-tracker/ui/components/badge";
import { Button } from "@events-tracker/ui/components/button";
import { Card } from "@events-tracker/ui/components/card";
import { Separator } from "@events-tracker/ui/components/separator";
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
	/** Same-day session start times (incl. startAt) when this row merged 2+. */
	sessionStarts?: number[];
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
		<div className="min-h-[calc(100vh-64px)] bg-[var(--p443-canvas)]">
			{/* Hero - cream */}
			<div className="mx-auto max-w-[1280px] px-4 pt-8 pb-6 sm:px-8 sm:pt-10">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<div className="mb-3 inline-flex items-center gap-2 rounded-[2px] bg-[var(--p443-surface)] px-3 py-1 font-bold text-[11px] text-[var(--p443-canvas)] uppercase tracking-[0.6px]">
							<CalendarDays className="size-3.5" />
							Vista mensal
						</div>
						<h1
							className="font-bold text-[40px] text-[var(--p443-ink)] leading-[0.95] tracking-[-1.6px] sm:text-[40px]"
							style={{ fontFamily: "var(--font-display)" }}
						>
							Calendário
						</h1>
						<p
							className="mt-2 flex items-center gap-2 text-[var(--p443-ink-muted)] text-sm"
							style={{ fontFamily: "var(--font-dek)" }}
						>
							<span
								data-testid="calendar-month"
								className="rounded-[2px] border border-[var(--p443-hairline)] bg-[var(--p443-surface)] px-3 py-1 font-bold font-mono text-[var(--p443-ink)] text-xs uppercase tracking-wide"
								style={{ fontFamily: "var(--font-mono)" }}
							>
								{monthName(year, month)} {year}
							</span>
							<span
								data-testid="calendar-count"
								className="font-medium font-mono text-xs uppercase tracking-wide"
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
							className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--p443-ink)]/15 bg-[var(--p443-surface)] px-4 py-2 font-bold font-mono text-[11px] text-[var(--p443-ink)] uppercase tracking-[0.6px] transition-colors hover:border-[var(--p443-ink)] hover:border-[var(--p443-ink-muted)] hover:bg-[var(--p443-surface)]"
						>
							<ArrowLeft className="size-3.5" />
							Agenda
						</Link>
						<a
							href="http://localhost:3301/events.ics"
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1.5 rounded-[2px] bg-[var(--p443-primary)] px-4 py-2 font-bold font-mono text-[11px] text-[var(--p443-on-primary)] uppercase tracking-[0.6px] transition-colors hover:bg-[var(--p443-primary-hover)]"
						>
							<Rss className="size-3.5" />
							Subscrever ICS
							<ArrowUpRight className="size-3" />
						</a>
					</div>
				</div>
			</div>

			{/* Blue voltage month control bar - single per page? We use blue band here as control header */}
			<div className="w-full border-[var(--p443-hairline)] border-y bg-[var(--p443-surface)] px-4 py-4 sm:px-8">
				<div className="mx-auto flex max-w-[1280px] items-center justify-between">
					<Button
						variant="outline"
						size="sm"
						onClick={() => goMonth(-1)}
						data-testid="cal-prev"
						aria-label="Mês anterior"
						className="size-9 rounded-[4px] border-[var(--p443-hairline)] bg-[var(--p443-hairline)] p-0 text-[var(--p443-on-primary)] backdrop-blur hover:bg-[var(--p443-surface)] hover:text-[var(--p443-primary)]"
					>
						<ChevronLeft className="size-4" />
					</Button>

					<div className="flex items-center gap-3">
						<div className="hidden size-8 items-center justify-center rounded-[2px] bg-[var(--p443-hairline)] sm:flex">
							<Sparkles className="size-4 text-[var(--p443-on-primary)]" />
						</div>
						<span
							className="font-bold text-[20px] text-[var(--p443-on-primary)] tracking-tight"
							style={{
								fontFamily: "var(--font-display)",
								letterSpacing: "-0.02em",
							}}
						>
							{monthName(year, month)} {year}
						</span>
						<Badge variant="secondary" className="hidden sm:inline-flex">
							{monthEventsLabel}
						</Badge>
					</div>

					<Button
						variant="outline"
						size="sm"
						onClick={() => goMonth(1)}
						data-testid="cal-next"
						aria-label="Mês seguinte"
						className="size-9 rounded-[4px] border-[var(--p443-hairline)] bg-[var(--p443-hairline)] p-0 text-[var(--p443-on-primary)] backdrop-blur hover:bg-[var(--p443-surface)] hover:text-[var(--p443-primary)]"
					>
						<ChevronRight className="size-4" />
					</Button>
				</div>
			</div>

			{/* Grid */}
			<div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">
				<Card className="overflow-hidden rounded-[2px] border border-[var(--p443-hairline)] bg-[var(--p443-surface)] p-0">
					{/* Weekday header - mono eyebrow */}
					<div className="grid grid-cols-7 border-[var(--p443-hairline)] border-b bg-[var(--p443-surface)]/50">
						{WEEKDAYS.map((w) => (
							<div
								key={w}
								className="px-2 py-3 text-center font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[1.4px]"
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
									className={`group flex min-h-[112px] flex-col items-stretch gap-1 p-2 text-left transition-colors hover:bg-[var(--p443-primary)]/[0.06] ${
										i % 7 !== 6 ? "border-[var(--p443-hairline)] border-r" : ""
									} ${i < CELLS - 7 ? "border-[var(--p443-hairline)] border-b" : ""} ${
										inMonth
											? "bg-[var(--p443-surface)]"
											: "bg-[var(--p443-surface)]/40"
									}`}
								>
									<span
										className={`self-start rounded-[2px] px-2 py-1 font-bold font-mono text-xs tabular-nums transition-colors ${
											isToday
												? "bg-[var(--p443-primary)] text-[var(--p443-on-primary)] shadow-sm"
												: inMonth
													? "bg-transparent text-[var(--p443-ink)] group-hover:bg-[var(--p443-ink)] group-hover:text-[var(--p443-canvas)]"
													: "text-[var(--p443-ink-muted)]"
										}`}
										style={{ fontFamily: "var(--font-mono)" }}
									>
										{dayNum}
									</span>
									<div className="mt-1 flex flex-col gap-1">
										{renderable.map((ev) => (
											<span
												key={ev.id}
												className="truncate rounded-[2px] bg-[var(--p443-primary)]/10 px-1.5 py-1 font-medium text-[11px] text-[var(--p443-primary-hover)] leading-tight ring-1 ring-[var(--p443-primary)]/10 group-hover:bg-[var(--p443-primary)] group-hover:text-[var(--p443-on-primary)]"
											>
												<span
													className="font-bold font-mono text-[11px] tabular-nums"
													style={{ fontFamily: "var(--font-mono)" }}
												>
													{fmtTime(ev.startAt)}
												</span>{" "}
												<span className="font-medium">{ev.title}</span>
												{(ev.sessionStarts?.length ?? 0) > 1 && (
													<span className="font-bold font-mono text-[10px] opacity-70">
														{" "}
														· +{(ev.sessionStarts?.length ?? 0) - 1}
													</span>
												)}
											</span>
										))}
										{overflow > 0 && (
											<span
												className="px-1 font-bold font-mono text-[11px] text-[var(--p443-primary)]"
												style={{ fontFamily: "var(--font-mono)" }}
											>
												+{overflow} mais
											</span>
										)}
										{dayEvents.length === 0 && inMonth && (
											<span className="hidden px-1 font-mono text-[10px] text-transparent uppercase tracking-wide group-hover:text-[var(--p443-ink-muted)] sm:block">
												Ver dia →
											</span>
										)}
									</div>
								</button>
							);
						})}
					</div>
				</Card>

				<div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]">
					<span className="inline-flex items-center gap-1.5">
						<span className="size-2 rounded-[2px] bg-[var(--p443-primary)]" />{" "}
						Hoje
					</span>
					<Separator orientation="vertical" className="h-3" />
					<span>Clique num dia para filtrar a agenda</span>
				</div>
			</div>

			<footer className="border-[var(--p443-hairline)] border-t bg-[var(--p443-canvas)] px-4 py-8 sm:px-8">
				<div className="mx-auto flex max-w-[1280px] items-center justify-between font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]">
					<span>Europe/Lisbon · Segunda a Domingo</span>
					<Link
						to="/"
						search={{ date: undefined }}
						className="hover:text-[var(--p443-ink)]"
					>
						Voltar à agenda →
					</Link>
				</div>
			</footer>
		</div>
	);
}
