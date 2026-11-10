# Changelog

## v2 — 2026-11-10

- **Onboarding first:** new `ONBOARDING.md`. The recipient's Muse
  asks the new owner, one question at a time, for their
  companion's name + avatar picture, 5–7 routine (intention)
  activities, the food to feed it, the game to play, and the
  exercise — then fills in the config, gets a yes on the list,
  and generates the animations from those answers.
- **Data-driven player:** `src/client/src/player.ts` now builds
  activity sets and care clips from `companion.config.json`
  (`activities` + `care`) instead of hard-coded filenames.
  A loop-only activity (no start/exit) is generic now, not
  special-cased as "stretch".
- **Generic care clip names:** `feed.webm` / `play.webm` /
  `exercise.webm` (v1: `cake.webm` / `idle-play.webm` /
  `idle-stretch.webm`). Same roles, new names.
- `PROMPTS.md` §B is now templates with the owner's food /
  game / exercise / activity substituted in; the old table
  remains as the worked default example. `ASSETS.md` notes
  the manifest is generated from the config.
- Verified by static checks only (config consistency, clip
  manifest coverage, no sender avatar/state in the package),
  same as v1 — the first deploy from the package is still the
  real end-to-end test.

## v1 — 2026-11-06

- First reusable package: README, PROMPTS, config with
  placeholders, reusable src from gameplay-7-2, LESSONS,
  ASSETS. Fixed default routine (read/garden/draw/dance/
  stretch/daydream/nap), cake / ball / stretching care clips,
  first-run generating state.
