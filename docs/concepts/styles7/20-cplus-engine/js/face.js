/* Face mechanics (no face design): THE JAW RULE, mouth holes, lidded eye sockets, skin marks.
   JAW RULE: an opening mouth deforms ONE connected skin outline. A head builds J = ST.jaw(f.jaw, spec) once and runs
   its skin outline through J.pts(...) and EVERY part that hangs off the jaw - lower lip, lower teeth, chin, wattle,
   jowls, beard, warts, chin stubble, the chin face anchor - through J.y / J.pt / J.pts. The upper lip, nose and
   everything above spec.pivot never move. Nothing below the pivot may be placed at a fixed y.
   (Film 15's Captain moved jowls + chin but not the skin outline or the mouth: the jaw tier detached.) */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const TAU = Math.PI * 2;

  // spec: { pivot: head-local y of the mouth line, drop: px at open = 1, span: px over which the drop fades in
  // (default 10) }. J.y(y) moves a y; J.pt(x, y) -> [x, y']; J.pts(flat) maps a control-point array.
  ST.jaw = (open, spec) => {
    const o = Math.max(0, Math.min(1, open || 0)), d = o * spec.drop, span = spec.span || 10;
    const w = (y) => ST.smooth((y - spec.pivot) / span);
    const y = (yy) => yy + d * w(yy);
    return { open: o, d, pivot: spec.pivot, w, y, pt: (x, yy) => [x, y(yy)], pts: (a) => a.map((v, i) => (i % 2 ? y(v) : v)) };
  };
  const CLOSED = { open: 0, d: 0, pivot: 0, w: () => 0, y: (v) => v, pt: (x, y) => [x, y], pts: (a) => a.slice() };
  ST.jawClosed = () => CLOSED;

  // a mouth opening in the character's own outline: dark fill, tongue, then o.inner(bb) draws that character's teeth
  // clipped to the hole; ink edge (o.lw, 0 = none). Returns { c: curve, bb }.
  ST.hole = (ctx, pts, o) => {
    o = o || {};
    const c = ST.curve(pts, true, 3), bb = ST.bbox(c);
    ST.path(ctx, c, true);
    ctx.fillStyle = ST.SIL || C.MOUTH;
    ctx.fill();
    if (!ST.SIL) {
      ctx.save();
      ST.path(ctx, c, true);
      ctx.clip();
      ctx.fillStyle = C.TONGUE;
      ctx.beginPath();
      ctx.ellipse(bb.cx + bb.w * 0.08, bb.y1, bb.w * 0.32, bb.h * 0.4, 0, 0, TAU);
      ctx.fill();
      if (o.inner) o.inner(bb);
      ctx.restore();
    }
    if (o.lw !== 0) ST.inkLine(ctx, c, { w: o.lw || 5, closed: true, seed: o.seed || 17 });
    return { c, bb };
  };
  // a lidded eye in a character's OWN outline (closed control points). o: { pupil: [x, y], pr, lid 0..1, sq 0..1,
  // skin, lw, seed, white, sag }. Upper lid = skin coming down to the lid edge, lower lid comes up for a squint.
  ST.socketEye = (ctx, pts, o) => {
    const c = ST.curve(pts, true, 3), bb = ST.bbox(c), lw = o.lw || 5;
    ST.path(ctx, c, true);
    ctx.fillStyle = ST.SIL || o.white || '#d6cdb0';
    ctx.fill();
    if (ST.SIL) return bb;
    ctx.save();
    ST.path(ctx, c, true);
    ctx.clip();
    if (o.pr > 0) {
      ctx.fillStyle = C.INK;
      ctx.beginPath();
      ctx.arc(o.pupil[0], o.pupil[1], o.pr, 0, TAU);
      ctx.fill();
    }
    const lid = Math.min(1, o.lid), ly = bb.y0 - 2 + lid * (bb.h + 4), sag = o.sag || 0;
    if (lid > 0.02) {
      ctx.fillStyle = o.skin;
      ST.path(ctx, [bb.x0 - 4, bb.y0 - 30, bb.x1 + 4, bb.y0 - 30, bb.x1 + 4, ly - sag, bb.cx, ly + bb.h * 0.08, bb.x0 - 4, ly + sag], true);
      ctx.fill();
    }
    if (o.sq > 0) {
      const sy = bb.y1 + 2 - o.sq * bb.h * 0.9;
      ctx.fillStyle = o.skin;
      ST.path(ctx, [bb.x0 - 4, bb.y1 + 30, bb.x0 - 4, sy, bb.cx, sy - bb.h * 0.08, bb.x1 + 4, sy, bb.x1 + 4, bb.y1 + 30], true);
      ctx.fill();
    }
    ctx.restore();
    ST.inkLine(ctx, c, { w: lw, closed: true, seed: o.seed || 3 });
    if (lid > 0.02 && lid < 0.97) ST.stroke(ctx, [bb.x0, ly + sag, bb.cx, ly + bb.h * 0.08, bb.x1, ly - sag], { w: lw * 1.5, seed: (o.seed || 3) + 1, taper: false });
    else if (lid >= 0.97) ST.stroke(ctx, [bb.x0, bb.cy, bb.cx, bb.cy + bb.h * 0.3, bb.x1, bb.cy], { w: lw * 1.3, seed: (o.seed || 3) + 2 });
    return bb;
  };

  // stubble: short dark dashes scattered inside a closed region (control points), clipped to it
  ST.stubble = (ctx, pts, seed, n, col) => {
    if (ST.SIL) return;
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
    if (hair && !ST.SIL) ST.stroke(ctx, [x, y - r * 0.4, x + r * 0.6, y - r * 1.8, x + r * 1.4, y - r * 2.2], { w: 2, seed: (seed || 5) + 1, taper: false });
  };
  // pores / pock marks: a handful of tiny dark ticks in a box
  ST.pores = (ctx, x0, y0, w, h, n, seed, col) => {
    if (ST.SIL) return;
    ctx.fillStyle = col || 'rgba(60,30,20,0.45)';
    for (let i = 0; i < n; i++) ctx.fillRect(x0 + ST.hash(seed, i, 7) * w, y0 + ST.hash(seed, i, 8) * h, 3, 2.5);
  };
  // flat tone patch (sunburn, rouge, bruise, lipstick off target): never a gradient
  ST.blotch = (ctx, pts, col) => ST.blob(ctx, pts, col, { lw: 0, seed: (pts[0] | 0) + 7, deco: true });
  // sweat beads (free-floating decorations: skipped by the silhouette validators); drip = which bead slides
  ST.beads = (ctx, pts, drip, seed) => pts.forEach(([x, y], i) => ST.blob(ctx, [x, y - 8 + (i === drip ? 4 : 0), x + 5, y + 4, x, y + 8, x - 5, y + 4], 'rgba(220,235,240,0.85)', { lw: 2.5, seed: seed + i, deco: true }));
  // a slow sweat drop that slides down on twos (k = 0..1 progress)
  ST.sweatDrop = (ctx, x, y, k) => ST.blob(ctx, [x, y - 12 + k * 30, x + 7, y + 3 + k * 30, x, y + 9 + k * 30, x - 7, y + 3 + k * 30], '#bcc7c0', { lw: 3, seed: 61, light: ['rgba(255,255,255,0.6)', -2, -3], deco: true });
})();
