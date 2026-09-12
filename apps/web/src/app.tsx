import { QueryClientProvider } from "@tanstack/react-query";
import { Announcements } from "@/components/agenda/announcements";
import { PageFooter } from "@/components/agenda/footer";
import { SHELL } from "@/components/agenda/layout";
import { AgendaPage } from "@/components/agenda/page";
import { useAgenda } from "@/hooks/use-agenda";
import { queryClient } from "@/utils/api";

/** Sits inside the provider: `useAgenda` needs the query client above it. */
function AgendaShell() {
	const agenda = useAgenda();

	return (
		<div className="min-h-svh">
			<main className={SHELL}>
				<AgendaPage agenda={agenda} />
				<Announcements agenda={agenda} />
			</main>
			<div className={SHELL}>
				<PageFooter />
			</div>
		</div>
	);
}

export function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<AgendaShell />
		</QueryClientProvider>
	);
}
