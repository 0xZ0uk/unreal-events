import { createContext } from "@events-tracker/api/context";
import { appRouter } from "@events-tracker/api/routers/index";
import { authRoutes, savedRoutes } from "@events-tracker/auth";
import { db } from "@events-tracker/db";
import { env } from "@events-tracker/env/server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { digestRoutes } from "./digest";

const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
	}),
);

app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext: () => createContext(db),
	}),
);

app.route("/", authRoutes);
app.route("/", savedRoutes);
app.route("/", digestRoutes);

app.get("/", (c) => {
	return c.text("OK");
});

export default app;
