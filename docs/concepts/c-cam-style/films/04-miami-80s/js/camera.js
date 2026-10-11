/* Camera work (the one change vs c-base): cuts inside a shot between wide / close-up / extreme close-up, push-ins and
   pull-backs, Dutch tilt, and flat foreground silhouettes. Pure functions of shot time; the beat times of the film are
   untouched. Every character, hand and prop is still placed in world space, the camera only transforms the frame. */
'use strict';
(function () {
  const ST = window.ST;
  // cuts: [{ at, x, y, z, rot }, ...] in shot time, sorted; each value is a number or ST.key frames (push / pull /
  // drift inside that cut). The last cut whose `at` has passed is on screen (a hard cut). Returns its index.
  ST.cutCam = (ctx, t, cuts) => {
    let i = 0;
    for (let k = 0; k < cuts.length; k++) if (t >= cuts[k].at) i = k;
    const c = cuts[i], v = (x) => (Array.isArray(x) ? ST.key(t, x) : x || 0);
    ST.camera(ctx, v(c.x), v(c.y), v(c.z), v(c.rot));
    return i;
  };
  // flat near-black shape in front of everything (door frame, console edge, a shoulder): a foreground silhouette
  ST.fgShape = (ctx, pts, seed) => ST.rough(ctx, pts, '#14100c', { seed, lw: 0 });
})();
