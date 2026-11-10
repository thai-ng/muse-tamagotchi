-- Companion state store (idempotent: safe to apply on a fresh space
-- whose own initial migration may not have an `entries` table).
CREATE TABLE IF NOT EXISTS companion_state (
  id INTEGER PRIMARY KEY,
  fullness REAL NOT NULL,
  engagement REAL NOT NULL,
  fitness REAL NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
