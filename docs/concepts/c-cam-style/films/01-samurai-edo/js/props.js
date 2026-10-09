/* Topic props + placement helpers for the Edo film, built only from C's brushes and rig (no new drawing style).
   - Bow: the upper body turns around the hip joint while legs stay planted (drawn by each character).
   - World <-> figure space, so a hand can be solved to land exactly on another figure's palm (the coin exchange).
   - Props: the two swords (projected from body space through the view), rice bale, gold koban, abacus, ledger,
     jingasa hat, seal stamp. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const RAD = Math.PI / 180, DEG = [0, 45, 90, 180];
  const rot = (pt, cx, cy, deg) => {
    const a = deg * RAD, x = pt[0] - cx, y = pt[1] - cy;
    return [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)];
  };

  // ---- bowing: the upper body rotates by deg (+ = forward) around the hip pivot (0, hy) in figure space ----
  ST.bowed = (ctx, hy, deg, fn) => {
    if (!deg) { fn(); return; }
    ctx.save();
    ctx.translate(0, hy);
    ctx.rotate(deg * RAD);
    ctx.translate(0, -hy);
    fn();
    ctx.restore();
  };
  ST.bowPt = (pt, hy, deg) => rot(pt, 0, hy, deg || 0);

  // figure space (as inside ST.figure: origin at the feet, mirrored when flip) <-> world
  ST.figToWorld = (p, flip, lean, pt) => {
    const r = rot(pt, 0, 0, lean || 0);
    return [p.x + (flip ? -1 : 1) * p.s * r[0], p.y + p.s * r[1]];
  };
  ST.worldToFig = (p, flip, lean, w) => rot([((w[0] - p.x) / p.s) * (flip ? -1 : 1), (w[1] - p.y) / p.s], 0, 0, -(lean || 0));

  // body-space hand target whose projection lands on the figure-space point q. keep = the body coordinate held fixed
  // (x for side-ish views, z for front/back) - the view only fixes one horizontal axis.
  ST.bodyAt = (V, q, bob, keep) => {
    const a = DEG[V.v] * RAD, s = Math.sin(a), c = Math.cos(a), y = q[1] - bob;
    if (Math.abs(s) > 0.5) { const xp = V.mir ? -keep : keep; return [keep, y, (q[0] - xp * c) / s]; }
    const xp = (q[0] - keep * s) / c;
    return [V.mir ? -xp : xp, y, keep];
  };
  // solve one hand (side 'L' | 'R') so its PALM lands on the world point w (a few fixed-point steps on the palm offset)
  ST.reachPalm = (ch, p, P, side, w, keep) => {
    const V = ST.view(p.yaw || 0), lean = (p.lean || 0) + (P.lean || 0), bob = (P.bob || 0) * (ch.D.l1l + ch.D.l2l);
    const q = ST.bowPt(ST.worldToFig(p, V.mir, lean, w), ch.D.hy + bob, -(p.bow || 0));
    let aim = q, T = null;
    for (let i = 0; i < 4; i++) {
      T = ST.bodyAt(V, aim, bob, keep);
      const J = ST.solve(V, ch.D, Object.assign({}, P, { ['h' + side]: T })), g = ST.palm(J['a' + side], ch.hsz);
      aim = [aim[0] + q[0] - g[0], aim[1] + q[1] - g[1]];
    }
    return T;
  };
  // world position of a figure's palm (side 'L' | 'R') for the props p and pose P it will be drawn with
  ST.palmWorld = (ch, p, P, side) => {
    const V = ST.view(p.yaw || 0), J = ST.solve(V, ch.D, P), g = ST.palm(J['a' + side], ch.hsz);
    return ST.figToWorld(p, V.mir, (p.lean || 0) + (P.lean || 0), ST.bowPt(g, ch.D.hy + J.bob, p.bow || 0));
  };

  // kimono sleeve bag (sode): hangs straight down from the forearm of an arm rig j; drawn before the arm tube
  // (V: in side views the bag swings out behind the arm, in front views it hangs flat behind it)
  ST.sode = (ctx, V, j, drop, col, colD, seed) => {
    const { e, h } = j, w0 = [e[0] + (h[0] - e[0]) * 0.82, e[1] + (h[1] - e[1]) * 0.82], e0 = [e[0] + (h[0] - e[0]) * 0.1, e[1] + (h[1] - e[1]) * 0.1];
    const lo = Math.max(w0[1], e0[1]) + drop * 0.6, bk = -Math.sin((DEG[V.v] * Math.PI) / 180) * drop * 0.7;
    ST.blob(ctx, [e0[0], e0[1], w0[0], w0[1], w0[0] + bk * 0.4, lo, (w0[0] + e0[0]) / 2 + bk, lo + 6, e0[0] + bk, lo - drop * 0.3], col, { lw: 6, seed, shade: [colD, -10, 6], hatch: { c: 'rgba(14,12,10,0.5)', n: 2, len: 26, gap: 6, k: 3, ang: 80, bend: 0.05 } });
  };

  // a kneeling figure behind furniture: drawn lowered by drop (body units) and clipped at the floor line floorY
  ST.seated = (ctx, ch, p, floorY, drop) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-4000, -4000, 10000, floorY + 4000);
    ctx.clip();
    ch.draw(ctx, Object.assign({}, p, { y: floorY + (drop || 230) * p.s }));
    ctx.restore();
  };

  // ---- the two swords (daisho) through the obi at the left hip. S: { g, h, e, g2, h2, e2 } body-space guard, hilt
  // end, scabbard end (katana, then the short sword). Parts toward the camera (depth > 0) draw after the torso.
  // tilt (deg, profile views): the scabbard pivots at the guard, + = its end goes down (a cat sitting on it).
  ST.swordEnd = (V, S, tilt) => {
    const g = ST.proj(V, S.g), e = ST.proj(V, S.e);
    return rot([e[0], e[1]], g[0], g[1], -(tilt || 0));
  };
  ST.daisho = (ctx, V, S, front, o) => {
    o = o || {};
    [['g', 'h', 'e', 1], ['g2', 'h2', 'e2', 0.72]].forEach(([gk, hk, ek, k], i) => {
      const g = ST.proj(V, S[gk]), h = ST.proj(V, S[hk]), e3 = ST.proj(V, S[ek]);
      const e = i === 0 ? ST.swordEnd(V, S, o.tilt) : [e3[0], e3[1]];
      if ((e3[2] > 0) === front) {
        ST.tube(ctx, [g[0], g[1], (g[0] + e[0]) / 2, (g[1] + e[1]) / 2 + 3, e[0], e[1]], [22 * k + 6, 21 * k + 6, 19 * k + 5], C.BLACK, { lw: 5, seed: 700 + i, light: ['#4a4540', 2, -3] });
        ST.tube(ctx, [e[0] + (g[0] - e[0]) * 0.06, e[1] + (g[1] - e[1]) * 0.06, e[0], e[1]], [21 * k + 7, 21 * k + 7], '#57503f', { lw: 4, seed: 710 + i });
      }
      if ((h[2] > 0) === front) {
        ST.tube(ctx, [g[0], g[1], h[0], h[1]], [22 * k + 5, 20 * k + 5], '#2a2a2c', { lw: 5, seed: 720 + i });
        for (let j = 1; j < 4; j++) {
          const u = j / 4.2, x = g[0] + (h[0] - g[0]) * u, y = g[1] + (h[1] - g[1]) * u;
          ST.stroke(ctx, [x - 6, y - 7, x + 6, y + 7], { w: 3, color: '#8a826c', seed: 730 + j, taper: false });
        }
        ST.blob(ctx, ST.ellipseRing(g[0], g[1], 9 * k + 6, 15 * k + 6, 8), '#3d3a33', { lw: 4, seed: 740 + i, light: ['#6a6352', 2, -3] });
      }
    });
  };
  // a sword lying on its rack (screen space): hilt at (x, y), length len, the drawn blade a hand's width out when bare
  ST.rackSword = (ctx, x, y, len, seed, gleam) => {
    ST.tube(ctx, [x, y, x + len * 0.72, y - 6], [20, 18], C.BLACK, { lw: 5, seed, light: ['#4a4540', 2, -3] });
    ST.tube(ctx, [x - len * 0.26, y + 2, x - 8, y], [18, 20], '#2a2a2c', { lw: 5, seed: seed + 1 });
    ST.blob(ctx, ST.ellipseRing(x - 4, y, 8, 18, 8), '#3d3a33', { lw: 4, seed: seed + 2 });
    if (gleam) {
      ST.tube(ctx, [x + 2, y - 1, x + len * 0.16, y - 3], [12, 11], '#b8b39c', { lw: 4, seed: seed + 3, light: ['#e6e0c8', 0, -3] });
      ctx.fillStyle = '#efe7c8';
      const cx = x + len * 0.12, cy = y - 4, r = 24 + 44 * gleam;
      ST.path(ctx, [cx - r, cy, cx - 5, cy - 5, cx, cy - r, cx + 5, cy - 5, cx + r, cy, cx + 5, cy + 5, cx, cy + r, cx - 5, cy + 5], true);
      ctx.fill();
    }
  };

  // ---- rice bale (tawara): a straw drum, end caps toward the sides, three rope bands. centre (x, y), size w x h ----
  ST.bale = (ctx, x, y, w, h, seed) => {
    ST.blob(ctx, [x - w / 2, y - h * 0.42, x, y - h / 2, x + w / 2, y - h * 0.42, x + w * 0.54, y, x + w / 2, y + h * 0.42, x, y + h / 2, x - w / 2, y + h * 0.42, x - w * 0.54, y], '#a08a52', { lw: 6, seed, shade: ['#7a6838', -12, 8], hatch: { c: 'rgba(70,52,20,0.55)', n: 7, len: 28, gap: 5, k: 3, ang: 0, bend: 0.08 } });
    [-1, 1].forEach((s) => ST.blob(ctx, ST.ellipseRing(x + s * w * 0.47, y, w * 0.08, h * 0.44, 10), '#8b7442', { lw: 5, seed: seed + 2 + s, hatch: { c: 'rgba(60,40,14,0.6)', n: 3, len: 14, gap: 4, k: 3, ang: 30 } }));
    [-0.24, 0, 0.24].forEach((u, i) => ST.stroke(ctx, [x + u * w - 4, y - h * 0.5, x + u * w + 3, y, x + u * w - 4, y + h * 0.5], { w: 7, color: '#4e3c22', seed: seed + 5 + i, taper: false }));
  };
  // gold koban: flat ovals in a small fan (the accent of the exchange), centre (x, y)
  ST.koban = (ctx, x, y, n, seed) => {
    for (let i = 0; i < n; i++) {
      const cx = x + (i - (n - 1) / 2) * 12, cy = y - i * 4;
      ST.blob(ctx, ST.ellipseRing(cx, cy, 13, 20, 10, (i - 1) * 0.2), C.GOLD, { lw: 4, seed: seed + i, shade: [C.GOLD_D, -3, 3], inner: () => ST.stroke(ctx, [cx - 6, cy - 8, cx - 6, cy + 8], { w: 2, color: C.GOLD_D, seed: seed + 9, taper: false }) });
    }
  };
  // soroban: dark frame, a bar, rods with beads (counting = beads hop on twos). centre (x, y), width w, angle ang (deg)
  ST.abacus = (ctx, x, y, w, ang, seed, tick) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((ang || 0) * RAD);
    const h = w * 0.36;
    ST.rect(ctx, -w / 2, -h / 2, w, h, '#2e241b', { seed, lw: 5, amp: 1 });
    ST.rect(ctx, -w / 2 + 8, -h / 2 + 8, w - 16, h - 16, '#6b5a40', { seed: seed + 1, lw: 2, amp: 0.5 });
    ST.stroke(ctx, [-w / 2 + 8, -h * 0.18, w / 2 - 8, -h * 0.18], { w: 5, color: '#2e241b', seed: seed + 2, taper: false });
    const rods = 7;
    for (let r = 0; r < rods; r++) {
      const rx = -w / 2 + 16 + ((w - 32) * (r + 0.5)) / rods, up = ST.hash(seed, r, tick || 0) < 0.5;
      [[-h * 0.32 + (up ? 0 : 6)], [-h * 0.02 + (up ? 0 : 10)], [h * 0.14], [h * 0.28]].forEach(([by], b) => ST.blob(ctx, ST.ellipseRing(rx, by, 7, 5, 6), b === 0 ? '#3b2c1f' : '#5a4430', { lw: 2.5, seed: seed + 10 + r * 4 + b }));
    }
    ctx.restore();
  };
  // a seal stamp (hanko block) gripped at the palm g; bottom face down
  ST.hanko = (ctx, g, seed) => {
    ST.rough(ctx, [g[0] - 14, g[1] - 26, g[0] + 14, g[1] - 26, g[0] + 16, g[1] + 34, g[0] - 16, g[1] + 34], '#6a5236', { seed, lw: 5, amp: 1, shade: ['#4c3a26', -5, 0] });
  };
  // the jingasa: flat lacquered cone hat, drawn in head space on top of the head (top = crown y)
  ST.jingasa = (ctx, cx, top, w, seed) => {
    ST.blob(ctx, [cx - w / 2, top + 14, cx - w * 0.3, top - 6, cx, top - 26, cx + w * 0.3, top - 6, cx + w / 2, top + 14, cx, top + 6], C.BLACK, { lw: 6, seed, light: ['#4b4640', 4, -6], hatch: { c: 'rgba(150,140,110,0.25)', n: 3, len: 30, gap: 6, k: 2, ang: 8 } });
    ST.blob(ctx, ST.ellipseRing(cx, top - 22, 8, 5, 6), C.GOLD_D, { lw: 3, seed: seed + 1 });
  };
})();
