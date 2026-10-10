/* Brushes - shared drawing code only. c-plus line: the ink centre line wanders (no perfect curve), heavy contours
   (lw >= 8) on heads / torsos / props / clothes sometimes get a thin doubled stroke, interior strokes are thinner,
   hatching is scratchy with a kink (optionally cross-hatched). Filled shapes can take the shot's key light (o.lit).
   LIMB RULE: tubes (arms, hands, legs, feet, straps) never get the doubled stroke - it made every limb look glitchy.
   Silhouette mode (ST.SIL = colour): everything fills flat in one colour (validators, foreground silhouettes). */
'use strict';
(function () {
  const ST = window.ST, C = ST.C;
  const TAU = Math.PI * 2;
  ST.LW = 1; // ink width multiplier for the current figure/camera scale
  ST.camZ = 1;
  ST.SIL = null;
  ST.silhouette = (col, draw) => { const keep = ST.SIL; ST.SIL = col; draw(); ST.SIL = keep; };

  // Catmull-Rom through control points (flat [x,y,...])
  ST.curve = (pts, closed, step) => {
    const n = pts.length >> 1;
    if (n < 3) return pts.slice();
    const out = [], st = step || 7;
    const at = (i) => 2 * (closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i)));
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
      const x0 = pts[a], y0 = pts[a + 1], x1 = pts[b], y1 = pts[b + 1], x2 = pts[c], y2 = pts[c + 1], x3 = pts[d], y3 = pts[d + 1];
      const m = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / st));
      for (let k = 0; k < m; k++) {
        const t = k / m, t2 = t * t, t3 = t2 * t;
        out.push(
          0.5 * (2 * x1 + (-x0 + x2) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (-x0 + 3 * x1 - 3 * x2 + x3) * t3),
          0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3),
        );
      }
    }
    if (!closed) out.push(pts[2 * n - 2], pts[2 * n - 1]);
    return out;
  };
  ST.path = (ctx, c, closed) => {
    ctx.beginPath();
    ctx.moveTo(c[0], c[1]);
    for (let i = 2; i < c.length; i += 2) ctx.lineTo(c[i], c[i + 1]);
    if (closed) ctx.closePath();
  };
  ST.bbox = (c) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < c.length; i += 2) {
      if (c[i] < x0) x0 = c[i]; if (c[i] > x1) x1 = c[i];
      if (c[i + 1] < y0) y0 = c[i + 1]; if (c[i + 1] > y1) y1 = c[i + 1];
    }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };

  // the ink line: a filled ribbon whose width swells and pinches hard along its length; its spine wanders a little
  // (o.scratch, default 1.2 px) so no curve is ever perfect
  ST.inkLine = (ctx, c, o) => {
    const n = c.length >> 1;
    if (n < 2) return;
    const closed = !!o.closed, seed = o.seed || 1, base = (o.w || 7) * ST.LW, amp = (o.scratch === undefined ? 1.2 : o.scratch) * ST.LW;
    const L = [], R = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const ip = closed ? (i - 1 + n) % n : Math.max(0, i - 1), inx = closed ? (i + 1) % n : Math.min(n - 1, i + 1);
      let tx = c[2 * inx] - c[2 * ip], ty = c[2 * inx + 1] - c[2 * ip + 1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      if (i > 0) acc += Math.hypot(c[2 * i] - c[2 * i - 2], c[2 * i + 1] - c[2 * i - 1]);
      const k = ST.noise1(seed, acc / 30), wob = amp * (ST.noise1(seed + 13, acc / 7) - 0.5) * 2;
      let w = base * (0.4 + 1.25 * k * k + 0.25 * ST.noise1(seed + 7, acc / 9));
      if (!closed && o.taper !== false) w *= Math.min(1, 0.12 + 2.2 * Math.sin(Math.PI * (i / (n - 1))));
      const px = c[2 * i] - ty * wob, py = c[2 * i + 1] + tx * wob;
      L.push(px - (ty * w) / 2, py + (tx * w) / 2);
      R.push(px + (ty * w) / 2, py - (tx * w) / 2);
    }
    ctx.fillStyle = ST.SIL || o.color || C.INK;
    ctx.beginPath();
    ctx.moveTo(L[0], L[1]);
    for (let i = 2; i < L.length; i += 2) ctx.lineTo(L[i], L[i + 1]);
    if (closed) {
      ctx.closePath();
      ctx.moveTo(R[R.length - 2], R[R.length - 1]);
      for (let i = R.length - 4; i >= 0; i -= 2) ctx.lineTo(R[i], R[i + 1]);
      ctx.closePath();
    } else for (let i = R.length - 2; i >= 0; i -= 2) ctx.lineTo(R[i], R[i + 1]);
    ctx.fill('nonzero');
  };
  // open brush stroke through control points (wrinkles, folds, brows, cracks)
  ST.stroke = (ctx, pts, o) => ST.inkLine(ctx, pts.length > 4 ? ST.curve(pts, false, 4) : pts, Object.assign({ w: 4.5 }, o));

  function scaled(c, k, dx, dy) {
    const b = ST.bbox(c), o = new Array(c.length);
    for (let i = 0; i < c.length; i += 2) { o[i] = b.cx + (c[i] - b.cx) * k + dx; o[i + 1] = b.cy + (c[i + 1] - b.cy) * k + dy; }
    return o;
  }
  // flat crescent on the (dx, dy) side of a shape: the part not covered by itself shifted back by (dx, dy)
  function crescent(ctx, c, spec) {
    const [col, dx, dy] = spec;
    ctx.beginPath();
    const s = scaled(c, 1, -dx, -dy);
    ctx.moveTo(c[0], c[1]);
    for (let i = 2; i < c.length; i += 2) ctx.lineTo(c[i], c[i + 1]);
    ctx.closePath();
    ctx.moveTo(s[0], s[1]);
    for (let i = 2; i < s.length; i += 2) ctx.lineTo(s[i], s[i + 1]);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill('evenodd');
  }
  // irregular flat tone shapes (mottling, stains drawn as deliberate patches, never noise)
  ST.mottle = (ctx, bb, m, seed) => {
    const [col, count, size] = m;
    ctx.fillStyle = col;
    for (let k = 0; k < count; k++) {
      const cx = bb.x0 + ST.hash(seed, k, 21) * bb.w, cy = bb.y0 + ST.hash(seed, k, 22) * bb.h;
      const r = size * (0.5 + ST.hash(seed, k, 23)), pts = [];
      for (let j = 0; j < 7; j++) {
        const a = (j / 7) * TAU, rr = r * (0.55 + 0.6 * ST.hash(seed, k, j));
        pts.push(cx + Math.cos(a) * rr * 1.35, cy + Math.sin(a) * rr * 0.8);
      }
      ST.path(ctx, ST.curve(pts, true, 4), true);
      ctx.fill();
    }
  };
  // scratchy hatching: clusters of straight strokes with one kink each, varying weight; h.cross adds a second pass
  ST.hatch = (ctx, bb, h, seed) => {
    if (ST.SIL) return;
    ctx.strokeStyle = h.c || 'rgba(22,18,14,0.6)';
    ctx.lineCap = 'round';
    const n = h.n || 6, k = h.k || 4, len = h.len || 30, gap = h.gap || 7;
    for (let i = 0; i < n; i++) {
      const cx = bb.x0 + ST.hash(seed, i, 31) * bb.w, cy = bb.y0 + ST.hash(seed, i, 32) * bb.h;
      const a = (((h.ang === undefined ? -40 : h.ang) + ST.rnd(-14, 14, seed, i, 33)) * Math.PI) / 180;
      const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, bend = (h.bend === undefined ? 0.18 : h.bend) * len;
      ctx.lineWidth = (h.w || 2.6) * ST.LW * ST.rnd(0.6, 1.3, seed, i, 34);
      ctx.beginPath();
      for (let j = 0; j < k; j++) {
        const l = len * (0.55 + 0.6 * ST.hash(seed, i, j + 40)), ox = cx + nx * gap * j + ST.rnd(-2, 2, seed, i, j + 50), oy = cy + ny * gap * j;
        const kink = ST.rnd(0.3, 0.7, seed, i, j + 60);
        ctx.moveTo(ox - (ux * l) / 2, oy - (uy * l) / 2);
        ctx.lineTo(ox - (ux * l) / 2 + ux * l * kink + nx * bend, oy - (uy * l) / 2 + uy * l * kink + ny * bend);
        ctx.lineTo(ox + (ux * l) / 2, oy + (uy * l) / 2);
      }
      ctx.stroke();
    }
    if (h.cross) ST.hatch(ctx, bb, Object.assign({}, h, { cross: false, ang: (h.ang === undefined ? -40 : h.ang) + 70, n: Math.ceil(n / 2) }), seed + 5);
  };
  // a thin second pass over part of a heavy contour, a little off the first (the sketchy doubled stroke)
  function doubled(ctx, c, seed, lw, col) {
    const n = c.length >> 1, a = Math.floor(ST.hash(seed, 78) * n), m = Math.max(3, Math.floor(n * 0.3)), part = [];
    for (let k = 0; k < m; k++) { const i = (a + k) % n; part.push(c[2 * i] + 3.5 * ST.LW, c[2 * i + 1] - 2.5 * ST.LW); }
    ST.inkLine(ctx, part, { w: lw * 0.32, seed: seed + 79, color: col });
  }

  // filled shape: base fill -> key-light shadow (+ deepening) + rim (o.lit) or a fixed shade -> light -> patch ->
  // tone shapes -> hatching -> inner -> ink (+ the odd doubled stroke on heavy contours; o.double: false opts out).
  // o.lit: [shadowColour, depth px, rimWidth px | false]: the shadow falls away from the shot's key (ST.LIGHT).
  // o.deco: a free-floating decoration (sweat bead, speed line) - skipped in silhouette mode.
  ST.blob = (ctx, pts, fill, o) => {
    o = o || {};
    const c = o.sharp ? pts : ST.curve(pts, true, o.step);
    if (ST.SIL) {
      if (o.deco) return c;
      ST.path(ctx, c, true);
      ctx.fillStyle = ST.SIL;
      ctx.fill();
      if (o.lw !== 0) ST.inkLine(ctx, c, { w: o.lw || 7, closed: true, seed: o.seed || 1 });
      return c;
    }
    const seed = o.seed || 1;
    ST.path(ctx, c, true);
    ctx.fillStyle = fill;
    ctx.fill();
    let shade = o.shade, light = o.light, deep = null;
    if (o.lit) {
      const L = ST.lightX(ctx), d = o.lit[1] || 16;
      shade = [o.lit[0], -L * d, d * 0.35];
      if (ST.LIGHT.deep) deep = ['rgba(12,8,14,' + ST.LIGHT.deep + ')', -L * d * 1.25, d * 0.35];
      if (o.lit[2] !== false && ST.LIGHT.rim && !o.noRim) light = [ST.LIGHT.rim, L * (o.lit[2] || 5), -1];
    }
    if (shade || light || o.patch || o.mottle || o.hatch || o.inner) {
      ctx.save();
      ST.path(ctx, c, true);
      ctx.clip();
      const bb = ST.bbox(c);
      if (shade) crescent(ctx, c, shade);
      if (deep) crescent(ctx, c, deep);
      if (light) crescent(ctx, c, light);
      if (o.patch) {
        const [col, dx, dy, k] = o.patch;
        ST.path(ctx, scaled(c, k || 0.5, dx, dy), true);
        ctx.fillStyle = col;
        ctx.fill();
      }
      if (o.mottle) ST.mottle(ctx, bb, o.mottle, seed);
      if (o.hatch) ST.hatch(ctx, bb, o.hatch, seed);
      if (o.inner) o.inner(bb);
      ctx.restore();
    }
    if (o.lw !== 0) {
      ST.inkLine(ctx, c, { w: o.lw || 7, closed: true, seed, color: o.lineColor, scratch: o.scratch });
      if (o.double !== false && (o.lw || 7) >= 8 && ST.hash(seed, 77) < 0.45) doubled(ctx, c, seed, o.lw || 7, o.lineColor);
    }
    return c;
  };

  // limb / sleeve / strap: a soft tube through joints with per-joint widths, filled like a blob. Never doubled
  // (the limb rule) unless a prop asks for it explicitly with o.double: true.
  ST.tube = (ctx, pts, widths, fill, o) => {
    const n = pts.length >> 1, L = [], R = [];
    let t0 = [0, 1], t1 = [0, 1];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let tx = pts[2 * b] - pts[2 * a], ty = pts[2 * b + 1] - pts[2 * a + 1];
      const tl = Math.hypot(tx, ty);
      if (tl < 1e-3) { tx = 0; ty = 1; } else { tx /= tl; ty /= tl; }
      if (i === 0) t0 = [tx, ty];
      if (i === n - 1) t1 = [tx, ty];
      const w = widths[i] / 2;
      L.push(pts[2 * i] - ty * w, pts[2 * i + 1] + tx * w);
      R.unshift(pts[2 * i] + ty * w, pts[2 * i + 1] - tx * w);
    }
    const we = widths[n - 1] * 0.45, ws = widths[0] * 0.45;
    const poly = L.concat([pts[2 * n - 2] + t1[0] * we, pts[2 * n - 1] + t1[1] * we], R, [pts[0] - t0[0] * ws, pts[1] - t0[1] * ws]);
    return ST.blob(ctx, poly, fill, Object.assign({}, o, { double: !!(o && o.double === true) }));
  };

  // control points of an ellipse (feed to ST.blob / ST.curve)
  ST.ellipseRing = (cx, cy, rx, ry, n, rot) => {
    const out = [], cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      out.push(cx + x * cr - y * sr, cy + x * sr + y * cr);
    }
    return out;
  };
  // architecture: polygon with hand-wobbled edges (corners stay sharp)
  ST.wobble = (pts, amp, seed, step) => {
    const n = pts.length >> 1, out = [];
    for (let i = 0; i < n; i++) {
      const ax = pts[2 * i], ay = pts[2 * i + 1], bx = pts[(2 * i + 2) % pts.length], by = pts[(2 * i + 3) % pts.length];
      const m = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / (step || 80)));
      for (let k = 0; k < m; k++) {
        const j = k === 0 ? 0 : amp;
        out.push(ax + ((bx - ax) * k) / m + ST.rnd(-j, j, seed, i, k, 1), ay + ((by - ay) * k) / m + ST.rnd(-j, j, seed, i, k, 2));
      }
    }
    return out;
  };
  ST.rough = (ctx, pts, fill, o) => ST.blob(ctx, ST.wobble(pts, (o && o.amp) || 3, (o && o.seed) || 5), fill, Object.assign({ sharp: true, lw: 5 }, o));
  ST.rect = (ctx, x, y, w, h, fill, o) => ST.rough(ctx, [x, y, x + w, y, x + w, y + h, x, y + h], fill, o);
  // a heavy timber beam between two points (rafters, posts, masts)
  ST.beam = (ctx, x0, y0, x1, y1, w, seed, col) => ST.tube(ctx, [x0, y0, x1, y1], [w, w * 0.92], col || C.TIMBER, { lw: 4, seed, hatch: { c: 'rgba(10,8,6,0.5)', n: 2, len: 26, gap: 5, k: 2, ang: (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI, bend: 0.04 } });

  // flat poster sky: horizontal bands with gently wavy seams (no gradients)
  ST.bands = (ctx, x0, y0, x1, y1, cols, seed) => {
    const bh = (y1 - y0) / cols.length;
    cols.forEach((col, i) => {
      const top = y0 + i * bh, pts = [];
      for (let x = x0; x <= x1 + 1; x += (x1 - x0) / 12) pts.push(x, top + (i ? Math.sin(x / 210 + i * 1.7 + seed) * bh * 0.18 : 0));
      pts.push(x1, y1, x0, y1);
      ctx.fillStyle = col;
      ST.path(ctx, pts, true);
      ctx.fill();
    });
  };
  ST.stars = (ctx, x0, y0, w, h, n, seed, col) => {
    ctx.fillStyle = col || '#b9b39a';
    for (let i = 0; i < n; i++) {
      const r = ST.hash(seed, i, 3) < 0.12 ? 3.2 : 1.6;
      ctx.fillRect(x0 + ST.hash(seed, i, 1) * w - r / 2, y0 + ST.hash(seed, i, 2) * h - r / 2, r, r);
    }
  };
  // stepped light pool / lamp halo: 3 flat concentric ellipses (posterised, never a soft gradient)
  ST.pool = (ctx, cx, cy, rx, ry, col, alpha) => {
    ctx.fillStyle = col;
    [1, 0.66, 0.36].forEach((k) => {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * k, ry * k, 0, 0, TAU);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  };
  // brick / stone courses: mortar lines + a few blocks in a second flat tone (drawn on top of a filled wall)
  ST.bricks = (ctx, x0, y0, w, h, o) => {
    const bh = o.bh || 22, bw = o.bw || 56, seed = o.seed || 7;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, w, h);
    ctx.clip();
    ctx.fillStyle = o.tone || 'rgba(0,0,0,0.13)';
    for (let r = 0; r * bh < h; r++) for (let c = -1; c * bw < w; c++) {
      if (ST.hash(seed, r, c) > (o.density || 0.18)) continue;
      ctx.fillRect(x0 + c * bw + (r % 2) * bw * 0.5, y0 + r * bh, bw - 3, bh - 3);
    }
    ctx.strokeStyle = o.line || 'rgba(22,18,14,0.5)';
    ctx.lineWidth = (o.lw || 2.2) * ST.LW;
    ctx.beginPath();
    for (let r = 0; r * bh < h; r++) {
      const y = y0 + r * bh;
      ctx.moveTo(x0, y + ST.rnd(-1.5, 1.5, seed, r));
      ctx.lineTo(x0 + w, y + ST.rnd(-1.5, 1.5, seed, r, 1));
      for (let c = -1; c * bw < w; c++) {
        const x = x0 + c * bw + (r % 2) * bw * 0.5;
        ctx.moveTo(x, y);
        ctx.lineTo(x + ST.rnd(-2, 2, seed, r, c), y + bh);
      }
    }
    ctx.stroke();
    ctx.restore();
  };
  // lettering with a fat ink outline; rot in degrees. Inside a mirrored figure the text is un-mirrored.
  ST.label = (ctx, str, x, y, o) => {
    ctx.save();
    ctx.translate(x, y);
    const m = ctx.getTransform();
    if (m.a * m.d - m.b * m.c < 0) ctx.scale(-1, 1);
    if (o.rot) ctx.rotate((o.rot * Math.PI) / 180);
    ctx.font = o.font || `${o.size || 40}px Impact, 'Arial Black', sans-serif`;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (o.stroke) {
      ctx.strokeStyle = o.stroke;
      ctx.lineWidth = o.lw || 8;
      ctx.strokeText(str, 0, 0);
    }
    ctx.fillStyle = o.fill || C.INK;
    ctx.fillText(str, 0, 0);
    ctx.restore();
  };
})();
