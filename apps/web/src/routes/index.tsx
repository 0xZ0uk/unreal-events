import { Badge } from "@events-tracker/ui/components/badge";
import { Button } from "@events-tracker/ui/components/button";
import { Card, CardContent } from "@events-tracker/ui/components/card";
import { Input } from "@events-tracker/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@events-tracker/ui/components/native-select";
import { Separator } from "@events-tracker/ui/components/separator";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowUpRight,
	CalendarDays,
	MapPin,
	SearchX,
	SlidersHorizontal,
	Sparkles,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
		<Card className="group gap-0 overflow-hidden rounded-[2px] border border-[var(--p443-hairline)] bg-[var(--p443-surface)] py-0 transition-colors hover:border-[var(--p443-ink-muted)]">
			<CardContent className="flex items-stretch gap-0 p-0">
				{/* Time rail - mono, muted */}
				<div className="flex w-[96px] shrink-0 flex-col items-center justify-center gap-1 border-[var(--p443-hairline)] border-r bg-[var(--p443-surface)]/60 px-3 py-4 text-center transition-colors group-hover:bg-[var(--p443-surface)] sm:w-[112px]">
					{multiDay ? (
						<>
							<span
								className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
								style={{ fontFamily: "var(--p443-font-mono)" }}
							>
								{dayKey(event.startAt)}
							</span>
							<span className="font-bold text-[11px] text-[var(--p443-ink-muted)]">
								→
							</span>
							<span
								className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
								style={{ fontFamily: "var(--p443-font-mono)" }}
							>
								{dayKey(event.endAt!)}
							</span>
							<span className="mt-1 rounded-[2px] border border-[var(--p443-hairline)] bg-[var(--p443-surface)] px-2 py-0.5 font-bold font-mono text-[10px] text-[var(--p443-ink-muted)] uppercase tracking-wide">
								vários dias
							</span>
						</>
					) : (
						<>
							<span
								className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[1.2px]"
								style={{ fontFamily: "var(--p443-font-mono)" }}
							>
								{timeLabel ? "HORÁRIO" : "—"}
							</span>
							<span
								className="font-bold font-display text-[22px] text-[var(--p443-ink)] tabular-nums leading-none tracking-tight"
								style={{
									fontFamily: "var(--p443-font-display)",
									letterSpacing: "-0.02em",
								}}
							>
								{timeLabel || "—"}
							</span>
							<span className="mt-0.5 size-1 rounded-full bg-[var(--p443-ink-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
						</>
					)}
				</div>

				{/* Main */}
				<div className="min-w-0 flex-1 px-4 py-4 sm:px-5">
					<div className="flex items-start justify-between gap-3">
						<h3
							className="line-clamp-2 font-semibold text-[17px] text-[var(--p443-ink)] leading-tight transition-colors group-hover:text-[var(--p443-ink-muted)]"
							style={{
								fontFamily: "var(--p443-font-display)",
								letterSpacing: "-0.02em",
							}}
						>
							{event.url ? (
								<a
									href={event.url}
									target="_blank"
									rel="noreferrer"
									className="inline-flex items-start gap-1.5 decoration-2 decoration-[var(--p443-ink-muted)] underline-offset-2 hover:underline"
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
							className="mt-1.5 flex items-center gap-1.5 font-medium font-mono text-[12px] text-[var(--p443-ink-muted)]"
							style={{ fontFamily: "var(--p443-font-mono)" }}
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
									className="rounded-[2px] px-2.5 py-1 text-[11px]"
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
		<Card className="rounded-[2px] border border-[var(--p443-hairline)] bg-[var(--p443-surface)] p-4 sm:p-5">
			<div className="mb-4 flex items-center gap-2">
				<div className="flex size-7 items-center justify-center rounded-[4px] border border-[var(--p443-hairline)] bg-[var(--p443-surface)] text-[var(--p443-ink-muted)]">
					<SlidersHorizontal className="size-3.5" />
				</div>
				<span
					className="font-bold font-mono text-[11px] text-[var(--p443-ink)] uppercase tracking-[1.4px]"
					style={{ fontFamily: "var(--p443-font-mono)" }}
				>
					Filtros
				</span>
				{hasActive && (
					<span className="ml-1 size-1.5 rounded-full bg-[var(--p443-ink-muted)]" />
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
							className="h-7 gap-1 rounded-[2px] px-3 font-bold font-mono text-[11px] uppercase tracking-wide hover:bg-[var(--p443-surface)]"
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
						className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
						style={{ fontFamily: "var(--p443-font-mono)" }}
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
						className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
						style={{ fontFamily: "var(--p443-font-mono)" }}
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
						className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
						style={{ fontFamily: "var(--p443-font-mono)" }}
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
						className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
						style={{ fontFamily: "var(--p443-font-mono)" }}
					>
						De
					</span>
					<Input
						type="date"
						value={filters.dateFrom}
						onChange={(e) => onChange({ dateFrom: e.target.value })}
						className="h-8 rounded-[4px] border border-[var(--p443-hairline)] bg-[var(--p443-canvas)] text-sm"
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<span
						className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
						style={{ fontFamily: "var(--p443-font-mono)" }}
					>
						Até
					</span>
					<Input
						type="date"
						value={filters.dateTo}
						onChange={(e) => onChange({ dateTo: e.target.value })}
						className="h-8 rounded-[4px] border border-[var(--p443-hairline)] bg-[var(--p443-canvas)] text-sm"
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
			<Card className="flex flex-col items-center gap-3 rounded-[2px] border-dashed bg-[var(--p443-surface)] py-12 text-center">
				<div className="flex size-10 items-center justify-center rounded-[4px] bg-[var(--p443-surface)]">
					<SearchX className="size-5 text-[var(--p443-ink-muted)]" />
				</div>
				<p
					className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[1.4px]"
					style={{ fontFamily: "var(--p443-font-mono)" }}
				>
					Nenhum evento
				</p>
				<p className="max-w-sm text-[var(--p443-ink-muted)] text-sm leading-relaxed">
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
						<div className="p443-eyebrow flex items-center gap-2 rounded-[2px] border border-[var(--p443-hairline)] bg-[var(--p443-surface)] px-3 py-1.5 text-[var(--p443-ink)]">
							<CalendarDays className="size-3.5" />
							{dayFmt(dayEvents[0].startAt)}
						</div>
						<Separator className="flex-1 bg-[var(--p443-hairline)]" />
						<span
							className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
							style={{ fontFamily: "var(--p443-font-mono)" }}
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
		<div className="min-h-[calc(100vh-64px)] bg-[var(--p443-canvas)]">
			{/* Hero - dark canvas, p443-display, single amber eyebrow dot */}
			<div className="mx-auto max-w-[1280px] px-4 pt-10 pb-8 sm:px-8 sm:pt-14">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-[720px]">
						{/* Eyebrow - muted with the ONE amber dot on this view */}
						<div className="mb-4 flex items-center gap-2">
							<span className="size-1.5 rounded-full bg-[var(--p443-primary)]" />
							<span
								className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
								style={{ fontFamily: "var(--p443-font-mono)" }}
							>
								Agenda viva — Lisboa Time · Europe/Lisbon
							</span>
						</div>

						<h1 className="p443-display text-[var(--p443-ink)]">
							O que se
							<br />
							passa em Leiria.
						</h1>

						<p
							className="p443-dek mt-4 max-w-[560px] text-[var(--p443-ink)]"
							style={{ fontFamily: "var(--p443-font-body)" }}
						>
							Um único sítio para concertos, teatro, exposições e encontros —
							recolhido diariamente dos palcos da cidade.
						</p>

						{stats.data && (
							<div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
								<div className="flex items-center gap-2 rounded-[2px] border border-[var(--p443-hairline)] bg-[var(--p443-surface)] px-3 py-1.5">
									<span className="size-2 rounded-full bg-[var(--p443-ink-muted)]" />
									<span
										className="font-bold font-mono text-[var(--p443-ink)] text-xs uppercase tracking-[0.4px]"
										style={{ fontFamily: "var(--p443-font-mono)" }}
									>
										{stats.data.totalEvents} eventos
									</span>
									<span className="text-[var(--p443-ink-muted)]">·</span>
									<span
										className="font-medium font-mono text-[var(--p443-ink-muted)] text-xs"
										style={{ fontFamily: "var(--p443-font-mono)" }}
									>
										{stats.data.totalVenues} locais
									</span>
								</div>
								<span
									className="hidden font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[1.2px] sm:inline"
									style={{ fontFamily: "var(--p443-font-mono)" }}
								>
									Atualizado diariamente · 07:00
								</span>
							</div>
						)}
					</div>

					{/* Asymmetric secondary CTA - surface, no amber */}
					<div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
						<Link
							to="/calendario"
							search={{ y: undefined, m: undefined }}
							className="no-underline"
						>
							<Button
								variant="secondary"
								size="cta"
								className="w-full justify-between gap-4 sm:w-auto lg:w-[260px]"
							>
								<span
									className="text-left font-medium leading-tight"
									style={{ fontFamily: "var(--p443-font-display)" }}
								>
									Ver calendário
								</span>
								<span className="flex size-9 items-center justify-center rounded-[4px] border border-[var(--p443-hairline)] bg-[var(--p443-surface)] text-[var(--p443-ink)]">
									<CalendarDays className="size-4" />
								</span>
							</Button>
						</Link>
						<a
							href="http://localhost:3301/events.ics"
							className="inline-flex items-center justify-center gap-2 rounded-[4px] border border-[var(--p443-hairline)] bg-transparent px-6 py-3 font-bold font-mono text-[11px] text-[var(--p443-ink)] uppercase tracking-[0.6px] transition-colors hover:border-[var(--p443-ink-muted)] hover:text-[var(--p443-ink-muted)]"
						>
							Subscrever ICS
							<ArrowUpRight className="size-3.5" />
						</a>
					</div>
				</div>
			</div>

			{/* Stats band - plain surface, no colour band */}
			<div className="w-full border-[var(--p443-hairline)] border-y bg-[var(--p443-surface)] px-4 py-8 sm:px-8 sm:py-10">
				<div className="mx-auto flex max-w-[1280px] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
					<div className="max-w-[640px]">
						<p
							className="p443-eyebrow"
							style={{ fontFamily: "var(--p443-font-body)" }}
						>
							Em destaque
						</p>
						<p
							className="p443-section-title mt-2 text-[var(--p443-ink)]"
							style={{ fontFamily: "var(--p443-font-display)" }}
						>
							Uma cidade. Um calendário.
							<br />
							<span className="text-[var(--p443-ink-muted)]">
								Sem ruído, só o essencial.
							</span>
						</p>
					</div>
					<div className="flex shrink-0 gap-6">
						<div className="text-left">
							<p
								className="font-bold font-display text-[36px] text-[var(--p443-ink)] leading-none tracking-tight"
								style={{ fontFamily: "var(--p443-font-display)" }}
							>
								{stats.data?.totalEvents ?? "—"}
							</p>
							<p
								className="p443-eyebrow"
								style={{ fontFamily: "var(--p443-font-body)" }}
							>
								eventos ativos
							</p>
						</div>
						<div className="h-12 w-px bg-[var(--p443-hairline)]" />
						<div className="text-left">
							<p
								className="font-bold font-display text-[36px] text-[var(--p443-ink)] leading-none tracking-tight"
								style={{ fontFamily: "var(--p443-font-display)" }}
							>
								{stats.data?.totalVenues ?? "—"}
							</p>
							<p
								className="p443-eyebrow"
								style={{ fontFamily: "var(--p443-font-body)" }}
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
					<section className="mt-10 overflow-hidden rounded-[2px] border border-[var(--p443-hairline)] bg-[var(--p443-surface)] p-6 sm:p-8">
						<div className="mb-5 flex items-end justify-between gap-4">
							<div>
								<div className="p443-eyebrow flex items-center gap-2 text-[var(--p443-ink)]">
									<Sparkles className="size-3 text-[var(--p443-ink-muted)]" />
									<span
										className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
										style={{ fontFamily: "var(--p443-font-mono)" }}
									>
										Sem data fixa
									</span>
								</div>
								<h2
									className="mt-3 font-bold text-[24px] text-[var(--p443-ink)] leading-none tracking-tight"
									style={{
										fontFamily: "var(--p443-font-display)",
										letterSpacing: "-0.02em",
									}}
								>
									Anúncios & datas por confirmar
								</h2>
								<p
									className="p443-dek mt-2 max-w-[560px] text-[var(--p443-ink-muted)]"
									style={{ fontFamily: "var(--p443-font-body)" }}
								>
									Eventos sem data marcada — à espera de confirmação do local.
								</p>
							</div>
							<span
								className="hidden font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px] sm:block"
								style={{ fontFamily: "var(--p443-font-mono)" }}
							>
								{undated.length} {undated.length === 1 ? "registo" : "registos"}
							</span>
						</div>

						<div className="grid gap-3 sm:grid-cols-2">
							{undated.map((event) => (
								<div
									key={event.id}
									className="rounded-[2px] border border-[var(--p443-hairline)] bg-[var(--p443-surface)] p-4 transition-colors hover:border-[var(--p443-ink-muted)]"
								>
									<div className="flex items-start justify-between gap-3">
										<h3
											className="line-clamp-2 min-w-0 font-semibold text-[15px] text-[var(--p443-ink)] leading-tight"
											style={{ fontFamily: "var(--p443-font-display)" }}
										>
											{event.url ? (
												<a
													href={event.url}
													target="_blank"
													rel="noreferrer"
													className="inline-flex gap-1 hover:text-[var(--p443-ink-muted)] hover:underline"
												>
													{event.title}
													<ArrowUpRight className="mt-0.5 size-3 shrink-0 opacity-40" />
												</a>
											) : (
												event.title
											)}
										</h3>
										{event.dateText && (
											<span className="shrink-0 rounded-[2px] border border-[var(--p443-hairline)] bg-[var(--p443-surface)] px-2 py-1 font-medium font-mono text-[11px] text-[var(--p443-ink-muted)]">
												{event.dateText}
											</span>
										)}
									</div>
									{event.venueName && (
										<p
											className="mt-2 flex items-center gap-1.5 font-mono text-[var(--p443-ink-muted)] text-xs"
											style={{ fontFamily: "var(--p443-font-mono)" }}
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

			{/* Footer - canvas continuity */}
			<footer className="border-[var(--p443-hairline)] border-t bg-[var(--p443-canvas)] px-4 py-10 sm:px-8">
				<div className="mx-auto flex max-w-[1280px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<p
						className="font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
						style={{ fontFamily: "var(--p443-font-mono)" }}
					>
						Unreal Events · Leiria · Europe/Lisbon
					</p>
					<div className="flex gap-6 font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]">
						<Link
							to="/calendario"
							search={{ y: undefined, m: undefined }}
							className="hover:text-[var(--p443-ink)]"
						>
							Calendário
						</Link>
						<Link to="/admin" className="hover:text-[var(--p443-ink)]">
							Runs
						</Link>
						<a
							href="http://localhost:3301/events.ics"
							className="hover:text-[var(--p443-ink)]"
						>
							ICS
						</a>
					</div>
				</div>
			</footer>
		</div>
	);
}
