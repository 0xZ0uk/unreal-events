import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowUpRight,
	CalendarDays,
	MapPin,
	SearchX,
	Sparkles,
	SlidersHorizontal,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@events-tracker/ui/components/badge";
import { Button } from "@events-tracker/ui/components/button";
import { Card, CardContent } from "@events-tracker/ui/components/card";
import { Input } from "@events-tracker/ui/components/input";
import { Separator } from "@events-tracker/ui/components/separator";
import {
	NativeSelect,
	NativeSelectOption,
} from "@events-tracker/ui/components/native-select";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/")({
	validateSearch: (search) => ({
		date: typeof search.date === "string" ? search.date : undefined,
	}),
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
	new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(
		new Date(t * 1000),
	);

const pad = (n: number) => String(n).padStart(2, "0");

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
		<Card className="group gap-0 overflow-hidden rounded-[10px] border border-foreground/[0.07] bg-white py-0 shadow-[0_5px_10px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.09)] hover:border-foreground/10 dark:bg-zinc-900 dark:border-white/10 dark:hover:border-white/15">
			<CardContent className="flex items-stretch gap-0 p-0">
				{/* Time rail - Arc tab-label + mono, with blue accent on hover */}
				<div className="flex w-[96px] shrink-0 flex-col items-center justify-center gap-1 border-r border-foreground/[0.06] bg-[var(--arc-surface-students)]/60 px-3 py-4 text-center transition-colors group-hover:bg-[var(--arc-surface-students)] dark:bg-zinc-800/50 dark:border-white/5 sm:w-[112px]">
					{multiDay ? (
						<>
							<span
								className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
								style={{ fontFamily: "var(--font-mono)" }}
							>
								{dayKey(event.startAt)}
							</span>
							<span className="text-[11px] font-bold text-[var(--arc-primary)]">
								→
							</span>
							<span
								className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
								style={{ fontFamily: "var(--font-mono)" }}
							>
								{dayKey(event.endAt!)}
							</span>
							<span className="mt-1 rounded-full bg-[var(--arc-ink)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--arc-canvas)] dark:bg-white dark:text-black">
								vários dias
							</span>
						</>
					) : (
						<>
							<span
								className="font-mono text-[11px] font-bold uppercase tracking-[1.2px] text-[var(--arc-ink-students)] dark:text-zinc-400"
								style={{ fontFamily: "var(--font-mono)" }}
							>
								{timeLabel ? "HORÁRIO" : "—"}
							</span>
							<span
								className="font-display text-[22px] font-bold leading-none tracking-tight text-[var(--arc-ink)] tabular-nums dark:text-white"
								style={{
									fontFamily: "var(--font-display)",
									letterSpacing: "-0.02em",
								}}
							>
								{timeLabel || "—"}
							</span>
							<span className="mt-0.5 size-1 rounded-full bg-[var(--arc-primary)] opacity-0 transition-opacity group-hover:opacity-100" />
						</>
					)}
				</div>

				{/* Main */}
				<div className="min-w-0 flex-1 px-4 py-4 sm:px-5">
					<div className="flex items-start justify-between gap-3">
						<h3
							className="line-clamp-2 text-[17px] font-semibold leading-tight text-[var(--arc-ink)] transition-colors group-hover:text-[var(--arc-primary-deep)] dark:text-white dark:group-hover:text-white"
							style={{
								fontFamily: "var(--font-display)",
								letterSpacing: "-0.02em",
							}}
						>
							{event.url ? (
								<a
									href={event.url}
									target="_blank"
									rel="noreferrer"
									className="inline-flex items-start gap-1.5 hover:underline decoration-[var(--arc-primary)] decoration-2 underline-offset-2"
								>
									<span>{event.title}</span>
									<ArrowUpRight className="mt-0.5 size-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-100" />
								</a>
							) : (
								event.title
							)}
						</h3>
					</div>

					{event.venueName && (
						<p
							className="mt-1.5 flex items-center gap-1.5 font-mono text-[12px] font-medium text-[var(--arc-ink-students)] dark:text-zinc-400"
							style={{ fontFamily: "var(--font-mono)" }}
						>
							<MapPin className="size-3 shrink-0" />
							<span className="truncate">
								{event.venueName}
								{event.venueCity ? ` · ${event.venueCity}` : ""}
							</span>
						</p>
					)}

					{event.categories.length > 0 && (
						<div className="mt-3 flex flex-wrap gap-1.5">
							{event.categories.map((cat) => (
								<Badge
									key={cat}
									variant="secondary"
									className="rounded-full px-2.5 py-1 text-[11px]"
								>
									{cat}
								</Badge>
							))}
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

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
	const hasActive = Object.values(filters).some((v) => v !== "");

	return (
		<Card className="rounded-[12px] border border-foreground/[0.07] bg-white p-4 shadow-[0_5px_10px_rgba(0,0,0,0.04)] sm:p-5 dark:bg-zinc-900 dark:border-white/10">
			<div className="mb-4 flex items-center gap-2">
				<div className="flex size-7 items-center justify-center rounded-[6px] bg-[var(--arc-ink)] text-[var(--arc-canvas)] dark:bg-white dark:text-black">
					<SlidersHorizontal className="size-3.5" />
				</div>
				<span
					className="font-mono text-[11px] font-bold uppercase tracking-[1.4px] text-[var(--arc-ink)] dark:text-white"
					style={{ fontFamily: "var(--font-mono)" }}
				>
					Filtros
				</span>
				{hasActive && (
					<span className="ml-1 size-1.5 rounded-full bg-[var(--arc-primary)]" />
				)}
				<div className="ml-auto">
					{hasActive && (
						<Button
							variant="ghost"
							size="xs"
							onClick={() =>
								onChange({
									venueSlug: "",
									category: "",
									dateFrom: "",
									dateTo: "",
									city: "",
								})
							}
							className="h-7 gap-1 rounded-full px-3 font-mono text-[11px] font-bold uppercase tracking-wide hover:bg-[var(--arc-surface-students)] dark:hover:bg-zinc-800"
						>
							<X className="size-3" />
							Limpar
						</Button>
					)}
				</div>
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
				<div className="flex flex-col gap-1.5">
					<span
						className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
						style={{ fontFamily: "var(--font-mono)" }}
					>
						Local
					</span>
					<NativeSelect
						value={filters.venueSlug}
						onChange={(e) => onChange({ venueSlug: e.target.value })}
						className="w-full"
						aria-label="Local"
					>
						<NativeSelectOption value="">Todos os locais</NativeSelectOption>
						{venues.map((v) => (
							<NativeSelectOption key={v.id} value={v.slug}>
								{v.name}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</div>

				<div className="flex flex-col gap-1.5">
					<span
						className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
						style={{ fontFamily: "var(--font-mono)" }}
					>
						Categoria
					</span>
					<NativeSelect
						value={filters.category}
						onChange={(e) => onChange({ category: e.target.value })}
						className="w-full"
						aria-label="Categoria"
					>
						<NativeSelectOption value="">
							Todas as categorias
						</NativeSelectOption>
						{categories.map((c) => (
							<NativeSelectOption key={c} value={c}>
								{c}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</div>

				<div className="flex flex-col gap-1.5">
					<span
						className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
						style={{ fontFamily: "var(--font-mono)" }}
					>
						Cidade
					</span>
					<NativeSelect
						value={filters.city}
						onChange={(e) => onChange({ city: e.target.value })}
						className="w-full"
						aria-label="Cidade"
					>
						<NativeSelectOption value="">Todas</NativeSelectOption>
						<NativeSelectOption value="Leiria">Leiria</NativeSelectOption>
						<NativeSelectOption value="Fora de Leiria">
							Fora de Leiria
						</NativeSelectOption>
					</NativeSelect>
				</div>

				<div className="flex flex-col gap-1.5">
					<span
						className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
						style={{ fontFamily: "var(--font-mono)" }}
					>
						De
					</span>
					<Input
						type="date"
						value={filters.dateFrom}
						onChange={(e) => onChange({ dateFrom: e.target.value })}
						className="h-8 rounded-[8px] border border-[var(--arc-ink)]/15 bg-[var(--arc-canvas)] text-sm dark:bg-zinc-900 dark:border-white/15"
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<span
						className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
						style={{ fontFamily: "var(--font-mono)" }}
					>
						Até
					</span>
					<Input
						type="date"
						value={filters.dateTo}
						onChange={(e) => onChange({ dateTo: e.target.value })}
						className="h-8 rounded-[8px] border border-[var(--arc-ink)]/15 bg-[var(--arc-canvas)] text-sm dark:bg-zinc-900 dark:border-white/15"
					/>
				</div>
			</div>
		</Card>
	);
}

function groupByDay(events: Event[]): [string, Event[]][] {
	const grouped = new Map<string, Event[]>();
	for (const event of events) {
		const key = dayKey(event.startAt);
		const bucket = grouped.get(key);
		if (bucket) bucket.push(event);
		else grouped.set(key, [event]);
	}
	return [...grouped.entries()];
}

function DayGroups({ groups }: { groups: [string, Event[]][] }) {
	if (groups.length === 0) {
		return (
			<Card className="flex flex-col items-center gap-3 rounded-[12px] border-dashed bg-white py-12 text-center dark:bg-zinc-900">
				<div className="flex size-10 items-center justify-center rounded-full bg-[var(--arc-surface-students)] dark:bg-zinc-800">
					<SearchX className="size-5 text-[var(--arc-ink-muted)] dark:text-zinc-400" />
				</div>
				<p
					className="font-mono text-[11px] font-bold uppercase tracking-[1.4px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
					style={{ fontFamily: "var(--font-mono)" }}
				>
					Nenhum evento
				</p>
				<p className="max-w-sm text-sm leading-relaxed text-[var(--arc-ink-muted)] dark:text-zinc-400">
					Nenhum evento corresponde aos filtros. Tente limpar ou alargar o
					intervalo de datas.
				</p>
			</Card>
		);
	}
	return (
		<div className="space-y-10">
			{groups.map(([key, dayEvents]) => (
				<section key={key} className="space-y-4">
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2 rounded-full bg-[var(--arc-ink)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-canvas)] dark:bg-white dark:text-black">
							<CalendarDays className="size-3.5" />
							{dayFmt(dayEvents[0].startAt)}
						</div>
						<Separator className="flex-1 bg-foreground/10" />
						<span
							className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
							style={{ fontFamily: "var(--font-mono)" }}
						>
							{dayEvents.length} {dayEvents.length === 1 ? "evento" : "eventos"}
						</span>
					</div>
					<div className="space-y-3">
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
	const search = Route.useSearch();
	const byDay = useQuery(trpc.events.byDay.queryOptions());
	const stats = useQuery(trpc.events.stats.queryOptions());
	const venuesQuery = useQuery(trpc.events.venues.queryOptions());
	const undatedQuery = useQuery(trpc.events.undated.queryOptions());

	const [venueSlug, setVenueSlug] = useState("");
	const [category, setCategory] = useState("");
	const [dateFrom, setDateFrom] = useState(search.date ?? "");
	const [dateTo, setDateTo] = useState(search.date ?? "");
	const [city, setCity] = useState("");

	useEffect(() => {
		setDateFrom(search.date ?? "");
		setDateTo(search.date ?? "");
	}, [search.date]);

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
		<div className="min-h-[calc(100vh-64px)] bg-[var(--arc-canvas)] dark:bg-zinc-950">
			{/* Hero - Cream canvas, Marlin display, asymmetric CTA */}
			<div className="mx-auto max-w-[1280px] px-4 pt-10 pb-8 sm:px-8 sm:pt-14">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-[720px]">
						{/* Eyebrow-tag Arc mono */}
						<div className="mb-4 inline-flex items-center gap-2 rounded-[4px] bg-[var(--arc-ink)] px-3 py-1 dark:bg-white">
							<span className="size-1.5 rounded-full bg-[var(--arc-primary)]" />
							<span
								className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-canvas)] dark:text-black"
								style={{ fontFamily: "var(--font-mono)" }}
							>
								Agenda viva — Lisboa Time · Europe/Lisbon
							</span>
						</div>

						<h1
							className="font-bold leading-[0.93] tracking-[-1.82px] text-[var(--arc-ink)] dark:text-white"
							style={{
								fontFamily: "var(--font-display)",
								fontSize: "clamp(36px, 5vw, 45.51px)",
							}}
						>
							O que se
							<br />
							passa em Leiria.
						</h1>

						<p
							className="mt-4 max-w-[560px] text-[17px] leading-[1.5] text-[var(--arc-ink-students)] dark:text-zinc-300 sm:text-[20px]"
							style={{ fontFamily: "var(--font-dek)" }}
						>
							Um único sítio para concertos, teatro, exposições e encontros —
							recolhido diariamente dos palcos da cidade.
						</p>

						{stats.data && (
							<div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
								<div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-[0_5px_10px_rgba(0,0,0,0.04)] ring-1 ring-foreground/10 dark:bg-zinc-900 dark:ring-white/10">
									<span className="size-2 rounded-full bg-[var(--arc-primary)]" />
									<span
										className="font-mono text-xs font-bold uppercase tracking-[0.4px] text-[var(--arc-ink)] dark:text-white"
										style={{ fontFamily: "var(--font-mono)" }}
									>
										{stats.data.totalEvents} eventos
									</span>
									<span className="text-[var(--arc-ink-muted)] dark:text-zinc-400">
										·
									</span>
									<span
										className="font-mono text-xs font-medium text-[var(--arc-ink-muted)] dark:text-zinc-400"
										style={{ fontFamily: "var(--font-mono)" }}
									>
										{stats.data.totalVenues} locais
									</span>
								</div>
								<span
									className="hidden font-mono text-[11px] uppercase tracking-[1.2px] text-[var(--arc-ink-muted)] sm:inline dark:text-zinc-500"
									style={{ fontFamily: "var(--font-mono)" }}
								>
									Atualizado diariamente · 07:00
								</span>
							</div>
						)}
					</div>

					{/* Asymmetric CTA - Arc 76px tall would overflow hero, use 52px variant */}
					<div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
						<Link
							to="/calendario"
							search={{ y: undefined, m: undefined }}
							className="no-underline"
						>
							<Button
								variant="arc"
								className="w-full justify-between gap-4 rounded-[22px] bg-[var(--arc-ink)] px-6 py-6 text-[var(--arc-canvas)] hover:bg-[var(--arc-primary-dark)] dark:bg-white dark:text-black dark:hover:bg-zinc-200 sm:w-auto lg:w-[260px]"
							>
								<span
									className="text-left font-medium leading-tight"
									style={{ fontFamily: "var(--font-display)" }}
								>
									Ver calendário
								</span>
								<span className="flex size-9 items-center justify-center rounded-full bg-[var(--arc-canvas)] text-[var(--arc-ink)] transition-colors group-hover:bg-white dark:bg-black dark:text-white">
									<CalendarDays className="size-4" />
								</span>
							</Button>
						</Link>
						<a
							href="http://localhost:3301/events.ics"
							className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--arc-ink)] bg-transparent px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink)] transition-colors hover:bg-[var(--arc-ink)] hover:text-[var(--arc-canvas)] dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
						>
							Subscrever ICS
							<ArrowUpRight className="size-3.5" />
						</a>
					</div>
				</div>
			</div>

			{/* Blue voltage band - single per page, Arc press-quote-band */}
			<div className="w-full bg-[var(--arc-primary)] px-4 py-8 sm:px-8 sm:py-10 dark:bg-[var(--arc-primary)]">
				<div className="mx-auto flex max-w-[1280px] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
					<div className="max-w-[640px]">
						<p
							className="font-mono text-[11px] font-bold uppercase tracking-[1.8px] text-white/70"
							style={{ fontFamily: "var(--font-mono)" }}
						>
							Em destaque
						</p>
						<p
							className="mt-2 text-[28px] font-bold leading-[1.07] tracking-[-0.03em] text-white sm:text-[32px]"
							style={{ fontFamily: "var(--font-display)" }}
						>
							Uma cidade. Um calendário.
							<br />
							<span className="text-white/90">Sem ruído, só o essencial.</span>
						</p>
					</div>
					<div className="flex shrink-0 gap-6">
						<div className="text-left">
							<p
								className="font-display text-[36px] font-bold leading-none tracking-tight text-white"
								style={{ fontFamily: "var(--font-display)" }}
							>
								{stats.data?.totalEvents ?? "—"}
							</p>
							<p
								className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-white/70"
								style={{ fontFamily: "var(--font-mono)" }}
							>
								eventos ativos
							</p>
						</div>
						<div className="h-12 w-px bg-white/15" />
						<div className="text-left">
							<p
								className="font-display text-[36px] font-bold leading-none tracking-tight text-white"
								style={{ fontFamily: "var(--font-display)" }}
							>
								{stats.data?.totalVenues ?? "—"}
							</p>
							<p
								className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-white/70"
								style={{ fontFamily: "var(--font-mono)" }}
							>
								palcos & salas
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-8">
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

				<div className="mt-8">
					<DayGroups groups={groups} />
				</div>

				{undated.length > 0 && (
					<section className="mt-10 overflow-hidden rounded-[12px] bg-[var(--arc-surface-students)] p-6 ring-1 ring-foreground/5 sm:p-8 dark:bg-zinc-900 dark:ring-white/10">
						<div className="mb-5 flex items-end justify-between gap-4">
							<div>
								<div className="inline-flex items-center gap-2 rounded-full bg-[var(--arc-surface-students-grey)] px-3 py-1">
									<Sparkles className="size-3 text-[var(--arc-ink-students)]" />
									<span
										className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-students)] dark:text-zinc-300"
										style={{ fontFamily: "var(--font-mono)" }}
									>
										Sem data fixa
									</span>
								</div>
								<h2
									className="mt-3 text-[24px] font-bold leading-none tracking-tight text-[var(--arc-ink-students)] dark:text-white"
									style={{
										fontFamily: "var(--font-display)",
										letterSpacing: "-0.02em",
									}}
								>
									Anúncios & datas por confirmar
								</h2>
								<p
									className="mt-2 max-w-[560px] text-sm leading-relaxed text-[var(--arc-ink-students-soft)] dark:text-zinc-400"
									style={{ fontFamily: "var(--font-dek)" }}
								>
									Eventos sem data marcada — à espera de confirmação do local.
								</p>
							</div>
							<span
								className="hidden font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-students-soft)] sm:block dark:text-zinc-500"
								style={{ fontFamily: "var(--font-mono)" }}
							>
								{undated.length} {undated.length === 1 ? "registo" : "registos"}
							</span>
						</div>

						<div className="grid gap-3 sm:grid-cols-2">
							{undated.map((event) => (
								<div
									key={event.id}
									className="rounded-[10px] border border-foreground/10 bg-[var(--arc-canvas)] p-4 shadow-[0_5px_10px_rgba(0,0,0,0.04)] transition-colors hover:border-foreground/15 dark:bg-zinc-800 dark:border-white/10"
								>
									<div className="flex items-start justify-between gap-3">
										<h3
											className="line-clamp-2 min-w-0 text-[15px] font-semibold leading-tight text-[var(--arc-ink)] dark:text-white"
											style={{ fontFamily: "var(--font-display)" }}
										>
											{event.url ? (
												<a
													href={event.url}
													target="_blank"
													rel="noreferrer"
													className="inline-flex gap-1 hover:text-[var(--arc-primary-deep)] hover:underline"
												>
													{event.title}
													<ArrowUpRight className="mt-0.5 size-3 shrink-0 opacity-40" />
												</a>
											) : (
												event.title
											)}
										</h3>
										{event.dateText && (
											<span className="shrink-0 rounded-full bg-[var(--arc-surface-students-grey)] px-2 py-1 font-mono text-[11px] font-medium text-[var(--arc-ink-students)] dark:bg-zinc-700 dark:text-zinc-300">
												{event.dateText}
											</span>
										)}
									</div>
									{event.venueName && (
										<p
											className="mt-2 flex items-center gap-1.5 font-mono text-xs text-[var(--arc-ink-students-soft)] dark:text-zinc-400"
											style={{ fontFamily: "var(--font-mono)" }}
										>
											<MapPin className="size-3" />
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

			{/* Footer - Arc cream continuity */}
			<footer className="border-t border-foreground/10 bg-[var(--arc-canvas)] px-4 py-10 sm:px-8 dark:bg-zinc-950 dark:border-white/10">
				<div className="mx-auto flex max-w-[1280px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<p
						className="font-mono text-[11px] uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-500"
						style={{ fontFamily: "var(--font-mono)" }}
					>
						Unreal Events · Leiria · Europe/Lisbon
					</p>
					<div className="flex gap-6 font-mono text-[11px] uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-500">
						<Link
							to="/calendario"
							search={{ y: undefined, m: undefined }}
							className="hover:text-[var(--arc-ink)] dark:hover:text-white"
						>
							Calendário
						</Link>
						<Link
							to="/admin"
							className="hover:text-[var(--arc-ink)] dark:hover:text-white"
						>
							Runs
						</Link>
						<a
							href="http://localhost:3301/events.ics"
							className="hover:text-[var(--arc-primary)]"
						>
							ICS
						</a>
					</div>
				</div>
			</footer>
		</div>
	);
}
