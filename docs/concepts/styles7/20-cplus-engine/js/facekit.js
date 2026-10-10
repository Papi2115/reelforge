/* Shared face KIT (style C, extended in film 12): an eye of several outlines under moving lids, a heavy brow, a mouth
   that makes speech shapes with crooked teeth. Optional - most c-plus heads draw their own parts; characters that use
   the kit still place and size every part by hand. Mouths obey the jaw rule: pass o.J (ST.jaw) and the lower lip and
   lower teeth hang off the jaw instead of a free-floating opening height. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const TAU = Math.PI * 2;

  // o.kind: 'egg' (C's), 'bulge' (round, pin pupil), 'slit', 'sunken' (socket ring), 'beady', 'milky' (no pupil),
  // 'droop' (outer corner sags). o: { skin, seed, lw, side 0|1, bags 1|2, bag false, lidAdd, white, socket }
  ST.eye = (ctx, x, y, rx, ry, f, o) => {
    rx *= f.eye; ry *= f.eye;
    const seed = o.seed || 3, pts = [], kind = o.kind || 'egg';
    const sqz = kind === 'slit' ? 0.45 : kind === 'bulge' ? 1.12 : 1;
    if (o.socket) ST.blob(ctx, ST.ellipseRing(x, y + ry * 0.1, rx * 1.55, ry * 1.5 * sqz, 9), o.socket, { lw: 0, seed: seed + 9 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU - Math.PI / 2, egg = Math.sin(a) > 0 ? 1.06 : 0.94;
      const j = 1 + ST.rnd(-0.07, 0.07, seed, i), sag = kind === 'droop' && Math.cos(a) * (o.side ? 1 : -1) > 0.3 ? ry * 0.35 : 0;
      pts.push(x + Math.cos(a) * rx * j, y + Math.sin(a) * ry * egg * j * sqz + sag);
    }
    const c = ST.curve(pts, true, 3);
    ST.path(ctx, c, true);
    ctx.fillStyle = ST.SIL || o.white || (kind === 'milky' ? '#b9bdb0' : C.EYE);
    ctx.fill();
    if (ST.SIL) return;
    ctx.save();
    ST.path(ctx, c, true);
    ctx.clip();
    const pk = { bulge: 0.09, beady: 0.34, slit: 0.2 }[kind] || 0.14;
    const pr = Math.max(rx * pk * f.pup, 2.2), px = x + f.look[0] * rx * 0.55, py = y + f.look[1] * ry * 0.42 * sqz;
    ctx.fillStyle = C.INK;
    ctx.beginPath();
    if (kind !== 'milky') ctx.arc(px, py, pr, 0, TAU);
    ctx.fill();
    const lid = f.lid >= 0.99 ? 1 : Math.max(0, Math.min(1, f.lid + (o.lidAdd || 0)));
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
    ST.inkLine(ctx, c, { w: lw, closed: true, seed });
    if (lid > 0.02 && lid < 0.97) {
      const d = Math.max(0, 1 - Math.pow((ly - y) / (ry * 1.02), 2)), hw = rx * Math.sqrt(d) * 1.08;
      if (hw > 1) ST.stroke(ctx, [x - hw, ly, x, ly + ry * 0.1, x + hw, ly], { w: lw * 1.5, seed: seed + 1, taper: false });
    } else if (lid >= 0.97) ST.stroke(ctx, [x - rx, y + ry * 0.1, x, y + ry * 0.45, x + rx, y + ry * 0.1], { w: lw * 1.3, seed: seed + 2 });
    if (o.bag !== false) {
      ST.stroke(ctx, [x - rx * 0.85, y + ry * 1.12, x, y + ry * 1.42, x + rx * 0.95, y + ry * 1.1], { w: lw * 0.7, seed: seed + 4 });
      if (o.bags === 2) ST.stroke(ctx, [x - rx * 0.6, y + ry * 1.6, x + rx * 0.1, y + ry * 1.82, x + rx * 0.75, y + ry * 1.55], { w: lw * 0.5, seed: seed + 5 });
    }
  };
  // heavy brow: tapered brush stroke. side -1 = screen-left brow, +1 = screen-right. o.u = eye height unit.
  ST.brow = (ctx, x, y, w, side, f, o) => {
    const [raise, knit] = side < 0 ? f.bl : f.br, u = o.u || 20;
    const yy = y - raise * u * 0.6;
    const ix = x - (side * w) / 2, ox = x + (side * w) / 2;
    const iy = yy + knit * u * 0.5, oy = yy - knit * u * 0.12 + (o.droop || 0);
    const mx = (ix + ox) / 2, my = (iy + oy) / 2 - u * 0.28 * (o.arch === undefined ? 1 : o.arch);
    ST.stroke(ctx, [ox, oy, mx, my, ix, iy], { w: o.thick || 14, color: o.color, seed: o.seed || 9 });
  };

  // Mouth: closed shapes are crooked brush lines; open shapes are a dark hole with uneven teeth.
  // o: { teeth: 'few'|'snag'|'gap'|'row'|'none', teethAt: [[u, width, height]], under: [[u, h]] lower teeth, lop
  // (right corner drops by lop*w), open (px at jaw 1 without J), J (the head's ST.jaw: the opening follows the jaw),
  // seed, lw }. f.vis shapes speech: 'O' narrow + round, 'E' wide + flat, 'M' pressed shut, 'A' open.
  ST.mouth = (ctx, x, y, w0, f, o) => {
    const kind = f.mouth, seed = o.seed || 17, lw = o.lw || 5, vis = f.vis;
    const w = w0 * (vis === 'O' ? 0.55 : vis === 'E' ? 1.18 : 1), hw = w / 2;
    const k = vis === 'O' ? 1.15 : vis === 'E' ? 0.5 : 1;
    const h = (o.J ? o.J.d : f.jaw * (o.open || w0 * 0.6)) * k;
    const corner = { flat: [0.05, -0.04], smirk: [0.12, -0.3], frown: [0.3, 0.3], grin: [-0.16, -0.22], twist: [-0.16, 0.2], wavy: [0.08, 0.1], open: [0.08, 0.08], yell: [0.1, 0.06], snarl: [0.04, -0.12], smile: [-0.12, -0.14] }[kind] || [0, 0];
    const lx = x - hw, rx = x + hw, ly = y + corner[0] * w, ry = y + corner[1] * w + (o.lop || 0) * w;
    const under = () => (o.under || []).forEach(([u, th], i) => {
      const tx = x + u * hw, top = y - th + (h >= 4 ? h * 0.9 : 0);
      ST.blob(ctx, [tx - 5, top + th + 2, tx - 4, top + 3, tx + 2, top - 1, tx + 6, top + th + 2], C.TOOTH, { sharp: true, lw: lw * 0.55, seed: seed + 30 + i, shade: [C.TOOTH_D, -2, 0] });
    });
    if (h < 4 || vis === 'M') {
      const mid = kind === 'frown' ? -0.1 : kind === 'grin' || kind === 'smirk' || kind === 'smile' ? 0.12 : 0.03;
      const pts = kind === 'wavy'
        ? [lx, ly, x - hw * 0.5, y - 4, x, y + 4, x + hw * 0.5, y - 4, rx, ry]
        : [lx, ly, x - hw * 0.2, y + mid * w + 3, x + hw * 0.35, y + mid * w - 1, rx, ry];
      ST.stroke(ctx, pts, { w: lw * 1.3, seed, taper: false });
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
    const teeth = o.teethAt || { few: [[-0.5, 0.2], [-0.12, 0.24], [0.38, 0.17]], snag: [[0.15, 0.24]], gap: [[-0.55, 0.18], [-0.3, 0.2], [0.3, 0.2], [0.55, 0.15]], row: [[-0.6, 0.2], [-0.36, 0.22], [-0.12, 0.22], [0.14, 0.2], [0.38, 0.21], [0.6, 0.17]], none: [] }[o.teeth || 'few'];
    const th = Math.min(h * 0.5, w * 0.22);
    ST.hole(ctx, pts, { lw: lw * 1.2, seed, inner: () => teeth.forEach(([u, tw, hk], i) => {
      const tx = x + u * hw * wide, tw2 = tw * hw, ty = top - 4 + ST.rnd(-3, 3, seed, i), sk = ST.rnd(-0.3, 0.3, seed, i, 2) * tw2, tl = th * (hk || ST.rnd(0.7, 1.2, seed, i, 1));
      ST.blob(ctx, [tx - tw2 / 2, ty, tx + tw2 / 2, ty, tx + tw2 / 2 - 1 + sk, ty + tl, tx - tw2 / 2 + 1 + sk, ty + th], C.TOOTH, { sharp: true, lw: lw * 0.5, seed: seed + i, shade: [C.TOOTH_D, -2, 0], double: false });
    }) });
    under();
    return y + h;
  };
})();
