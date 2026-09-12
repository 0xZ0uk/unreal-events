import { LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MICRO } from "@/components/agenda/layout";
import { signOut, useSession } from "@/utils/auth-client";

/**
 * The account, top right of the page.
 *
 * Signed out it is a plain link to `/entrar`; signed in it is the initial and
 * a panel with the address and the way out. No popover dependency — one ref,
 * one outside-click listener, Escape to close.
 */
export function AccountMenu() {
	const { data, isPending } = useSession();
	const [open, setOpen] = useState(false);
	const wrapper = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;

		const onPointerDown = (event: PointerEvent) => {
			if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};

		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	// A quiet placeholder, so a signed-in reader never sees a flash of "Entrar"
	// while the session is being read.
	if (isPending) {
		return (
			<span
				aria-hidden="true"
				className="size-11 shrink-0 rounded-[4px] border border-border bg-card sm:size-10"
			/>
		);
	}

	const user = data?.user;

	if (!user) {
		return (
			<a
				href="/entrar"
				className="focus-ring inline-flex h-11 shrink-0 items-center rounded-[4px] border border-muted-foreground/60 bg-card px-3 font-medium text-[15px] hover:border-primary/60 hover:text-primary motion-safe:transition-colors sm:h-10"
			>
				Entrar
			</a>
		);
	}

	const initial = (user.name?.trim() || user.email).slice(0, 1).toUpperCase();

	return (
		<div ref={wrapper} className="relative">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				aria-expanded={open}
				aria-haspopup="menu"
				aria-label="A sua conta"
				className="focus-ring inline-flex h-11 shrink-0 items-center gap-2 rounded-[4px] border border-muted-foreground/60 bg-card pr-2.5 pl-1.5 hover:border-primary/60 motion-safe:transition-colors sm:h-10"
			>
				<span
					aria-hidden="true"
					className="grid size-7 shrink-0 place-items-center rounded-[2px] bg-primary font-mono font-semibold text-[12px] text-primary-foreground"
				>
					{initial}
				</span>
				<span className="hidden max-w-[14ch] truncate text-[14px] text-muted-foreground sm:inline">
					{user.name?.trim() || user.email}
				</span>
			</button>

			{open ? (
				<div
					role="menu"
					className="absolute right-0 z-30 mt-2 w-64 rounded-[4px] border border-border bg-card p-3 shadow-lg"
				>
					<p className={`${MICRO} text-muted-foreground`}>Sessão iniciada</p>
					<p className="mt-2 truncate text-[14px]">{user.email}</p>
					<button
						type="button"
						role="menuitem"
						onClick={() => {
							setOpen(false);
							void signOut();
						}}
						className="focus-ring mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[4px] border border-muted-foreground/60 text-[14px] hover:border-primary/60 hover:text-primary motion-safe:transition-colors"
					>
						<LogOut aria-hidden="true" strokeWidth={1.5} className="size-4" />
						Terminar sessão
					</button>
				</div>
			) : null}
		</div>
	);
}
