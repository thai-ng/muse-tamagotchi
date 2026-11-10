# Muse Companion — reusable package (v2)

> **v2 (2026-11-10):** the package now starts with an onboarding
> interview. The recipient's Muse asks the new owner for their
> routine activities, food, game and exercise (`ONBOARDING.md`),
> then generates the animations from those answers. The player
> is data-driven: activities and care clips come from
> `companion.config.json` (`activities` + `care`), not from
> hard-coded filenames. Care clips are now generically named
> `feed.webm` / `play.webm` / `exercise.webm` (v1 used
> `cake.webm` / `idle-play.webm` / `idle-stretch.webm` — same
> roles, new names; rename old clips if you reuse them).

A complete, generic kit for deploying your own **Muse Companion**: a small
animated companion who lives in a 233×233 web view, does a quiet daily
routine, and lets you look after it (Feed / Play / Exercise) with needs
that decay over real time and persist between visits.

It is the packaged form of a build that was developed and tested
iteratively on a real device. Everything avatar-specific is a parameter
in `companion.config.json` — there is no hard-coded character, no
hard-coded state, and no reference to the original owner's avatar
anywhere in this package.

## What you get

| File | What it is |
|---|---|
| `ONBOARDING.md` | **Start here.** The interview the recipient's Muse follows: asks for routine activities, food, game and exercise, fills in the config, generates the clips from those answers, then builds. Give this file to Muse along with the package. |
| `companion.config.json` | The only file you must edit: name, avatar key, seed state, timings, gains, routine order, intentions, speech lines, plus the new `activities` and `care` sections (food / game / exercise). Placeholders everywhere a personal value belongs. |
| `src/` | The reusable source: React client (`client/src/player.ts` — the whole game, data-driven from the config, `App.tsx`, `theme.css`), server actions (`server/src/actions.ts`, `schema.ts`), the `companion_state` migration, and the asset-copy build step. |
| `ASSETS.md` | Manifest of every video clip you need, its purpose, length, and how to generate it. The list is generated from the config — custom activities change the filenames. |
| `PROMPTS.md` | Copy-paste prompts: the onboarding prompt (§A0), the build prompt for Muse (§A), video-generation prompt templates for every clip — custom food / game / exercise / activity (§B), and a customisation prompt (§C). |
| `LESSONS.md` | The hard-won rules, one line each. Read it before changing anything. |

## What you need

1. **A Muse account** (the artifact runs in your own Muse; each person
   deploys their own copy — there is no shared link and no public
   version, because the companion saves *your* state).
2. **One square avatar image** of your character (front-facing, full
   upper body visible, plain background if possible). It is the reference
   for every video clip.
3. **A device to view it on** — the stage is designed for a small square
   web view (233×233 DP / 466×466 px, e.g. a Coop device), but it also
   opens in any browser.
4. About an hour: most of it is waiting on video generation.

## Deploy, step by step

### Step 0 — Onboarding interview (the new owner's choices)

Give your Muse `ONBOARDING.md` plus this package. Your Muse
asks you, one question at a time: your companion's name + avatar
picture, the 5–7 routine activities it does, the food you feed
it, the game it plays, and the exercise it does — then fills in
`companion.config.json` from your answers and shows you the list
(name, activities in order, food, game, exercise) for a yes
before generating anything. Defaults exist for every question
if you say "surprise me". Skip to Step 1 only if you are filling
in the config yourself by hand.

### Step 1 — Fill in the config (5 minutes)

Open `companion.config.json` and replace every `YOUR_…` placeholder:

- `companionName` — your companion's name, e.g. `"Momo"`.
- `avatarKey` — any hex string, e.g. `"a1b2c3d4e5f60718"`. It only
  offsets the routine order, so any value works; keep it stable once
  chosen, or the routine order will shift.
- `seed` — starting needs (0–100). Leave at 100/100/100 and leave
  `updatedAtMs` at `0`, which means "now, at first deploy".
- `clipsReady` — leave `false` until your clips are generated (Step
  2). Set it to `true` once they are all ready. While it is `false`
  the companion boots into the first-run generating state instead of
  normal gameplay — see "First run" below.
- `gains`, `timings`, `decayMsPerPoint`, `moodEvery`, `happyThreshold`,
  `routineOrder`, `intentions`, `routineLines` — the defaults are the
  tested ones; change them only if you want different behaviour (see
  `PROMPTS.md` §C for what each does).

Nothing else in the package needs editing for a standard deploy.

### Step 2 — Generate the video clips (the long part)

You need **27 clips** (plus 6 optional ones). All are ~5–8 seconds,
square, of the same character from your avatar image. Use the prompts
in `PROMPTS.md` §B with any image-to-video generator, one clip at a
time, and save them with exactly the filenames in `ASSETS.md` into a
folder called `assets/`.

**Generate `idle-creating.webm` first.** It is the one clip the
first-run generating state needs, so make it before anything else —
that way you can build and open the companion immediately (Step 3)
and watch it "generate" while you make the rest.

- 3 mood idles: `idle-content.webm`, `idle-peckish.webm`,
  `idle-hungry.webm`
- 1 creating clip: `idle-creating.webm` (first-run state — generate
  this one first)
- 1 wave: `idle-wave.webm` (5 s)
- 1 happy: `idle-happy.webm`
- 3 care clips: `feed.webm` (your food), `play.webm` (your game), `exercise.webm` (your exercise)
- 7 routine activities × start/loop/exit: `read`, `garden`, `draw`,
  `dance`, `stretch` (uses `exercise.webm` as its loop — no separate
  files, shared with the Exercise care clip), `daydream`, `nap`
  — or your own activities from the onboarding, same pattern
- 1 still: `avatar.jpg` (your avatar image itself)

Clips must be `.webm` (VP9). If your generator outputs `.mp4`, convert
with ffmpeg: `ffmpeg -i in.mp4 -c:v libvpx-vp9 -b:v 0 -crf 30 out.webm`.
Keep each clip under ~1 MB.

### Step 3 — Ask Muse to build it (5 minutes)

Give Muse the build prompt in `PROMPTS.md` §A (copy-paste it whole),
and attach this package folder — `companion.config.json`, the `src/`
folder, and your `assets/` folder. Muse creates a **fresh full-stack
artifact** (it needs the server side for saving state) and hands you a
card. Open it.

> **Fresh link per build.** If you ever change the companion, ask for a
> new build, never an edit of the same link — devices cache artifacts
> by link, and an edited link can keep showing the old version.
>
> The package does not include scaffold files (`package.json`,
> `tsconfig*.json`, `space.json`, the initial migration) — the artifact
> builder generates those when it scaffolds the fresh artifact.

### First run — while your avatar is being generated

If you open the companion before your clips are ready (`clipsReady`
is `false` in the config), you do **not** get a broken or empty
screen. Instead you see the first-run generating state: your avatar
loops its creating animation — drawing, crafting, building something
— with a speech bubble that says "Generating avatar…". The Care
button is hidden and taps do nothing; there is nothing to play or
save yet.

How it ends: once the rest of the clips are generated, set
`clipsReady` to `true` in `companion.config.json` and rebuild (a
fresh link, as always) — the companion boots straight into normal
gameplay. The player also checks on its own: every 30 seconds it
quietly tries loading the content mood idle (`assets/idle-content.webm`),
and if that clip can play, it leaves the generating state live with
no rebuild needed. Either way, the moment the clip set exists, the
generating state is gone for good — it only ever appears before the
first real boot.

### Step 4 — Test it (10 minutes)

1. It boots to a mood idle and starts the routine within seconds.
   (If `clipsReady` is still `false`, you see the creating animation
   and the "Generating avatar…" bubble instead — that is the
   first-run state working, not a failure.)
2. Tap the stage — it waves, then idles ~12 s before the routine resumes.
3. Tap **Care → Feed** — the cake clip plays, the refill bar rises in
   the Care button's spot, and when the clip ends Fullness is +25.
4. Open **Status** — meters, mood, score, and a "Now: …" line; the Care
   button is gone while it is open.
5. Close the artifact completely, reopen it — the bars are where you
   left them (minus a little real-time decay). If they reset to the
   seed, the save path is failing on your device: tell Muse, and check
   `LESSONS.md` — the dual-save section is the first suspect.
6. Leave it alone for a few minutes — activities should dominate and a
   mood clip should appear only once in a while, never twice in a row.

## How it works (short version)

- **Needs:** Fullness, Engagement, Fitness (0–100) decay in real time
  (−100 per 24 h / 48 h / 72 h) from the last save. Score =
  0.5·Fullness + 0.3·Engagement + 0.2·Fitness picks the mood idle
  (content ≥ 60, peckish ≥ 25, otherwise hungry).
- **Routine:** the day is cut into 3-minute wall-clock episodes in a
  fixed order (read → garden → draw → dance → stretch → daydream →
  nap), offset by your avatar key. Reopening joins the current episode;
  the timer never restarts. The "Now: …" line is just the current
  episode's text — it is never caused by, or resolved by, feeding or
  playing.
- **Care:** Feed (+25 Fullness), Play (+25 Engagement), Exercise (+20
  Fitness, capped at 100). The gain lands **only** when the care clip's
  `ended` event fires — never at the press, never mid-clip.
- **Saving:** every care gain writes to **two** places — the artifact's
  server store (`get_state` / `save_state`) and an on-device copy in
  localStorage. On open, whichever copy is newer wins, and the fresher
  one heals the other. Either channel alone surviving is enough.
- **First run:** while `clipsReady` is `false`, the companion boots
  into the generating state (creating animation looped, persistent
  "Generating avatar…" bubble, Care hidden, no routine or saving)
  instead of normal gameplay. See "First run" above.

## Customising

- Timings, gains, decay, mood cadence, routine order, intentions, and
  speech lines: edit `companion.config.json` (or use the prompt in
  `PROMPTS.md` §C) and rebuild.
- Colours: edit `src/client/src/theme.css` (panel, refill bar, pill,
  bubble). The panel and refill bar must stay explicitly dark with
  light text — see `LESSONS.md`.
- Exercise is whatever the owner chose in the onboarding
  (default: gentle stretching / light movement). To change it,
  generate a new `exercise.webm` and update `care.exercise` in
  the config — do not rename the routine activities after a sport.
  If the exercise is also a routine activity, its loop clip *is*
  `exercise.webm`: one clip, shared, never generated twice.

## What this package does NOT do

- It does not include any avatar, video, or state. You supply all media.
- It does not publish or share itself: full-stack artifacts have no
  public link. Each person deploys their own copy in their own Muse.
- It does not sync between your devices beyond the server store: the
  on-device copy is per device, the server copy is shared by the
  artifact wherever you open it.

## Troubleshooting

- **Black screen:** the player is waiting on a host handshake or a blob
  URL — this package has neither. Check the clip files actually copied
  into `client/assets/` with the exact filenames in `ASSETS.md`.
- **Bars reset on reopen:** the save path is failing. First check the
  on-device copy survives (reopen in the same browser/device); then
  check `get_state` returns the saved values. See `LESSONS.md`.
- **Status panel unreadable:** the panel/refill colours were changed
  away from explicit dark + light text. Restore them from `theme.css`.
- **Care button overlapping the refill bar:** the dock-hide logic in
  `player.ts` (`hideCareDockForRefill`) was removed or the refill bar
  was moved off `bottom: 8px`. Restore both.
- **JSON import error for `companion.config.json`:** the build must
  resolve a JSON import from `client/src/` and `server/src/` to the
  space root (Bun does this natively). If the builder's typecheck
  rejects it, inlining the config values into `player.ts` and
  `actions.ts` is the approved fallback — same values, same keys.
