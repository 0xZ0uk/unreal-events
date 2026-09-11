import { ChevronDown, Search, X } from "lucide-react";
import { useId, useState } from "react";
import type { Agenda, Facet } from "@/hooks/use-agenda";
import { BUTTON, FIELD, LABEL, MICRO } from "./layout";
import { EventCount } from "./states";

const CHEVRON = "pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground";

function FacetSelect({
	id,
	label,
	value,
	all,
	options,
	onChange,
}: {
	id: string;
	label: string;
	value: string;
	all: string;
	options: Facet[];
	onChange: (value: string) => void;
}) {
	return (
		<div className="min-w-0">
			<label htmlFor={id} className={LABEL}>
				{label}
			</label>
			<div className="relative">
				<select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={`${FIELD} appearance-none pr-9`}>
					<option value="">{all}</option>
					{options.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label} ({option.count})
						</option>
					))}
				</select>
				<ChevronDown aria-hidden="true" strokeWidth={1.5} className={CHEVRON} />
			</div>
		</div>
	);
}

function DateRange({
	id,
	label,
	value,
	min,
	max,
	onChange,
}: {
	id: string;
	label: string;
	value: string;
	min: string;
	max: string;
	onChange: (value: string) => void;
}) {
	return (
		<div className="min-w-0">
			<label htmlFor={id} className={LABEL}>
				{label}
			</label>
			<input id={id} type="date" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} className={FIELD} />
		</div>
	);
}

/**
 * Filters, always visible from `sm` up and folded behind one labelled button on
 * a phone. Facet options come from the loaded window and carry their counts, so
 * no option is a dead end and the pickers are the same list as the agenda.
 *
 * One grid holds the search and all five facets, so every control shares a
 * column edge at `lg` instead of the search floating over an unrelated row.
 */
export function FilterBar({ agenda }: { agenda: Agenda }) {
	const [open, setOpen] = useState(false);
	const id = useId();
	const { filters, facets, rangeBounds } = agenda;

	const searchId = `${id}-q`;
	const facetsId = `${id}-facets`;

	return (
		<section aria-labelledby={`${id}-heading`}>
			<h2 id={`${id}-heading`} className="sr-only">
				Filtros
			</h2>

			<div className="flex flex-wrap items-end gap-3">
				<div className="min-w-0 flex-1 sm:flex-none sm:basis-[calc((200%_-_12px)/3)] lg:basis-[calc((200%_-_60px)/7)]">
					<label htmlFor={searchId} className={LABEL}>
						Procurar
					</label>
					<div className="group relative">
						<Search
							aria-hidden="true"
							strokeWidth={1.5}
							className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground motion-safe:transition-[opacity,transform,filter] motion-safe:duration-150 ${
								filters.q ? "opacity-100" : "opacity-0 scale-75 blur-[2px] group-focus-within:opacity-100 group-focus-within:scale-100 group-focus-within:blur-0"
							}`}
						/>
						<input
							id={searchId}
							type="search"
							value={filters.q}
							onChange={(event) => agenda.setFilter("q", event.target.value)}
							placeholder="Nome, local ou tema"
							autoComplete="off"
							spellCheck={false}
							enterKeyHint="search"
							className={`${FIELD} pl-9`}
						/>
					</div>
				</div>

				<button
					type="button"
					onClick={() => setOpen((current) => !current)}
					aria-expanded={open}
					aria-controls={facetsId}
					className={`${BUTTON} sm:hidden`}
				>
					Filtros
					{agenda.activeCount > 0 ? <span className={`${MICRO} text-primary`}>{agenda.activeCount}</span> : null}
					<ChevronDown
						aria-hidden="true"
						strokeWidth={1.5}
						className={`size-4 motion-safe:transition-transform motion-safe:duration-150 ${open ? "rotate-180" : ""}`}
					/>
				</button>
			</div>

			<div
				id={facetsId}
				className={`mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7 ${open ? "" : "hidden sm:grid"}`}
			>
				<FacetSelect
					id={`${id}-city`}
					label="Concelho"
					all="Todos"
					value={filters.city}
					options={facets.cities}
					onChange={(value) => agenda.setFilter("city", value)}
				/>
				<FacetSelect
					id={`${id}-category`}
					label="Tipo"
					all="Todos"
					value={filters.category}
					options={facets.categories}
					onChange={(value) => agenda.setFilter("category", value)}
				/>
				<FacetSelect
					id={`${id}-venue`}
					label="Local"
					all="Todos"
					value={filters.venue}
					options={facets.venues}
					onChange={(value) => agenda.setFilter("venue", value)}
				/>
				<DateRange
					id={`${id}-from`}
					label="De"
					value={filters.from}
					min={rangeBounds.min}
					max={filters.to || rangeBounds.max}
					onChange={(value) => agenda.setFilter("from", value)}
				/>
				<DateRange
					id={`${id}-to`}
					label="Até"
					value={filters.to}
					min={filters.from || rangeBounds.min}
					max={rangeBounds.max}
					onChange={(value) => agenda.setFilter("to", value)}
				/>
			</div>

			<div className="mt-4 flex items-center justify-between gap-3">
				<p role="status" className="font-mono text-[12px] tabular-nums text-muted-foreground">
					<EventCount total={agenda.rows.length} shown={agenda.visible.length} days={agenda.window.days} />
				</p>
				{agenda.isFiltered ? (
					<button type="button" onClick={agenda.clearFilters} className={BUTTON}>
						<X aria-hidden="true" strokeWidth={1.5} className="size-4" />
						Limpar filtros
					</button>
				) : null}
			</div>
		</section>
	);
}
