import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { type FormEvent, useState } from "react";
import { BUTTON, FIELD, LABEL, MICRO, SHELL } from "@/components/agenda/layout";
import { Wordmark } from "@/components/agenda/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { signIn, signOut, signUp, useSession } from "@/utils/auth-client";

type Mode = "entrar" | "criar";

/**
 * better-auth answers in English and with codes; the page answers in Portuguese
 * and says what to do about it.
 */
const MESSAGES: Record<string, string> = {
	INVALID_EMAIL_OR_PASSWORD: "Email ou palavra-passe errados.",
	USER_ALREADY_EXISTS:
		"Já existe uma conta com este email. Entre em vez de a criar outra vez.",
	USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
		"Já existe uma conta com este email. Entre em vez de a criar outra vez.",
	PASSWORD_TOO_SHORT: "A palavra-passe tem de ter pelo menos 8 caracteres.",
	INVALID_EMAIL: "Esse email não parece válido.",
	FAILED_TO_CREATE_USER: "Não conseguimos criar a conta. Tente outra vez.",
};

function messageFor(error: unknown): string {
	const code = (error as { code?: string } | null)?.code;
	return (
		(code && MESSAGES[code]) ||
		"Não conseguimos completar o pedido. Tente outra vez."
	);
}

/** Where to land after signing in: only ever a path on this site. */
function nextPath(): string {
	const target = new URLSearchParams(window.location.search).get("redirect");
	if (!target?.startsWith("/") || target.startsWith("//")) return "/";
	return target;
}

/**
 * Google's own mark, in Google's own four colours.
 *
 * The one place on this site that is not amber: it is somebody else's brand and
 * people find it by colour, on a phone, in a hurry.
 */
function GoogleMark() {
	return (
		<svg
			viewBox="0 0 48 48"
			aria-hidden="true"
			focusable="false"
			className="size-[18px]"
		>
			<path
				fill="#EA4335"
				d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
			/>
			<path
				fill="#4285F4"
				d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"
			/>
			<path
				fill="#FBBC05"
				d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19Z"
			/>
			<path
				fill="#34A853"
				d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
			/>
		</svg>
	);
}

/** The half of the page that says you are already somebody here. */
function SignedIn({ email }: { email: string }) {
	return (
		<div className="mt-8 rounded-[4px] border border-border bg-card p-5">
			<p className={`${MICRO} text-muted-foreground`}>Sessão iniciada</p>
			<p className="mt-2 truncate text-[15px]">{email}</p>
			<div className="mt-4 flex flex-wrap gap-2">
				<a href="/" className={BUTTON}>
					Voltar à agenda
				</a>
				<button
					type="button"
					onClick={() => void signOut()}
					className="focus-ring inline-flex h-11 shrink-0 items-center rounded-[4px] border border-muted-foreground/60 bg-card px-4 font-medium text-[15px] hover:border-primary/60 hover:text-primary motion-safe:transition-colors sm:h-10"
				>
					Terminar sessão
				</button>
			</div>
		</div>
	);
}

/**
 * Sign in or sign up, on `/entrar`.
 *
 * A page rather than a modal, because it is a page on a phone: the back
 * gesture, the password manager and the Google consent screen all expect one.
 *
 * One form with a switch underneath, not two tabs above it: signing in and
 * creating an account ask for the same two fields, and the switch keeps the
 * amber fill for the button that actually does something.
 */
export function SignInPage() {
	useDocumentMeta(
		"Entrar — FindLeiria",
		"Entre com email e palavra-passe ou com a sua conta Google para guardar eventos em Leiria.",
	);

	const session = useSession();
	const [mode, setMode] = useState<Mode>("entrar");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [showPassword, setShowPassword] = useState(false);

	const creating = mode === "criar";

	async function withGoogle() {
		setError(null);
		setPending(true);
		const { error: failure } = await signIn.social({
			provider: "google",
			callbackURL: nextPath(),
		});
		if (failure) {
			setError(messageFor(failure));
			setPending(false);
		}
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setPending(true);

		const { error: failure } = creating
			? await signUp.email({ email, password, name: name.trim() || email })
			: await signIn.email({ email, password });

		if (failure) {
			setError(messageFor(failure));
			setPending(false);
			return;
		}

		window.location.assign(nextPath());
	}

	return (
		<div className="min-h-svh">
			<header className={`${SHELL} pt-6 sm:pt-10`}>
				<div className="flex items-center justify-between gap-4">
					<Wordmark />
					<ThemeToggle />
				</div>
			</header>

			<main className={`${SHELL} py-10 sm:py-16`}>
				<div className="max-w-md">
					<a
						href="/"
						className="focus-ring -my-3.5 inline-flex min-h-11 items-center gap-1.5 py-3.5 font-mono text-[12px] text-muted-foreground uppercase tracking-[0.14em] hover:text-foreground motion-safe:transition-colors"
					>
						<ArrowLeft
							aria-hidden="true"
							strokeWidth={1.5}
							className="size-3.5"
						/>
						Agenda
					</a>

					<h1 className="p443-display mt-6 text-balance">A sua conta</h1>
					<p className="p443-dek mt-4 text-pretty text-muted-foreground">
						Entra com a conta Google que já tem no telemóvel, ou com um email e
						uma palavra-passe. É o que basta para guardar eventos.
					</p>

					{session.data?.user ? (
						<SignedIn email={session.data.user.email} />
					) : (
						<div className="mt-8">
							{/* The provider button is the quiet one: amber is for the form's own
							    submit, so the page has one fill per way in. */}
							<button
								type="button"
								onClick={() => void withGoogle()}
								disabled={pending}
								className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-[4px] border border-muted-foreground/60 bg-card px-4 font-medium text-[15px] text-foreground hover:border-primary/60 hover:text-primary disabled:opacity-50 motion-safe:transition-colors sm:h-10"
							>
								<GoogleMark />
								Continuar com Google
							</button>

							<div className="mt-6 flex items-center gap-3">
								<span className="h-px flex-1 bg-border" />
								<span className={`${MICRO} text-muted-foreground`}>ou</span>
								<span className="h-px flex-1 bg-border" />
							</div>

							<form onSubmit={onSubmit} className="mt-6">
								{creating ? (
									<div>
										<label htmlFor="name" className={LABEL}>
											Nome
										</label>
										<input
											id="name"
											name="name"
											type="text"
											autoComplete="name"
											value={name}
											onChange={(event) => setName(event.target.value)}
											className={FIELD}
											placeholder="Como quer aparecer"
										/>
									</div>
								) : null}

								<div className={creating ? "mt-4" : undefined}>
									<label htmlFor="email" className={LABEL}>
										Email
									</label>
									<input
										id="email"
										name="email"
										type="email"
										required
										autoComplete="email"
										inputMode="email"
										autoCapitalize="none"
										spellCheck={false}
										value={email}
										onChange={(event) => setEmail(event.target.value)}
										className={FIELD}
										placeholder="nome@exemplo.pt"
									/>
								</div>

								<div className="mt-4">
									<label htmlFor="password" className={LABEL}>
										Palavra-passe
									</label>
									<div className="relative">
										<input
											id="password"
											name="password"
											type={showPassword ? "text" : "password"}
											required
											minLength={8}
											autoComplete={
												creating ? "new-password" : "current-password"
											}
											value={password}
											onChange={(event) => setPassword(event.target.value)}
											className={`${FIELD} pr-12`}
											placeholder="Pelo menos 8 caracteres"
										/>
										{/* Thumbs and passwords do not get on: let people read what they
										    typed instead of guessing at dots. */}
										<button
											type="button"
											onClick={() => setShowPassword((visible) => !visible)}
											aria-label={
												showPassword
													? "Ocultar palavra-passe"
													: "Mostrar palavra-passe"
											}
											aria-pressed={showPassword}
											className="focus-ring absolute top-0 right-0 grid h-11 w-11 place-items-center text-muted-foreground hover:text-foreground motion-safe:transition-colors sm:h-10 sm:w-10"
										>
											{showPassword ? (
												<EyeOff
													aria-hidden="true"
													strokeWidth={1.5}
													className="size-4"
												/>
											) : (
												<Eye
													aria-hidden="true"
													strokeWidth={1.5}
													className="size-4"
												/>
											)}
										</button>
									</div>
									{creating ? (
										<p className="mt-1.5 text-[13px] text-muted-foreground">
											Oito caracteres chegam. Guarde-a onde guarda as outras.
										</p>
									) : null}
								</div>

								{error ? (
									<p role="alert" className="mt-4 text-[14px] text-primary">
										{error}
									</p>
								) : null}

								<button
									type="submit"
									disabled={pending}
									className="focus-ring mt-6 inline-flex h-11 w-full items-center justify-center rounded-[4px] border border-primary bg-primary px-4 font-medium text-[15px] text-primary-foreground hover:bg-primary/90 disabled:opacity-50 motion-safe:transition-colors sm:h-10"
								>
									{pending
										? "Um momento…"
										: creating
											? "Criar conta"
											: "Entrar"}
								</button>
							</form>

							<p className="mt-3 text-[14px] text-muted-foreground">
								{creating ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
								<button
									type="button"
									onClick={() => {
										setMode(creating ? "entrar" : "criar");
										setError(null);
									}}
									className="focus-ring -my-2 inline-flex min-h-11 items-center py-2 align-middle font-medium text-primary underline underline-offset-4 hover:text-primary/80 motion-safe:transition-colors"
								>
									{creating ? "Entrar" : "Criar conta"}
								</button>
							</p>

							{creating ? (
								<p className="mt-4 text-pretty text-[13px] text-muted-foreground">
									Guardar eventos é o próximo passo — a conta fica pronta para
									quando chegar. Não enviamos email para já: entre com a mesma
									conta e está dentro.
								</p>
							) : null}
						</div>
					)}
				</div>
			</main>
		</div>
	);
}
