/* Face brushes: expression vocabulary + eye / brow / mouth / hand / stubble / wart primitives. Characters place and
   size these by hand per view; nothing here decides what a person looks like. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const TAU = Math.PI * 2;

  // lid: upper-lid cover 0..1 · eye: white size · pup: pupil size · bl/br: [raise, knit] per brow · sq: lower-lid squint
  // [left, right] · mouth: shape key · jaw: resting jaw drop 0..1 · look: pupil offset. Default acting is deadpan.
  ST.EXPR = {
    deadpan: { lid: 0.58, eye: 0.96, pup: 1, bl: [-0.15, 0.1], br: [-0.1, 0.15], mouth: 'flat', jaw: 0 },
    miserable: { lid: 0.62, eye: 0.95, pup: 1, bl: [0.1, -0.7], br: [0.05, -0.6], mouth: 'frown', jaw: 0, look: [0, 0.3] },
    exhausted: { lid: 0.78, eye: 0.95, pup: 1, bl: [-0.1, -0.5], br: [-0.2, -0.4], mouth: 'open', jaw: 0.35, look: [0, 0.4] },
    shock: { lid: 0, eye: 1.3, pup: 0.5, bl: [1.1, -0.2], br: [1.1, -0.2], mouth: 'open', jaw: 0.9 },
    rage: { lid: 0.3, eye: 1.06, pup: 0.7, bl: [-0.6, 1.1], br: [-0.6, 1.1], sq: [0.25, 0.25], mouth: 'snarl', jaw: 0.5 },
    smug: { lid: 0.66, eye: 0.98, pup: 1, bl: [-0.25, 0.25], br: [0.7, 0], mouth: 'smirk', jaw: 0 },
    scared: { lid: 0.02, eye: 1.2, pup: 0.5, bl: [0.8, -1], br: [0.8, -1], mouth: 'wavy', jaw: 0.3 },
    confused: { lid: 0.32, eye: 1.04, pup: 0.9, bl: [0.9, -0.3], br: [-0.4, 0.5], mouth: 'twist', jaw: 0.08 },
    sad: { lid: 0.5, eye: 1, pup: 1, bl: [0.2, -1.1], br: [0.2, -1.1], mouth: 'frown', jaw: 0, look: [0, 0.5] },
    yelling: { lid: 0.12, eye: 1.16, pup: 0.6, bl: [-0.3, 1], br: [-0.3, 1], mouth: 'yell', jaw: 1 },
    disgust: { lid: 0.5, eye: 1, pup: 1, sq: [0.45, 0.1], bl: [-0.6, 0.6], br: [0.5, 0], mouth: 'twist', jaw: 0.22 },
    grin: { lid: 0.4, eye: 1, pup: 1, bl: [0.3, 0], br: [0.4, 0], mouth: 'grin', jaw: 0.4 },
    asleep: { lid: 1, eye: 1, pup: 1, bl: [-0.1, -0.3], br: [-0.1, -0.3], mouth: 'open', jaw: 0.25 },
    focused: { lid: 0.44, eye: 1, pup: 0.85, bl: [-0.35, 0.7], br: [-0.35, 0.7], sq: [0.2, 0.2], mouth: 'flat', jaw: 0 },
  };

  // resolved face state at time t: expression + blink + talking jaw (+ per-call overrides)
  ST.face = (t, seed, expr, o) => {
    const e = ST.EXPR[expr] || ST.EXPR.deadpan;
    o = o || {};
    const talk = o.talk ? ST.talk(t, seed, o.talk) : 0;
    const blink = o.noBlink || e.lid >= 1 ? 0 : ST.blink(t, seed);
    return {
      lid: Math.max(e.lid, blink), eye: e.eye, pup: e.pup, bl: e.bl, br: e.br, sq: e.sq || [0, 0],
      mouth: talk > 0 && (e.mouth === 'flat' || e.mouth === 'frown') ? 'open' : e.mouth,
      jaw: Math.max(e.jaw, talk * (o.talkAmp || 0.8)), look: o.look || e.look || [0, 0], name: expr,
    };
  };

  // Egg-shaped dirty-white eye, tiny pupil, heavy upper lid in skin colour, double bag under it. side: 0 left, 1 right.
  ST.eye = (ctx, x, y, rx, ry, f, o) => {
    rx *= f.eye; ry *= f.eye;
    const seed = o.seed || 3, pts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU - Math.PI / 2, egg = Math.sin(a) > 0 ? 1.06 : 0.94;
      const j = 1 + ST.rnd(-0.07, 0.07, seed, i);
      pts.push(x + Math.cos(a) * rx * j, y + Math.sin(a) * ry * egg * j);
    }
    const c = ST.curve(pts, true, 3);
    ST.path(ctx, c, true);
    ctx.fillStyle = o.white || C.EYE;
    ctx.fill();
    ctx.save();
    ST.path(ctx, c, true);
    ctx.clip();
    const pr = Math.max(rx * 0.14 * f.pup, 2.2), px = x + f.look[0] * rx * 0.55, py = y + f.look[1] * ry * 0.42;
    ctx.fillStyle = C.INK;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TAU);
    ctx.fill();
    const lid = Math.min(1, f.lid + (o.lidAdd || 0));
    const ly = y - ry * 1.1 + lid * 2.25 * ry;
    if (lid > 0.02) {
      ctx.fillStyle = o.skin;
      ST.path(ctx, [x - rx * 1.4, y - ry * 1.5, x + rx * 1.4, y - ry * 1.5, x + rx * 1.4, ly, x, ly + ry * 0.12, x - rx * 1.4, ly], true);
      ctx.fill();
    }
    const sq = f.sq[o.side || 0];
    if (sq > 0) {
      const sy = y + ry * 1.05 - sq * 2 * ry;
      ctx.fillStyle = o.skin;
      ST.path(ctx, [x - rx * 1.4, y + ry * 1.5, x - rx * 1.4, sy + ry * 0.1, x, sy - ry * 0.1, x + rx * 1.4, sy + ry * 0.1, x + rx * 1.4, y + ry * 1.5], true);
      ctx.fill();
    }
    ctx.restore();
    const lw = o.lw || 5;
    ST.inkLine(ctx, c, { w: lw, closed: true, seed: seed });
    if (lid > 0.02 && lid < 0.97) {
      const d = Math.max(0, 1 - Math.pow((ly - y) / (ry * 1.02), 2)), hw = rx * Math.sqrt(d) * 1.08;
      if (hw > 1) ST.stroke(ctx, [x - hw, ly, x, ly + ry * 0.1, x + hw, ly], { w: lw * 1.5, seed: seed + 1, taper: false });
    } else if (lid >= 0.97) ST.stroke(ctx, [x - rx, y + ry * 0.1, x, y + ry * 0.45, x + rx, y + ry * 0.1], { w: lw * 1.3, seed: seed + 2 });
    if (o.bag !== false) {
      ST.stroke(ctx, [x - rx * 0.85, y + ry * 1.12, x, y + ry * 1.42, x + rx * 0.95, y + ry * 1.1], { w: lw * 0.7, seed: seed + 4 });
      if (o.bags === 2) ST.stroke(ctx, [x - rx * 0.6, y + ry * 1.6, x + rx * 0.1, y + ry * 1.82, x + rx * 0.75, y + ry * 1.55], { w: lw * 0.5, seed: seed + 5 });
    }
  };

  // Heavy brow: tapered brush stroke. side -1 = screen-left brow, +1 = screen-right. u = eye height unit.
  ST.brow = (ctx, x, y, w, side, f, o) => {
    const [raise, knit] = side < 0 ? f.bl : f.br, u = o.u || 20;
    const yy = y - raise * u * 0.6;
    const ix = x - (side * w) / 2, ox = x + (side * w) / 2;
    const iy = yy + knit * u * 0.5, oy = yy - knit * u * 0.12 + (o.droop || 0);
    const mx = (ix + ox) / 2, my = (iy + oy) / 2 - u * 0.28 * (o.arch === undefined ? 1 : o.arch);
    ST.stroke(ctx, [ox, oy, mx, my, ix, iy], { w: o.thick || 14, color: o.color, seed: o.seed || 9 });
  };

  // Mouth: closed shapes are crooked brush lines; open shapes are a dark hole with yellow, uneven, crooked teeth.
  // teeth: 'few' | 'snag' | 'gap' | 'row' | 'none'. under: [u, h] lower teeth jutting over the lip even when closed.
  ST.mouth = (ctx, x, y, w, f, o) => {
    const kind = f.mouth, seed = o.seed || 17, hw = w / 2, lw = o.lw || 5;
    const h = f.jaw * (o.open || w * 0.6);
    const corner = { flat: [0.05, -0.04], smirk: [0.12, -0.3], frown: [0.3, 0.3], grin: [-0.16, -0.22], twist: [-0.16, 0.2], wavy: [0.08, 0.1], open: [0.08, 0.08], yell: [0.1, 0.06], snarl: [0.04, -0.12] }[kind] || [0, 0];
    const lx = x - hw, rx = x + hw, ly = y + corner[0] * w, ry = y + corner[1] * w;
    const under = () => (o.under || []).forEach(([u, th], i) => {
      const tx = x + u * hw, top = y - th + (h >= 4 ? h * 0.9 : 0);
      ST.blob(ctx, [tx - 5, top + th + 2, tx - 4, top + 3, tx + 2, top - 1, tx + 6, top + th + 2], C.TOOTH, { sharp: true, lw: lw * 0.55, seed: seed + 30 + i, shade: [C.TOOTH_D, -2, 0] });
    });
    if (h < 4) {
      const mid = kind === 'frown' ? -0.1 : kind === 'grin' || kind === 'smirk' ? 0.12 : 0.03;
      const pts = kind === 'wavy'
        ? [lx, ly, x - hw * 0.5, y - 4, x, y + 4, x + hw * 0.5, y - 4, rx, ry]
        : [lx, ly, x - hw * 0.2, y + mid * w + 3, x + hw * 0.35, y + mid * w - 1, rx, ry];
      ST.stroke(ctx, pts, { w: lw * 1.3, seed: seed, taper: false });
      ST.stroke(ctx, [rx - 2, ry - 8, rx + 5, ry + 4], { w: lw * 0.6, seed: seed + 1 });
      ST.stroke(ctx, [lx + 3, ly - 6, lx - 4, ly + 5], { w: lw * 0.5, seed: seed + 2 });
      under();
      return y;
    }
    const top = kind === 'snarl' ? y - h * 0.25 : kind === 'grin' ? y - h * 0.05 : y - h * 0.1;
    const wide = kind === 'open' ? 0.72 : kind === 'yell' ? 1.08 : 1;
    const L = x - hw * wide, R = x + hw * wide;
    const pts = kind === 'yell'
      ? [L, ly, x - hw * 0.4, top, x + hw * 0.45, top - 3, R, ry, x + hw * 0.6, y + h, x - hw * 0.5, y + h * 1.04]
      : [L, ly, x - hw * 0.45, top + (kind === 'snarl' ? h * 0.2 : 0), x + hw * 0.3, top, R, ry, x + hw * 0.25, y + h, x - hw * 0.35, y + h * 0.92];
    const c = ST.curve(pts, true, 3);
    ST.path(ctx, c, true);
    ctx.fillStyle = C.MOUTH;
    ctx.fill();
    ctx.save();
    ST.path(ctx, c, true);
    ctx.clip();
    ctx.fillStyle = C.TONGUE;
    ctx.beginPath();
    ctx.ellipse(x + hw * 0.1, y + h * 1.0, hw * 0.55, h * 0.38, 0, 0, TAU);
    ctx.fill();
    const teeth = { few: [[-0.5, 0.2], [-0.12, 0.24], [0.38, 0.17]], snag: [[0.15, 0.24]], gap: [[-0.55, 0.18], [-0.3, 0.2], [0.3, 0.2], [0.55, 0.15]], row: [[-0.6, 0.2], [-0.36, 0.22], [-0.12, 0.22], [0.14, 0.2], [0.38, 0.21], [0.6, 0.17]], none: [] }[o.teeth || 'few'];
    const th = Math.min(h * 0.5, w * 0.22);
    teeth.forEach(([u, tw], i) => {
      const tx = x + u * hw * wide, tw2 = tw * hw, ty = top - 4 + ST.rnd(-3, 3, seed, i), sk = ST.rnd(-0.3, 0.3, seed, i, 2) * tw2;
      ST.blob(ctx, [tx - tw2 / 2, ty, tx + tw2 / 2, ty, tx + tw2 / 2 - 1 + sk, ty + th * ST.rnd(0.7, 1.2, seed, i, 1), tx - tw2 / 2 + 1 + sk, ty + th], C.TOOTH, { sharp: true, lw: lw * 0.5, seed: seed + i, shade: [C.TOOTH_D, -2, 0] });
    });
    ctx.restore();
    ST.inkLine(ctx, c, { w: lw * 1.2, closed: true, seed: seed });
    under();
    return y + h;
  };

  // stubble: short dark dashes scattered inside a closed region (control points), clipped to it
  ST.stubble = (ctx, pts, seed, n, col) => {
    const c = ST.curve(pts, true, 6), bb = ST.bbox(c);
    ctx.save();
    ST.path(ctx, c, true);
    ctx.clip();
    ctx.strokeStyle = col || 'rgba(30,24,18,0.55)';
    ctx.lineWidth = 2.4 * ST.LW;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = bb.x0 + ST.hash(seed, i, 1) * bb.w, y = bb.y0 + ST.hash(seed, i, 2) * bb.h, a = ST.rnd(1.2, 1.9, seed, i, 3);
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4);
    }
    ctx.stroke();
    ctx.restore();
  };
  // wart / mole: a lumpy dark-skin blob with a hair or two
  ST.wart = (ctx, x, y, r, col, seed, hair) => {
    ST.blob(ctx, ST.ellipseRing(x, y, r, r * 0.85, 7), col, { lw: 3, seed: seed || 5, patch: ['rgba(255,240,210,0.18)', -r * 0.2, -r * 0.3, 0.4] });
    if (hair) ST.stroke(ctx, [x, y - r * 0.4, x + r * 0.6, y - r * 1.8, x + r * 1.4, y - r * 2.2], { w: 2, seed: (seed || 5) + 1, taper: false });
  };
  // pores / pock marks: a handful of tiny dark ticks in a box
  ST.pores = (ctx, x0, y0, w, h, n, seed, col) => {
    ctx.fillStyle = col || 'rgba(60,30,20,0.45)';
    for (let i = 0; i < n; i++) ctx.fillRect(x0 + ST.hash(seed, i, 7) * w, y0 + ST.hash(seed, i, 8) * h, 3, 2.5);
  };

  // Mitten hand. ang = forearm direction (deg, 0 = down). kind: 'fist' | 'open' | 'point' | 'grip' | 'flat'. Thumb toward +x.
  ST.hand = (ctx, x, y, ang, sz, skin, kind, o) => {
    o = o || {};
    const seed = o.seed || 23, shade = o.shade || 'rgba(50,25,15,0.3)', lw = o.lw || 5.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((-ang * Math.PI) / 180);
    const blobOpts = { lw, seed, shade: [shade, -sz * 0.14, sz * 0.05] };
    if (kind === 'open') {
      [-0.38, -0.12, 0.13, 0.36].forEach((u, i) => {
        const a = u * 0.9, l = sz * (0.6 + (i === 1 ? 0.12 : 0) - (i === 3 ? 0.12 : 0));
        ST.tube(ctx, [u * sz * 0.6, sz * 0.75, u * sz * 0.6 + Math.sin(a) * l, sz * 0.75 + Math.cos(a) * l], [sz * 0.26, sz * 0.21], skin, { lw, seed: seed + i });
      });
    }
    if (kind === 'point') ST.tube(ctx, [sz * 0.15, sz * 0.7, sz * 0.25, sz * 1.55], [sz * 0.26, sz * 0.21], skin, { lw, seed: seed + 5 });
    ST.blob(ctx, [-sz * 0.44, 0, sz * 0.42, 0, sz * 0.54, sz * 0.55, sz * 0.34, sz * 0.98, -sz * 0.32, sz * 1.0, -sz * 0.55, sz * 0.5], skin, blobOpts);
    if (kind === 'fist' || kind === 'grip' || kind === 'point') {
      for (let i = 0; i < 3; i++) ST.stroke(ctx, [-sz * 0.38 + i * sz * 0.22, sz * 0.62, -sz * 0.3 + i * sz * 0.22, sz * 0.88], { w: lw * 0.6, seed: seed + 10 + i });
    }
    if (kind !== 'flat') ST.tube(ctx, [sz * 0.36, sz * 0.25, sz * 0.64, sz * 0.64], [sz * 0.3, sz * 0.23], skin, { lw, seed: seed + 7 });
    ctx.restore();
  };
})();
