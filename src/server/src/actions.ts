// Actions for the Muse Companion (generic package build).
//
// The companion's needs state (fullness / engagement / fitness /
// updatedAtMs) lives in a single row of the companion_state table.
// get_state reads it — seeding it from companion.config.json the
// first time the store is empty — and save_state is called by the page
// on every care gain (care clip ended) so the values persist across
// restarts and updates. The page treats both calls as fire-and-forget:
// playback never waits on them, and any failure leaves the page on its
// baked snapshot.

import { defineAction, z, type ActionsModule } from "@hatch/space-sdk";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
// @ts-ignore — JSON import; Bun resolves it at runtime.
import CONFIG from "../../companion.config.json";

// Seed from companion.config.json. Used once, to seed an empty store;
// never written over an existing row. An updatedAtMs of 0 in the
// config means "now, at first deploy".
const SEED_STATE = {
  fullness: CONFIG.seed.fullness,
  engagement: CONFIG.seed.engagement,
  fitness: CONFIG.seed.fitness,
  updatedAtMs: CONFIG.seed.updatedAtMs || Date.now(),
};

const stateShape = z.object({
  fullness: z.number().min(0).max(100),
  engagement: z.number().min(0).max(100),
  fitness: z.number().min(0).max(100),
  updatedAtMs: z.number().int().positive(),
});

const getStateResponse = z.object({ state: stateShape });
const saveStateResponse = z.object({ ok: z.literal(true) });

export const Actions = {
  get_state: defineAction({
    description:
      "Reads the companion's persisted needs state (fullness, engagement, fitness, updatedAtMs), seeding it from companion.config.json the first time the store is empty.",
    request: z.object({}),
    response: getStateResponse,
    handler: async (ctx): Promise<z.infer<typeof getStateResponse>> => {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.companionState)
        .where(eq(schema.companionState.id, 1))
        .limit(1);
      const row = rows[0];
      if (row) {
        return {
          state: {
            fullness: row.fullness,
            engagement: row.engagement,
            fitness: row.fitness,
            updatedAtMs: row.updatedAtMs,
          },
        };
      }
      await db.insert(schema.companionState).values({ id: 1, ...SEED_STATE });
      return { state: { ...SEED_STATE } };
    },
  }),

  save_state: defineAction({
    description:
      "Saves the companion's needs state after a care gain, with updatedAtMs set by the caller to the moment of the gain.",
    request: stateShape,
    response: saveStateResponse,
    handler: async (ctx, args): Promise<z.infer<typeof saveStateResponse>> => {
      const db = ctx.db<typeof schema>();
      const values = {
        fullness: args.fullness,
        engagement: args.engagement,
        fitness: args.fitness,
        updatedAtMs: args.updatedAtMs,
      };
      await db
        .insert(schema.companionState)
        .values({ id: 1, ...values })
        .onConflictDoUpdate({
          target: schema.companionState.id,
          set: values,
        });
      return { ok: true as const };
    },
  }),
} satisfies ActionsModule;
