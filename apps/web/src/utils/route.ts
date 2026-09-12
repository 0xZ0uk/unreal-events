/**
 * Client-side routing for the SPA: no router dependency, just a pathname →
 * route function and a slug → href helper. The agenda owns `/`, an event owns
 * `/evento/<slug>`, and everything else is a 404 rendered in-place.
 */

/** One of the two real routes, or a miss. */
export type Route =
	| { kind: "agenda" }
	| { kind: "event"; slug: string }
	| { kind: "notFound" };

/** Internal link to an event's page. */
export function eventHref(slug: string): string {
	return `/evento/${encodeURIComponent(slug)}`;
}

/**
 * Resolve a location pathname to a route.
 *
 * `/` is the agenda. `/evento/<slug>` (leading slash optional) is an event,
 * the trailing slash tolerated. A bare `/evento`, a nested `/evento/a/b`, an
 * unknown path, and a slug that fails to decode all land on `notFound`.
 */
export function pathnameToRoute(pathname: string): Route {
	if (pathname === "/") return { kind: "agenda" };

	const match = /^\/evento\/([^/]+)\/?$/.exec(pathname);
	if (match) {
		try {
			return { kind: "event", slug: decodeURIComponent(match[1] ?? "") };
		} catch {
			return { kind: "notFound" };
		}
	}

	return { kind: "notFound" };
}
