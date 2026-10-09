/* Limb drawing: arms (sleeve + bare forearm + cuff + hand), legs (tube + shin + projected shoe), the mitten hand.
   LIMB RULE: no doubled contour stroke anywhere on a limb (tubes never double, the hand passes double: false).
   When ST.REC is set (validators), every arm records where its root was actually drawn (device pixels). */
'use strict';
(function () {
  const ST = window.ST;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const TILT = 0.16; // feet only: the camera sits a little above, so a forward-pointing foot reads lower on screen
  const dev = (ctx, q) => { const m = ctx.getTransform(); return [m.a * q[0] + m.c * q[1] + m.e, m.b * q[0] + m.d * q[1] + m.f]; };
  ST.devPoint = dev;

  // arm drawing. st: { cloth, clothD, w: [shoulder, elbow, wrist], bare: 0..1 (skin from this fraction of the forearm,
  // 1 = fully sleeved), skin, skinD, hsz, hand, cuff, hatch, seed, lw, hair }
  ST.drawArm = (ctx, j, st) => {
    const { s, e, h } = j, lw = st.lw || 6, seed = st.seed || 50;
    const w = st.w, bare = st.bare === undefined ? 1 : st.bare;
    if (ST.REC) ST.REC.arms.push({ j, root: dev(ctx, s), wrist: dev(ctx, h) });
    if (bare < 1) {
      const bx = e[0] + (h[0] - e[0]) * bare, by = e[1] + (h[1] - e[1]) * bare;
      ST.tube(ctx, [bx, by, h[0], h[1]], [w[1] * 0.86, w[2] * 0.9], st.skin, { lw, seed: seed + 1, shade: [st.skinD, -w[2] * 0.22, 2], hatch: st.hair ? { c: 'rgba(25,18,12,0.5)', n: 3, len: 10, gap: 4, k: 3, ang: 60 } : null });
      const ex = bx + (e[0] - bx) * -0.12, ey = by + (e[1] - by) * -0.12;
      ST.tube(ctx, [s[0], s[1], e[0], e[1], ex, ey], [w[0], w[1], w[1] * 1.05], st.cloth, { lw, seed, lit: st.lit ? [st.clothD, w[1] * 0.3] : null, shade: st.lit ? null : [st.clothD, -w[1] * 0.25, 3], hatch: st.hatch });
      if (st.cuff) ST.tube(ctx, [ex + (e[0] - ex) * 0.6, ey + (e[1] - ey) * 0.6, ex, ey], [w[1] * 1.12, w[1] * 1.12], st.cuff, { lw: lw * 0.8, seed: seed + 3 });
    } else {
      ST.tube(ctx, [s[0], s[1], e[0], e[1], h[0], h[1]], w, st.cloth, { lw, seed, lit: st.lit ? [st.clothD, w[1] * 0.3] : null, shade: st.lit ? null : [st.clothD, -w[1] * 0.25, 3], hatch: st.hatch });
      if (st.cuff) ST.tube(ctx, [e[0] + (h[0] - e[0]) * 0.8, e[1] + (h[1] - e[1]) * 0.8, h[0], h[1]], [w[2] * 1.12, w[2] * 1.1], st.cuff, { lw: lw * 0.8, seed: seed + 3 });
    }
    if (st.hand !== 'none') ST.hand(ctx, h[0], h[1], j.ang, st.hsz, st.skin, st.hand || 'fist', { seed: seed + 5, lw: lw * 0.9, shade: st.skinD, fore: j.fore });
  };

  // leg drawing: tube hip -> knee -> ankle, then the shoe, built from a projected heel/ball/toe so it turns with the
  // view. st: { cloth, clothD, w: [hip, knee, ankle], shoe, shoeD, shoeL, len, sw, seed, lw, splay, skin, skinD, hatch }
  ST.drawLeg = (ctx, V, j, sgn, st) => {
    const { s, e, h } = j, lw = st.lw || 6, seed = st.seed || 70;
    ST.tube(ctx, [s[0], s[1], e[0], e[1], h[0], h[1] - 4], st.w, st.cloth, { lw, seed, shade: [st.clothD, -st.w[1] * 0.25, 2], hatch: st.hatch });
    if (st.skin) ST.tube(ctx, [e[0] + (h[0] - e[0]) * 0.35, e[1] + (h[1] - e[1]) * 0.35, h[0], h[1] - 4], [st.w[1] * 0.8, st.w[2]], st.skin, { lw, seed: seed + 2, shade: [st.skinD, -5, 0] });
    ST.drawFoot(ctx, V, j.H3, sgn, st);
  };
  ST.drawFoot = (ctx, V, A, sgn, st) => {
    const len = st.len, sp = (st.splay === undefined ? 0.25 : st.splay) * sgn;
    const pt = (dx, dy, dz) => { const q = ST.proj(V, add(A, [dx, dy, dz])); return [q[0], q[1] + q[2] * TILT]; };
    const heel = pt(-sp * len * 0.2, 4, -len * 0.25), ball = pt(sp * len * 0.45, 8, len * 0.5), toe = pt(sp * len * 0.8, 4, len * 0.85);
    ST.tube(ctx, [heel[0], heel[1], ball[0], ball[1], toe[0], toe[1]], [st.sw * 0.95, st.sw, st.sw * 0.72], st.shoe, { lw: st.lw || 6, seed: (st.seed || 70) + 9, shade: [st.shoeD, -4, 4], light: st.shoeL ? [st.shoeL, 3, -4] : null });
  };

  // Mitten hand. ang = forearm direction (deg, 0 = down). kind: 'fist' | 'open' | 'point' | 'grip' | 'flat'.
  // Thumb toward +x. o.fore (0.45..1) foreshortens a hand pointing at the camera. Never a doubled stroke.
  ST.hand = (ctx, x, y, ang, sz, skin, kind, o) => {
    o = o || {};
    const seed = o.seed || 23, shade = o.shade || 'rgba(50,25,15,0.3)', lw = o.lw || 5.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((-ang * Math.PI) / 180);
    if (o.fore && o.fore < 1) ctx.scale(1, o.fore);
    if (kind === 'open') {
      [-0.38, -0.12, 0.13, 0.36].forEach((u, i) => {
        const a = u * 0.9, l = sz * (0.6 + (i === 1 ? 0.12 : 0) - (i === 3 ? 0.12 : 0));
        ST.tube(ctx, [u * sz * 0.6, sz * 0.75, u * sz * 0.6 + Math.sin(a) * l, sz * 0.75 + Math.cos(a) * l], [sz * 0.26, sz * 0.21], skin, { lw, seed: seed + i });
      });
    }
    if (kind === 'point') ST.tube(ctx, [sz * 0.15, sz * 0.7, sz * 0.25, sz * 1.55], [sz * 0.26, sz * 0.21], skin, { lw, seed: seed + 5 });
    ST.blob(ctx, [-sz * 0.44, 0, sz * 0.42, 0, sz * 0.54, sz * 0.55, sz * 0.34, sz * 0.98, -sz * 0.32, sz * 1.0, -sz * 0.55, sz * 0.5], skin, { lw, seed, shade: [shade, -sz * 0.14, sz * 0.05], double: false });
    if (kind === 'fist' || kind === 'grip' || kind === 'point') {
      for (let i = 0; i < 3; i++) ST.stroke(ctx, [-sz * 0.38 + i * sz * 0.22, sz * 0.62, -sz * 0.3 + i * sz * 0.22, sz * 0.88], { w: lw * 0.6, seed: seed + 10 + i });
    }
    if (kind !== 'flat') ST.tube(ctx, [sz * 0.36, sz * 0.25, sz * 0.64, sz * 0.64], [sz * 0.3, sz * 0.23], skin, { lw, seed: seed + 7 });
    ctx.restore();
  };
})();
