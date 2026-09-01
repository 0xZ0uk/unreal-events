import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, MapPin } from "lucide-react";

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

function HomeComponent() {
	const days = useQuery(trpc.events.byDay.queryOptions());
	const stats = useQuery(trpc.events.stats.queryOptions());

	const events = days.data ?? [];
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
	const groups = [...grouped.entries()];

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

			{groups.length === 0 ? (
				<p className="text-sm text-zinc-500 dark:text-zinc-400">
					A carregar eventos…
				</p>
			) : (
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
			)}
		</div>
	);
}
