import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Venue — a physical location in Leiria where events happen.
 */
export const venues = sqliteTable(
  "venues",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    address: text("address"),
    lat: real("lat"),
    lng: real("lng"),
    city: text("city").notNull().default("Leiria"),
  },
  (table) => [uniqueIndex("venues_slug_unique").on(table.slug)],
);

/**
 * Event — a single calendar event held at one of the venues.
 */
export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    /** Epoch seconds (UTC). */
    start_at: integer("start_at").notNull(),
    /** Epoch seconds (UTC). Nullable for events without a known end. */
    end_at: integer("end_at"),
    venue_id: integer("venue_id").references(() => venues.id),
    image_url: text("image_url"),
    url: text("url"),
    /** JSON-encoded string array of category names. */
    categories: text("categories", { mode: "json" }).$type<string[]>(),
    /** Deduplication fingerprint (e.g. hash of source + source event id). */
    fingerprint: text("fingerprint").notNull().unique(),
    /** Epoch seconds (UTC). */
    created_at: integer("created_at").notNull().$defaultFn(() =>
      Math.floor(Date.now() / 1000),
    ),
    /** Epoch seconds (UTC), auto-updated on each write. */
    updated_at: integer("updated_at").notNull().$onUpdateFn(() =>
      Math.floor(Date.now() / 1000),
    ),
  },
  (table) => [
    uniqueIndex("events_slug_unique").on(table.slug),
    uniqueIndex("events_fingerprint_unique").on(table.fingerprint),
    index("events_start_at_idx").on(table.start_at),
    index("events_venue_id_idx").on(table.venue_id),
  ],
);

/**
 * EventSource — provenance record mapping an event to an upstream source;
 * used for deduplication and first-seen tracking.
 */
export const eventSources = sqliteTable(
  "event_sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    event_id: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    source_event_id: text("source_event_id"),
    source_url: text("source_url"),
    /** Epoch seconds (UTC) when this source first reported the event. */
    first_seen_at: integer("first_seen_at").notNull(),
  },
  (table) => [
    uniqueIndex("event_sources_event_id_source_unique").on(
      table.event_id,
      table.source,
    ),
    index("event_sources_source_source_event_id_idx").on(
      table.source,
      table.source_event_id,
    ),
  ],
);

/**
 * ScrapeRun — one execution of a source scrape.
 */
export const scrapeRuns = sqliteTable(
  "scrape_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source").notNull(),
    /** Epoch seconds (UTC). */
    started_at: integer("started_at").notNull(),
    /** Epoch seconds (UTC). */
    finished_at: integer("finished_at"),
    items_found: integer("items_found").notNull().default(0),
    items_new: integer("items_new").notNull().default(0),
    items_failed: integer("items_failed").notNull().default(0),
    error: text("error"),
  },
  (table) => [index("scrape_runs_source_started_at_idx").on(table.source, table.started_at)],
);