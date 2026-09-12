import { useEffect } from "react";

/**
 * Cookieless analytics, off unless configured.
 *
 * Both values are build-time env vars: without them the app ships no
 * third-party script at all, so local dev and any fork stay clean. Set
 * VITE_UMAMI_SRC (the script URL) and VITE_UMAMI_WEBSITE_ID (the site id) to
 * turn it on — self-hosted Umami, no cookies, so no consent banner.
 */
const SRC = import.meta.env.VITE_UMAMI_SRC;
const WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID;

declare global {
	interface Window {
		umami?: { track: (name?: string, data?: Record<string, unknown>) => void };
	}
}

export function Analytics() {
	useEffect(() => {
		if (!SRC || !WEBSITE_ID) return;
		if (document.querySelector("script[data-website-id]")) return;

		const script = document.createElement("script");
		script.defer = true;
		script.src = SRC;
		script.dataset.websiteId = WEBSITE_ID;
		document.head.append(script);
	}, []);

	return null;
}

/**
 * Fire-and-forget custom event — a no-op when analytics is not configured, so
 * call sites never need to check.
 */
export function track(name: string, data?: Record<string, unknown>) {
	window.umami?.track(name, data);
}
