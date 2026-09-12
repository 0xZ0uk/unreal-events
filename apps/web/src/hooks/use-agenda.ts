import { normalizeEventTitle } from "@events-tracker/api/grouping";
import {
	activePreset,
	type PeriodPresetId,
	presetRange,
} from "@events-tracker/api/period";
import { municipalityOf } from "@events-tracker/api/places";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	api,
	type PublicEvent,
	type UndatedEvent,
	WINDOW_LIMIT,
} from "@/utils/api";
import {
	dayKey,
	dayMonth,
	lastRunLabel,
	shiftDayKey,
	startOfLisbonDay,
	weekday,
} from "@/utils/format";

/** How far ahead the page looks. Wide enough for every date the sources publish. */
const WINDOW_DAYS = 90;

export type AgendaRow = {
	id: number;
	slug: string;
	title: string;
	url: string | null;
	imageUrl: string | null;
	venueName: string | null;
	venueCity: string | null;
	venueSlug: string | null;
	categories: string[];
	startAt: number;
	endAt: number | null;
	sessionStarts: number[];
	/** Pre-normalised `title venue city categories`, so typing is a substring test. */
	haystack: string;
};

export type AnnouncementRow = {
	id: number;
	title: string;
	url: string | null;
	imageUrl: string | null;
	venueName: string | null;
	venueCity: string | null;
	categories: string[];
	dateText: string;
	haystack: string;
};

export type Facet = { value: string; label: string; count: number };

export type DayGroup = {
	key: string;
	label: string;
	date: string;
	events: AgendaRow[];
};

export type Filters = {
	q: string;
	city: string;
	category: string;
	venue: string;
	from: string;
	to: string;
};

export type AgendaStatus = "loading" | "error" | "ready";

const EMPTY_FILTERS: Filters = {
	q: "",
	city: "",
	category: "",
	venue: "",
	from: "",
	to: "",
};

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The five filters live in the query string, so a view is a URL you can send:
 *
 *   ?concelho=Óbidos&de=2026-09-18&ate=2026-09-20   — the weekend in Óbidos
 *   ?q=maria&tipo=Concertos                          — search + category
 *   ?local=sociedade-filarmonica                      — one venue
 *
 * `dia` is a day anchor, not a filter: it scrolls to that day and survives every
 * other change, so "here's the 20th" is one link.
 */
const URL_PARAM: Record<keyof Filters, string> = {
	q: "q",
	city: "concelho",
	category: "tipo",
	venue: "local",
	from: "de",
	to: "ate",
};

function readDayKey(raw: string | null): string {
	return raw && DAY_KEY.test(raw) ? raw : "";
}

function filtersFromSearch(search: string): { filters: Filters; dia: string } {
	const params = new URLSearchParams(search);
	const from = readDayKey(params.get(URL_PARAM.from));
	const to = readDayKey(params.get(URL_PARAM.to));
	return {
		filters: {
			q: params.get(URL_PARAM.q) ?? "",
			city: params.get(URL_PARAM.city) ?? "",
			category: params.get(URL_PARAM.category) ?? "",
			venue: params.get(URL_PARAM.venue) ?? "",
			// A backwards range is a typo, not a view: drop the bound instead of
			// showing an empty agenda that looks like "there is nothing on".
			from: to && from > to ? "" : from,
			to,
		},
		dia: readDayKey(params.get("dia")),
	};
}

function searchFromFilters(filters: Filters, dia: string): string {
	const params = new URLSearchParams();
	for (const key of Object.keys(URL_PARAM) as (keyof Filters)[]) {
		const value = filters[key];
		if (value) params.set(URL_PARAM[key], key === "q" ? value.trim() : value);
	}
	if (dia) params.set("dia", dia);
	const query = params.toString();
	return query ? `?${query}` : "";
}

function searchable(...parts: (string | null | undefined)[]): string {
	return normalizeEventTitle(
		parts.filter((part): part is string => Boolean(part)).join(" "),
	);
}

function toRow(event: PublicEvent): AgendaRow {
	const categories = event.categories ?? [];
	return {
		id: event.id,
		slug: event.slug,
		title: event.title,
		url: event.url,
		imageUrl: event.imageUrl,
		venueName: event.venueName,
		venueCity: event.venueCity,
		venueSlug: event.venueSlug,
		categories,
		startAt: event.startAt,
		endAt: event.endAt,
		sessionStarts: event.sessionStarts ?? [],
		haystack: searchable(
			event.title,
			event.venueName,
			event.venueCity,
			categories.join(" "),
		),
	};
}

function toAnnouncement(event: UndatedEvent): AnnouncementRow {
	const categories = event.categories ?? [];
	return {
		id: event.id,
		title: event.title,
		url: event.url,
		imageUrl: event.imageUrl,
		venueName: event.venueName,
		venueCity: event.venueCity,
		categories,
		dateText: event.dateText ?? "Data por marcar",
		haystack: searchable(
			event.title,
			event.venueName,
			event.venueCity,
			event.dateText,
			categories.join(" "),
		),
	};
}

/**
 * The concelho a row belongs to: its município when we can place the city,
 * otherwise the raw city value. Sources report the worked place where a
 * municipal agenda reports the concelho, so without this fold "Gaeiras" and
 * "Óbidos" were two concelhos and Leiria's events sat in ten of them.
 * An unplaceable city keeps its own name — never a guess, never hidden.
 */
function concelhoOf(city: string | null): string {
	return municipalityOf(city) ?? city ?? "";
}

function matches(row: AgendaRow, filters: Filters, needle: string): boolean {
	if (needle && !row.haystack.includes(needle)) return false;
	if (filters.city && concelhoOf(row.venueCity) !== filters.city) return false;
	if (filters.category && !row.categories.includes(filters.category))
		return false;
	if (filters.venue && row.venueSlug !== filters.venue) return false;
	// Range bounds are day keys, so an event on the `to` day is included whole.
	const key = dayKey(row.startAt);
	if (filters.from && key < filters.from) return false;
	if (filters.to && key > filters.to) return false;
	return true;
}

function groupByDay(
	rows: AgendaRow[],
	todayKey: string,
	tomorrowKey: string,
): DayGroup[] {
	const days = new Map<string, AgendaRow[]>();
	for (const row of rows) {
		const key = dayKey(row.startAt);
		const existing = days.get(key);
		if (existing) existing.push(row);
		else days.set(key, [row]);
	}

	const groups: DayGroup[] = [];
	for (const [key, events] of days) {
		const first = events[0];
		if (!first) continue;
		groups.push({
			key,
			label:
				key === todayKey
					? "Hoje"
					: key === tomorrowKey
						? "Amanhã"
						: weekday(first.startAt),
			date: dayMonth(first.startAt),
			events,
		});
	}
	return groups;
}

/** Tally facet values across every row — a multi-category event counts in each. */
function tally(
	rows: AgendaRow[],
	take: (row: AgendaRow) => { value: string; label: string }[],
): Facet[] {
	const counts = new Map<string, Facet>();
	for (const row of rows) {
		for (const item of take(row)) {
			const existing = counts.get(item.value);
			if (existing) existing.count += 1;
			else counts.set(item.value, { ...item, count: 1 });
		}
	}
	return [...counts.values()].sort(
		(a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt"),
	);
}

/**
 * The whole page model: one window query plus browser-side facets.
 *
 * Facets are applied over the loaded window — a couple of hundred rows — so
 * filtering is instant and the facet lists keep every option. Filtering on the
 * server would drop a facet's own options the moment you picked one.
 */
export function useAgenda() {
	const range = useMemo(() => {
		const from = startOfLisbonDay();
		const todayKey = dayKey(from);
		return {
			from,
			to: from + WINDOW_DAYS * 86_400,
			days: WINDOW_DAYS,
			todayKey,
			tomorrowKey: shiftDayKey(todayKey, 1),
		};
	}, []);

	const agendaQuery = useQuery(api.window.queryOptions(range.from, range.to));
	const undatedQuery = useQuery(api.undated.queryOptions());
	const statsQuery = useQuery(api.stats.queryOptions());

	// The URL is the initial state, not a mirror of it: a shared link opens on
	// exactly the view it was copied from.
	const initial = useMemo(
		() =>
			typeof window === "undefined"
				? { filters: EMPTY_FILTERS, dia: "" }
				: filtersFromSearch(window.location.search),
		[],
	);

	const [filters, setFilters] = useState<Filters>(initial.filters);
	const [dia, setDia] = useState<string>(initial.dia);

	// Setters work off the refs so two changes in one tick can't clobber each
	// other, and so every change writes the URL exactly once.
	const filtersRef = useRef(filters);
	const diaRef = useRef(dia);
	useEffect(() => {
		filtersRef.current = filters;
		diaRef.current = dia;
	}, [filters, dia]);

	const syncUrl = useCallback(
		(next: Filters, nextDia: string, mode: "push" | "replace") => {
			if (typeof window === "undefined") return;
			const url = `${window.location.pathname}${searchFromFilters(next, nextDia)}`;
			if (mode === "push") window.history.pushState(null, "", url);
			else window.history.replaceState(null, "", url);
		},
		[],
	);

	const applyFilters = useCallback(
		(patch: Partial<Filters>, mode: "push" | "replace" = "push") => {
			const next = { ...filtersRef.current, ...patch };
			filtersRef.current = next;
			setFilters(next);
			syncUrl(next, diaRef.current, mode);
		},
		[syncUrl],
	);

	// Back/forward walks the filter history instead of leaving the page.
	useEffect(() => {
		if (typeof window === "undefined") return;
		const onPopState = () => {
			const parsed = filtersFromSearch(window.location.search);
			filtersRef.current = parsed.filters;
			diaRef.current = parsed.dia;
			setFilters(parsed.filters);
			setDia(parsed.dia);
		};
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, []);

	const rows = useMemo(
		() => (agendaQuery.data ?? []).map(toRow),
		[agendaQuery.data],
	);
	const needle = useMemo(
		() => normalizeEventTitle(filters.q.trim()),
		[filters.q],
	);

	const hasFacet = Boolean(
		needle ||
			filters.city ||
			filters.category ||
			filters.venue ||
			filters.from ||
			filters.to,
	);
	const visible = useMemo(
		() =>
			hasFacet ? rows.filter((row) => matches(row, filters, needle)) : rows,
		[rows, hasFacet, filters, needle],
	);

	const groups = useMemo(
		() => groupByDay(visible, range.todayKey, range.tomorrowKey),
		[visible, range],
	);

	const available = useMemo(
		() => ({
			cities: tally(rows, (row) => {
				const concelho = concelhoOf(row.venueCity);
				return concelho ? [{ value: concelho, label: concelho }] : [];
			}),
			categories: tally(rows, (row) =>
				row.categories.map((category) => ({
					value: category,
					label: category,
				})),
			),
			venues: tally(rows, (row) =>
				row.venueSlug && row.venueName
					? [{ value: row.venueSlug, label: row.venueName }]
					: [],
			),
		}),
		[rows],
	);

	const announcements = useMemo(
		() => (undatedQuery.data ?? []).map(toAnnouncement),
		[undatedQuery.data],
	);

	/**
	 * `?dia=` scrolls once, after the day groups exist. Re-scrolling on every
	 * filter change would fight the reader, so each anchor fires once.
	 */
	const anchoredRef = useRef("");
	useEffect(() => {
		if (!dia || groups.length === 0 || anchoredRef.current === dia) return;
		const target = document.getElementById(`dia-${dia}`);
		if (!target) return;
		anchoredRef.current = dia;
		target.scrollIntoView({ block: "start" });
	}, [dia, groups]);

	const setFilter = useCallback(
		<K extends keyof Filters>(
			key: K,
			value: Filters[K],
			mode: "push" | "replace" = "push",
		) => {
			applyFilters(
				{ [key]: value } as Partial<Filters>,
				key === "q" ? "replace" : mode,
			);
		},
		[applyFilters],
	);

	const clearFilters = useCallback(
		() => applyFilters(EMPTY_FILTERS),
		[applyFilters],
	);

	/** A preset chip sets both bounds at once; passing null clears the range. */
	const setPeriod = useCallback(
		(id: PeriodPresetId | null) => {
			if (id === null) {
				applyFilters({ from: "", to: "" });
				return;
			}
			const preset = presetRange(id, range.todayKey);
			applyFilters({ from: preset.from, to: preset.to });
		},
		[applyFilters, range.todayKey],
	);

	const preset = useMemo(
		() => activePreset(filters.from, filters.to, range.todayKey),
		[filters.from, filters.to, range.todayKey],
	);

	const activeCount = useMemo(
		() => Object.values(filters).filter((value) => value !== "").length,
		[filters],
	);

	// Bounds come from the data, not from the window, so the pickers can never
	// offer a day the agenda has nothing on.
	const lastRow = rows[rows.length - 1];

	return {
		window: range,
		rows,
		visible,
		groups,
		facets: available,
		filters,
		setFilter,
		applyFilters,
		clearFilters,
		setPeriod,
		preset,
		activeCount,
		isFiltered: activeCount > 0,
		dia,
		rangeBounds: {
			min: range.todayKey,
			max: lastRow ? dayKey(lastRow.startAt) : range.todayKey,
		},
		announcements,
		lastRunLabel: statsQuery.data?.lastRunAt
			? lastRunLabel(statsQuery.data.lastRunAt)
			: null,
		lastRunAt: statsQuery.data?.lastRunAt ?? null,
		status: (agendaQuery.isPending
			? "loading"
			: agendaQuery.isError
				? "error"
				: "ready") as AgendaStatus,
		error: agendaQuery.error,
		refetch: agendaQuery.refetch,
		truncated: rows.length >= WINDOW_LIMIT,
	};
}

export type Agenda = ReturnType<typeof useAgenda>;
