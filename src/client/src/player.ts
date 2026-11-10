// @ts-nocheck
// Companion player core — generic package version. The state
// machine, timings, clip paths, speech lines, and DOM behaviour are
// the tested contract; do not re-tune them without reading
// LESSONS.md.
//
// Dual-channel persistence: the server store plus a second,
// on-device channel. Server-only saving was proven to fail in
// real use — after real device sessions the server store still
// held only the seed row, so every reopen reloaded the seed and
// the bars looked reset. The on-device copy closes that hole.
//  - Boot: playback starts immediately from the baked seed snapshot
//    in companion.config.json below; the on-device copy (localStorage) is read
//    synchronously and swapped in if fresher, and a get_state call
//    runs in the background — whichever of the two stored copies
//    has the newer updatedAtMs wins. A fresher server copy is
//    written down to local storage; a fresher local copy is pushed
//    up via save_state, healing the server. Any failure or timeout
//    (4s) is swallowed — the best available copy stays and nothing
//    logs to the console.
//  - Care gain: completeCare still lands the gain on the care clip's
//    ended event only, via the original applyGain. Right after, the
//    state is rebased to the current decayed values (identical under
//    the linear decay) with updatedAtMs = Date.now() and saved to
//    BOTH channels: localStorage synchronously (no network, cannot
//    silently fail the way the Coop action call did) and save_state
//    fire-and-forget. A wave or happy clip changes no stat and
//    triggers no save.
// "Happy once per visit at score >= 95" remains per page load
// (happyPlayed is a plain in-memory flag, never persisted).

import CONFIG from "../../companion.config.json";
import { api } from "./api";

// Baked fallback snapshot: the seed values from
// companion.config.json, so a failed load behaves exactly like a
// fresh deploy.
var BAKED_STATE = {
  schemaVersion: 1,
  fullness: CONFIG.seed.fullness,
  engagement: CONFIG.seed.engagement,
  fitness: CONFIG.seed.fitness,
  // A seed updatedAtMs of 0 means "the moment this is first deployed".
  updatedAtMs: CONFIG.seed.updatedAtMs || Date.now()
};
var AVATAR_KEY_VALUE = CONFIG.avatarKey;
var NAME = CONFIG.companionName;

var booted = false;

export function initPlayer() {
  if (booted) return;
  booted = true;

  var vid = document.getElementById("vid");
  var stage = document.getElementById("stage");
  var srStatus = document.getElementById("sr-status");
  var holdFrame = document.getElementById("hold-frame");
  var preloader = document.getElementById("preloader");
  // Idle buffers between distinct animations: routine
  // episode-to-episode transitions use exactly 4 seconds of
  // mood idle; after an interaction (wave / care / happy / any
  // user-triggered action) the mood idle lasts 12 seconds
  // before the routine resumes.
  var BUFFER_MS = CONFIG.timings.routineBufferMs;
  var INTERACTION_BUFFER_MS = CONFIG.timings.interactionBufferMs;

  // ---------------- state / mood layer ----------------
  var IDLES = {
    content: "assets/idle-content.webm",
    peckish: "assets/idle-peckish.webm",
    hungry: "assets/idle-hungry.webm"
  };
  var AVATAR_KEY = AVATAR_KEY_VALUE;
  // Starts as the baked snapshot; the freshest stored
  // state (on-device copy read synchronously, then the server copy)
  // swaps in via loadPersistedState below. Playback never waits.
  var state = {
    schemaVersion: BAKED_STATE.schemaVersion,
    fullness: BAKED_STATE.fullness,
    engagement: BAKED_STATE.engagement,
    fitness: BAKED_STATE.fitness,
    updatedAtMs: BAKED_STATE.updatedAtMs
  };

  function isNeed(v) { return typeof v === "number" && isFinite(v) && v >= 0 && v <= 100; }

  // Decay: fullness -100 per 24h, engagement -100 per 48h,
  // fitness -100 per 72h, clamped at 0.
  function decayedNeeds() {
    var elapsed = Math.max(0, Date.now() - state.updatedAtMs);
    return {
      fullness: Math.max(0, state.fullness - elapsed / 864000),
      engagement: Math.max(0, state.engagement - elapsed / 1728000),
      fitness: Math.max(0, state.fitness - elapsed / 2592000)
    };
  }
  function moodScore(v) { return v.fullness * 0.5 + v.engagement * 0.3 + v.fitness * 0.2; }
  function moodFor(v) {
    var s = moodScore(v);
    return s >= 60 ? "content" : s >= 25 ? "peckish" : "hungry";
  }
  var DECAY_DIVISOR = CONFIG.decayMsPerPoint;
  function applyGain(need, gain) {
    if (!state) return;
    var elapsed = Math.max(0, Date.now() - state.updatedAtMs);
    var cap = 100 + elapsed / DECAY_DIVISOR[need];
    state[need] = Math.min(cap, state[need] + gain);
    renderCareMeters();
  }

  // ---------------- persistence (dual channel) ----
  // Set once a care gain has been saved this visit: a late-arriving
  // boot load must never overwrite fresher in-memory values.
  var saveIssued = false;
  var LS_KEY = CONFIG.storageKey;
  function isValidStored(s) {
    return !!s && isNeed(s.fullness) && isNeed(s.engagement) && isNeed(s.fitness) &&
      typeof s.updatedAtMs === "number" && isFinite(s.updatedAtMs) && s.updatedAtMs > 0;
  }
  function adoptStored(s) {
    state = {
      schemaVersion: 1,
      fullness: s.fullness,
      engagement: s.engagement,
      fitness: s.fitness,
      updatedAtMs: s.updatedAtMs
    };
    renderCareMeters();
  }
  function readLocalState() {
    try {
      var raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return isValidStored(s) ? s : null;
    } catch (e) { return null; }
  }
  function writeLocalState(s) {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify({
        fullness: s.fullness,
        engagement: s.engagement,
        fitness: s.fitness,
        updatedAtMs: s.updatedAtMs
      }));
    } catch (e) { /* storage unavailable: the server copy still saves */ }
  }
  function pushToServer(s) {
    try {
      var p = api.save_state({
        fullness: s.fullness,
        engagement: s.engagement,
        fitness: s.fitness,
        updatedAtMs: s.updatedAtMs
      });
      if (p && typeof p.catch === "function") { p.catch(function () {}); }
    } catch (e) { /* saving never blocks playback */ }
  }
  function loadPersistedState() {
    // On-device copy first: synchronous, no network. If it is
    // fresher than the baked snapshot it becomes the live state
    // before the server answer can arrive.
    var local = readLocalState();
    if (local && !saveIssued && local.updatedAtMs > state.updatedAtMs) {
      adoptStored(local);
    }
    var timeout = new Promise(function (_resolve, reject) {
      setTimeout(function () { reject(new Error("get_state timeout")); }, CONFIG.timings.stateLoadTimeoutMs);
    });
    Promise.race([api.get_state({}), timeout]).then(function (res) {
      if (saveIssued) return;
      var s = res && res.state;
      if (!isValidStored(s)) return;
      if (s.updatedAtMs > state.updatedAtMs) {
        // Server copy is the freshest: adopt it and mirror it down
        // so the on-device copy stays current too.
        adoptStored(s);
        writeLocalState(s);
      } else if (local && local.updatedAtMs > s.updatedAtMs) {
        // The on-device copy is fresher than the server's (the
        // server-only failure mode: saves never landing server-side).
        // Heal the server so both channels agree again.
        pushToServer(local);
      }
    }).catch(function () {
      // Load failed or timed out: keep the best copy already in
      // memory (local or baked snapshot) and keep playing.
      // Deliberately silent — no console output.
    });
  }
  function persistAfterGain() {
    if (!state) return;
    // Rebase onto the current decayed values with a fresh timestamp.
    // Decay is linear, so the decayed values a reload would compute
    // from the saved row are exactly the values on screen now.
    var v = decayedNeeds();
    var nowMs = Date.now();
    state = {
      schemaVersion: 1,
      fullness: v.fullness,
      engagement: v.engagement,
      fitness: v.fitness,
      updatedAtMs: nowMs
    };
    saveIssued = true;
    // On-device copy first, synchronously — it needs no network and
    // is what the next open on this device reads before anything
    // else. Then the server copy, fire-and-forget as before.
    writeLocalState(state);
    pushToServer(state);
  }

  // ---------------- routine schedule ----------------
  // 3-minute wall-clock episodes, fixed order. Reopening joins the
  // current episode; the timer is never restarted.
  var EPISODE_MS = CONFIG.timings.episodeMs;
  var ORDER = CONFIG.routineOrder;
  var OFFSET = parseInt(AVATAR_KEY.slice(0, 8), 16);
  function episodeNow() { return Math.floor(Date.now() / EPISODE_MS); }
  function episodeEndMs(ep) { return (ep + 1) * EPISODE_MS; }
  function routineAct(ep) { var n = ORDER.length; return ORDER[((ep + OFFSET) % n + n) % n]; }

  // ---------------- intention + speech (from the player bundle) --
  // The intention is simply the current episode's text: generated
  // by the wall-clock episode, NOT from needs/mood. It is never
  // resolved or cleared by matching care/activity; it changes only
  // at an episode boundary.
  var INTENTIONS = CONFIG.intentions;
  function intentionNow() {
    var act = routineAct(episodeNow());
    return INTENTIONS[act] || INTENTIONS.quiet;
  }
  // The only routine lines the player ever speaks.
  var ROUTINE_LINES = CONFIG.routineLines;
  // One bubble: say() shows it for exactly 3.5s; a new say()
  // replaces the text and restarts the timer.
  var bubble = document.getElementById("bubble");
  var bubbleHideAt = 0;
  var bubbleTimer = null;
  function hideBubble() {
    bubble.className = "bubble";
    bubbleHideAt = 0;
    if (bubbleTimer !== null) { clearTimeout(bubbleTimer); bubbleTimer = null; }
  }
  function say(text) {
    bubble.textContent = text;
    bubble.className = "bubble show";
    bubbleHideAt = Date.now() + CONFIG.timings.speechBubbleMs;
    if (bubbleTimer !== null) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(hideBubble, CONFIG.timings.speechBubbleMs);
  }
  // Episode speech: the FIRST routine episode of the visit speaks
  // its checkIn line; every later episode change speaks its start
  // line. Resuming the same episode after an interruption is not
  // an episode change and speaks nothing.
  var lastSpokenEpisode = null;
  function speakRoutineEpisode(act) {
    var ep = episodeNow();
    if (lastSpokenEpisode === ep) return;
    var first = (lastSpokenEpisode === null);
    lastSpokenEpisode = ep;
    var lines = ROUTINE_LINES[act] || ROUTINE_LINES.quiet;
    say(first ? lines.checkIn : lines.start);
  }
  var nowEl = document.getElementById("now-intention");
  function renderIntention() {
    var t = intentionNow();
    if (nowEl.textContent !== t) nowEl.textContent = t;
  }

  // v2: activity sets are data-driven from CONFIG.activities
  // (filled in by the onboarding in ONBOARDING.md). Each activity
  // is either a start/loop/exit set, or loopOnly (one looping clip,
  // no start/exit — the v1 "stretch" shape). If no activities map
  // is present, fall back to the v1 fixed set so old configs keep
  // working unchanged.
  var ACTIVITIES = CONFIG.activities || null;
  var SETS = {};
  var LOOP_ONLY = {};
  if (ACTIVITIES) {
    Object.keys(ACTIVITIES).forEach(function (n) {
      var a = ACTIVITIES[n] || {};
      var clips = a.clips || {};
      if (a.loopOnly) {
        LOOP_ONLY[n] = clips.loop || ("assets/" + n + "-loop.webm");
      } else {
        SETS[n] = {
          start: clips.start || ("assets/" + n + "-start.webm"),
          loop: clips.loop || ("assets/" + n + "-loop.webm"),
          exit: clips.exit || ("assets/" + n + "-exit.webm")
        };
      }
    });
  } else {
    ["read", "draw", "garden", "nap", "dance", "daydream"].forEach(function (n) {
      SETS[n] = {
        start: "assets/" + n + "-start.webm",
        loop: "assets/" + n + "-loop.webm",
        exit: "assets/" + n + "-exit.webm"
      };
    });
    LOOP_ONLY.stretch = "assets/exercise.webm";
  }
  function isLoopOnly(name) { return !!LOOP_ONLY[name]; }
  function gerundFor(name) {
    if (ACTIVITIES && ACTIVITIES[name] && ACTIVITIES[name].gerund) return ACTIVITIES[name].gerund;
    var G = { read: "reading", draw: "drawing", garden: "gardening", dance: "dancing", daydream: "daydreaming", nap: "napping", stretch: "stretching" };
    return G[name] || name;
  }
  var STRETCH_CLIP = LOOP_ONLY.stretch || "assets/exercise.webm";
  var WAVE_CLIP = "assets/idle-wave.webm";
  var HAPPY_CLIP = "assets/idle-happy.webm";
  // First-run generating state: the creating animation, looped
  // while the clip set is not generated yet, with a persistent
  // "Generating avatar…" bubble. Generic making/creating, never a
  // sport. See enterGeneratingState below and README "First run".
  var GENERATING_CLIP = "assets/idle-creating.webm";
  var GENERATING_TEXT = "Generating avatar\u2026";
  var GENERATING_PROBE_MS = 30000;
  var GENERATING_SENTINEL = "assets/idle-content.webm";

  // ---------------- playback state machine ----------------
  // mode: idle | buffer | set-start | set-loop | set-exit |
  //       stretch-loop | care | wave | happy | mood
  // "buffer" is the mood-idle gap that separates every
  // one-shot / care action / activity from whatever comes next:
  // 4 seconds after a routine activity, 12 seconds after an
  // interaction (wave / care / happy).
  // While in buffer (or idle) a new action starts directly — the
  // interrupted routine activity is NOT resumed mid-clip and its
  // exit clip is NOT played, because it already ended; the
  // routine restarts from the current episode's set instead (see
  // resumeDefault). The exit clip plays only when interrupting a
  // currently-running sustained set (set-loop / set-start /
  // stretch handled there).
  //
  // Mood/activity balance: an earlier design defaulted to the mood
  // idle, re-picked on every idle clip's ended event, while routine
  // episodes were wall-clock gated — so between episodes and after
  // interruptions the companion sat in mood idle looping for
  // minutes, and the routine only started once per 3-minute
  // episode. Now the default is the routine: episodes play
  // back-to-back (start → loop → exit → buffer → next episode's
  // start), and a full mood-idle clip plays at most once per
  // MOOD_EVERY completed activity episodes (see below) — never
  // back-to-back, never instead of an activity for long. The buffer
  // itself still shows the mood idle, looped, as before.
  var mode = "idle";
  var currentSet = null;       // set name while in a set
  var loopContext = null;      // 'routine'
  var loopDeadline = 0;
  // Time-based transitions are driven by a Date.now() tick, not
  // by setTimeout(wait) where wait is a wall-clock duration:
  // episode boundaries and the 4s buffer are wall-clock
  // deadlines, so a 100ms tick reaches them at the right moment
  // in real time — and if the clock ever runs faster than real
  // time (e.g. an accelerated test harness), the scheduler
  // follows the clock instead of stalling on a real-time timer
  // armed with an accelerated-clock duration. That stall is why
  // the accelerated run only ever completed one episode.
  var schedulerTimer = null;
  var bufferEndMs = 0;
  function schedulerTick() {
    var now = Date.now();
    if ((mode === "set-loop" || mode === "stretch-loop") && loopDeadline && now >= loopDeadline) {
      var wasStretch = mode === "stretch-loop";
      loopDeadline = 0;
      // Natural end of an activity: count it toward the mood
      // cadence, exit clip, then the 4s idle buffer before the
      // next episode.
      noteEpisodeCompleted();
      if (wasStretch) { startBuffer(); }
      else { startExit(function () { startBuffer(); }); }
    } else if (mode === "buffer" && bufferEndMs && now >= bufferEndMs) {
      bufferEndMs = 0;
      if (queuedAction) { var f = queuedAction; queuedAction = null; f(); return; }
      resumeDefault();
    }
  }
  function startScheduler() {
    if (schedulerTimer === null) { schedulerTimer = setInterval(schedulerTick, 100); }
  }
  var afterExit = null;        // fn to run when an exit clip ends
  var pendingAfterStart = null;// interruption requested during set-start
  var queuedAction = null;     // action requested during a transient clip
  var pendingCare = null;      // {need, gain} awaiting care clip end
  var lastRoutineEpisode = -1;
  var happyPlayed = false;
  var happyDue = false;        // happy earned by a care clip but deferred behind a queued action
  // One full mood clip per 4 completed activity episodes.
  var MOOD_EVERY = CONFIG.moodEvery;
  var episodesSinceMood = 0;
  var moodDue = false;

  function setStatus(t) { srStatus.textContent = t; }

  // --- clip switching with last-frame hold ---
  // The visible video is never left showing a poster or a blank
  // frame: snapshot its current frame onto the hold canvas and
  // keep that on screen while the hidden preloader fetches the
  // next clip; only when the preloader can play do we swap the
  // visible element's src and play. Same src (e.g. re-entering
  // the same mood idle) just replays in place.
  var switchSeq = 0;
  var pendingSwap = null;      // {seq, src, loop}
  var hasPlayedOnce = false;
  function showHoldFrame() {
    if (!hasPlayedOnce) return;
    try {
      if (vid.readyState >= 2 && vid.videoWidth > 0) {
        var ctx = holdFrame.getContext("2d");
        if (holdFrame.width !== vid.videoWidth) {
          holdFrame.width = vid.videoWidth;
          holdFrame.height = vid.videoHeight;
        }
        ctx.drawImage(vid, 0, 0, holdFrame.width, holdFrame.height);
      }
    } catch (e) { /* snapshot is best-effort */ }
    holdFrame.className = "hold-frame show";
  }
  function hideHoldFrame() { holdFrame.className = "hold-frame"; }
  function doSwap(seq, src, loop) {
    if (seq !== switchSeq) return;
    pendingSwap = null;
    vid.loop = !!loop;
    if (vid.getAttribute("src") !== src) vid.src = src;
    var p = vid.play();
    if (p && typeof p.catch === "function") {
      p.catch(function () { if (seq === switchSeq) hideHoldFrame(); });
    }
  }
  function playClip(src, loop) {
    var seq = ++switchSeq;
    if (vid.getAttribute("src") === src && hasPlayedOnce) {
      // Same clip again: replay in place, no gap at all.
      pendingSwap = null;
      vid.loop = !!loop;
      try { vid.currentTime = 0; } catch (e) {}
      var p0 = vid.play();
      if (p0 && typeof p0.catch === "function") { p0.catch(function () {}); }
      hideHoldFrame();
      return;
    }
    showHoldFrame();
    pendingSwap = { seq: seq, src: src, loop: !!loop };
    var onReady = function () {
      preloader.removeEventListener("canplay", onReady);
      if (pendingSwap && pendingSwap.seq === seq) doSwap(seq, src, loop);
    };
    preloader.addEventListener("canplay", onReady);
    preloader.loop = false;
    if (preloader.getAttribute("src") !== src) preloader.src = src;
    else if (preloader.readyState >= 3) onReady();
    // Safety net: if preloading stalls, swap anyway rather than
    // freezing on the held frame forever.
    setTimeout(function () {
      if (pendingSwap && pendingSwap.seq === seq) doSwap(seq, src, loop);
    }, 2500);
  }
  vid.addEventListener("playing", function () {
    hasPlayedOnce = true;
    hideHoldFrame();
  });
  function clearLoopTimer() { loopDeadline = 0; }
  function clearBufferTimer() { bufferEndMs = 0; }

  // --- mood idle (plain, e.g. at boot) ---
  function playIdle() {
    clearLoopTimer(); clearBufferTimer();
    mode = "idle"; currentSet = null; loopContext = null;
    if (!state) { playClip(IDLES.content, false); return; }
    var mood = moodFor(decayedNeeds());
    setStatus(NAME + " is " + mood + ".");
    playClip(IDLES[mood], false);
  }

  // --- occasional full mood clip ---
  // One full (non-looped) mood-idle clip, picked from the decayed
  // state score exactly like playIdle. Played only when moodDue
  // (once per MOOD_EVERY completed episodes); when it ends, the
  // flow goes straight to the next activity — never to another
  // mood clip.
  function playMoodClip() {
    clearLoopTimer(); clearBufferTimer();
    mode = "mood"; currentSet = null; loopContext = null;
    if (!state) { playClip(IDLES.content, false); return; }
    var mood = moodFor(decayedNeeds());
    setStatus(NAME + " is " + mood + ".");
    playClip(IDLES[mood], false);
  }

  // ---------------- first-run generating state ----------------
  // If the clip set is not generated yet (companion.config.json
  // `clipsReady` is false), the companion boots into a generating
  // state instead of normal gameplay: the creating animation loops
  // and a persistent bubble reads "Generating avatar…". No routine,
  // no care, no wave, no state load — there is nothing to play or
  // save yet. The state ends two ways: the deployer flips
  // `clipsReady` to true and rebuilds, or the runtime probe below
  // notices the sentinel clip can load and exits live.
  var generating = false;
  var generatingProbeTimer = null;
  function showGeneratingBubble() {
    bubble.textContent = GENERATING_TEXT;
    bubble.className = "bubble show";
    bubbleHideAt = 0; // persistent: the 1s tick must not hide it
  }
  function enterGeneratingState() {
    generating = true;
    mode = "generating";
    clearLoopTimer(); clearBufferTimer();
    if (typeof careDock !== "undefined" && careDock) careDock.style.display = "none";
    showGeneratingBubble();
    setStatus(GENERATING_TEXT);
    playClip(GENERATING_CLIP, true);
    startGeneratingProbe();
  }
  function exitGeneratingState() {
    generating = false;
    if (generatingProbeTimer !== null) { clearInterval(generatingProbeTimer); generatingProbeTimer = null; }
    hideBubble();
    if (typeof careDock !== "undefined" && careDock) careDock.style.display = "";
    playIdle();
    loadPersistedState();
  }
  // Runtime readiness probe: every 30 s, try loading the sentinel
  // clip (the content mood idle) in a throwaway video element. If
  // it can play, the clip set exists and the player leaves the
  // generating state live, with no rebuild. A failed probe just
  // waits for the next one; it never logs and never blocks.
  function probeClipsReady() {
    if (!generating) return;
    var probe = document.createElement("video");
    probe.muted = true;
    probe.preload = "auto";
    var done = false;
    var finish = function (ready) {
      if (done) return;
      done = true;
      probe.removeAttribute("src");
      if (ready && generating) exitGeneratingState();
    };
    probe.addEventListener("canplay", function () { finish(true); });
    probe.addEventListener("error", function () { finish(false); });
    probe.src = GENERATING_SENTINEL;
    setTimeout(function () { finish(false); }, 5000);
  }
  function startGeneratingProbe() {
    if (generatingProbeTimer !== null) return;
    generatingProbeTimer = setInterval(probeClipsReady, GENERATING_PROBE_MS);
  }

  // --- idle buffer (looped mood idle on a deadline) ---
  // Plays the current mood idle, looped; when the deadline is
  // up, a queued action runs first, otherwise the routine
  // resumes. The duration is a parameter: routine transitions
  // use BUFFER_MS (4s, the default); post-interaction callers
  // pass INTERACTION_BUFFER_MS (12s). The mood clip loops for
  // the whole deadline — no shorter clip is chained into a
  // second buffer, so no ended event can resume an activity
  // early.
  // An action requested DURING the buffer is handled by
  // requestAction/requestWave: it cancels the buffer and starts
  // directly from idle (no exit clip, no routine resumption),
  // and a fresh buffer of the appropriate duration starts when
  // that action ends.
  function startBuffer(durationMs) {
    clearLoopTimer(); clearBufferTimer();
    mode = "buffer"; currentSet = null; loopContext = null;
    if (!state) { playClip(IDLES.content, true); }
    else {
      var mood = moodFor(decayedNeeds());
      setStatus(NAME + " is " + mood + ".");
      playClip(IDLES[mood], true);
    }
    bufferEndMs = Date.now() + (typeof durationMs === "number" ? durationMs : BUFFER_MS);
    startScheduler();
  }
  // End of a transient interaction clip (wave / care / happy):
  // a queued action runs immediately, with no idle in between;
  // a happy one-shot earned by the care clip plays next (also
  // immediately); otherwise the 12-second post-interaction
  // idle runs before the routine resumes. The fresh 12s idle
  // starts after the queued action itself completes — its own
  // end comes back through here.
  function afterInteraction() {
    if (queuedAction) { var f = queuedAction; queuedAction = null; f(); return; }
    if (happyDue && !happyPlayed) {
      happyPlayed = true; happyDue = false;
      mode = "happy"; currentSet = null;
      setStatus(NAME + " is happy.");
      say("You made my day!");
      playClip(HAPPY_CLIP, false);
      return;
    }
    startBuffer(INTERACTION_BUFFER_MS);
  }

  // --- activity sets ---
  function startSet(name, context) {
    clearLoopTimer(); clearBufferTimer();
    currentSet = name; loopContext = context;
    mode = "set-start";
    pendingAfterStart = null;
    if (context === "routine") { lastRoutineEpisode = episodeNow(); speakRoutineEpisode(name); }
    setStatus(NAME + " starts " + name + ".");
    playClip(SETS[name].start, false);
  }
  function enterLoop() {
    mode = "set-loop";
    loopDeadline = episodeEndMs(episodeNow());
    setStatus(NAME + " is " + gerundFor(currentSet) + ".");
    playClip(SETS[currentSet].loop, true);
    scheduleLoopEnd();
  }
  function noteEpisodeCompleted() {
    episodesSinceMood++;
    if (episodesSinceMood >= MOOD_EVERY) { moodDue = true; episodesSinceMood = 0; }
  }
  function scheduleLoopEnd() {
    // The loop ends when the wall-clock episode deadline
    // passes; the scheduler tick (100ms, Date.now-driven)
    // notices it. No setTimeout here: arming a real timer
    // with an accelerated-clock duration would stall for the
    // full real-time wait.
    startScheduler();
  }
  function startExit(next) {
    clearLoopTimer();
    var setName = currentSet;
    mode = "set-exit";
    afterExit = next || null;
    setStatus(NAME + " finishes " + setName + ".");
    playClip(SETS[setName].exit, false);
  }
  function startLoopOnly(name) {
    clearLoopTimer(); clearBufferTimer();
    mode = "loop-only"; currentSet = null; loopContext = "routine";
    lastRoutineEpisode = episodeNow();
    speakRoutineEpisode(name);
    loopDeadline = episodeEndMs(episodeNow());
    setStatus(NAME + " is " + gerundFor(name) + ".");
    playClip(LOOP_ONLY[name], true);
    scheduleLoopEnd();
  }
  // Back-compat alias: v1 called this startStretchLoop().
  function startStretchLoop() { startLoopOnly("stretch"); }

  // --- default resumption: routine episode, or the occasional mood clip ---
  // Reached from plain idle, from the end of the idle buffer, and
  // from the end of a full mood clip. The routine is the default:
  // the current wall-clock episode's set starts (from its start
  // clip — an interrupted episode restarts rather than idling
  // until the next boundary), so episodes play back-to-back with
  // only the 4s buffer between them. A full mood clip plays only
  // when one is due (one per MOOD_EVERY completed episodes); the
  // mood clip's own ended event comes back here with moodDue
  // already consumed, so it always continues to an activity and
  // mood clips never play back-to-back.
  function resumeDefault() {
    if (queuedAction) { var f = queuedAction; queuedAction = null; f(); return; }
    if (moodDue) { moodDue = false; playMoodClip(); return; }
    if (!state) { playIdle(); return; }
    var ep = episodeNow();
    var act = routineAct(ep);
    if (isLoopOnly(act)) { startLoopOnly(act); return; }
    startSet(act, "routine");
  }

  // --- interruption plumbing ---
  // Interrupting a currently-running sustained set plays its
  // matching exit first (that activity is still live). From idle
  // or the idle buffer the action starts directly — no exit, no
  // return to the interrupted activity (the routine restarts from
  // the current episode's set after the buffer instead).
  function requestAction(fn) {
    // Generating state: no wave, no care, nothing queued — there
    // is nothing to interact with yet.
    if (generating) return;
    if (mode === "set-loop" && currentSet) {
      startExit(fn);
    } else if (mode === "set-start" && currentSet) {
      pendingAfterStart = fn;
    } else if (mode === "loop-only" || mode === "stretch-loop") {
      clearLoopTimer(); fn();
    } else if (mode === "idle" || mode === "buffer") {
      clearBufferTimer();
      fn();
    } else {
      // care / wave / happy / mood / set-exit in flight: the
      // action is queued and runs as soon as that clip ends —
      // for a transient clip, immediately, with no idle buffer
      // in between (see afterInteraction).
      queuedAction = fn;
    }
  }

  // --- greeting wave ---
  // One-shot: when the wave ends, a queued action runs at once;
  // otherwise the 12s post-interaction idle runs before the
  // routine resumes.
  // The wave never resumes an interrupted activity directly.
  function playWave() {
    clearBufferTimer();
    mode = "wave"; currentSet = null;
    setStatus(NAME + " waves hello.");
    say("Hi there!");
    playClip(WAVE_CLIP, false);
  }
  function requestWave() {
    requestAction(function () { playWave(); });
  }

  // --- care animations ---
  // The gain lands ONLY when the care clip's ended event fires.
  // v2: care clips/labels come from CONFIG.care (filled in by the
  // onboarding: feed.food, play.game, exercise.activity). Fall back
  // to the v1 filenames so old configs keep working.
  var CARE_CFG = CONFIG.care || {};
  var CARE = {
    feed:     { clip: (CARE_CFG.feed && CARE_CFG.feed.clip) || "assets/feed.webm", need: "fullness", gain: CONFIG.gains.feed, label: (CARE_CFG.feed && CARE_CFG.feed.label) || "eating" },
    ball:     { clip: (CARE_CFG.play && CARE_CFG.play.clip) || "assets/play.webm", need: "engagement", gain: CONFIG.gains.play, label: (CARE_CFG.play && CARE_CFG.play.label) || "playing" },
    exercise: { clip: (CARE_CFG.exercise && CARE_CFG.exercise.clip) || "assets/exercise.webm", need: "fitness", gain: CONFIG.gains.exercise, label: (CARE_CFG.exercise && CARE_CFG.exercise.label) || "exercising" }
  };
  function startCare(kind) {
    var c = CARE[kind];
    clearBufferTimer();
    pendingCare = { need: c.need, gain: c.gain };
    mode = "care"; currentSet = null;
    setStatus(NAME + " is " + c.label + ".");
    playClip(c.clip, false);
    showRefill(kind);
  }
  // Care goes through the same interruption plumbing as the wave:
  // from a live set it plays that set's exit first; from idle or
  // the idle buffer it starts directly. After the care clip the
  // flow continues through finishCare -> idle buffer.
  function requestCare(kind) {
    requestAction(function () { startCare(kind); });
  }
  function finishCare() {
    // Care (and the happy one-shot) always hand back through
    // afterInteraction: a queued action runs immediately,
    // otherwise the 12-second post-interaction idle runs —
    // never straight into an activity.
    afterInteraction();
  }
  function completeCare() {
    // Land the refill bar exactly on its target, then hide it
    // 1s after the clip ends; the gain lands below, on this same
    // ended event, and nowhere else.
    finishRefill();
    if (pendingCare) {
      applyGain(pendingCare.need, pendingCare.gain);
      pendingCare = null;
      // Persist the gain to both channels.
      // persistAfterGain rebases the in-memory state onto the
      // current decayed values with updatedAtMs = Date.now() and
      // saves local + server, fire-and-forget; the decayed values
      // (and so the happy check below and every meter) are
      // unchanged by the rebase.
      persistAfterGain();
    }
    if (state && !happyPlayed && moodScore(decayedNeeds()) >= CONFIG.happyThreshold) {
      // Earned, but a queued action still runs first (at once);
      // afterInteraction plays the happy clip right after it,
      // before the 12s idle.
      happyDue = true;
    }
    finishCare();
  }

  // --- central ended dispatcher ---
  vid.addEventListener("ended", function () {
    if (mode === "idle") {
      // Re-evaluate mood from the decayed state and resume
      // (routine episode first, otherwise a fresh mood idle).
      resumeDefault();
    } else if (mode === "mood") {
      // A full mood clip never chains into another one: straight
      // to the next activity.
      resumeDefault();
    } else if (mode === "set-start") {
      if (pendingAfterStart) {
        var f = pendingAfterStart; pendingAfterStart = null;
        startExit(f);
      } else {
        enterLoop();
      }
    } else if (mode === "set-exit") {
      var nx = afterExit; afterExit = null; currentSet = null;
      if (nx) nx(); else resumeDefault();
    } else if (mode === "care") {
      completeCare();
    } else if (mode === "happy") {
      finishCare();
    } else if (mode === "wave") {
      // Wave is a one-shot: a queued action runs at once,
      // otherwise 12s of mood idle before the routine resumes.
      // No activity resume here.
      afterInteraction();
    } else if (mode === "buffer") {
      // Buffer clip is looped and governed by its deadline
      // timer (4s routine / 12s post-interaction); an ended
      // event here (loop-flag race) changes nothing.
    }
  });

  // ---------------- live refill bar ----------------
  // Visual preview of the care gain only: the bar starts at the
  // stat's current decayed value and fills in sync with the care
  // clip's progress (currentTime / duration), reaching
  // current + gain (capped at 100) exactly when the clip ends.
  // The underlying gain still lands only in completeCare, on the
  // clip's ended event — the bar is never a second gain. The bar
  // hides REFILL_HIDE_MS after the clip ends. If the care is
  // interrupted (mode leaves "care" without an ended event) the
  // bar disappears at once and no gain lands.
  var REFILL_HIDE_MS = CONFIG.timings.refillHideMs;
  var refillEl = document.getElementById("refill");
  var refillFill = document.getElementById("refill-fill");
  var refillLabel = document.getElementById("refill-label");
  var refillVal = document.getElementById("refill-val");
  var REFILL_META = {
    feed:     { label: "Fullness",   color: "#e0218a" },
    ball:     { label: "Engagement", color: "#1f8a70" },
    exercise: { label: "Fitness",    color: "#e07b39" }
  };
  var refillActive = false;
  var refillStart = 0;
  var refillTarget = 0;
  var refillClip = null;
  var refillHideTimer = null;
  var refillRaf = null;
  var refillDeadline = 0; // give up waiting for the clip swap after this
  // While the refill bar is up it replaces the care
  // dock — the dock is hidden for exactly the bar's visible life
  // (clip + the 1s tail) and restored when the bar hides. The bar
  // itself sits in the dock's bottom slot (see theme.css), so the
  // character is never covered by a bar stacked over the pill.
  var refillDockHidden = false;
  function hideCareDockForRefill() {
    if (typeof careDock !== "undefined" && careDock && !refillDockHidden) {
      refillDockHidden = true;
      careDock.style.display = "none";
    }
  }
  function restoreCareDockAfterRefill() {
    if (refillDockHidden && typeof careDock !== "undefined" && careDock) {
      refillDockHidden = false;
      // The status panel owns the dock's visibility while open;
      // never resurrect the dock underneath it.
      if (!panelOpen) careDock.style.display = "";
    }
  }
  function paintRefill(val) {
    refillFill.style.width = val.toFixed(1) + "%";
    refillVal.textContent = val.toFixed(1);
  }
  function hideRefillNow() {
    refillActive = false;
    if (refillRaf !== null) { cancelAnimationFrame(refillRaf); refillRaf = null; }
    if (refillHideTimer !== null) { clearTimeout(refillHideTimer); refillHideTimer = null; }
    refillEl.className = "refill";
    restoreCareDockAfterRefill();
  }
  function showRefill(kind) {
    if (!state) return;
    var c = CARE[kind];
    var meta = REFILL_META[kind];
    hideRefillNow();
    var v = decayedNeeds();
    refillStart = v[c.need];
    refillTarget = Math.min(100, refillStart + c.gain);
    refillClip = c.clip;
    refillDeadline = Date.now() + 3000;
    refillLabel.textContent = meta.label;
    refillFill.style.background = meta.color;
    refillEl.className = "refill show";
    hideCareDockForRefill();
    refillActive = true;
    paintRefill(refillStart);
    var tick = function () {
      if (!refillActive) return;
      // Interrupted: bar goes away, no gain.
      if (mode !== "care") { hideRefillNow(); return; }
      // The visible video still shows the previous clip until
      // the preloader swap lands (up to ~2.5s): hold at the
      // start value instead of hiding. The old code hid the
      // bar on the very first frame here, so it never rose and
      // finishRefill then bailed out early. Give up only if
      // the swap never lands at all.
      if (vid.getAttribute("src") !== refillClip) {
        if (Date.now() > refillDeadline) { hideRefillNow(); return; }
        refillRaf = requestAnimationFrame(tick);
        return;
      }
      var p = 0;
      if (vid.duration && isFinite(vid.duration) && vid.duration > 0) {
        p = Math.min(1, Math.max(0, vid.currentTime / vid.duration));
      }
      paintRefill(refillStart + (refillTarget - refillStart) * p);
      refillRaf = requestAnimationFrame(tick);
    };
    refillRaf = requestAnimationFrame(tick);
  }
  function finishRefill() {
    // Care clip ended: land exactly on the target, then hide
    // after REFILL_HIDE_MS.
    if (!refillActive) return;
    if (refillRaf !== null) { cancelAnimationFrame(refillRaf); refillRaf = null; }
    paintRefill(refillTarget);
    refillActive = false;
    refillHideTimer = setTimeout(hideRefillNow, REFILL_HIDE_MS);
  }

  // Stage tap (not the pill, bar, panel, or backdrop) = greeting
  // wave — UNLESS the care menu is open, in which case the tap
  // only collapses the menu and must NOT wave. Collapsing takes
  // precedence for that tap.
  stage.addEventListener("click", function (e) {
    if (e.target === vid) {
      if (menuOpen) { closeMenu(); return; }
      requestWave();
    }
  });
  vid.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " " || e.keyCode === 13 || e.keyCode === 32) {
      e.preventDefault(); requestWave();
    }
  });

  // ---------------- care dock + status panel ----------------
  // The care dock is the collapsed "Care" pill, which pulls up
  // into the 4-button menu bar; the pill becomes the bar's
  // handle underneath it. The bar is display:none whenever
  // collapsed, so it can never trap interaction. Opening the
  // status panel hides the whole dock; closing the panel brings
  // back the collapsed pill (never the expanded bar).
  var careDock = document.getElementById("care-dock");
  var carePill = document.getElementById("care-pill");
  var pillBar = document.getElementById("pill-bar");
  var barHandle = document.getElementById("bar-handle");
  var statusPanel = document.getElementById("status-panel");
  var backdrop = document.getElementById("backdrop");
  var statusBtn = document.getElementById("btn-status");
  var meterFill = {
    fullness: document.getElementById("meter-fullness-fill"),
    engagement: document.getElementById("meter-engagement-fill"),
    fitness: document.getElementById("meter-fitness-fill")
  };
  var meterVal = {
    fullness: document.getElementById("meter-fullness-val"),
    engagement: document.getElementById("meter-engagement-val"),
    fitness: document.getElementById("meter-fitness-val")
  };
  var moodNameEl = document.getElementById("mood-name");
  var moodScoreEl = document.getElementById("mood-score");
  var menuOpen = false;
  var panelOpen = false;
  // Suppresses the click that follows a drag-down collapse, so
  // the handle tap that ends a drag does not immediately reopen
  // the menu.
  var suppressClickUntil = 0;
  function menuClickSuppressed() { return Date.now() < suppressClickUntil; }

  function renderCareMeters() {
    if (!state) return;
    var v = decayedNeeds();
    var keys = ["fullness", "engagement", "fitness"];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      meterFill[k].style.width = v[k].toFixed(1) + "%";
      meterVal[k].textContent = v[k].toFixed(1) + " / 100";
    }
    moodNameEl.textContent = moodFor(v);
    moodScoreEl.textContent = moodScore(v).toFixed(1);
  }
  function setMenuExpanded(expanded) {
    menuOpen = !!expanded;
    careDock.className = expanded ? "care-dock expanded" : "care-dock";
    carePill.setAttribute("aria-expanded", expanded ? "true" : "false");
  }
  function openMenu() { setMenuExpanded(true); }
  function closeMenu() {
    // Collapsing the menu also closes the panel if it is open:
    // the panel's anchor is gone, and it must never be left
    // open without the care UI.
    setMenuExpanded(false);
    if (panelOpen) closePanel();
  }
  function toggleMenu() { if (menuOpen) closeMenu(); else openMenu(); }
  function openPanel() {
    panelOpen = true;
    // The care menu goes away entirely while the panel is open:
    // both the collapsed pill and the expanded bar are hidden.
    setMenuExpanded(false);
    careDock.style.display = "none";
    renderCareMeters();
    renderIntention();
    statusPanel.style.transform = "";
    statusPanel.className = "status-panel open";
    backdrop.className = "backdrop open";
    statusBtn.setAttribute("aria-expanded", "true");
  }
  function closePanel() {
    panelOpen = false;
    statusPanel.style.transform = "";
    statusPanel.className = "status-panel";
    backdrop.className = "backdrop";
    statusBtn.setAttribute("aria-expanded", "false");
    // Back to the collapsed pill, never the expanded bar.
    careDock.style.display = "";
    setMenuExpanded(false);
  }
  function togglePanel() { if (panelOpen) closePanel(); else openPanel(); }

  carePill.addEventListener("click", function () {
    if (menuClickSuppressed()) return;
    toggleMenu();
  });
  barHandle.addEventListener("click", function () {
    if (menuClickSuppressed()) return;
    closeMenu();
  });
  statusBtn.addEventListener("click", togglePanel);
  backdrop.addEventListener("click", closePanel);
  document.getElementById("btn-status-close").addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" || e.keyCode === 27) {
      if (panelOpen) closePanel();
      else if (menuOpen) closeMenu();
    }
  });

  // Drag-down to dismiss the menu bar: dragging the bar (or its
  // handle) downward moves it with the pointer; releasing past a
  // 48px threshold collapses it, otherwise it snaps back. A tap
  // (no drag) still fires the button's click normally.
  var barDragStartY = null;
  var barDragDy = 0;
  function barDragBegin(y) { barDragStartY = y; barDragDy = 0; }
  function barDragMove(y) {
    if (barDragStartY === null) return;
    barDragDy = Math.max(0, y - barDragStartY);
    pillBar.style.transform = "translateY(" + barDragDy + "px)";
  }
  function barDragEnd() {
    if (barDragStartY === null) return;
    var dy = barDragDy;
    barDragStartY = null; barDragDy = 0;
    pillBar.style.transform = "";
    if (dy > 48) {
      suppressClickUntil = Date.now() + 300;
      closeMenu();
    }
  }
  function bindBarDrag(el) {
    el.addEventListener("pointerdown", function (e) {
      barDragBegin(e.clientY);
      // No setPointerCapture here: capturing the pointer on
      // this container retargets the click that follows a tap
      // to the container itself, which swallowed every click
      // on the Status/Feed/Play/Exercise buttons inside it
      // (the panel never opened, care clips never played).
      // Track the drag on the window instead, so clicks still
      // land on their real targets.
      var onMove = function (ev) { barDragMove(ev.clientY); };
      var onUp = function () {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        barDragEnd();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    });
  }
  bindBarDrag(pillBar);
  bindBarDrag(barHandle);

  // Drag-down to dismiss the status panel: dragging the grab bar
  // or the panel header downward moves the panel with the
  // pointer; releasing past a 48px threshold closes it,
  // otherwise it snaps back. Pointer events cover both touch and
  // mouse.
  var dragStartY = null;
  var dragDy = 0;
  function dragBegin(y) { dragStartY = y; dragDy = 0; }
  function dragMove(y) {
    if (dragStartY === null) return;
    dragDy = Math.max(0, y - dragStartY);
    statusPanel.style.transform = "translateY(" + dragDy + "px)";
  }
  function dragEnd() {
    if (dragStartY === null) return;
    var dy = dragDy;
    dragStartY = null; dragDy = 0;
    if (dy > 48) closePanel();
    else statusPanel.style.transform = "";
  }
  function bindDrag(el) {
    el.addEventListener("pointerdown", function (e) {
      dragBegin(e.clientY);
      // No setPointerCapture here either: the panel header
      // holds the Close button, and capturing on the header
      // would retarget its click to the header and swallow it.
      // Track the drag on the window instead.
      var onMove = function (ev) { dragMove(ev.clientY); };
      var onUp = function () {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        dragEnd();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    });
  }
  bindDrag(document.getElementById("panel-grab"));
  bindDrag(document.getElementById("panel-head"));

  document.getElementById("btn-feed").addEventListener("click", function () {
    if (menuClickSuppressed()) return;
    closePanel(); closeMenu(); requestCare("feed");
  });
  document.getElementById("btn-play").addEventListener("click", function () {
    if (menuClickSuppressed()) return;
    closePanel(); closeMenu(); requestCare("ball");
  });
  document.getElementById("btn-exercise").addEventListener("click", function () {
    if (menuClickSuppressed()) return;
    closePanel(); closeMenu(); requestCare("exercise");
  });

  if (state) {
    renderCareMeters();
    setInterval(function () { if (panelOpen) renderCareMeters(); }, 1000);
  }

  // 1-second tick: hide the bubble once its 3.5s are up, and keep
  // the Status intention line on the current episode (it changes
  // only at episode boundaries).
  renderIntention();
  setInterval(function () {
    if (bubbleHideAt && Date.now() >= bubbleHideAt) hideBubble();
    renderIntention();
  }, 1000);

  // Boot: if the clip set is not generated yet, boot into the
  // generating state (creating animation + "Generating avatar…"
  // bubble) instead of normal gameplay. Otherwise mood idle first;
  // when it ends, the routine/idle resumption takes over.
  if (!CONFIG.clipsReady) {
    enterGeneratingState();
  } else {
    playIdle();

    // Load the persisted state (on-device copy first,
    // then the server copy in the background). The snapshot above is
    // already playing; the freshest valid stored state swaps in when
    // it lands, and any failure leaves the best available copy in
    // place with no visible change.
    loadPersistedState();
  }
}
