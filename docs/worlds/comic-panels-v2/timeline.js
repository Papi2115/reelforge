/* comic-panels v2 showcase - one continuous film. Global frame -> (shot, local t) -> pixels.
 * The incoming transition lives in the first frames of a shot: A = previous shot's last frame (held),
 * B = this shot running. Everything here is a pure function of the global frame number.
 */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const FPS = 30;
  const SHOTS = CP.SHOTS;
  let cursor = 0;
  SHOTS.forEach((s, i) => {
    if (!s) throw new Error(`shot ${i + 1} is missing`);
    s.frames = Math.round(s.dur * FPS);
    s.startFrame = cursor;
    s.start = cursor / FPS;
    cursor += s.frames;
  });
  const TOTAL_FRAMES = cursor;

  function locate(frame) {
    const f = Math.max(0, Math.min(TOTAL_FRAMES - 1, frame | 0));
    for (let i = SHOTS.length - 1; i >= 0; i--) {
      if (f >= SHOTS[i].startFrame) return { index: i, local: f - SHOTS[i].startFrame };
    }
    return { index: 0, local: 0 };
  }

  /** Renders shot i at local frame f into CP.fb (resets all global drawing state first). */
  function renderShot(i, f) {
    const t = f / FPS;
    CP.setClip(null);
    CP.setBoilFrame(t);
    CP.setScreen(1, 0);
    const out = SHOTS[i].render(t) || {};
    if (out.remap) CP.remapFb(out.remap);
  }

  // A shot's last frame is a pure function of the shot, so it may be cached.
  const held = [];
  function lastFrame(i) {
    if (!held[i]) {
      renderShot(i, SHOTS[i].frames - 1);
      held[i] = CP.fb.slice();
    }
    return held[i];
  }

  function transitionFrames(i) {
    const tr = SHOTS[i].transIn;
    return i > 0 && tr ? Math.round(tr.dur * FPS) : 0;
  }

  /** Renders global frame number `frame` into CP.fb. */
  function renderFrame(frame) {
    const { index, local } = locate(frame);
    const n = transitionFrames(index);
    if (local < n) {
      const A = lastFrame(index - 1);
      renderShot(index, local);
      const B = CP.fb.slice();
      const tr = SHOTS[index].transIn;
      CP.setClip(null);
      CP.transitions[tr.kind](A, B, (local + 1) / (n + 1), tr);
    } else renderShot(index, local);
    return { index, local };
  }

  CP.timeline = { FPS, SHOTS, TOTAL_FRAMES, locate, renderFrame, transitionFrames };
})();
