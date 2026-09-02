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
		<Card className="rounded-[2px] border border-[var(--p443-hairline)] bg-[var(--p443-surface)] p-0">
			<CardContent className="flex items-center gap-4 p-5">
				<div
					className={
						accent === "blue"
							? "flex size-10 items-center justify-center rounded-[8px] bg-[var(--p443-primary)] text-[var(--p443-on-primary)] shadow-sm"
							: accent === "ink"
								? "flex size-10 items-center justify-center rounded-[8px] bg-[var(--p443-ink)] text-[var(--p443-canvas)] shadow-sm"
								: "flex size-10 items-center justify-center rounded-[8px] bg-[var(--p443-surface)] text-[var(--p443-ink-muted)]"
					}
				>
					{icon}
				</div>
				<div className="min-w-0">
					<p
						className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
						style={{ fontFamily: "var(--font-mono)" }}
					>
						{label}
					</p>
					<p
						className="font-bold font-display text-[28px] text-[var(--p443-ink)] tabular-nums leading-none tracking-tight"
						style={{
							fontFamily: "var(--font-display)",
							letterSpacing: "-0.02em",
						}}
					>
						{value}
					</p>
					<p
						className="font-mono text-[11px] text-[var(--p443-ink-muted)]"
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
		<div className="min-h-[calc(100vh-64px)] bg-[var(--p443-canvas)]">
			{/* Hero */}
			<div className="mx-auto max-w-[1280px] px-4 pt-8 pb-6 sm:px-8 sm:pt-10">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<div className="mb-3 inline-flex items-center gap-2 rounded-[2px] bg-[var(--p443-surface)] px-3 py-1 font-bold text-[11px] text-[var(--p443-canvas)] uppercase tracking-[0.6px]">
							<Radio className="size-3.5" />
							Operação
						</div>
						<h1
							className="font-bold text-[40px] text-[var(--p443-ink)] leading-[0.95] tracking-[-1.6px]"
							style={{ fontFamily: "var(--font-display)" }}
						>
							Dashboard
							<span className="font-normal text-[var(--p443-ink-muted)]">
								{" "}
								de Scraping
							</span>
						</h1>
						<p
							className="mt-3 max-w-[560px] text-[17px] text-[var(--p443-ink-muted)] leading-[1.5]"
							style={{ fontFamily: "var(--font-dek)" }}
						>
							Últimas execuções dos coletores — estado, volume e falhas.
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<Link
							to="/"
							search={{ date: undefined }}
							className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--p443-ink)]/15 bg-[var(--p443-surface)] px-4 py-2 font-bold font-mono text-[11px] text-[var(--p443-ink)] uppercase tracking-[0.6px] hover:border-[var(--p443-ink-muted)] hover:bg-[var(--p443-surface)]"
						>
							Ver agenda
							<ArrowUpRight className="size-3.5" />
						</Link>
						<a
							href="http://localhost:3301/events.ics"
							target="_blank"
							rel="noreferrer"
							className="hidden items-center gap-1.5 rounded-[2px] bg-[var(--p443-primary)] px-4 py-2 font-bold font-mono text-[11px] text-[var(--p443-on-primary)] uppercase tracking-[0.6px] hover:bg-[var(--p443-primary-hover)] sm:inline-flex"
						>
							ICS
							<ArrowUpRight className="size-3" />
						</a>
					</div>
				</div>
			</div>

			{/* Blue band - status */}
			<div className="w-full border-[var(--p443-hairline)] border-y bg-[var(--p443-surface)] px-4 py-6 sm:px-8">
				<div className="mx-auto flex max-w-[1280px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-4">
						<div className="hidden size-10 items-center justify-center rounded-[2px] bg-[var(--p443-hairline)] sm:flex">
							<Activity className="size-5 text-[var(--p443-on-primary)]" />
						</div>
						<div>
							<p
								className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[1.4px]"
								style={{ fontFamily: "var(--font-mono)" }}
							>
								Estado da recolha
							</p>
							<p
								className="font-bold text-[20px] text-[var(--p443-on-primary)] leading-tight"
								style={{ fontFamily: "var(--font-display)" }}
							>
								{withErrors === 0
									? "Tudo operacional"
									: `${withErrors} fontes com erro`}
								<span className="font-normal text-[var(--p443-on-primary)]/80">
									{" "}
									· {rows.length} runs recentes
								</span>
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Badge className="rounded-[2px] bg-[var(--p443-surface)] px-3 py-1.5 font-bold font-mono text-[11px] text-[var(--p443-primary)] uppercase tracking-wide hover:bg-[var(--p443-surface)]">
							<Clock className="size-3" />
							Cron 07:00 LISBOA
						</Badge>
						<Badge
							variant="outline"
							className="rounded-[4px] border-[var(--p443-hairline)] bg-transparent px-3 py-1.5 font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] text-[var(--p443-on-primary)] uppercase tracking-wide hover:bg-[var(--p443-hairline)] hover:text-[var(--p443-on-primary)]"
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
								className={`size-5 ${withErrors > 0 ? "text-[#d0342c]" : ""}`}
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
				<Card className="overflow-hidden rounded-[2px] border border-[var(--p443-hairline)] bg-[var(--p443-surface)] p-0">
					<div className="flex items-center justify-between border-[var(--p443-hairline)] border-b bg-[var(--p443-surface)]/30 px-5 py-4">
						<div className="flex items-center gap-3">
							<div className="flex size-8 items-center justify-center rounded-[8px] bg-[var(--p443-ink)] text-[var(--p443-canvas)]">
								<Sparkles className="size-4" />
							</div>
							<div>
								<p
									className="font-bold font-display text-[15px] text-[var(--p443-ink)] leading-none tracking-tight"
									style={{ fontFamily: "var(--font-display)" }}
								>
									Histórico de runs
								</p>
								<p
									className="font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
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
								<TableRow className="border-[var(--p443-hairline)] bg-transparent hover:bg-transparent">
									<TableHead
										className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
										style={{ fontFamily: "var(--font-mono)" }}
									>
										Hora (PT)
									</TableHead>
									<TableHead
										className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
										style={{ fontFamily: "var(--font-mono)" }}
									>
										Fonte
									</TableHead>
									<TableHead
										className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
										style={{ fontFamily: "var(--font-mono)" }}
									>
										Encontrados
									</TableHead>
									<TableHead
										className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
										style={{ fontFamily: "var(--font-mono)" }}
									>
										Novos
									</TableHead>
									<TableHead
										className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
										style={{ fontFamily: "var(--font-mono)" }}
									>
										Falhas
									</TableHead>
									<TableHead
										className="font-bold font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
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
											className="py-10 text-center font-mono text-[var(--p443-ink-muted)] text-xs uppercase tracking-wide"
										>
											A carregar execuções…
										</TableCell>
									</TableRow>
								)}
								{!runs.isLoading && rows.length === 0 && (
									<TableRow>
										<TableCell colSpan={6} className="py-10 text-center">
											<div className="flex flex-col items-center gap-2">
												<div className="flex size-10 items-center justify-center rounded-[2px] bg-[var(--p443-surface)]">
													<Radio className="size-5 text-[var(--p443-ink-muted)]" />
												</div>
												<p
													className="font-bold font-mono text-[var(--p443-ink-muted)] text-xs uppercase tracking-wide"
													style={{ fontFamily: "var(--font-mono)" }}
												>
													Sem execuções
												</p>
												<p className="text-[var(--p443-ink-muted)] text-sm">
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
													? "bg-[#d0342c]/10 hover:bg-[#d0342c]/15"
													: "hover:bg-[var(--p443-surface)]/40/40"
											}
										>
											<TableCell className="whitespace-nowrap font-mono text-[var(--p443-ink-muted)] text-xs tabular-nums">
												<span className="inline-flex items-center gap-1.5">
													<span className="flex size-6 items-center justify-center rounded-[2px] bg-[var(--p443-surface)]">
														<Clock className="size-3" />
													</span>
													{fmtLisbon(r.startedAt, true)}
												</span>
											</TableCell>
											<TableCell className="font-display font-semibold text-[var(--p443-ink)] text-sm">
												<Badge
													variant={isBad ? "destructive" : "secondary"}
													className="rounded-[2px] px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide"
												>
													{r.source}
												</Badge>
											</TableCell>
											<TableCell className="font-mono text-sm tabular-nums">
												{r.found}
											</TableCell>
											<TableCell
												className={`font-mono text-sm tabular-nums ${r.new > 0 ? "font-bold text-[var(--p443-primary)]" : "text-[var(--p443-ink-muted)]"}`}
											>
												{r.new > 0 ? `+${r.new}` : r.new}
											</TableCell>
											<TableCell>
												<Badge
													variant={r.failed > 0 ? "destructive" : "outline"}
													className="rounded-[2px] px-2.5 py-1 font-mono text-xs tabular-nums"
												>
													{r.failed}
												</Badge>
											</TableCell>
											<TableCell className="max-w-[260px]">
												{r.error ? (
													<span className="inline-block max-w-[260px] truncate rounded-[2px] bg-[#d0342c]/15 px-2 py-1 font-medium font-mono text-[#d0342c] text-xs ring-1 ring-[#d0342c]/20">
														{r.error}
													</span>
												) : (
													<span className="font-mono text-[var(--p443-ink-muted)] text-xs">
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

					<div className="flex items-center justify-between border-[var(--p443-hairline)] border-t bg-[var(--p443-surface)]/20 px-5 py-3">
						<p
							className="font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]"
							style={{ fontFamily: "var(--font-mono)" }}
						>
							Cron diário · 07:00 Europe/Lisbon
						</p>
						<p className="hidden font-mono text-[11px] text-[var(--p443-ink-muted)] sm:block">
							Reveja falhas — 0 encontrados ×2 dias = seletor partido.
						</p>
					</div>
				</Card>

				<div className="mt-6 flex items-center gap-2 font-mono text-[11px] text-[var(--p443-ink-muted)] uppercase tracking-[0.6px]">
					<Separator className="flex-1 bg-[var(--p443-hairline)]" />
					<span>Europe/Lisbon</span>
					<Separator className="flex-1 bg-[var(--p443-hairline)]" />
				</div>
			</div>
		</div>
	);
}
