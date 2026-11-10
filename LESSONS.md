# Lessons — hard-won rules

Each rule below cost a real debugging session. One line each; do not
"improve" any of them without re-testing on the device.

- Direct relative `assets/…` file URLs only — no blob URLs, no decoder pool, no host MessagePort handshake (the handshake is what made the original player black-screen).
- One visible `<video>` element, plus one hidden preloader that fetches the next clip; swap the visible src only when the preloader can play, and hold the last frame on a canvas in between (never a poster/still).
- Fresh link per build — never edit the same slug; devices cache artifacts by slug and an edited link can keep showing the old version.
- State saves on the care clip's `ended` event ONLY — never on press, never mid-clip — and must write to BOTH the server store and on-device localStorage; on load, whichever copy is newer wins and heals the other (server-only saving was proven to silently lose saves).
- State load/save must never block playback and must never log to the console; a failed or slow load (4 s timeout) falls back silently to the baked seed snapshot.
- Status panel and refill bar need explicit dark-mode colours (dark background, light text on every element) — a light panel with inherited text goes invisible on a dark-mode device.
- Care dock fully hidden while the Status panel is open or a care clip is running; the refill bar sits in the dock's bottom slot (bottom 8px), never stacked above it, or it covers half the character.
- 12 s post-interaction mood idle vs 4 s routine-to-routine buffer — a new interaction during the idle starts immediately and restarts a fresh 12 s idle, never returning to the interrupted activity and never playing its exit clip.
- Mood clip at most once per 4 completed episodes, never back-to-back; routine activities are the default the rest of the time.
- Gains: cake +25 Fullness, play +25 Engagement, exercise +20 Fitness, cap 100 — and the refill bar must land exactly on the target at clip end and hide 1 s after.
- 3-minute wall-clock routine episodes in fixed order, offset by the avatar key; reopening joins the current episode, the timer never restarts.
- Intention is the current episode's text only — never generated from needs, never resolved or cleared by a matching care action; it changes only at episode boundaries.
- Speech bubble: one overlay, 3.5 s, verbatim lines only, pointer-events none.
- Exit clips play only when interrupting a currently-running sustained set; interrupting from idle or the buffer starts the new action directly.
- Decay is linear from `updatedAtMs` (Fullness −100/24 h, Engagement −100/48 h, Fitness −100/72 h); a care gain rebases the state onto the current decayed values with `updatedAtMs = now`.
- Happy thank-you plays once per visit at score ≥ 95, earned by a care gain, before the 12 s idle — it is a per-visit flag, never persisted.
- First-run generating state: if `clipsReady` is false, boot into the creating animation looped with a persistent "Generating avatar…" bubble, Care hidden, no routine, no saving — never a broken or empty screen; the state ends when the deployer flips `clipsReady` to true and rebuilds, or when the runtime probe (sentinel clip `idle-content.webm`, every 30 s) finds the clip set can load.
- The build must work with only `avatar.jpg` and `idle-creating.webm` present — missing clips must never crash the page.
- Never describe what is on the device's screen from internal files — only the person holding the device can confirm playback, fit, and timing there.
- Audit in a pool (parallel workers, each with its own fresh browser session, picking checks off a shared queue); sequential only for genuinely timing-shared runs.

- v2 onboarding: ask the new owner for routine activities, food, game and exercise BEFORE generating anything, one question at a time, and get a yes on the filled-in list first — never generate from the package defaults without asking, and never ship anyone else's avatar, clips or state.
- v2 data-driven player: activity sets and care clips come from `companion.config.json` (`activities` + `care`), not hard-coded filenames. Care clips are generically named `feed.webm` / `play.webm` / `exercise.webm` (v1: `cake.webm` / `idle-play.webm` / `idle-stretch.webm`); a loop-only routine activity shares its loop clip with the Exercise care clip when it is the same movement.
- v2 custom exercise: if the owner picks a specific sport or activity, generate a few takes and let them pick by eye — the video tool takes a still + prompt only, no reference video, so motion drifts and only an approved take ships.
