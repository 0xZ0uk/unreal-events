import { Hono } from "hono";

import { auth } from "./auth";

/**
 * `/api/auth/*` as a Hono sub-app, shared by the Vercel function and the dev
 * server so both exercise the same handler. Everything better-auth exposes
 * (sign-up, sign-in, Google callback, session, sign-out) hangs off this prefix.
 */
export const authRoutes = new Hono().on(["GET", "POST"], "/api/auth/*", (c) =>
	auth.handler(c.req.raw),
);
