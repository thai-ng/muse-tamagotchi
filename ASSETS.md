# Asset manifest

Every file the player needs, in `client/assets/`. All clips are square
(466×466), `.webm` (VP9), of the same character from one avatar image.
Durations below are the tested originals — the refill bar syncs to the
clip's actual duration, so a second or two either way is fine, but a
loop clip **must** loop cleanly and a one-shot must end cleanly.

Total: 27 required clips + 1 still (`avatar.jpg`) + 6 optional spares.
Keep each clip under ~1 MB.

> **v2:** this manifest is generated from
> `companion.config.json`. Custom activities from the onboarding
> change the routine rows (filenames follow
> `<id>-start/-loop/-exit.webm`), and the care clips are the
> owner's food / game / exercise, not necessarily cake / ball /
> stretching. The table below is the worked default set.

## Required

### First-run creating clip (looped while the clip set is being generated)

| File | Purpose | Duration |
|---|---|---|
| `idle-creating.webm` | Creating animation for the first-run generating state — the character drawing, crafting, or building something. Generate this one first. Generic making/creating, not any sport. | 8 s |

### Mood idles (looped while shown; picked from the mood score)

| File | Purpose | Duration |
|---|---|---|
| `idle-content.webm` | Content mood idle (score ≥ 60) | 8 s |
| `idle-peckish.webm` | Peckish mood idle (score 25–59) | 8 s |
| `idle-hungry.webm` | Hungry mood idle (score < 25) | 8 s |

### One-shots

| File | Purpose | Duration |
|---|---|---|
| `idle-wave.webm` | Greeting wave on stage tap | 5 s |
| `idle-happy.webm` | Happy thank-you, once per visit at score ≥ 95 | 8 s |

### Care clips (gain lands only when the clip ends)

| File | Purpose | Duration |
|---|---|---|
| `feed.webm` | Feed — eating the owner's food (default: cake), +25 Fullness | 8 s |
| `play.webm` | Play — playing the owner's game (default: ball), +25 Engagement | 8 s |
| `exercise.webm` | Exercise — the owner's exercise (default: gentle stretching / light movement), +20 Fitness. Also the routine loop for that activity if it is in the routine (below). | 8 s |

### Routine activity sets (start → loop → exit)

Each activity except the loop-only one (default: stretch) has
three clips. The loop runs until the 3-minute wall-clock episode
ends; the exit plays when the activity ends or is interrupted
mid-set. A custom loop-only activity follows the same shape:
one looping clip, no start/exit, and if it is also the Exercise
care clip, that clip is shared — never generated twice.

| Activity | Start | Loop | Exit | Durations |
|---|---|---|---|---|
| read | `read-start.webm` | `read-loop.webm` | `read-exit.webm` | 5 s / 5 s / 5 s |
| garden | `garden-start.webm` | `garden-loop.webm` | `garden-exit.webm` | 8 s / 8 s / 8 s |
| draw | `draw-start.webm` | `draw-loop.webm` | `draw-exit.webm` | 8 s / 8 s / 8 s |
| dance | `dance-start.webm` | `dance-loop.webm` | `dance-exit.webm` | 8 s / 8 s / 8 s |
| stretch | — (no start/exit) | `exercise.webm` (shared with Exercise) | — | 8 s |
| daydream | `daydream-start.webm` | `daydream-loop.webm` | `daydream-exit.webm` | 8 s / 8 s / 8 s |
| nap | `nap-start.webm` | `nap-loop.webm` | `nap-exit.webm` | 5 s / 5 s / 5 s |

### Still

| File | Purpose |
|---|---|
| `avatar.jpg` | Your avatar image itself (used as the reference still). |

## Optional spares (not used by the current player)

Bundled in the original build as alternates; safe to omit. Generate
only if you want them.

| File | Purpose | Duration |
|---|---|---|
| `idle-read.webm` | Spare reading idle | 8 s |
| `idle-garden.webm` | Spare gardening idle | 8 s |
| `idle-draw.webm` | Spare drawing idle | 8 s |
| `idle-dance.webm` | Spare dancing idle | 8 s |
| `idle-daydream.webm` | Spare daydreaming idle | 8 s |
| `idle-nap.webm` | Spare napping idle | 8 s |

## How to generate them

See `PROMPTS.md` §B: one master style block plus one line per clip,
all from the same avatar image. After generating, convert to `.webm`
(VP9) if needed:

```sh
ffmpeg -i in.mp4 -c:v libvpx-vp9 -b:v 0 -crf 30 out.webm
ffprobe -v error -show_entries format=duration -of csv=p=0 out.webm
```

Check every clip once by watching it: same character, no text, no
watermark, loops clean where the table says loop, ends clean where it
says one-shot. A clip of a different-looking character is a failed
clip — regenerate it, do not ship it.
