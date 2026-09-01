import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Activity,
	AlertTriangle,
	Calendar,
	CheckCircle2,
	Clock,
} from "lucide-react";
import type { ReactNode } from "react";

import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/admin")({
	component: AdminComponent,
});

type RunRow = {
	id: number;
	source: string;
	startedAt: number;
	finishedAt: number | null;
	found: number;
	new: number;
	failed: number;
	error: string | null;
};

const cellCls =
	"px-3 py-2 align-middle text-sm tabular-nums text-zinc-600 dark:text-zinc-300";
const thCls =
	"px-3 py-2 text-left font-medium text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

function fmtLisbon(t: number, withDate: boolean) {
	return new Intl.DateTimeFormat("pt-PT", {
		day: withDate ? "2-digit" : undefined,
		month: withDate ? "short" : undefined,
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Europe/Lisbon",
		hour12: false,
	}).format(new Date(t * 1000));
}

function statCard(icon: ReactNode, label: string, value: string) {
	return (
		<div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
			<span className="text-zinc-500 dark:text-zinc-400">{icon}</span>
			<div>
				<p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
				<p className="font-semibold text-lg text-zinc-900 tabular-nums dark:text-zinc-50">
					{value}
				</p>
			</div>
		</div>
	);
}

function AdminComponent() {
	const runs = useQuery(trpc.admin.runs.queryOptions({ limit: 50 }));

	const rows: RunRow[] = runs.data ?? [];

	const totalFound = rows.reduce((acc, r) => acc + r.found, 0);
	const totalNew = rows.reduce((acc, r) => acc + r.new, 0);
	const withErrors = rows.filter(
		(r) => r.failed > 0 || (r.error != null && r.error !== ""),
	).length;

	return (
		<div className="container mx-auto max-w-5xl px-4 py-6">
			<header className="mb-6">
				<h1 className="font-semibold text-2xl text-zinc-900 tracking-tight dark:text-zinc-50">
					Dashboard de Scraping
				</h1>
				<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
					Últimas execuções dos coletores de eventos
				</p>
			</header>

			<div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
				{statCard(
					<Activity className="h-4 w-4" />,
					"Execuções",
					String(rows.length),
				)}
				{statCard(
					<Calendar className="h-4 w-4" />,
					"Encontrados",
					String(totalFound),
				)}
				{statCard(
					<CheckCircle2 className="h-4 w-4" />,
					"Novos",
					String(totalNew),
				)}
				{statCard(
					<AlertTriangle
						className={`h-4 w-4 ${withErrors > 0 ? "text-red-500" : ""}`}
					/>,
					"Com erros",
					String(withErrors),
				)}
			</div>

			<div className="space-y-4">
				<nav className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-300">
					<span className="text-zinc-900 dark:text-zinc-50">Runs</span>
					<span className="text-zinc-400 dark:text-zinc-500">
						Histórico de scraping
					</span>
				</nav>
				<div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
					<table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
						<thead className="bg-zinc-50 dark:bg-zinc-900">
							<tr>
								<th className={thCls}>Hora (PT)</th>
								<th className={thCls}>Fonte</th>
								<th className={thCls}>Encontrados</th>
								<th className={thCls}>Novos</th>
								<th className={thCls}>Falhas</th>
								<th className={thCls}>Erro</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
							{runs.isLoading && (
								<tr>
									<td
										className={`${cellCls} text-zinc-400 dark:text-zinc-500`}
										colSpan={6}
									>
										A carregar execuções…
									</td>
								</tr>
							)}
							{!runs.isLoading && rows.length === 0 && (
								<tr>
									<td
										className={`${cellCls} text-zinc-400 dark:text-zinc-500`}
										colSpan={6}
									>
										Ainda não há execuções registadas.
									</td>
								</tr>
							)}
							{rows.map((r) => {
								const isBad =
									r.failed > 0 || (r.error != null && r.error !== "");
								return (
									<tr
										key={r.id}
										className={
											isBad ? "bg-red-50 dark:bg-red-950/40" : undefined
										}
									>
										<td className={cellCls}>
											<span className="inline-flex items-center gap-1.5">
												<Clock className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
												{fmtLisbon(r.startedAt, true)}
											</span>
										</td>
										<td
											className={`${cellCls} font-medium text-zinc-900 dark:text-zinc-50`}
										>
											{r.source}
										</td>
										<td className={cellCls}>{r.found}</td>
										<td
											className={`${cellCls} ${r.new > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}
										>
											{r.new}
										</td>
										<td className={cellCls}>
											<span
												className={`rounded-full px-2 py-0.5 text-xs ${
													r.failed > 0
														? "bg-red-100 font-medium text-red-700 dark:bg-red-900/60 dark:text-red-300"
														: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
												}`}
											>
												{r.failed}
											</span>
										</td>
										<td className={`${cellCls} max-w-52`}>
											{r.error ? (
												<span className="inline-block rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700 text-xs dark:bg-red-900/60 dark:text-red-300">
													{r.error}
												</span>
											) : (
												<span className="text-zinc-300 dark:text-zinc-600">
													—
												</span>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>

				<p className="text-xs text-zinc-400 dark:text-zinc-500">
					Frequência: corrida diária automática às 07:00 (cron). Reveja esta
					página para confirmar que os coletores correram sem falhas.
				</p>
			</div>
		</div>
	);
}
