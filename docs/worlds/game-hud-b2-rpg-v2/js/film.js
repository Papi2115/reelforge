/* The v2 film: ONE continuous global timeline G (0..82 s, 10 shots). v1's eight beats keep their own film time T
   (timeline.js, 0..66 s); two inserted scenes (automap, intermission tally) sit between them while T is held.
   G -> { shot, T | scene + local u } is a pure table lookup: no state, no clocks. */
'use strict';
(function () {
  const RF = window.RF, V1 = RF.V1_SHOTS;
  RF.FPS = 30;
  // v1: index into V1_SHOTS (T = G - offset); scene: key of window.RF.<key>, v1 time frozen at holdT meanwhile
  const CUTS = [
    { g0: 0, g1: 7.5, v1: 0 },
    { g0: 7.5, g1: 16, v1: 1 },
    { g0: 16, g1: 24, v1: 2 },
    { g0: 24, g1: 32, scene: 'AUTOMAP', holdT: 24, title: 'Automap', role: 'B',
      note: 'Structure beat: the story so far as one level seen from above. Rooms we walked are drawn, the next chapters are still dark. The map draws on, then folds back into the game.' },
    { g0: 32, g1: 39, v1: 3 },
    { g0: 39, g1: 47, v1: 4 },
    { g0: 47, g1: 56, v1: 5 },
    { g0: 56, g1: 64, scene: 'TALLY', holdT: 48, title: 'Intermission', role: 'recap',
      note: 'End-of-level tally as the chapter recap: the facts count up, a par time, a stamped grade. Then out the back door into the night.' },
    { g0: 64, g1: 72.5, v1: 6 },
    { g0: 72.5, g1: 82, v1: 7 },
  ];
  CUTS.forEach((c, i) => {
    if (c.scene) return;
    const s = V1[c.v1];
    c.offset = c.g0 - s.t0;
    // a v1 beat right after an inserted scene starts clean: no dialogue box left over from before the scene
    c.cleanFrom = i > 0 && CUTS[i - 1].scene ? s.t0 : null;
    if (Math.abs(c.g1 - c.g0 - (s.t1 - s.t0)) > 1e-9) throw new Error(`film.js: shot ${s.title} length differs from v1`);
  });
  RF.CUTS = CUTS;
  RF.DURATION = CUTS[CUTS.length - 1].g1;
  /** Public shot table in global time (what the player and the dev caption use). */
  RF.SHOTS = CUTS.map((c) => {
    const src = c.scene ? c : V1[c.v1];
    return { t0: c.g0, t1: c.g1, title: src.title, role: src.role, note: src.note, scene: c.scene || null };
  });
  RF.shotAt = (g) => { for (let i = CUTS.length - 1; i >= 0; i--) if (g >= CUTS[i].g0) return i; return 0; };
  /** Where global time g lands: a v1 beat at film time T, or an inserted scene at local time u. */
  RF.filmAt = function (gIn) {
    const g = RF.clamp(gIn, 0, RF.DURATION - 1e-4);
    const i = RF.shotAt(g), c = CUTS[i], u = g - c.g0;
    if (c.scene) return { shot: i, u: u, scene: c.scene, T: c.holdT, cleanFrom: null };
    return { shot: i, u: u, scene: null, T: v1Time(g, c.offset), cleanFrom: c.cleanFrom };
  };
  /** On the frame grid, T is the exact v1 frame time k/FPS (G - offset alone drifts by an ulp and flips v1 thresholds). */
  function v1Time(g, offset) {
    const k = g * RF.FPS, kr = Math.round(k);
    return Math.abs(k - kr) < 1e-6 ? (kr - offset * RF.FPS) / RF.FPS : g - offset;
  }
  /** The inserted scene object if its script loaded (automap.js / intermission.js are optional at load time). */
  RF.sceneFor = (key) => {
    const s = RF[key];
    return s && typeof s.render === 'function' ? s : null;
  };
  /** Dev caption in global time: v1 lines via T, inserted scenes via their own `lines` (local s). */
  RF.captionAt = function (g) {
    const f = RF.filmAt(g);
    if (!f.scene) return RF.v1CaptionAt(f.T);
    const s = RF.sceneFor(f.scene);
    let best = null;
    if (s && Array.isArray(s.lines)) s.lines.forEach((l) => { if (f.u >= l.t0 - 0.2) best = l; });
    return best ? best.say : '';
  };
})();
