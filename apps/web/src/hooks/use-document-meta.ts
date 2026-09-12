import { useEffect } from "react";

/**
 * Keeps `<title>` and the meta description in step with the route.
 *
 * The prerendered HTML already carries both for event pages, but a client-side
 * navigation never reloads the document, so without this the tab would still
 * read the previous event's title.
 */
export function useDocumentMeta(
	title: string,
	description?: string | null,
	noindex = false,
) {
	useEffect(() => {
		document.title = title;
		if (!description) return;
		const tag = document.querySelector('meta[name="description"]');
		if (tag) tag.setAttribute("content", description);
	}, [title, description]);

	// A dead slug serves the SPA shell with a 200, so `noindex` is the only
	// thing keeping thin, dataless URLs out of the index.
	useEffect(() => {
		if (!noindex) return;
		const tag = document.createElement("meta");
		tag.setAttribute("name", "robots");
		tag.setAttribute("content", "noindex");
		document.head.append(tag);
		return () => tag.remove();
	}, [noindex]);
}
