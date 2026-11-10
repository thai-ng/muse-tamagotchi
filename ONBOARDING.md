# Muse Companion — onboarding for a new owner

**Give this file, plus the rest of this package, to your Muse.**
Your Muse follows it, asks you a few questions, generates the
animations from your answers, and serves the finished companion
back to you as an artifact. Nothing in this package belongs to
anyone else: no avatar, no video, no saved state is included —
everything personal comes from your answers below.

## What you're getting

A small animated companion who lives in a 233×233 square view,
does a quiet daily routine, and lets you look after it with three
buttons: **Feed / Play / Exercise**. Its needs (Fullness,
Engagement, Fitness) decay in real time and persist between
visits. The routine, the food, the game and the exercise are all
yours — that's what the questions below decide.

## Instructions for Muse (the recipient's Muse — follow in order)

### Step 0 — Before asking anything

1. Read `README.md`, `LESSONS.md` and `PROMPTS.md` in this
   package first. The rules in `LESSONS.md` are load-bearing —
   do not "improve" them.
2. Do **not** reuse anyone else's avatar, clips, or state. If
   this package arrived with example values in
   `companion.config.json`, treat them as examples only and
   replace every one with this user's answers.
3. Do **not** generate any video yet. Ask the questions first.

### Step 1 — Ask, one question at a time, in this order

Ask one question, wait for the answer, then ask the next. Do not
batch all five into one message, and do not guess an answer the
user hasn't given. If they answer "use the defaults" or "surprise
me" for any question, use the default listed for that question
and say so. If they give fewer activities than asked for, fill
the rest from the defaults — never leave a slot empty.

**Q1 — Name + avatar picture.**
"What's your companion's name, and can you share one square
picture of the character? Front-facing, upper body visible,
plain background if you can."
- The picture is the reference for every animation. No picture,
  no generation — ask again, don't proceed with a stand-in.
- Default name if they don't pick one: `Momo`.

**Q2 — Intention activities (the routine).**
"What should your companion spend its day doing? Give me 5–7
things — the quiet activities it does on its own, in rotation,
about 3 minutes each."
- Each activity must be one short phrase (2–4 words) that can
  be shown on screen, e.g. reading a book, watering a plant,
  doodling, dancing, daydreaming, napping, cooking, playing
  piano, stargazing.
- Steer away from anything that needs another character, text
  on screen, or a big scene change — the stage is one character
  on a plain background.
- One of the 5–7 may be a simple looping activity with no
  start/exit (e.g. stretching) — mark it `loopOnly` in the
  config. The rest each need a start, a loop and an exit clip.
- Default, if they don't pick: reading, gardening, drawing,
  dancing, stretching (loop-only), daydreaming, napping — in
  that order.
- For each activity, also ask (or draft and confirm): one
  "Now: …" intention line, e.g. "Finishing a little story"
  for reading. Keep it to a few words. Offer to draft these
  yourself from their activity list and let them correct you —
  don't make them write seven lines from scratch.

**Q3 — Food.**
"What do you want to feed your companion?"
- One specific food, e.g. cake, sushi, ramen, an apple, boba.
  The Feed button plays the companion eating exactly that.
- Default: cake.

**Q4 — Game.**
"What game do you want your companion to play with you?"
- One specific game/toy, e.g. playing ball, a VR game, building
  blocks, hide-and-seek, a board game. The Play button plays
  exactly that.
- Default: playing ball.

**Q5 — Exercise.**
"What exercise should your companion do?"
- One specific movement, e.g. stretching, yoga,
  dancing, jogging in place, skipping. The Exercise button
  plays exactly that, and it also doubles as that activity's
  routine loop if the user listed the same movement in Q2
  (share the clip — don't generate it twice).
- Default: gentle stretching.
- If the exercise is a sport or a specific activity (not generic
  stretching), say so plainly when you generate it: the clip
  must match the companion's art style and proportions, and the
  user judges it by eye.

### Step 2 — Fill in `companion.config.json`

From the answers, fill in exactly these fields (leave everything
else at its package defaults unless the user asks to change it):

- `companionName`, `avatarKey` (any hex string, keep it stable
  once chosen), `clipsReady: false` until the clips exist.
- `routineOrder`: the Q2 activities, in the user's order, as
  short ids (`read`, `garden`, `draw`, … — one word, lowercase,
  no spaces). Use the same ids everywhere below.
- `activities`: one entry per id, with `gerund` ("reading",
  "gardening", …) and `clips` — `start`/`loop`/`exit` as
  `assets/<id>-start.webm` etc., or `loopOnly: true` with a
  single `clips.loop` for the looping activity.
- `intentions`: one "Now: …" line per activity id, plus `quiet`.
- `routineLines`: per activity, a `checkIn` line (first episode
  of a visit) and a `start` line (later episodes). Draft them,
  show them to the user, and use their corrections.
- `care.feed`: `food` (Q3), `clip: assets/feed.webm`,
  `label: "eating <food>"`.
- `care.play`: `game` (Q4), `clip: assets/play.webm`,
  `label: "playing <game>"`.
- `care.exercise`: `activity` (Q5), `clip: assets/exercise.webm`,
  `label: "doing <exercise>"` (or "exercising" for stretching).
- If the exercise is also a routine activity, point that
  activity's `clips.loop` at `assets/exercise.webm` — one clip,
  shared, exactly as the package default does for stretching.

Show the user the filled-in list (name, activities in order,
food, game, exercise) and get a yes before generating. One
correction round is normal; don't generate on a list they
haven't confirmed.

### Step 3 — Generate the animations from their answers

Use `PROMPTS.md` §B. The master style block goes in **every**
prompt, with the same avatar picture attached as the character
reference, so the character stays the same across all clips.

- Generate `idle-creating.webm` first (the first-run clip), then
  the 3 mood idles, wave, happy, then the 3 care clips (food /
  game / exercise), then each routine activity's start/loop/exit.
- For each clip, substitute the user's own words into the clip
  line: "Eating <food>", "Playing <game>", "Doing <exercise>",
  "<activity> — start / loop / exit". The templates in
  `PROMPTS.md` §B show the exact wording; don't invent a
  different activity from the one they chose.
- Your video tool takes a still reference photo + a prompt only
  — no reference video. Motion comes from wording alone, so
  generate a few takes per clip where it matters (especially
  the exercise), show the user the takes, and let them pick.
  Only use a clip they've approved. If a take drifts in art
  style, proportions or character, regenerate it — don't ship it.
- All clips: square 466×466, `.webm` (VP9), ~5–8 s, under ~1 MB.
  Convert from mp4 with ffmpeg if needed (see `ASSETS.md`).
- The full set is 27 clips + the avatar still. The exact list
  for this user is: 1 creating + 3 mood idles + wave + happy +
  3 care clips + 3 clips per start/loop/exit activity (or 1 loop
  clip for the loop-only activity). Write that list out for the
  user before you start, so they can see the count.

### Step 4 — Build it and hand it over

Give Muse the build prompt in `PROMPTS.md` §A with the filled-in
`companion.config.json`, the `src/` folder, and the `assets/`
folder. Create a **fresh full-stack artifact** (it needs the
server side for saving state). Never edit an existing artifact
or slug — a fresh link per build.

Verify with the short check in `PROMPTS.md` §A (boot plays,
tap-to-wave, Feed plays the food clip with +25 Fullness landing
exactly on clip end, close/reopen keeps the saved value, Status
opens readable, no console errors), then hand the user the fresh
artifact card.

If the user opens it before all clips are ready, the first-run
generating state is the correct behaviour: the creating animation
loops with a "Generating avatar…" bubble, Care hidden, taps
ignored — not a failure. Flip `clipsReady` to `true` and rebuild
(a fresh link) once the set is complete.

### Step 5 — After delivery

- The user can change food, game, exercise, activities, timings
  or speech lines later with the customisation prompt in
  `PROMPTS.md` §C — always as a fresh build, never an edit of
  the same link.
- Don't keep the user's avatar picture or clips after the build
  unless they ask you to. Their companion, their files.
