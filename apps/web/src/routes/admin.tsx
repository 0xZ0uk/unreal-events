import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Activity,
	AlertTriangle,
	ArrowUpRight,
	Calendar,
	CheckCircle2,
	Clock,
	Radio,
	Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@events-tracker/ui/components/badge";
import { Button } from "@events-tracker/ui/components/button";
import { Card, CardContent } from "@events-tracker/ui/components/card";
import { Separator } from "@events-tracker/ui/components/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@events-tracker/ui/components/table";
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

function StatCard({
	icon,
	label,
	value,
	sub,
	accent,
}: {
	icon: ReactNode;
	label: string;
	value: string;
	sub: string;
	accent?: "blue" | "ink" | "muted";
}) {
	return (
		<Card className="rounded-[10px] border border-foreground/10 bg-white p-0 shadow-[0_5px_10px_rgba(0,0,0,0.04)] dark:bg-zinc-900 dark:border-white/10">
			<CardContent className="flex items-center gap-4 p-5">
				<div
					className={
						accent === "blue"
							? "flex size-10 items-center justify-center rounded-[8px] bg-[var(--arc-primary)] text-white shadow-sm"
							: accent === "ink"
								? "flex size-10 items-center justify-center rounded-[8px] bg-[var(--arc-ink)] text-[var(--arc-canvas)] shadow-sm dark:bg-white dark:text-black"
								: "flex size-10 items-center justify-center rounded-[8px] bg-[var(--arc-surface-students)] text-[var(--arc-ink-students)] dark:bg-zinc-800 dark:text-zinc-300"
					}
				>
					{icon}
				</div>
				<div className="min-w-0">
					<p
						className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
						style={{ fontFamily: "var(--font-mono)" }}
					>
						{label}
					</p>
					<p
						className="font-display text-[28px] font-bold leading-none tracking-tight text-[var(--arc-ink)] tabular-nums dark:text-white"
						style={{
							fontFamily: "var(--font-display)",
							letterSpacing: "-0.02em",
						}}
					>
						{value}
					</p>
					<p
						className="font-mono text-[11px] text-[var(--arc-ink-students-soft)] dark:text-zinc-500"
						style={{ fontFamily: "var(--font-mono)" }}
					>
						{sub}
					</p>
				</div>
			</CardContent>
		</Card>
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
		<div className="min-h-[calc(100vh-64px)] bg-[var(--arc-canvas)] dark:bg-zinc-950">
			{/* Hero */}
			<div className="mx-auto max-w-[1280px] px-4 pt-8 pb-6 sm:px-8 sm:pt-10">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--arc-ink)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-canvas)] dark:bg-white dark:text-black">
							<Radio className="size-3.5" />
							Operação
						</div>
						<h1
							className="text-[40px] font-bold leading-[0.95] tracking-[-1.6px] text-[var(--arc-ink)] dark:text-white"
							style={{ fontFamily: "var(--font-display)" }}
						>
							Dashboard
							<span className="font-normal text-[var(--arc-ink-muted)] dark:text-zinc-400">
								{" "}
								de Scraping
							</span>
						</h1>
						<p
							className="mt-3 max-w-[560px] text-[17px] leading-[1.5] text-[var(--arc-ink-students)] dark:text-zinc-300"
							style={{ fontFamily: "var(--font-dek)" }}
						>
							Últimas execuções dos coletores — estado, volume e falhas.
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<Link
							to="/"
							search={{ date: undefined }}
							className="inline-flex items-center gap-1.5 rounded-full border border-[var(--arc-ink)]/15 bg-white px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink)] shadow-sm hover:bg-[var(--arc-ink)] hover:text-[var(--arc-canvas)] dark:border-white/15 dark:bg-zinc-900 dark:text-white dark:hover:bg-white dark:hover:text-black"
						>
							Ver agenda
							<ArrowUpRight className="size-3.5" />
						</Link>
						<a
							href="http://localhost:3301/events.ics"
							target="_blank"
							rel="noreferrer"
							className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[var(--arc-primary)] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-white shadow-sm hover:bg-[var(--arc-primary-deep)]"
						>
							ICS
							<ArrowUpRight className="size-3" />
						</a>
					</div>
				</div>
			</div>

			{/* Blue band - status */}
			<div className="w-full bg-[var(--arc-primary)] px-4 py-6 sm:px-8">
				<div className="mx-auto flex max-w-[1280px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-4">
						<div className="hidden size-10 items-center justify-center rounded-[10px] bg-white/15 sm:flex">
							<Activity className="size-5 text-white" />
						</div>
						<div>
							<p
								className="font-mono text-[11px] font-bold uppercase tracking-[1.4px] text-white/70"
								style={{ fontFamily: "var(--font-mono)" }}
							>
								Estado da recolha
							</p>
							<p
								className="text-[20px] font-bold leading-tight text-white"
								style={{ fontFamily: "var(--font-display)" }}
							>
								{withErrors === 0
									? "Tudo operacional"
									: `${withErrors} fontes com erro`}
								<span className="font-normal text-white/80">
									{" "}
									· {rows.length} runs recentes
								</span>
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Badge className="rounded-full bg-white px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--arc-primary)] hover:bg-white">
							<Clock className="size-3" />
							Cron 07:00 LISBOA
						</Badge>
						<Badge
							variant="outline"
							className="rounded-full border-white/30 bg-transparent px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide text-white hover:bg-white/10 hover:text-white"
						>
							Auto-diário
						</Badge>
					</div>
				</div>
			</div>

			{/* Stats - 4 cards Arc feature-card */}
			<div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8">
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard
						icon={<Activity className="size-5" />}
						label="Execuções"
						value={String(rows.length)}
						sub="últimas 50"
						accent="ink"
					/>
					<StatCard
						icon={<Calendar className="size-5" />}
						label="Encontrados"
						value={String(totalFound)}
						sub="total acumulado"
						accent="blue"
					/>
					<StatCard
						icon={<CheckCircle2 className="size-5" />}
						label="Novos"
						value={String(totalNew)}
						sub="desde último ciclo"
						accent="muted"
					/>
					<StatCard
						icon={
							<AlertTriangle
								className={`size-5 ${withErrors > 0 ? "text-[var(--arc-accent-red)]" : ""}`}
							/>
						}
						label="Com erros"
						value={String(withErrors)}
						sub={withErrors ? "requer atenção" : "sem falhas"}
						accent={withErrors ? "blue" : "muted"}
					/>
				</div>
			</div>

			{/* Table */}
			<div className="mx-auto max-w-[1280px] px-4 pb-10 sm:px-8">
				<Card className="overflow-hidden rounded-[12px] border border-foreground/10 bg-white p-0 shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:bg-zinc-900 dark:border-white/10">
					<div className="flex items-center justify-between border-b border-foreground/10 bg-[var(--arc-surface-students)]/30 px-5 py-4 dark:bg-zinc-800/30 dark:border-white/10">
						<div className="flex items-center gap-3">
							<div className="flex size-8 items-center justify-center rounded-[8px] bg-[var(--arc-ink)] text-[var(--arc-canvas)] dark:bg-white dark:text-black">
								<Sparkles className="size-4" />
							</div>
							<div>
								<p
									className="font-display text-[15px] font-bold leading-none tracking-tight text-[var(--arc-ink)] dark:text-white"
									style={{ fontFamily: "var(--font-display)" }}
								>
									Histórico de runs
								</p>
								<p
									className="font-mono text-[11px] uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
									style={{ fontFamily: "var(--font-mono)" }}
								>
									Mais recentes primeiro · Europe/Lisbon
								</p>
							</div>
						</div>
						<Badge variant="secondary" className="hidden sm:inline-flex">
							{rows.length} registos
						</Badge>
					</div>

					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow className="border-foreground/10 bg-transparent hover:bg-transparent dark:border-white/10">
									<TableHead
										className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
										style={{ fontFamily: "var(--font-mono)" }}
									>
										Hora (PT)
									</TableHead>
									<TableHead
										className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
										style={{ fontFamily: "var(--font-mono)" }}
									>
										Fonte
									</TableHead>
									<TableHead
										className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
										style={{ fontFamily: "var(--font-mono)" }}
									>
										Encontrados
									</TableHead>
									<TableHead
										className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
										style={{ fontFamily: "var(--font-mono)" }}
									>
										Novos
									</TableHead>
									<TableHead
										className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
										style={{ fontFamily: "var(--font-mono)" }}
									>
										Falhas
									</TableHead>
									<TableHead
										className="font-mono text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
										style={{ fontFamily: "var(--font-mono)" }}
									>
										Erro
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{runs.isLoading && (
									<TableRow>
										<TableCell
											colSpan={6}
											className="py-10 text-center font-mono text-xs uppercase tracking-wide text-[var(--arc-ink-muted)] dark:text-zinc-500"
										>
											A carregar execuções…
										</TableCell>
									</TableRow>
								)}
								{!runs.isLoading && rows.length === 0 && (
									<TableRow>
										<TableCell colSpan={6} className="py-10 text-center">
											<div className="flex flex-col items-center gap-2">
												<div className="flex size-10 items-center justify-center rounded-full bg-[var(--arc-surface-students)] dark:bg-zinc-800">
													<Radio className="size-5 text-[var(--arc-ink-muted)]" />
												</div>
												<p
													className="font-mono text-xs font-bold uppercase tracking-wide text-[var(--arc-ink-muted)] dark:text-zinc-400"
													style={{ fontFamily: "var(--font-mono)" }}
												>
													Sem execuções
												</p>
												<p className="text-sm text-[var(--arc-ink-muted)] dark:text-zinc-500">
													Ainda não há execuções registadas.
												</p>
											</div>
										</TableCell>
									</TableRow>
								)}
								{rows.map((r) => {
									const isBad =
										r.failed > 0 || (r.error != null && r.error !== "");
									return (
										<TableRow
											key={r.id}
											className={
												isBad
													? "bg-[var(--arc-students-pinkish)]/10 hover:bg-[var(--arc-students-pinkish)]/15 dark:bg-red-950/20"
													: "hover:bg-[var(--arc-surface-students)]/40 dark:hover:bg-zinc-800/40"
											}
										>
											<TableCell className="whitespace-nowrap font-mono text-xs tabular-nums text-[var(--arc-ink-students)] dark:text-zinc-300">
												<span className="inline-flex items-center gap-1.5">
													<span className="flex size-6 items-center justify-center rounded-full bg-[var(--arc-surface-students-grey)] dark:bg-zinc-800">
														<Clock className="size-3" />
													</span>
													{fmtLisbon(r.startedAt, true)}
												</span>
											</TableCell>
											<TableCell className="font-display text-sm font-semibold text-[var(--arc-ink)] dark:text-white">
												<Badge
													variant={isBad ? "destructive" : "secondary"}
													className="rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide"
												>
													{r.source}
												</Badge>
											</TableCell>
											<TableCell className="font-mono text-sm tabular-nums dark:text-zinc-300">
												{r.found}
											</TableCell>
											<TableCell
												className={`font-mono text-sm tabular-nums ${r.new > 0 ? "font-bold text-emerald-600 dark:text-emerald-400" : "text-[var(--arc-ink-muted)] dark:text-zinc-400"}`}
											>
												{r.new > 0 ? `+${r.new}` : r.new}
											</TableCell>
											<TableCell>
												<Badge
													variant={r.failed > 0 ? "destructive" : "outline"}
													className="rounded-full px-2.5 py-1 font-mono text-xs tabular-nums"
												>
													{r.failed}
												</Badge>
											</TableCell>
											<TableCell className="max-w-[260px]">
												{r.error ? (
													<span className="inline-block max-w-[260px] truncate rounded-[6px] bg-[var(--arc-students-pinkish)]/15 px-2 py-1 font-mono text-xs font-medium text-[var(--arc-accent-red)] ring-1 ring-[var(--arc-students-pinkish)]/20 dark:bg-red-900/30 dark:text-red-300">
														{r.error}
													</span>
												) : (
													<span className="font-mono text-xs text-[var(--arc-ink-students-soft)] dark:text-zinc-500">
														—
													</span>
												)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>

					<div className="flex items-center justify-between border-t border-foreground/10 bg-[var(--arc-surface-students)]/20 px-5 py-3 dark:border-white/10 dark:bg-zinc-800/20">
						<p
							className="font-mono text-[11px] uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-400"
							style={{ fontFamily: "var(--font-mono)" }}
						>
							Cron diário · 07:00 Europe/Lisbon
						</p>
						<p className="hidden font-mono text-[11px] text-[var(--arc-ink-students-soft)] sm:block dark:text-zinc-500">
							Reveja falhas — 0 encontrados ×2 dias = seletor partido.
						</p>
					</div>
				</Card>

				<div className="mt-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.6px] text-[var(--arc-ink-muted)] dark:text-zinc-500">
					<Separator className="flex-1 bg-foreground/10" />
					<span>Europe/Lisbon</span>
					<Separator className="flex-1 bg-foreground/10" />
				</div>
			</div>
		</div>
	);
}
