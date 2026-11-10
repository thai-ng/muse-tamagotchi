# Prompts

Copy-paste prompts for deploying and customising the companion. Fill in
the bracketed parts; everything else is ready to send as-is.

---

## A0. Onboarding prompt — give this to Muse first

> I want my own Muse Companion. Use the attached package and
> follow `ONBOARDING.md` in it: ask me the questions in there,
> one at a time, in order — my companion's name and avatar
> picture, the routine activities, the food, the game, and the
> exercise — then fill in `companion.config.json` from my
> answers, show me the list for a yes, generate the animations
> from those answers, and build me the artifact. Don't generate
> anything before I've confirmed the list.

## A. Build prompt — give this to Muse

> Build me a Muse Companion artifact from the attached package.
>
> Create a FRESH full-stack web artifact (it needs the server side for
> saving state). Do not edit or reuse any existing artifact or slug.
>
> Files attached:
> - `companion.config.json` — my settings (name, avatar key, seed
>   state, timings, gains). Use it as-is.
> - `src/` — the reusable source. Copy `src/client/` to `client/`,
>   `src/server/` to `server/`, and `src/drizzle/` to `drizzle/`
>   (keep the `0002_companion_state_store.sql` migration). Copy
>   `companion.config.json` to the space root, so both
>   `client/src/player.ts` and `server/src/actions.ts` can import it
>   as `../../companion.config.json`.
> - `assets/` — my video clips and avatar image. Copy the whole folder
>   to `client/assets/` so the player's direct relative `assets/…`
>   URLs resolve. On the very first build this may be only
>   `avatar.jpg` and `idle-creating.webm`, with `clipsReady: false`
>   in the config — the companion then boots into the first-run
>   generating state (see README "First run") until the rest are
>   generated and `clipsReady` is flipped to `true`.
>
> Rules you must follow (these are load-bearing, from LESSONS.md in
> the package — do not "improve" them):
> - One visible `<video>` element, direct relative `assets/…` URLs.
>   No blob URLs, no decoder pool, no host MessagePort handshake, no
>   poster/fallback still. A hidden preloader element fetches the next
>   clip; swap the visible src only when it can play, and hold the
>   last frame on a canvas in between.
> - State saves on the care clip's `ended` event ONLY, to BOTH the
>   server store (`save_state`) and on-device localStorage, and loads
>   whichever copy is newer (healing the other). A failed or slow
>   load/save must never block playback or log to the console.
> - First-run generating state: read `clipsReady` from
>   `companion.config.json`. When it is `false`, boot into the
>   generating state — loop `assets/idle-creating.webm`, show the
>   persistent bubble "Generating avatar…", hide the Care dock, run
>   no routine and no state load, ignore taps. Check readiness with
>   a runtime probe of `assets/idle-content.webm` every 30 s (a
>   throwaway video element: `canplay` means ready) and exit the
>   state live when it loads, or when a rebuild flips `clipsReady`
>   to `true`. The build must work with only `avatar.jpg` and
>   `idle-creating.webm` present — missing clips must never crash
>   the page.
> - Status panel and refill bar: explicit dark background with light
>   text on every element. Care dock fully hidden while the Status
>   panel is open or a care clip is running; the refill bar sits in
>   the dock's bottom slot (bottom 8px), never stacked above it.
> - 12-second mood-idle buffer after any interaction, 4-second buffer
>   between routine episodes. A new interaction during the buffer
>   starts immediately and restarts a fresh 12 s idle.
> - Full mood clip at most once per 4 completed episodes, never
>   back-to-back. Routine activities are the default the rest of the
>   time.
> - Gains: cake +25 Fullness, play +25 Engagement, exercise +20
>   Fitness, capped at 100, only on clip `ended`.
> - 3-minute wall-clock routine episodes in the fixed order from the
>   config, offset by the avatar key. Intention is the current
>   episode's text only.
>
> When the build is done, verify with a short check (not a full
> audit): boot plays, tap-to-wave then ~12 s idle, Feed plays the
> cake clip with the refill bar landing exactly +25 on clip end,
> close/reopen keeps the saved value, Status opens with the dock
> hidden and readable dark text, no console errors. Then hand me the
> fresh artifact card.

---

## B. Video-generation prompts — one per clip

### How to use these

For **every** clip: attach the same avatar image as the character
reference and use the master style block at the top of your prompt,
then add the clip-specific line. Generate at square 466×466 (or the
closest square your generator offers — the player crops to fill).
Keep the character the same in every clip: same face, same outfit,
same proportions, same art style, same plain dark background. If a
clip comes back with a different-looking character, regenerate it —
do not ship it.

**Master style block (paste into every prompt):**

> Using the attached image as the exact character reference — same
> face, same outfit, same proportions, same art style, same plain
> dark background (#14101a). Square 466×466 video, smooth motion,
> no text, no watermark, no camera movement, character centred and
> fully in frame. [CLIP LINE]

**Clip lines (one per clip, ~5–8 s each):**

These lines are templates — substitute the owner's own words
from the onboarding. The worked example below uses the package
defaults (cake / ball / stretching / read-garden-draw-dance-
stretch-daydream-nap); for a custom owner, replace as follows
and keep the same filenames:

| Slot | Template clip line | File |
|---|---|---|
| Food | Eating <food>: the character holds <food> and eats it happily, eyes closed in enjoyment, a few bites. Plays once. | `feed.webm` |
| Game | Playing <game>: the character plays <game> — [one concrete motion, e.g. tosses a ball up, catches it, bounces it], laughing. Plays once. | `play.webm` |
| Exercise | <Exercise>: the character does <exercise> — [concrete motions, e.g. arms up, side bends, a slow twist], [relaxed / energetic as the activity is]. Plays once. Also loops as the routine activity if the same movement is in the routine. | `exercise.webm` |
| Activity start | Starting <activity>: the character [picks up / walks over to / sits down with what the activity needs], settling in. Plays once. | `<id>-start.webm` |
| Activity loop | Doing <activity>: the character [the core motion of the activity], absorbed. Must loop cleanly. | `<id>-loop.webm` |
| Activity exit | Finishing <activity>: the character [puts it down / steps back / holds it up] with a satisfied smile. Plays once. | `<id>-exit.webm` |

For the exercise especially, generate a few takes and let the
owner pick by eye — the video tool takes a still + prompt only,
no reference video, so motion comes from wording alone and
drifts. Only use a clip the owner approved.

**Generate `idle-creating.webm` first** — it is the only clip the
first-run generating state needs, so make it before the rest (see
README "First run").

| Clip file | Clip line |
|---|---|
| `idle-creating.webm` | Creating something: the character is happily making something — sketching on paper, shaping clay, or assembling a small craft — focused and pleased with its work, tools and materials visible. Generic making/creating, not any sport. Must loop cleanly. |
|---|---|
| `idle-content.webm` | Content idle: the character stands relaxed, soft happy expression, gentle breathing and a small contented sway, looking at the viewer. Must loop cleanly. |
| `idle-peckish.webm` | Peckish idle: the character looks a little hungry — glances around, rubs its belly once, hopeful expression. Must loop cleanly. |
| `idle-hungry.webm` | Hungry idle: the character is clearly hungry — drooping posture, hand on belly, big pleading eyes at the viewer. Must loop cleanly. |
| `idle-wave.webm` | Greeting wave: the character smiles brightly and waves hello at the viewer, one hand up, cheerful bounce. 5 seconds, plays once. |
| `idle-happy.webm` | Happy thank-you: the character beams, does a small joyful hop and clasps its hands, delighted. Plays once. |
| `feed.webm` | Eating cake: the character holds a small slice of cake and eats it happily, eyes closed in enjoyment, a few bites. Plays once. (Template: eating `<food>` — see above.) |
| `play.webm` | Playing ball: the character plays with a ball — tosses it up, catches it, bounces it, laughing. Plays once. (Template: playing `<game>` — see above.) |
| `exercise.webm` | Everyday exercise: the character does gentle stretching and light movement — arms up, side bends, a slow twist, shaking out its limbs. Relaxed, not athletic, not any specific sport. Plays once for the Exercise action; also loops as the routine stretch activity. (Template: doing `<exercise>` — see above.) |
| `read-start.webm` | Picking up a book and opening it, settling in to read. Plays once. |
| `read-loop.webm` | Reading a book, turning a page now and then, absorbed. Must loop cleanly. |
| `read-exit.webm` | Closing the book with a satisfied smile and putting it down. Plays once. |
| `garden-start.webm` | Walking over to a small potted plant with a watering can. Plays once. |
| `garden-loop.webm` | Watering and tending the little plant, checking its leaves. Must loop cleanly. |
| `garden-exit.webm` | Patting the plant fondly and stepping back with a smile. Plays once. |
| `draw-start.webm` | Sitting down with paper and a pencil, thinking, then starting to sketch. Plays once. |
| `draw-loop.webm` | Drawing a doodle, pausing to look at it, adding details. Must loop cleanly. |
| `draw-exit.webm` | Holding up the finished doodle proudly to show the viewer. Plays once. |
| `dance-start.webm` | Stepping into place and striking a first dance pose, ready to go. Plays once. |
| `dance-loop.webm` | Practicing a simple cheerful dance — small steps, spins, swaying arms. Must loop cleanly. |
| `dance-exit.webm` | Finishing with a little bow and a grin. Plays once. |
| `daydream-start.webm` | Looking up dreamily, chin in hand, eyes drifting off. Plays once. |
| `daydream-loop.webm` | Daydreaming — slow soft swaying, eyes half closed, a dreamy smile, imagining. Must loop cleanly. |
| `daydream-exit.webm` | Blinking back to the present with a small happy sigh. Plays once. |
| `nap-start.webm` | Yawning, curling up cozily with a blanket, eyes closing. 5 seconds, plays once. |
| `nap-loop.webm` | Sleeping peacefully, slow breathing, occasional tiny sleepy shift. Must loop cleanly. |
| `nap-exit.webm` | Waking up with a big stretch and a sleepy smile. 5 seconds, plays once. |
| `avatar.jpg` | No generation — this is your avatar image itself, copied as-is. |

**Optional clips** (bundled in the original build but not used by the
current player — generate only if you want spares): `idle-read.webm`,
`idle-garden.webm`, `idle-draw.webm`, `idle-dance.webm`,
`idle-daydream.webm`, `idle-nap.webm` — same master style block, with
the clip line "the character doing [activity], gentle loop, 8 seconds".

**After generating:** convert to `.webm` (VP9) if needed —
`ffmpeg -i in.mp4 -c:v libvpx-vp9 -b:v 0 -crf 30 out.webm` — and
check each clip with `ffprobe` (duration ~5–8 s) and by watching it
once: same character, no text, no watermark, loops clean where the
table says so.

---

## C. Customisation prompt — give this to Muse after the build

> Customise my companion (fresh build, new link — do not edit the
> existing artifact):
>
> - Name: [NEW NAME]
> - Post-interaction idle: [NUMBER] seconds (currently 12)
> - Routine-to-routine buffer: [NUMBER] seconds (currently 4)
> - Gains: Feed +[N] Fullness, Play +[N] Engagement, Exercise +[N]
>   Fitness (currently 25 / 25 / 20, cap 100)
> - Decay: Fullness −100 per [N] hours, Engagement −100 per [N] hours,
>   Fitness −100 per [N] hours (currently 24 / 48 / 72)
> - Mood clip at most once per [N] completed episodes (currently 4)
> - Routine order: [ORDER, e.g. read, draw, nap, garden, dance,
>   stretch, daydream] (currently read, garden, draw, dance, stretch,
>   daydream, nap)
> - Intention lines / speech lines: [YOUR LINES, or leave as-is]
> - Colours: panel [COLOUR], refill bar [COLOUR], pill [COLOUR]
>   (keep the panel and refill bar explicitly dark with light text)
>
> Only change the items I listed. Keep everything else — dual save,
> gains only on clip `ended`, dock hiding, last-frame hold, direct
> file URLs — exactly as it is. Verify with the same short check as
> the build prompt.
