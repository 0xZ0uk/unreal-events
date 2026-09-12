import { lazy, Suspense, useMemo } from "react";
import { MICRO } from "@/components/agenda/layout";
import type { Agenda } from "@/hooks/use-agenda";
import { districtRoster, heatOpacity, isDistrictConcelho, peak, tallyConcelhos } from "@/utils/concelho";

/**
 * Leaflet is ~150 kB and only the map view needs it, so the chunk is fetched
 * with the view rather than with the agenda everybody lands on.
 */
const ConcelhoMap = lazy(() => import("./concelho-map"));

/**
 * The map reading of the agenda.
 *
 * A choropleth, not a heat map: every event here is already placed in a
 * concelho by its venue, so the honest unit is the concelho — a continuous
 * density field would invent a gradient between two towns, and the venues are
 * far too sparse for that (SLICE_14).
 *
 * The numbers beside it are the same tallies as real buttons: the map is the
 * fast read, the list is the accessible one, and neither is a second source of
 * truth.
 */
export function MapView({ agenda }: { agenda: Agenda }) {
	const tallies = useMemo(() => tallyConcelhos(agenda.mapRows), [agenda.mapRows]);
	const busiest = useMemo(() => peak(tallies), [tallies]);
	const counts = useMemo(
		() => new Map(tallies.filter((tally) => tally.mappable).map((t) => [t.name, t.count])),
		[tallies],
	);
	const drawable = districtRoster(tallies);
	const outside = tallies.filter((tally) => !tally.mappable);
	const selected = isDistrictConcelho(agenda.filters.city) ? agenda.filters.city : "";
	const placed = agenda.mapRows.length;

	/**
	 * One sentence, and it says which denominator it is using. With a concelho
	 * picked the interesting number is "of the district", because the map is
	 * still drawing the district.
	 */
	const status = !selected
		? `${placed} ${placed === 1 ? "evento" : "eventos"} em ${drawable.length} ${
				drawable.length === 1 ? "concelho" : "concelhos"
			}`
		: `${selected}: ${counts.get(selected) ?? 0} de ${placed}`;

	const toggle = (name: string) => {
		agenda.setFilter("city", selected === name ? "" : name);
	};

	return (
		<section aria-labelledby="mapa-heading" className="mt-6">
			<h2 id="mapa-heading" className="sr-only">
				Atividade por concelho
			</h2>

			<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
				<div className="min-w-0">
					<Suspense
						fallback={
							<div className="h-[58svh] min-h-[320px] w-full animate-pulse rounded-[4px] border border-border bg-card sm:h-[520px]" />
						}
					>
						<ConcelhoMap
							counts={counts}
							max={busiest}
							selected={selected}
							onSelect={toggle}
						/>
					</Suspense>

					<div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
						<p className="flex items-center gap-2">
							<span className={`${MICRO} text-muted-foreground`}>Menos</span>
							{[0, 0.25, 0.6, 1].map((step) => (
								<span
									key={step}
									aria-hidden="true"
									className="block size-3.5 rounded-[2px] bg-primary"
									style={{ opacity: heatOpacity(step * busiest, busiest) }}
								/>
							))}
							<span className={`${MICRO} text-muted-foreground`}>Mais</span>
						</p>
						<p className="font-mono text-[12px] text-muted-foreground tabular-nums">
							{status}
						</p>
					</div>

					<p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
						Cada evento conta no concelho do seu local. O mapa ignora o filtro de
						concelho — clicar num muda o filtro, e voltar a clicar liberta-o — para
						os concelhos vizinhos continuarem comparáveis.
					</p>
				</div>

				<div className="min-w-0">
					<h3 className={`${MICRO} text-muted-foreground`}>Focos</h3>
					<ol className="mt-3 flex flex-col gap-1">
						{drawable.map((tally) => {
							const isSelected = selected === tally.name;
							return (
								<li key={tally.name}>
									<button
										type="button"
										onClick={() => toggle(tally.name)}
										aria-pressed={isSelected}
										className={`group flex w-full items-baseline justify-between gap-3 rounded-[4px] border px-3 py-2 text-left focus-ring motion-safe:transition-colors ${
											isSelected
												? "border-primary bg-primary/10"
												: "border-transparent hover:border-border hover:bg-card"
										}`}
									>
										<span className="min-w-0">
											<span
												className={`block truncate font-display text-[15px] font-bold ${
													isSelected ? "text-primary" : "text-foreground"
												}`}
											>
												{tally.name}
											</span>
											<span
												aria-hidden="true"
												className="mt-1.5 block h-[3px] rounded-[1px] bg-primary motion-safe:transition-[width] motion-safe:duration-200"
												style={{
													width: `${busiest > 0 ? Math.max(2, (tally.count / busiest) * 100) : 0}%`,
													opacity: heatOpacity(tally.count, busiest),
												}}
											/>
										</span>
										<span className="font-mono text-[13px] text-muted-foreground tabular-nums">
											{tally.count}
										</span>
									</button>
								</li>
							);
						})}
					</ol>

					{outside.length > 0 ? (
						<div className="mt-5">
							<h3 className={`${MICRO} text-muted-foreground`}>Fora do mapa</h3>
							<ul className="mt-2">
								{outside.map((tally) => (
									<li
										key={tally.name}
										className="flex items-baseline justify-between gap-3 px-3 py-1 text-[14px] text-muted-foreground"
									>
										<span className="min-w-0 truncate">{tally.name}</span>
										<span className="font-mono text-[13px] tabular-nums">
											{tally.count}
										</span>
									</li>
								))}
							</ul>
							<p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
								Eventos cujo local não cai em nenhum concelho do distrito. Não são
								escondidos nem atribuídos a um concelho por adivinhação.
							</p>
						</div>
					) : null}
				</div>
			</div>
		</section>
	);
}
