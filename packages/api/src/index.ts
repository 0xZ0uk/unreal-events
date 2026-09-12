import { initTRPC } from "@trpc/server";

import type { Context } from "./context";

export {
	KNOWN_LEIRIA_VENUES,
	type KnownVenue,
	knownVenueFor,
	titlePlaceCity,
} from "./known-venues";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;
