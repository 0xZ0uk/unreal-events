import { db, schema } from "@events-tracker/db";
import { eq } from "drizzle-orm";

const now = Math.floor(Date.now() / 1000);

const venue = await db.query.venues.findFirst({
	where: eq(schema.venues.slug, "teatro-jose-lucio-da-silva"),
});

if (!venue) {
	throw new Error("Seed venue not found — run db:seed first");
}

const fixtureSlug = `roundtrip-fixture-${now}`;

await db
	.insert(schema.events)
	.values({
		title: "Roundtrip Fixture Event",
		slug: fixtureSlug,
		description: "Inserted by roundtrip verification script",
		start_at: now,
		end_at: now + 3600,
		venue_id: venue.id,
		categories: ["fixture", "test"],
		fingerprint: `fixture:roundtrip:${now}`,
		created_at: now,
		updated_at: now,
	})
	.onConflictDoNothing({ target: schema.events.slug });

const row = await db
	.select({
		id: schema.events.id,
		title: schema.events.title,
		slug: schema.events.slug,
		start_at: schema.events.start_at,
		end_at: schema.events.end_at,
		categories: schema.events.categories,
		fingerprint: schema.events.fingerprint,
		created_at: schema.events.created_at,
		updated_at: schema.events.updated_at,
		venue_id: schema.events.venue_id,
		venue_name: schema.venues.name,
		venue_city: schema.venues.city,
	})
	.from(schema.events)
	.leftJoin(schema.venues, eq(schema.events.venue_id, schema.venues.id))
	.where(eq(schema.events.slug, fixtureSlug));

console.log("ROUNDTRIP_OK rows=" + row.length);
console.log(JSON.stringify(row[0] ?? null, null, 2));
