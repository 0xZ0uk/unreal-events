import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

/**
 * Resolve the local SQLite file reliably regardless of cwd.
 * packages/db/src -> ../../../local.db is the repo-root events-tracker/local.db.
 */
const dbUrl =
  process.env.DATABASE_URL ??
  `file:${new URL("../../../local.db", import.meta.url).pathname}`;

const client = createClient({ url: dbUrl });
const db = drizzle({ client, schema });

export const SEED_VENUES = [
  { name: "Teatro José Lúcio da Silva", slug: "teatro-jose-lucio-da-silva" },
  { name: "Teatro Miguel Franco", slug: "teatro-miguel-franco" },
  { name: "Mercado de Sant'Ana", slug: "mercado-de-santana" },
  { name: "Castelo de Leiria", slug: "castelo-de-leiria" },
  { name: "m|i|mo - museu da imagem em movimento", slug: "mi-mo-museu-da-imagem-em-movimento" },
  { name: "Biblioteca Municipal Afonso Lopes Vieira", slug: "biblioteca-municipal-afonso-lopes-vieira" },
  { name: "Ludoteca Municipal de Leiria", slug: "ludoteca-municipal-de-leiria" },
  { name: "Museu de Leiria", slug: "museu-de-leiria" },
  { name: "Jardim Luís de Camões", slug: "jardim-luis-de-camoes" },
  { name: "Parque do Avião", slug: "parque-do-aviao" },
] as const;

export async function seedVenues() {
  const inserted = await db
    .insert(schema.venues)
    .values(
      SEED_VENUES.map((v) => ({
        name: v.name,
        slug: v.slug,
        city: "Leiria",
      })),
    )
    .onConflictDoNothing({ target: schema.venues.slug });

  const count = await db.$count(schema.venues);
  return { rowsAffected: inserted.rowsAffected, totalVenues: count };
}

// CLI entry: `pnpm db:seed` or `bun run src/seed.ts`
if (import.meta.main) {
  const res = await seedVenues();
  console.log(
    `VENUES_SEEDED new=${res.rowsAffected} total=${res.totalVenues}`,
  );
}