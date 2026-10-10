/* Background people helpers (films 15 + 16): simplified but INDIVIDUAL figures (flat colour + the key light, small
   faces) so the hand-built cast reads in front - never a blob or a sack. Two ways to build one:
   1. ST.bg.rig(ctx, m, D, look, torso(v), head(v, blink)): rigged (views, 2-bone IK arms/legs, act modes) - film 15.
   2. ST.bg.wrap + ST.bg.arm / legs / fill / dot / line: a hand-posed 3/4 figure facing m.dir - film 16.
   Register a person with ST.BG[name] = (ctx, m) => ...; draw with ST.bgPerson(ctx, { who, x, y, s, t, dir|yaw,
   mode: 'stand' | 'wave' | 'vote' | 'point' | 'cheer' | 'cross' | 'laugh', seed }). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, LW = 6;
  const bg = (ST.bg = {});
  ST.BG = {};
  ST.bgPerson = (ctx, m) => ST.BG[m.who](ctx, Object.assign({ dir: 1, mode: 'stand', seed: 3000, t: 0 }, m));

  bg.fill = (ctx, pts, col, seed, o) => ST.blob(ctx, pts, col, Object.assign({ lw: LW, seed, lit: ['rgba(20,14,10,0.3)', 10, false] }, o || {}));
  bg.dot = (ctx, x, y, r) => { ctx.fillStyle = ST.SIL || C.INK; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  bg.line = (ctx, pts, seed, w) => ST.stroke(ctx, pts, { w: w || 3.5, seed, taper: false });
  bg.wrap = (ctx, m, draw) => ST.figure(ctx, { x: m.x, y: m.y, s: m.s, lean: m.lean || 0 }, m.dir < 0, draw);
  // a 2-bone arm in the figure plane: shoulder sh -> hand (clamped), sleeve tube + a small mitten; returns the wrist
  bg.arm = (ctx, sh, hand, l1, l2, w, col, skin, seed, out) => {
    const [E, H] = ST.ik([sh[0], sh[1], 0], [hand[0], hand[1], 0], l1, l2, [out || 0.4, 0.3, -1]);
    ST.tube(ctx, [sh[0], sh[1], E[0], E[1], H[0], H[1]], [w, w * 0.85, w * 0.7], col, { lw: LW, seed });
    ST.blob(ctx, ST.ellipseRing(H[0], H[1] + w * 0.3, w * 0.42, w * 0.48, 7), skin, { lw: 4.5, seed: seed + 1, double: false });
    return H;
  };
  bg.legs = (ctx, hips, feet, w, col, shoe, seed) => feet.forEach(([fx, fy], i) => {
    ST.tube(ctx, [hips[i][0], hips[i][1], (hips[i][0] + fx) / 2 + 4, (hips[i][1] + fy) / 2, fx, fy - 10], [w, w * 0.8, w * 0.7], col, { lw: LW, seed: seed + i });
    ST.blob(ctx, [fx - w * 0.5, fy, fx - w * 0.4, fy - w * 0.6, fx + w * 1.1, fy - w * 0.5, fx + w * 1.2, fy], shoe, { lw: 4.5, seed: seed + 3 + i, double: false });
  });
  // where a free hand goes: hanging (hang = [dx, dy] from the shoulder) or up and waving on twos
  bg.handAt = (m, sh, len, hang) => (m.mode === 'wave' ? [sh[0] + 30 + (Math.floor(ST.twos(m.t || 0) * 6 + m.seed) % 2 ? 22 : -10), sh[1] - len * 0.85] : [sh[0] + hang[0], sh[1] + hang[1]]);

  // act modes for rigged extras (the same pose library as the cast)
  function pose(D, mode, t) {
    if (mode === 'vote' || mode === 'cheer') return ST.pose(mode, D);
    if (mode === 'point') return ST.pose('point', D, -1);
    if (mode === 'cross') return ST.pose('fold', D);
    if (mode === 'laugh') return ST.pose('stand', D, null, { hL: ST.handAt(D, 1, -0.3, 0.55, 0.45), hR: ST.handAt(D, -1, -0.3, 0.55, 0.45), poleL: [1, 0.5, -0.4], poleR: [-1, 0.5, -0.4], bob: Math.floor(ST.twos(t) * 12) % 2 ? 0.03 : 0 });
    return ST.pose('stand', D);
  }
  // light anchors for an extra: shoulders/hips from D, the head box from D.head = { cx, hw, top, bottom } (optional)
  function anchors(V, D, P, hsz) {
    const bob = (P.bob || 0) * (D.l1l + D.l2l), sh = {}, hip = {};
    ['L', 'R'].forEach((side, i) => {
      const sgn = i ? -1 : 1, b = [sgn * D.sw, D.sy + bob, D.sz || 0], q = ST.proj(V, b);
      sh[side] = { b, p: [q[0], q[1]] };
      hip[side] = { b: [sgn * D.hw, D.hy + bob, 0] };
    });
    const h = D.head ? { cx: D.head.cx * (V.v === 2 ? 1 : V.v === 1 ? 0.6 : 0), hw: D.head.hw, top: D.head.top + bob, bottom: D.head.bottom + bob } : null;
    return { D: Object.assign({ hsz }, D), bob, sh, hip, head: h };
  }
  // the shared limb rig for extras: far limbs, body (drawn by the extra), head (drawn by the extra), near limbs.
  // look: { arm, armD, armW, skin, hand, leg, legW, peg, lean, prop(J) }
  bg.rig = (ctx, m, D, look, torso, head) => {
    const V = ST.view(Math.max(-2, Math.min(2, m.yaw || 0))), P = Object.assign(pose(D, m.mode, m.t || 0), look.pose || {});
    const A = anchors(V, D, P, look.hand || 24), J = ST.solve(V, A, P), lw = 7;
    const arm = (j, k) => {
      ST.tube(ctx, [j.s[0], j.s[1], j.e[0], j.e[1], j.h[0], j.h[1]], look.armW || [26, 22, 18], look.arm, { lw, seed: m.seed + 1, lit: [look.armD || 'rgba(0,0,0,0.3)', 8, false] });
      ST.hand(ctx, j.h[0], j.h[1], j.ang, look.hand || 24, look.skin, k || 'fist', { lw: lw * 0.8, seed: m.seed + 2 });
    };
    const leg = (j, sg) => {
      if (look.peg && sg < 0) { ST.tube(ctx, [j.s[0], j.s[1], j.e[0], j.e[1]], [30, 24], look.leg, { lw, seed: m.seed + 3 }); ST.tube(ctx, [j.e[0], j.e[1], j.h[0], j.h[1]], [14, 10], C.FUR, { lw, seed: m.seed + 4 }); return; }
      ST.tube(ctx, [j.s[0], j.s[1], j.e[0], j.e[1], j.h[0], j.h[1] - 4], look.legW || [30, 24, 20], look.leg, { lw, seed: m.seed + 3, lit: ['rgba(0,0,0,0.3)', 8, false] });
      ST.drawFoot(ctx, V, j.H3, sg, { len: 44, sw: 22, shoe: '#221c16', shoeD: '#120e0a', lw, seed: m.seed + 5 });
    };
    ST.groundShadow(ctx, m.x, m.y, 120 * m.s);
    ST.figure(ctx, { x: m.x, y: m.y, s: m.s, lean: look.lean || 0 }, V.mir, () => {
      if (J.aL.behind) arm(J.aL, P.kL);
      if (J.aR.behind) arm(J.aR, P.kR);
      [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => leg(j, sg));
      ctx.save();
      ctx.translate(0, J.bob);
      torso(V.v);
      head(V.v, ST.blink(m.t || 0, m.seed));
      ctx.restore();
      if (!J.aL.behind) arm(J.aL, P.kL);
      if (!J.aR.behind) arm(J.aR, P.kR);
      if (look.prop) look.prop(J);
    });
  };
  // a tiny face for a rigged extra: two dot eyes (blink = a dash), a nose of its own shape, a mouth line
  bg.face = (ctx, v, x, y, o, blink, seed) => {
    const fx = x + [0, 10, 22, 0][v];
    if (v === 3) return;
    const eye = (ex) => (blink > 0.5 ? ST.stroke(ctx, [ex - 5, y, ex + 5, y], { w: 3, seed, taper: false }) : ST.blob(ctx, ST.ellipseRing(ex, y, 4.5, 5, 6), C.INK, { lw: 0, seed }));
    if (v < 2) eye(fx - 14 * (v ? 0.7 : 1));
    eye(fx + 14 * (v === 2 ? 0.3 : 1));
    if (o.nose) ST.blob(ctx, o.nose.map((q, i) => (i % 2 ? y + q : fx + q + v * 6)), o.skin, { lw: 4, seed: seed + 2, lit: [o.skinD, 4, false] });
    ST.stroke(ctx, (o.mouth || [-10, 2, 0, 4, 10, 1]).map((q, i) => (i % 2 ? y + 28 + q : fx + 2 + q + v * 6)), { w: 3.5, seed: seed + 3, taper: false });
  };

  // two examples, one per style of building
  ST.BG.beanpole = (ctx, m) => bg.wrap(ctx, m, () => {
    const sk = '#a8906c', cl = '#5a5a44';
    bg.legs(ctx, [[-8, -400], [10, -400]], [[-16, 0], [20, 0]], 22, '#3e3e30', '#2e241a', m.seed);
    bg.arm(ctx, [-14, -640], [-10, -440], 120, 110, 22, cl, sk, m.seed + 5);
    bg.fill(ctx, [-30, -660, 26, -664, 34, -520, 30, -380, -32, -380, -36, -520], cl, m.seed + 7);
    ST.tube(ctx, [0, -660, 10, -740], [18, 16], sk, { lw: LW, seed: m.seed + 8 }); // long neck
    bg.fill(ctx, ST.ellipseRing(14, -770, 24, 32, 9), sk, m.seed + 9);
    bg.fill(ctx, [-8, -796, 4, -850, 18, -858, 40, -796], '#6e4a30', m.seed + 10); // felt cap
    bg.fill(ctx, [34, -776, 52, -758, 36, -752], sk, m.seed + 11, { lw: 4 });
    bg.dot(ctx, 26, -778, 3);
    bg.line(ctx, [20, -750, 32, -748], m.seed + 12, 2.5);
    bg.arm(ctx, [18, -640], bg.handAt(m, [18, -640], 230, [6, 200]), 120, 110, 22, cl, sk, m.seed + 13);
  });
  const BARREL_D = { sw: 56, sy: -400, sz: 0, l1a: 80, l2a: 72, hw: 22, hy: -160, l1l: 86, l2l: 76, elbowOut: 0.8, head: { cx: 6, hw: 50, top: -520, bottom: -420 } };
  ST.BG.barrel = (ctx, m) => bg.rig(ctx, m, BARREL_D, { arm: '#7a4a3a', skin: '#b88a6a', leg: '#5a3a2c', hand: 26 }, (v) => {
    const k = [1, 0.86, 0.66, 1][v];
    bg.fill(ctx, [-50 * k, -420, 50 * k, -420, 90 * k, -300, 100 * k, -150, -100 * k, -150, -90 * k, -300], '#7a4a3a', m.seed + 7);
    if (v < 3) bg.fill(ctx, [-50 * k, -330, 50 * k, -330, 60 * k, -160, -60 * k, -160], '#a59a7c', m.seed + 8); // apron
  }, (v, blink) => {
    bg.fill(ctx, ST.ellipseRing(6, -470, 46, 50, 9), '#b88a6a', m.seed + 10);
    bg.fill(ctx, [-40, -500, 0, -524, 46, -500, 40, -480, -36, -482], '#3a2a20', m.seed + 12);
    bg.face(ctx, v, 4, -478, { nose: [-6, 6, 8, 2, 4, 16], skin: '#c99a7a', skinD: '#8e6a4a' }, blink, m.seed + 13);
  });
})();
