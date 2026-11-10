// Muse Companion — generic package build.
//
// The stage markup below is the player's DOM:
// ONE visible video element with direct relative assets/... URLs
// (switched directly by the player core in ./player), a hidden
// preloader, the last-frame hold canvas, the speech bubble, the live
// refill bar, the pull-up care dock (Status / Feed / Play /
// Exercise), and the status panel. All behaviour lives in
// ./player (initPlayer).
//
// The status panel and refill bar are explicitly dark with light
// text; while the refill bar is up it replaces the care dock (dock
// hidden, bar in the dock's slot); and state persistence is
// dual-channel — server actions plus an on-device localStorage copy,
// freshest updatedAtMs wins.
//
// This component only renders the DOM once and boots the player;
// it holds no copy of the companion's state.

import CONFIG from "../../companion.config.json";
import { useEffect } from "react";
import { initPlayer } from "./player";

export function App() {
  useEffect(() => {
    initPlayer();
  }, []);

  return (
    <div className="stage" id="stage">
      {/* ONE visible video element. Direct relative file URLs only,
          src switched directly by the gameplay layer. No blob URLs, no
          decoder pool, no host handshake, no playbackRate changes.
          NO poster: the fallback still must never appear between
          clips. Before the first clip ever plays the stage background
          shows for a moment; afterwards the hold-frame canvas covers
          every switch with the previous clip's last frame. A second,
          hidden video element (#preloader, display:none) only preloads
          the next clip — it is never a visible stage. */}
      <video
        id="vid"
        src="assets/idle-content.webm"
        autoPlay
        muted
        playsInline
        role="button"
        aria-label={`Say hello to ${CONFIG.companionName}`}
        tabIndex={0}
      ></video>
      <canvas
        className="hold-frame"
        id="hold-frame"
        width="466"
        height="466"
        aria-hidden="true"
      ></canvas>
      <video
        id="preloader"
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        style={{ display: "none" }}
      ></video>

      <div className="bubble" id="bubble"></div>

      {/* Live refill bar: one stat only, shown while a care clip
          plays (and 1s after). While it is up it replaces the care
          dock: the dock is hidden and the bar sits in the dock's
          bottom slot. pointer-events:none. */}
      <div className="refill" id="refill" aria-hidden="true">
        <div className="refill-top">
          <span id="refill-label">Fullness</span>
          <span id="refill-val">0.0</span>
        </div>
        <div className="refill-track">
          <div className="refill-fill" id="refill-fill"></div>
        </div>
      </div>

      {/* Care dock: collapsed it is a single "Care" pill; tapped, it
          pulls up into the 4-button menu bar, with the pill as the
          bar's handle underneath. Feed / Play / Exercise start their
          care animation directly; Status opens the status panel (which
          hides this whole dock while open). */}
      <div className="care-dock" id="care-dock">
        <button
          type="button"
          className="care-pill"
          id="care-pill"
          aria-expanded="false"
          aria-controls="pill-bar"
        >
          <span>Care</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#14101a"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 14l6-6 6 6" />
          </svg>
        </button>
        <div className="pill-bar" id="pill-bar" role="toolbar" aria-label="Care">
          <button
            type="button"
            className="pill-btn"
            id="btn-status"
            aria-haspopup="true"
            aria-expanded="false"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#14101a"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M5 20v-6" />
              <path d="M12 20V5" />
              <path d="M19 20v-9" />
              <path d="M3 20h18" />
            </svg>
            <span className="lbl">Status</span>
          </button>
          <button type="button" className="pill-btn" id="btn-feed">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#14101a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 21h16" />
              <path d="M5 21v-6.5h14V21" />
              <path d="M5 14.5c1.8-1.6 3.6-1.6 5.4 0 1.8 1.6 3.6 1.6 5.4 0 1-.9 2-1.1 3.2-.5" />
              <path d="M12 10V7.5" />
              <path
                d="M12 4.2c.9 1 .9 1.9 0 2.6-.9-.7-.9-1.6 0-2.6z"
                fill="#14101a"
                stroke="none"
              />
            </svg>
            <span className="lbl">Feed</span>
          </button>
          <button type="button" className="pill-btn" id="btn-play">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#14101a"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8.5" />
              <path d="M4.6 8.5c4.9 2.6 9.9 2.6 14.8 0" />
              <path d="M6.2 19.5c1.7-3.4 3.7-5 5.8-5s4.1 1.6 5.8 5" />
            </svg>
            <span className="lbl">Play</span>
          </button>
          <button type="button" className="pill-btn" id="btn-exercise">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#14101a"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6.5 6.5v11" />
              <path d="M17.5 6.5v11" />
              <path d="M3.5 9v6" />
              <path d="M20.5 9v6" />
              <path d="M6.5 12h11" />
            </svg>
            <span className="lbl">Exercise</span>
          </button>
        </div>
        <button
          type="button"
          className="bar-handle"
          id="bar-handle"
          aria-label="Close care menu"
        >
          <span>Care</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#14101a"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 10l6 6 6-6" />
          </svg>
        </button>
      </div>

      <div
        className="backdrop"
        id="backdrop"
        role="button"
        aria-label="Dismiss status panel"
      ></div>

      {/* Status panel: live meters, mood, and the "Now: …" intention.
          Dismiss by dragging it down (grab bar / header), tapping the
          backdrop, the Close button, or Escape. Fully hidden
          (display:none) whenever closed. While open the care dock is
          hidden entirely; closing the panel brings back the collapsed
          Care pill. */}
      <div className="status-panel" id="status-panel" role="dialog" aria-label="Status">
        <div className="panel-grab" id="panel-grab">
          <span className="bar"></span>
        </div>
        <div className="panel-head" id="panel-head">
          <h2>Status</h2>
          <button type="button" className="close-btn head-close" id="btn-status-close">
            Close
          </button>
        </div>
        <p className="now-line">
          Now: <span id="now-intention">—</span>
        </p>
        <p className="mood-line">
          Mood: <span id="mood-name">—</span> · score <span id="mood-score">—</span>
        </p>
        <div className="meter-row">
          <span className="meter-label">Fullness: </span>
          <span className="meter-val" id="meter-fullness-val">
            —
          </span>
          <div className="meter-track">
            <div className="meter-fill" id="meter-fullness-fill"></div>
          </div>
        </div>
        <div className="meter-row">
          <span className="meter-label">Engagement: </span>
          <span className="meter-val" id="meter-engagement-val">
            —
          </span>
          <div className="meter-track">
            <div className="meter-fill" id="meter-engagement-fill"></div>
          </div>
        </div>
        <div className="meter-row">
          <span className="meter-label">Fitness: </span>
          <span className="meter-val" id="meter-fitness-val">
            —
          </span>
          <div className="meter-track">
            <div className="meter-fill" id="meter-fitness-fill"></div>
          </div>
        </div>
      </div>

      <p className="sr-only" id="sr-status" aria-live="polite"></p>
    </div>
  );
}
