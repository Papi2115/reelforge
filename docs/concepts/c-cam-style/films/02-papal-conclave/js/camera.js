/* Camera staging (ported from the c-plus films, camera only): foreground silhouettes in screen space and the
   in-shot cut list. Lighting, rim and vignette passes are NOT part of this film. */
'use strict';
(function () {
  const ST = window.ST;

  // a flat dark shape very close to the lens (door jamb, chair back, a shoulder), drawn in screen space over the frame
  ST.fg = (ctx, pts, seed, col) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const keep = ST.LW;
    ST.LW = 1.4;
    ST.blob(ctx, pts, col || '#14110e', { lw: 0, seed });
    ST.LW = keep;
    ctx.restore();
  };

  // an arm reaching in from the frame edge, close to the lens (screen space): sleeve tube + a pointing hand
  ST.fgArm = (ctx, x0, y0, x1, y1, seed) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const keep = ST.LW;
    ST.LW = 1.4;
    ST.tube(ctx, [x0, y0, (x0 + x1) / 2, (y0 + y1) / 2 + 20, x1, y1], [150, 120, 100], '#4a2418', { lw: 9, seed, shade: ['#331810', -30, 6] });
    const ang = (Math.atan2(x1 - x0, y1 - y0) * 180) / Math.PI;
    ST.hand(ctx, x1, y1, ang, 110, '#7a5c48', 'point', { seed: seed + 1, lw: 9, shade: '#5a4232' });
    ST.LW = keep;
    ctx.restore();
  };

  // cuts inside a shot: list [[from, name], ...] in shot time (on twos) -> the current setup's name and start time
  ST.cut = (t, list) => {
    const tt = ST.twos(t);
    let cur = list[0];
    for (const c of list) if (tt >= c[0]) cur = c;
    return { name: cur[1], t0: cur[0] };
  };
})();
