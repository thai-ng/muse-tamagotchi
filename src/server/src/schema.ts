// Drizzle schema for this space.
//
// Single-row store for the companion's persisted needs state. The row
// (id = 1) is seeded by the get_state action the first time the store
// is empty, from the seed values in companion.config.json;
// save_state upserts the same row on every care gain. No history is
// kept.

import { integer, real, sqliteTable } from "drizzle-orm/sqlite-core";

export const companionState = sqliteTable("companion_state", {
  id: integer("id").primaryKey(),
  fullness: real("fullness").notNull(),
  engagement: real("engagement").notNull(),
  fitness: real("fitness").notNull(),
  updatedAtMs: integer("updated_at_ms").notNull(),
});
