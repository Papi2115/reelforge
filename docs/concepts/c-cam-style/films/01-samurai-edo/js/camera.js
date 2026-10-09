/* Cuts inside a shot (the c-plus camera, as a table). A shot lists its framings; each framing starts at a beat time
   and holds until the next one starts (a hard cut), moving from frame a to frame b over [at, end] (push-in, pull-back,
   pan). A frame is [cx, cy, zoom, tilt]: world point in the centre, zoom, Dutch angle in degrees.
   Cut selection runs on twos (in step with the acting); the move inside a framing runs on the film clock.
   The camera never moves anything in the world: contacts (palms, props, bows) are solved in world space first. */
'use strict';
(function () {
  const ST = window.ST;
  const pick = (t, cuts) => {
    const tt = ST.twos(t);
    let i = 0;
    for (let k = 0; k < cuts.length; k++) if (tt >= cuts[k][0]) i = k;
    return i;
  };
  // cuts: [[at, end, a, b?], ...] sorted by at -> the current frame [cx, cy, z, tilt]
  ST.cutFrame = (t, cuts) => {
    const [at, end, a, b] = cuts[pick(t, cuts)], to = b || a, u = ST.ease.inOut((t - at) / (end - at));
    return [0, 1, 2, 3].map((k) => ST.lerp(a[k] || 0, to[k] || 0, u));
  };
  // apply the current frame; returns the index of the framing on screen (shots stage per framing)
  ST.cutCam = (ctx, t, cuts) => {
    const f = ST.cutFrame(t, cuts);
    ST.camera(ctx, f[0], f[1], f[2], f[3]);
    return pick(t, cuts);
  };
})();
