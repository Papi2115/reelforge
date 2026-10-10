/* Camera + figure space. ST.camera puts a world point in the frame centre at zoom z, rolled by a Dutch tilt (deg).
   ST.cam / ST.shotCam keyframe a camera track; ST.cut = hard cuts inside a shot; ST.figure = a character's space.
   The same affine maths is exported (ST.aff, ST.figMatrix, ST.camMatrix) so contact solving (ST.meet) uses exactly
   the transforms the drawing uses. Lines thicken gently in close-ups (ST.LW). */
'use strict';
(function () {
  const ST = window.ST;
  const RAD = Math.PI / 180;

  ST.camera = (ctx, cx, cy, z, tilt) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(ST.W / 2, ST.H / 2);
    if (tilt) ctx.rotate(tilt * RAD);
    ctx.scale(z, z);
    ctx.translate(-cx, -cy);
    ST.camZ = z;
    ST.LW = Math.pow(z, -0.55);
  };
  // a camera track: each field is a number or keys [[t, v, ease?], ...]; returns { x, y, z, tilt }
  ST.cam = (t, track) => {
    const v = (k, d) => (k === undefined ? d : typeof k === 'number' ? k : ST.key(t, k));
    return { x: v(track.x, ST.W / 2), y: v(track.y, ST.H / 2), z: v(track.z, 1), tilt: v(track.tilt, 0) };
  };
  ST.shotCam = (ctx, t, track) => {
    const c = ST.cam(t, track);
    ST.camera(ctx, c.x, c.y, c.z, c.tilt);
    return c;
  };
  // hard cuts inside a shot: cuts [[t0, draw(ctx, t, tLocal)], ...]; the last cut whose time has passed draws
  ST.cut = (ctx, t, cuts) => {
    let k = 0;
    cuts.forEach((c, i) => { if (t >= c[0]) k = i; });
    cuts[k][1](ctx, t, t - cuts[k][0]);
  };
  // a cold/nervous shiver: a few px of hashed jitter on twos
  ST.shiver = (t, seed, amp) => ST.rnd(-amp, amp, seed, Math.floor(ST.twos(t) * ST.ANIM));

  // figure space: origin at the feet, +x = the way the figure faces (flip mirrors it), p.lean in degrees
  ST.figure = (ctx, p, flip, draw) => {
    const keep = ST.LW;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(flip ? -p.s : p.s, p.s);
    if (p.lean) ctx.rotate(p.lean * RAD);
    ST.LW = Math.pow(p.s * ST.camZ, -0.55);
    draw();
    ctx.restore();
    ST.LW = keep;
  };

  // ---- 2D affine maths, canvas order [a, b, c, d, e, f]: (x, y) -> (a x + c y + e, b x + d y + f) ----
  const mul = (M, N) => [
    M[0] * N[0] + M[2] * N[1], M[1] * N[0] + M[3] * N[1],
    M[0] * N[2] + M[2] * N[3], M[1] * N[2] + M[3] * N[3],
    M[0] * N[4] + M[2] * N[5] + M[4], M[1] * N[4] + M[3] * N[5] + M[5],
  ];
  const inv = (M) => {
    const d = M[0] * M[3] - M[1] * M[2];
    return [M[3] / d, -M[1] / d, -M[2] / d, M[0] / d, (M[2] * M[5] - M[3] * M[4]) / d, (M[1] * M[4] - M[0] * M[5]) / d];
  };
  const apply = (M, q) => [M[0] * q[0] + M[2] * q[1] + M[4], M[1] * q[0] + M[3] * q[1] + M[5]];
  const T = (x, y) => [1, 0, 0, 1, x, y], S = (sx, sy) => [sx, 0, 0, sy, 0, 0];
  const R = (deg) => { const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD); return [c, s, -s, c, 0, 0]; };
  ST.aff = { mul, inv, apply, T, S, R, I: [1, 0, 0, 1, 0, 0], of: (ctx) => { const m = ctx.getTransform(); return [m.a, m.b, m.c, m.d, m.e, m.f]; } };
  // figure -> world for a figure frame { x, y, s, lean, flip } (exactly what ST.figure does)
  ST.figMatrix = (f) => mul(mul(T(f.x, f.y), S(f.flip ? -f.s : f.s, f.s)), R(f.lean || 0));
  // world -> screen for a camera { x, y, z, tilt } (exactly what ST.camera does)
  ST.camMatrix = (c) => (c ? mul(mul(mul(T(ST.W / 2, ST.H / 2), R(c.tilt || 0)), S(c.z, c.z)), T(-c.x, -c.y)) : ST.aff.I);
})();
