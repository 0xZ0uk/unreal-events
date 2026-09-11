import { normalizeEventTitle } from "@events-tracker/api/grouping";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { api, type PublicEvent, type UndatedEvent, WINDOW_LIMIT } from "@/utils/api";
import { dayKey, dayMonth, lastRunLabel, shiftDayKey, startOfLisbonDay, weekday } from "@/utils/format";

/** How far ahead the page looks. Wide enough for every date the sources publish. */
const WINDOW_DAYS = 90;

export type AgendaRow = {
	id: number;
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

const EMPTY_FILTERS: Filters = { q: "", city: "", category: "", venue: "", from: "", to: "" };

function searchable(...parts: (string | null | undefined)[]): string {
	return normalizeEventTitle(parts.filter((part): part is string => Boolean(part)).join(" "));
}

function toRow(event: PublicEvent): AgendaRow {
	const categories = event.categories ?? [];
	return {
		id: event.id,
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
		haystack: searchable(event.title, event.venueName, event.venueCity, categories.join(" ")),
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
		haystack: searchable(event.title, event.venueName, event.venueCity, event.dateText, categories.join(" ")),
	};
}

function matches(row: AgendaRow, filters: Filters, needle: string): boolean {
	if (needle && !row.haystack.includes(needle)) return false;
	if (filters.city && row.venueCity !== filters.city) return false;
	if (filters.category && !row.categories.includes(filters.category)) return false;
	if (filters.venue && row.venueSlug !== filters.venue) return false;
	// Range bounds are day keys, so an event on the `to` day is included whole.
	const key = dayKey(row.startAt);
	if (filters.from && key < filters.from) return false;
	if (filters.to && key > filters.to) return false;
	return true;
}

function groupByDay(rows: AgendaRow[], todayKey: string, tomorrowKey: string): DayGroup[] {
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
			label: key === todayKey ? "Hoje" : key === tomorrowKey ? "Amanhã" : weekday(first.startAt),
			date: dayMonth(first.startAt),
			events,
		});
	}
	return groups;
}

/** Tally facet values across every row — a multi-category event counts in each. */
function tally(rows: AgendaRow[], take: (row: AgendaRow) => { value: string; label: string }[]): Facet[] {
	const counts = new Map<string, Facet>();
	for (const row of rows) {
		for (const item of take(row)) {
			const existing = counts.get(item.value);
			if (existing) existing.count += 1;
			else counts.set(item.value, { ...item, count: 1 });
		}
	}
	return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt"));
}

/**
 * The whole page model: one window query plus browser-side facets.
 *
 * Facets are applied over the loaded window — a couple of hundred rows — so
 * filtering is instant and the facet lists keep every option. Filtering on the
 * server would drop a facet's own options the moment you picked one.
 */
export function useAgenda() {
	const window = useMemo(() => {
		const from = startOfLisbonDay();
		const todayKey = dayKey(from);
		return { from, to: from + WINDOW_DAYS * 86_400, days: WINDOW_DAYS, todayKey, tomorrowKey: shiftDayKey(todayKey, 1) };
	}, []);

	const agendaQuery = useQuery(api.window.queryOptions(window.from, window.to));
	const undatedQuery = useQuery(api.undated.queryOptions());
	const statsQuery = useQuery(api.stats.queryOptions());

	const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

	const rows = useMemo(() => (agendaQuery.data ?? []).map(toRow), [agendaQuery.data]);
	const needle = useMemo(() => normalizeEventTitle(filters.q.trim()), [filters.q]);

	const hasFacet = Boolean(needle || filters.city || filters.category || filters.venue || filters.from || filters.to);
	const visible = useMemo(() => (hasFacet ? rows.filter((row) => matches(row, filters, needle)) : rows), [rows, hasFacet, filters, needle]);

	const groups = useMemo(() => groupByDay(visible, window.todayKey, window.tomorrowKey), [visible, window]);

	const available = useMemo(
		() => ({
			cities: tally(rows, (row) => (row.venueCity ? [{ value: row.venueCity, label: row.venueCity }] : [])),
			categories: tally(rows, (row) => row.categories.map((category) => ({ value: category, label: category }))),
			venues: tally(rows, (row) => (row.venueSlug && row.venueName ? [{ value: row.venueSlug, label: row.venueName }] : [])),
		}),
		[rows],
	);

	const announcements = useMemo(() => (undatedQuery.data ?? []).map(toAnnouncement), [undatedQuery.data]);

	const setFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
		setFilters((current) => ({ ...current, [key]: value }));
	}, []);

	const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

	const activeCount = useMemo(() => Object.values(filters).filter((value) => value !== "").length, [filters]);

	// Bounds come from the data, not from the window, so the pickers can never
	// offer a day the agenda has nothing on.
	const lastRow = rows[rows.length - 1];

	return {
		window,
		rows,
		visible,
		groups,
		facets: available,
		filters,
		setFilter,
		clearFilters,
		activeCount,
		isFiltered: activeCount > 0,
		rangeBounds: { min: window.todayKey, max: lastRow ? dayKey(lastRow.startAt) : window.todayKey },
		announcements,
		lastRunLabel: statsQuery.data?.lastRunAt ? lastRunLabel(statsQuery.data.lastRunAt) : null,
		lastRunAt: statsQuery.data?.lastRunAt ?? null,
		status: (agendaQuery.isPending ? "loading" : agendaQuery.isError ? "error" : "ready") as AgendaStatus,
		error: agendaQuery.error,
		refetch: agendaQuery.refetch,
		truncated: rows.length >= WINDOW_LIMIT,
	};
}

export type Agenda = ReturnType<typeof useAgenda>;
