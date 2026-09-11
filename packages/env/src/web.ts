import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	clientPrefix: "VITE_",
	client: {
		VITE_TURSO_URL: z.string().min(1),
		VITE_TURSO_AUTH_TOKEN: z.string().optional(),
	},
	runtimeEnv: (import.meta as any).env,
	emptyStringAsUndefined: true,
});
