import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, MapPin } from "lucide-react";
import { useMemo, useState } from "react";

import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

type Event = {
	id: number;
	title: string;
	slug: string;
	description: string | null;
	startAt: number;
	endAt: number | null;
	venueId: number | null;
	venueName: string | null;
	venueCity: string | null;
	venueSlug: string | null;
	imageUrl: string | null;
	url: string | null;
	categories: string[];
	dateText?: string | null;
};

const dayFmt = (t: number) =>
	new Intl.DateTimeFormat("pt-PT", {
		weekday: "long",
		day: "2-digit",
		month: "short",
		year: "numeric",
		timeZone: "Europe/Lisbon",
	}).format(new Date(t * 1000));

const dayKey = (t: number) =>
	// Authoritative Europe/Lisbon date key (en-CA renders YYYY-MM-DD),
	// independent of the viewer's timezone.
	new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(
		new Date(t * 1000),
	);

const pad = (n: number) => String(n).padStart(2, "0");

/** Epoch seconds for Lisbon-local midnight of a `YYYY-MM-DD` date string. */
function lisbonMidnightEpoch(dateStr: string): number {
	const [y, m, d] = dateStr.split("-").map(Number);
	const target = `${y}-${pad(m)}-${pad(d)}`;
	const base = Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000);
	for (const cand of [base, base - 3600, base + 3600]) {
		const key = new Intl.DateTimeFormat("en-CA", {
			timeZone: "Europe/Lisbon",
		}).format(new Date(cand * 1000));
		if (key === target) {
			return cand;
		}
	}
	return base;
}

function fmtTime(t: number) {
	const hour = new Date(t * 1000).toLocaleString("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: "Europe/Lisbon",
	});
	return hour === "00:00" ? "" : hour;
}

function isSameDay(a: number, b: number) {
	return dayKey(a) === dayKey(b);
}

function isMultiDay(e: Event) {
	return e.endAt != null && !isSameDay(e.startAt, e.endAt);
}

function EventRow({ event }: { event: Event }) {
	const multiDay = isMultiDay(event);
	const timeLabel =
		multiDay && event.endAt != null
			? `${dayKey(event.startAt)} → ${dayKey(event.endAt)}`
			: fmtTime(event.startAt);

	return (
		<div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
			<div className="min-w-16 text-left">
				{multiDay ? (
					<span className="font-medium text-xs text-zinc-500 dark:text-zinc-400">
						{dayKey(event.startAt)}
						<br />
						→
						<br />
						{dayKey(event.endAt!)}
					</span>
				) : (
					<span className="font-semibold text-sm text-zinc-800 tabular-nums dark:text-zinc-100">
						{timeLabel || "—"}
					</span>
				)}
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<h3 className="font-medium text-zinc-900 dark:text-zinc-50">
						{event.url ? (
							<a
								href={event.url}
								target="_blank"
								rel="noreferrer"
								className="transition-colors hover:text-blue-600 dark:hover:text-blue-400"
							>
								{event.title}
							</a>
						) : (
							event.title
						)}
					</h3>
				</div>
				{event.venueName && (
					<p className="mt-0.5 flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
						<MapPin className="h-3.5 w-3.5" />
						{event.venueName}
						{event.venueCity ? ` · ${event.venueCity}` : ""}
					</p>
				)}
				{event.categories.length > 0 && (
					<div className="mt-1.5 flex flex-wrap gap-1.5">
						{event.categories.map((cat) => (
							<span
								key={cat}
								className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
							>
								{cat}
							</span>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

const selectCls =
	"rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function FilterBar({
	venues,
	categories,
	filters,
	onChange,
}: {
	venues: { id: number; name: string; slug: string; city: string }[];
	categories: string[];
	filters: {
		venueSlug: string;
		category: string;
		dateFrom: string;
		dateTo: string;
		city: string;
	};
	onChange: (patch: Partial<typeof filters>) => void;
}) {
	return (
		<div className="mb-6 flex flex-wrap items-center gap-3">
			<select
				value={filters.venueSlug}
				onChange={(e) => onChange({ venueSlug: e.target.value })}
				className={selectCls}
				aria-label="Local"
			>
				<option value="">Todos os locais</option>
				{venues.map((v) => (
					<option key={v.id} value={v.slug}>
						{v.name}
					</option>
				))}
			</select>

			<select
				value={filters.category}
				onChange={(e) => onChange({ category: e.target.value })}
				className={selectCls}
				aria-label="Categoria"
			>
				<option value="">Todas as categorias</option>
				{categories.map((c) => (
					<option key={c} value={c}>
						{c}
					</option>
				))}
			</select>

			<select
				value={filters.city}
				onChange={(e) => onChange({ city: e.target.value })}
				className={selectCls}
				aria-label="Cidade"
			>
				<option value="">Todas</option>
				<option value="Leiria">Leiria</option>
				<option value="Fora de Leiria">Fora de Leiria</option>
			</select>

			<label className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
				De
				<input
					type="date"
					value={filters.dateFrom}
					onChange={(e) => onChange({ dateFrom: e.target.value })}
					className={selectCls}
				/>
			</label>
			<label className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
				Até
				<input
					type="date"
					value={filters.dateTo}
					onChange={(e) => onChange({ dateTo: e.target.value })}
					className={selectCls}
				/>
			</label>

			{Object.values(filters).some((v) => v !== "") && (
				<button
					type="button"
					onClick={() =>
						onChange({
							venueSlug: "",
							category: "",
							dateFrom: "",
							dateTo: "",
							city: "",
						})
					}
					className="text-blue-600 text-sm dark:text-blue-400"
				>
					Limpar filtros
				</button>
			)}
		</div>
	);
}

function groupByDay(events: Event[]): [string, Event[]][] {
	const grouped = new Map<string, Event[]>();
	for (const event of events) {
		const key = dayKey(event.startAt);
		const bucket = grouped.get(key);
		if (bucket) {
			bucket.push(event);
		} else {
			grouped.set(key, [event]);
		}
	}
	return [...grouped.entries()];
}

function DayGroups({ groups }: { groups: [string, Event[]][] }) {
	if (groups.length === 0) {
		return (
			<p className="text-sm text-zinc-500 dark:text-zinc-400">
				A carregar eventos…
			</p>
		);
	}
	return (
		<div className="space-y-8">
			{groups.map(([key, dayEvents]) => (
				<section key={key}>
					<h2 className="mb-3 flex items-center gap-2 font-semibold text-sm text-zinc-500 uppercase tracking-wide dark:text-zinc-400">
						<CalendarDays className="h-4 w-4" />
						{dayFmt(dayEvents[0].startAt)}
					</h2>
					<div className="space-y-2">
						{dayEvents.map((event) => (
							<EventRow key={event.id} event={event} />
						))}
					</div>
				</section>
			))}
		</div>
	);
}

function HomeComponent() {
	const byDay = useQuery(trpc.events.byDay.queryOptions());
	const stats = useQuery(trpc.events.stats.queryOptions());
	const venuesQuery = useQuery(trpc.events.venues.queryOptions());
	const undatedQuery = useQuery(trpc.events.undated.queryOptions());

	const [venueSlug, setVenueSlug] = useState("");
	const [category, setCategory] = useState("");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [city, setCity] = useState("");

	const hasFilter =
		venueSlug !== "" ||
		category !== "" ||
		dateFrom !== "" ||
		dateTo !== "" ||
		city !== "";

	const listQuery = useQuery(
		trpc.events.list.queryOptions({
			venueSlug: venueSlug || undefined,
			category: category || undefined,
			dateFrom: dateFrom ? lisbonMidnightEpoch(dateFrom) : undefined,
			dateTo: dateTo ? lisbonMidnightEpoch(dateTo) : undefined,
			city: city === "Leiria" ? "Leiria" : undefined,
			includeUndated: false,
		}),
	);

	let events = hasFilter ? (listQuery.data ?? []) : (byDay.data ?? []);
	// "Fora de Leiria" is a negative city filter — apply it client-side.
	if (city === "Fora de Leiria") {
		events = events.filter((e: Event) => !e.venueCity || e.venueCity === "");
	}

	const venues = venuesQuery.data ?? [];

	const categories = useMemo(() => {
		const source = [...(byDay.data ?? []), ...(listQuery.data ?? [])];
		return [...new Set(source.flatMap((e) => e.categories))].sort((a, b) =>
			a.localeCompare(b),
		);
	}, [byDay.data, listQuery.data]);

	const groups = groupByDay(events);
	const undated = undatedQuery.data ?? [];

	return (
		<div className="container mx-auto max-w-3xl px-4 py-6">
			<header className="mb-6">
				<h1 className="font-semibold text-2xl text-zinc-900 tracking-tight dark:text-zinc-50">
					Agenda de Eventos
				</h1>
				{stats.data && (
					<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
						<span className="font-medium text-zinc-700 dark:text-zinc-200">
							{stats.data.totalEvents}
						</span>{" "}
						eventos ·{" "}
						<span className="font-medium text-zinc-700 dark:text-zinc-200">
							{stats.data.totalVenues}
						</span>{" "}
						locais
					</p>
				)}
			</header>

			<FilterBar
				venues={venues}
				categories={categories}
				filters={{ venueSlug, category, dateFrom, dateTo, city }}
				onChange={(patch) => {
					if ("venueSlug" in patch) setVenueSlug(patch.venueSlug ?? "");
					if ("category" in patch) setCategory(patch.category ?? "");
					if ("dateFrom" in patch) setDateFrom(patch.dateFrom ?? "");
					if ("dateTo" in patch) setDateTo(patch.dateTo ?? "");
					if ("city" in patch) setCity(patch.city ?? "");
				}}
			/>

			<DayGroups groups={groups} />

			{undated.length > 0 && (
				<section className="mt-10">
					<h2 className="mb-3 flex items-center gap-2 font-semibold text-sm text-zinc-500 uppercase tracking-wide dark:text-zinc-400">
						<CalendarDays className="h-4 w-4" />
						Sem data fixa
					</h2>
					<div className="space-y-2">
						{undated.map((event) => (
							<div
								key={event.id}
								className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
							>
								<div className="flex items-baseline justify-between gap-3">
									<h3 className="min-w-0 font-medium text-zinc-900 dark:text-zinc-50">
										{event.url ? (
											<a
												href={event.url}
												target="_blank"
												rel="noreferrer"
												className="transition-colors hover:text-blue-600 dark:hover:text-blue-400"
											>
												{event.title}
											</a>
										) : (
											event.title
										)}
									</h3>
									{event.dateText && (
										<span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
											{event.dateText}
										</span>
									)}
								</div>
								{event.venueName && (
									<p className="mt-0.5 flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
										<MapPin className="h-3.5 w-3.5" />
										{event.venueName}
										{event.venueCity ? ` · ${event.venueCity}` : ""}
									</p>
								)}
							</div>
						))}
					</div>
				</section>
			)}
		</div>
	);
}
