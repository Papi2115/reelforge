/* detective-board 2c "felt" - craft helpers in item-local space: transforms, landing (felt pressed onto
 * linen), running stitches, blanket stitch, labels. All pure functions of time; builders are memoised. */
(function () {
  'use strict';
  const F = window.FELT;
  const C = F.C;
  const K = (F.K = {});

  /** item: {x, y, rot, scale}. Local (u, v) -> world. */
  K.xf = function (it, u, v) {
    const c = Math.cos(it.rot || 0);
    const s = Math.sin(it.rot || 0);
    const sc = it.scale || 1;
    return [it.x + (c * u - s * v) * sc, it.y + (s * u + c * v) * sc];
  };
  /** Felt piece in item space. o: piece options; du/dv offset, o.rot extra rotation. */
  K.pc = function (it, shape, du, dv, o) {
    const p = K.xf(it, du, dv);
    F.piece(Object.assign({}, o, { shape, x: p[0], y: p[1], rot: (it.rot || 0) + (o.rot || 0), scale: it.scale || 1 }));
  };
  /** Typed / cross text in item space (u, v = top-left of the text). */
  K.tx = function (it, str, u, v, s, col, o) {
    const p = K.xf(it, u, v);
    return F.text(str, p[0], p[1], (it.rot || 0) + ((o && o.rot) || 0), s * (it.scale || 1), col, o);
  };

  /**
   * Landing of a felt piece: hovers in (bigger, longer shadow), slaps flat with a small overshoot and settles.
   * Returns null before it exists.
   */
  K.land = function (T, t0, it) {
    const pre = 0.42;
    if (T < t0 - pre) return null;
    const out = Object.assign({}, it);
    out.lift = 0;
    if (T < t0) {
      const k = F.ease.in(F.prog(T, t0 - pre, t0));
      out.scale = (it.scale || 1) * (1 + 0.1 * (1 - k));
      out.lift = 9 * (1 - k);
      out.rot = (it.rot || 0) + 0.06 * (1 - k);
    } else {
      const dt = T - t0;
      const squash = dt < 0.22 ? Math.sin((dt / 0.22) * Math.PI) : 0;
      out.scale = (it.scale || 1) * (1 - 0.03 * squash);
      out.lift = -0.8 * squash;
    }
    return out;
  };

  const runCache = {};
  /**
   * Running stitch along a local polyline: straight stitches between needle holes, lengths and gaps varied
   * (consistent but imperfect). Returns [[au, av, bu, bv], ...].
   */
  K.run = function (key, pts, len, gap, seed, closed) {
    if (runCache[key]) return runCache[key];
    const rnd = F.prng(seed);
    const path = closed ? pts.concat([pts[0]]) : pts;
    const segs = [];
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const l = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
      segs.push(l);
      total += l;
    }
    const at = (s) => {
      let i = 0;
      while (i < segs.length - 1 && s > segs[i]) {
        s -= segs[i];
        i++;
      }
      const k = Math.min(1, s / (segs[i] || 1));
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k];
    };
    const out = [];
    let s = gap * 0.5 * rnd();
    while (s < total - 1) {
      const l = len * (0.82 + rnd() * 0.36);
      const e = Math.min(total, s + l);
      const a = at(s);
      const b = at(e);
      const wob = (rnd() - 0.5) * 0.5;
      out.push([a[0], a[1] + wob, b[0], b[1] - wob]);
      s = e + gap * (0.75 + rnd() * 0.5);
    }
    runCache[key] = out;
    return out;
  };
  /** Draw local stitches [[au,av,bu,bv]] on an item. count limits how many are sewn (newest pops in). */
  K.stitches = function (it, list, r, cols, count, o) {
    const z = F.cam.z;
    if (list.length && r * z < 0.25 && !(o && o.always)) return;
    const n = count === undefined ? list.length : Math.min(list.length, Math.floor(count));
    const minR = o && o.minR !== undefined ? o.minR : 0.5;
    for (let i = 0; i < n; i++) {
      const q = list[i];
      const a = K.xf(it, q[0], q[1]);
      const b = K.xf(it, q[2], q[3]);
      if ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 < 0.01) continue;
      F.stroke([a[0], a[1], b[0], b[1]], r * (it.scale || 1), cols, { minR, shadow: o && o.shadow });
    }
  };
  /** Rectangle outline as local points (inset from w x h centred). */
  K.rectPts = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];

  /** Blanket stitch along a closed local polygon: edge line + legs pointing inward. */
  K.blanket = function (key, pts, step, depth, seed) {
    if (runCache[key]) return runCache[key];
    const rnd = F.prng(seed);
    const out = [];
    const path = pts.concat([pts[0]]);
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, ay] = path[i];
      const [bx, by] = path[i + 1];
      const l = Math.hypot(bx - ax, by - ay);
      const nx = -(by - ay) / l;
      const ny = (bx - ax) / l;
      const n = Math.max(1, Math.round(l / step));
      for (let k = 0; k < n; k++) {
        const t0 = k / n;
        const t1 = (k + 1) / n;
        const p0 = [ax + (bx - ax) * t0, ay + (by - ay) * t0];
        const p1 = [ax + (bx - ax) * t1, ay + (by - ay) * t1];
        const d = depth * (0.8 + rnd() * 0.4);
        out.push([p0[0], p0[1], p1[0], p1[1]]);
        out.push([p1[0], p1[1], p1[0] + nx * d, p1[1] + ny * d]);
      }
    }
    runCache[key] = out;
    return out;
  };

  /** Jagged (torn / pinked) rectangle polygon, memoised. */
  const polyCache = {};
  K.tornRect = function (key, w, h, amp, step, seed, sides) {
    if (polyCache[key]) return polyCache[key];
    const rnd = F.prng(seed);
    const sd = sides || 'tlbr';
    const pts = [];
    const edge = (x0, y0, x1, y1, torn, nx, ny) => {
      const l = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.round(l / step));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const j = torn ? (rnd() - 0.3) * amp : (rnd() - 0.5) * 0.3;
        pts.push([x0 + (x1 - x0) * t + nx * j, y0 + (y1 - y0) * t + ny * j]);
      }
    };
    const hw = w / 2;
    const hh = h / 2;
    edge(-hw, -hh, hw, -hh, sd.includes('t'), 0, 1);
    edge(hw, -hh, hw, hh, sd.includes('r'), -1, 0);
    edge(hw, hh, -hw, hh, sd.includes('b'), 0, -1);
    edge(-hw, hh, -hw, -hh, sd.includes('l'), 1, 0);
    polyCache[key] = F.poly(pts, [-hw + amp, -hh + amp, hw - amp, hh - amp]);
    return polyCache[key];
  };
  /** Pinking-shears zigzag rectangle (analytic shape). */
  K.pinked = (key, w, h, tooth) => K.cached(key, () => F.pinked(w, h, tooth));
  K.cached = function (key, build) {
    if (!polyCache[key]) polyCache[key] = build();
    return polyCache[key];
  };

  // thread colour sets
  K.RED = { c: C.RED, hi: C.RED_L, lo: C.RED_S };
  K.CREAM = { c: C.CREAM, hi: C.WHITE, lo: C.CREAM_S };
  K.RUSTT = { c: C.RUST, hi: C.MUST, lo: C.RUST_S };
  K.TEALT = { c: C.TEAL_L, hi: C.WHITE, lo: C.TEAL };
  K.DARKT = { c: C.NIGHT_L, hi: C.LIN1, lo: C.NIGHT };
  K.INKK = { c: C.NIGHT, hi: C.NIGHT_L, lo: C.INK };
  K.MUSTT = { c: C.MUST, hi: C.CREAM, lo: C.MUST_S };
})();
