import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, Rss } from "lucide-react";

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

/** Epoch seconds for Lisbon-local midnight of a `YYYY-MM-DD` date string. */
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

	// Index events by their true Lisbon day (YYYY-MM-DD).
	const byDay = new Map<string, Event[]>();
	let monthCount = 0;
	for (const ev of events) {
		const key = lisbonDayKey(ev.startAt);
		if (key.startsWith(`${year}-${pad(month)}`)) {
			monthCount += 1;
		}
		const bucket = byDay.get(key);
		if (bucket) {
			bucket.push(ev);
		} else {
			byDay.set(key, [ev]);
		}
	}

	// Build the Monday-first grid with 6 weeks worth of cells.
	const firstEpoch = lisbonMidnightEpoch(`${year}-${pad(month)}-01`);
	const firstWeekday = new Date(firstEpoch * 1000).getDay(); // 0 = Sun
	const offset = (firstWeekday + 6) % 7; // days before Mon-1st
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
		<div className="container mx-auto max-w-5xl px-4 py-6">
			<header className="mb-6">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h1 className="font-semibold text-2xl text-zinc-900 tracking-tight dark:text-zinc-50">
							Calendário
						</h1>
						<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
							<span
								data-testid="calendar-month"
								className="font-medium text-zinc-700 dark:text-zinc-200"
							>
								{monthName(year, month)} {year}
							</span>
							{" · "}
							<span data-testid="calendar-count">{monthEventsLabel}</span>
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<a
							href="/"
							className="flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:border-blue-500 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:text-blue-400"
						>
							<ArrowLeft className="h-4 w-4" />
							Agenda
						</a>
						<a
							href="http://localhost:3301/events.ics"
							title="Subscrever ICS"
							className="flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:border-blue-500 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:text-blue-400"
						>
							<Rss className="h-4 w-4" />
							Subscrever ICS
						</a>
					</div>
				</div>
			</header>

			<div className="mb-4 flex items-center justify-between">
				<button
					type="button"
					onClick={() => goMonth(-1)}
					data-testid="cal-prev"
					aria-label="Mês anterior"
					className="flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-700 transition-colors hover:border-blue-500 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:text-blue-400"
				>
					<ChevronLeft className="h-4 w-4" />
				</button>
				<span className="font-medium text-zinc-800 dark:text-zinc-100">
					{monthName(year, month)} {year}
				</span>
				<button
					type="button"
					onClick={() => goMonth(1)}
					data-testid="cal-next"
					aria-label="Mês seguinte"
					className="flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-700 transition-colors hover:border-blue-500 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:text-blue-400"
				>
					<ChevronRight className="h-4 w-4" />
				</button>
			</div>

			<div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
				<div className="grid grid-cols-7 border-zinc-200 border-b dark:border-zinc-800">
					{WEEKDAYS.map((w) => (
						<div
							key={w}
							className="px-2 py-2 text-center font-semibold text-xs text-zinc-500 uppercase tracking-wide dark:text-zinc-400"
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
								className={`flex min-h-24 flex-col items-stretch gap-1 border-zinc-200 p-1.5 text-left transition-colors hover:bg-blue-50 dark:border-zinc-800 dark:hover:bg-blue-950 ${
									i % 7 !== 6 ? "border-r" : ""
								} ${i < CELLS - 7 ? "border-b" : ""} ${
									inMonth
										? "bg-white dark:bg-zinc-900"
										: "bg-zinc-50 dark:bg-zinc-950"
								}`}
							>
								<span
									className={`self-start rounded-md px-1.5 py-0.5 font-medium text-sm tabular-nums ${
										isToday
											? "bg-blue-600 text-white"
											: inMonth
												? "text-zinc-800 dark:text-zinc-100"
												: "text-zinc-400 dark:text-zinc-500"
									}`}
								>
									{dayNum}
								</span>
								{renderable.map((ev) => (
									<span
										key={ev.id}
										className="truncate rounded bg-blue-100/70 px-1 py-0.5 text-[11px] text-blue-900 leading-tight dark:bg-blue-900/50 dark:text-blue-100"
									>
										<span className="font-semibold tabular-nums">
											{fmtTime(ev.startAt)}
										</span>{" "}
										{ev.title}
									</span>
								))}
								{overflow > 0 && (
									<span className="px-1 font-medium text-[11px] text-blue-500 dark:text-blue-400">
										+{overflow}
									</span>
								)}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
