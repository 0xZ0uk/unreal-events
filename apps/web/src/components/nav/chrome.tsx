import { SHELL } from "@/components/agenda/layout";
import { Wordmark } from "@/components/agenda/wordmark";
import { AccountMenu } from "@/components/auth/account-menu";
import { BottomNav, TopNav } from "@/components/nav/nav-bar";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * The chrome every route wears: the wordmark row on top, plus the
 * device-appropriate navigation.
 *
 * Two shapes, one header. From `sm` up the routes sit inline in the middle of
 * the wordmark row. Below `sm` the same routes become a fixed tab bar at the
 * bottom, where a thumb can reach them, and the header keeps only the wordmark
 * and the theme toggle — so the brand stays on top on a phone exactly as it
 * does on a desktop. `AccountMenu` travels down with the routes, into the Conta
 * tab's sheet.
 *
 * Rendered once by the app shell rather than by each page, so the header does
 * not re-mount when the reader moves between the agenda, an event and their
 * saved list.
 */
export function AppChrome() {
	return (
		<>
			<header className={`${SHELL} pt-6 sm:pt-10`}>
				<div className="relative flex items-center justify-between gap-4">
					<Wordmark />
					<TopNav />
					<div className="flex items-center gap-2">
						<div className="hidden sm:block">
							<AccountMenu />
						</div>
						<ThemeToggle />
					</div>
				</div>
			</header>
			<BottomNav />
		</>
	);
}
