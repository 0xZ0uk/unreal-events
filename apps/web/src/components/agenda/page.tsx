import type { Agenda } from "@/hooks/use-agenda";
import { AgendaList } from "./agenda-list";
import { FilterBar } from "./filter-bar";
import { Masthead } from "./masthead";

/**
 * The whole product: one page, no navigation. Masthead, filters, agenda.
 * Filters only appear once there is something to filter.
 */
export function AgendaPage({ agenda }: { agenda: Agenda }) {
	return (
		<>
			<Masthead agenda={agenda} />
			<section className="mt-14 sm:mt-20" aria-label="Agenda">
				{agenda.status === "ready" ? <FilterBar agenda={agenda} /> : null}
				<AgendaList agenda={agenda} />
			</section>
		</>
	);
}
