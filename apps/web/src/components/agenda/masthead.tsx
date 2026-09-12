import type { Agenda } from "@/hooks/use-agenda";
import { MICRO } from "./layout";

function Stat({
	label,
	value,
	busy,
}: {
	label: string;
	value: string;
	busy: boolean;
}) {
	return (
		<div>
			<dt className={`${MICRO} text-muted-foreground`}>{label}</dt>
			<dd className="p443-card-title mt-2 tabular-nums">
				{busy ? "—" : value}
			</dd>
		</div>
	);
}

/**
 * Brand headline and three figures the page actually read — including the
 * real time of the last collection instead of a claim about the schedule.
 * The wordmark, account and top nav live in the shared app chrome above this,
 * so they stay on top on the agenda, saved and event routes alike.
 */
export function Masthead({ agenda }: { agenda: Agenda }) {
	const loading = agenda.status === "loading";

	return (
		<div className="mt-14 sm:mt-20">
			<h1 className="p443-display max-w-[24ch] text-balance">
				O que se passa em Leiria.
			</h1>
			<p className="p443-dek mt-6 max-w-[46ch] text-pretty text-muted-foreground">
				Concertos, teatro, exposições, festas e mercados do distrito, recolhidos
				das fontes originais todos os dias.
			</p>

			<dl
				className="mt-12 grid grid-cols-2 gap-x-8 gap-y-6 border-border border-t pt-6 sm:mt-16 sm:max-w-xl sm:grid-cols-3"
				aria-busy={loading}
			>
				<Stat
					label={`eventos nos próximos ${agenda.window.days} dias`}
					value={String(agenda.rows.length)}
					busy={loading}
				/>
				<Stat
					label="concelhos"
					value={String(agenda.facets.cities.length)}
					busy={loading}
				/>
				<Stat
					label="última recolha"
					value={agenda.lastRunLabel ?? "—"}
					busy={loading}
				/>
			</dl>
		</div>
	);
}
