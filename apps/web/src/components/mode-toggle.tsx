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
						className="size-9 rounded-full border-[var(--arc-ink)]/10 bg-transparent hover:border-[var(--arc-ink)]/20 hover:bg-[var(--arc-surface-students-grey)] dark:border-white/10 dark:hover:bg-zinc-800"
					/>
				}
			>
				<Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
				<Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
				<span className="sr-only">Toggle theme</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="rounded-[10px]">
				<DropdownMenuItem onClick={() => setTheme("light")}>
					Cream
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setTheme("dark")}>
					Ink
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setTheme("system")}>
					System
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
