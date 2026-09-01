import { Button } from "@events-tracker/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@events-tracker/ui/components/dropdown-menu";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";

export function ModeToggle() {
	const { setTheme } = useTheme();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						size="icon"
						className="size-9 rounded-[4px] border-[var(--p443-hairline)] bg-transparent hover:border-[var(--p443-ink-muted)]"
					/>
				}
			>
				<Sun className="h-4 w-4" />
				<span className="sr-only">Mudar tema</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="rounded-[2px] border-[var(--p443-hairline)] bg-[var(--p443-surface)]"
			>
				<DropdownMenuItem
					onClick={() => setTheme("dark")}
					className="font-[var(--p443-font-body)] text-[var(--p443-ink)] focus:bg-[var(--p443-primary)]/10 focus:text-[var(--p443-primary)]"
				>
					<Moon className="size-4" /> Escuro
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => setTheme("light")}
					className="text-[var(--p443-ink)] focus:bg-[var(--p443-primary)]/10 focus:text-[var(--p443-primary)]"
				>
					<Sun className="size-4" /> Claro
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
