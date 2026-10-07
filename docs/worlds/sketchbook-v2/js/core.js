/* sketchbook - core: palette, index framebuffer, seeded hash, easing, raster primitives. Pure, no clocks. */
'use strict';
(function () {
  const SB = (window.SB = {});
  const W = 960, H = 540;
  SB.W = W;
  SB.H = H;

  // Shots register by id: SB.defineShot(id, { title, role, note, pace?, render(buf, t) }). render paints the whole
  // 960x540 index buffer for shot time t (already multiplied by pace) and must be a pure function of t.
  // js/timeline.js owns the order, durations, exit transitions and narration of every shot.
  SB.SHOT_DEFS = {};
  SB.defineShot = (id, def) => { SB.SHOT_DEFS[id] = def; };

  // 24 inks. Paper family / printed rules / pens / pencils / desk.
  const INKS = [
    ['PAPER', '#f4eedb'], ['FIBRE', '#e6ddc4'], ['SHADE', '#cbbd9d'], ['RULE', '#a8c2d6'],
    ['MARGIN', '#e6a4a1'], ['GRID', '#bfd6cc'], ['GRAPH_L', '#a09b92'], ['GRAPHITE', '#5e5a55'],
    ['INK', '#1d1b20'], ['BIC', '#2b48a1'], ['BIC_L', '#7189c6'], ['RED', '#d8342b'],
    ['HILITE', '#e6ef5a'], ['STICKY', '#f6d86c'], ['STICKY_D', '#d9b74e'], ['GREEN', '#6b9a47'],
    ['ORANGE', '#e48a35'], ['SKY', '#88b6d6'], ['PURPLE', '#8a5c9c'], ['COFFEE', '#a8744c'],
    ['COFFEE_L', '#dcbf98'], ['KRAFT', '#d2b386'], ['KRAFT_D', '#b19064'], ['DESK', '#46332a'],
  ];
  const C = {};
  INKS.forEach(([n], i) => (C[n] = i));
  SB.C = C;
  SB.PAL = INKS.map(([, h]) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

  // paper-like indices: highlighter and soft shadows only touch these (ink stays on top)
  const PAPERLIKE = new Uint8Array(32);
  ['PAPER', 'FIBRE', 'SHADE', 'RULE', 'MARGIN', 'GRID', 'KRAFT', 'KRAFT_D', 'STICKY', 'STICKY_D', 'COFFEE_L', 'HILITE'].forEach((n) => (PAPERLIKE[C[n]] = 1));
  SB.PAPERLIKE = PAPERLIKE;

  function table(pairs) {
    const t = new Uint8Array(32);
    for (let i = 0; i < 32; i++) t[i] = i;
    for (const [a, b] of pairs) t[C[a]] = C[b];
    return t;
  }
  // soft cast shadow (pen, hand, lifted paper) and a firmer one (stacked inserts)
  SB.SOFT = table([['PAPER', 'FIBRE'], ['FIBRE', 'SHADE'], ['RULE', 'BIC_L'], ['GRID', 'SHADE'], ['MARGIN', 'COFFEE_L'],
    ['KRAFT', 'KRAFT_D'], ['STICKY', 'STICKY_D'], ['HILITE', 'STICKY'], ['COFFEE_L', 'KRAFT'], ['SHADE', 'GRAPH_L'], ['KRAFT_D', 'COFFEE']]);
  SB.HARD = table([['PAPER', 'SHADE'], ['FIBRE', 'SHADE'], ['RULE', 'BIC_L'], ['GRID', 'GRAPH_L'], ['MARGIN', 'COFFEE'],
    ['KRAFT', 'KRAFT_D'], ['KRAFT_D', 'COFFEE'], ['STICKY', 'STICKY_D'], ['SHADE', 'GRAPH_L'], ['COFFEE_L', 'KRAFT_D'], ['HILITE', 'STICKY_D'], ['GRAPH_L', 'GRAPHITE']]);
  // clear tape: a faint lift of the paper underneath
  SB.TAPE = table([['PAPER', 'FIBRE'], ['FIBRE', 'FIBRE'], ['KRAFT', 'COFFEE_L'], ['KRAFT_D', 'KRAFT'], ['RULE', 'GRID'], ['GRID', 'FIBRE']]);

  // ---- seeded hash (integers in, [0,1) out) ----
  function mix(h) {
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b);
    h ^= h >>> 16;
    return h >>> 0;
  }
  function hash(a, b, c, d) {
    let h = mix((a | 0) + 0x9e3779b9);
    h = mix(h ^ ((b | 0) + 0x85ebca6b));
    h = mix(h ^ ((c | 0) + 0xc2b2ae35));
    h = mix(h ^ ((d | 0) + 0x27d4eb2f));
    return h / 4294967296;
  }
  SB.hash = hash;
  SB.rnd = (lo, hi, a, b, c, d) => lo + (hi - lo) * hash(a, b, c, d);
  SB.seedOf = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };

  // ---- easing (mixed on purpose: back for pops, in-out for travel, linear for rulers) ----
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  SB.clamp01 = clamp01;
  SB.ease = {
    lin: (x) => clamp01(x),
    inOut: (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
    out: (x) => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); },
    in: (x) => { x = clamp01(x); return x * x; },
    back: (x, s) => { x = clamp01(x); s = s || 1.9; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); },
    sine: (x) => { x = clamp01(x); return 0.5 - 0.5 * Math.cos(Math.PI * x); },
    hand: (x) => { x = clamp01(x); return 0.55 * x + 0.45 * x * x * (3 - 2 * x); },
  };
  SB.seg = (t, a, b) => clamp01((t - a) / (b - a));
  // table sine and a polynomial atan2 for the per-pixel transition maps
  const SIN = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) SIN[i] = Math.sin((i / 4096) * Math.PI * 2);
  const K = 4096 / (Math.PI * 2);
  SB.fsin = (x) => SIN[((x * K) | 0) & 4095];
  SB.fcos = (x) => SIN[(((x + Math.PI / 2) * K) | 0) & 4095];
  SB.fatan2 = (y, x) => {
    const ax = Math.abs(x), ay = Math.abs(y), mx = Math.max(ax, ay);
    if (mx === 0) return 0;
    const a = Math.min(ax, ay) / mx, s = a * a;
    let r = ((-0.0464964749 * s + 0.15931422) * s - 0.327622764) * s * a + a;
    if (ay > ax) r = 1.57079637 - r;
    if (x < 0) r = 3.14159274 - r;
    return y < 0 ? -r : r;
  };
  SB.lerp = (a, b, k) => a + (b - a) * k;

  // ---- framebuffer ----
  SB.newBuf = () => new Uint8Array(W * H);
  // write modes: 0 normal, 1 under-ink (paper-like only), 2 remap via table
  let MODE = 0, MAP = null;
  SB.setMode = (m, map) => { MODE = m; MAP = map || null; };
  function put(b, x, y, c) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (MODE === 0) b[i] = c;
    else if (MODE === 1) { if (PAPERLIKE[b[i]]) b[i] = c; }
    else b[i] = MAP[b[i]];
  }
  SB.put = put;
  SB.fillRect = (b, x0, y0, x1, y1, c) => {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) put(b, x, y, c);
  };

  // even-odd scanline fill; col = index or fn(x,y) -> index | -1
  SB.fillPoly = (b, pts, col) => {
    const n = pts.length >> 1;
    if (n < 3) return;
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 1; i < pts.length; i += 2) { if (pts[i] < y0) y0 = pts[i]; if (pts[i] > y1) y1 = pts[i]; }
    y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(H - 1, Math.ceil(y1));
    const xs = [];
    const fn = typeof col === 'function';
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const ax = pts[2 * i], ay = pts[2 * i + 1], bx = pts[2 * j], by = pts[2 * j + 1];
        if ((ay > sy) !== (by > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = xa; x <= xb; x++) {
          if (fn) { const c = col(x, y); if (c >= 0) put(b, x, y, c); }
          else put(b, x, y, col);
        }
      }
    }
  };

  // polygon helpers (flat [x,y,...])
  SB.ellipsePts = (cx, cy, rx, ry, n, rot, a0) => {
    const out = [], cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
    for (let i = 0; i < n; i++) {
      const a = (a0 || 0) + (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      out.push(cx + x * cr - y * sr, cy + x * sr + y * cr);
    }
    return out;
  };
  SB.xformPts = (pts, f) => { const o = new Array(pts.length); for (let i = 0; i < pts.length; i += 2) { const p = f(pts[i], pts[i + 1]); o[i] = p[0]; o[i + 1] = p[1]; } return o; };
  SB.rotAbout = (cx, cy, deg, dx, dy, s) => {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), si = Math.sin(a), k = s || 1;
    return (x, y) => { const u = (x - cx) * k, v = (y - cy) * k; return [cx + u * c - v * si + (dx || 0), cy + u * si + v * c + (dy || 0)]; };
  };
  SB.compose = (f, g) => (x, y) => { const p = f(x, y); return g(p[0], p[1]); };

  // ---- brushes ----
  const brushCache = {};
  SB.roundBrush = (w) => {
    const key = 'r' + w;
    if (brushCache[key]) return brushCache[key];
    const out = [], c = (w - 1) / 2, h = Math.floor(w / 2);
    for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) if ((i - c) * (i - c) + (j - c) * (j - c) <= (w / 2) * (w / 2) + 0.25) out.push(i - h, j - h);
    return (brushCache[key] = out);
  };
  SB.chiselBrush = (len, deg, thick) => {
    const key = 'c' + len + ',' + deg + ',' + thick;
    if (brushCache[key]) return brushCache[key];
    const a = (deg * Math.PI) / 180, set = new Set(), out = [];
    for (let s = -len / 2; s <= len / 2; s += 0.5) for (let k = 0; k < thick; k++) {
      const x = Math.round(Math.cos(a) * s - Math.sin(a) * (k - (thick - 1) / 2)), y = Math.round(Math.sin(a) * s + Math.cos(a) * (k - (thick - 1) / 2));
      const id = x + ',' + y;
      if (!set.has(id)) { set.add(id); out.push(x, y); }
    }
    return (brushCache[key] = out);
  };
  SB.stamp = (b, x, y, brush, c) => { for (let i = 0; i < brush.length; i += 2) put(b, x + brush[i], y + brush[i + 1], c); };

  // integer pixel path along a polyline (flat float pts), deduped; pixel-perfect thinning for 1px lines
  SB.pixelPath = (pts, thin) => {
    const out = [];
    const np = pts.length >> 1;
    if (np === 1) return [Math.round(pts[0]), Math.round(pts[1])];
    let lx = 1e9, ly = 1e9;
    for (let i = 0; i < np - 1; i++) {
      const ax = pts[2 * i], ay = pts[2 * i + 1], bx = pts[2 * i + 2], by = pts[2 * i + 3];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(ax + ((bx - ax) * k) / n), y = Math.round(ay + ((by - ay) * k) / n);
        if (x === lx && y === ly) continue;
        out.push(x, y);
        lx = x; ly = y;
      }
    }
    if (!thin || out.length < 6) return out;
    const res = [out[0], out[1]];
    for (let i = 2; i < out.length; i += 2) {
      const n = res.length;
      if (n >= 4 && i + 1 < out.length) {
        const px = res[n - 4], py = res[n - 3], qx = res[n - 2], qy = res[n - 1], x = out[i], y = out[i + 1];
        if (Math.abs(x - px) === 1 && Math.abs(y - py) === 1 && (qx === px || qy === py) && (qx === x || qy === y)) { res[n - 2] = x; res[n - 1] = y; continue; }
      }
      res.push(out[i], out[i + 1]);
    }
    return res;
  };

  // Catmull-Rom through control points; corners split runs. pts flat, corners bool[] per point.
  SB.smoothPath = (pts, corners, step) => {
    const n = pts.length >> 1;
    if (n < 2) return pts.slice();
    const out = [];
    let start = 0;
    const runs = [];
    for (let i = 1; i < n; i++) if (corners && corners[i] && i < n - 1) { runs.push([start, i]); start = i; }
    runs.push([start, n - 1]);
    for (const [a, z] of runs) {
      for (let i = a; i < z; i++) {
        const p0 = Math.max(a, i - 1), p3 = Math.min(z, i + 2);
        const x0 = pts[2 * p0], y0 = pts[2 * p0 + 1], x1 = pts[2 * i], y1 = pts[2 * i + 1];
        const x2 = pts[2 * i + 2], y2 = pts[2 * i + 3], x3 = pts[2 * p3], y3 = pts[2 * p3 + 1];
        const len = Math.hypot(x2 - x1, y2 - y1);
        const m = z - a < 2 ? 1 : Math.max(1, Math.ceil(len / (step || 3)));
        for (let k = out.length ? 1 : 0; k <= m; k++) {
          if (k === 0 && out.length) continue;
          const t = k / m, t2 = t * t, t3 = t2 * t;
          out.push(
            0.5 * (2 * x1 + (-x0 + x2) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (-x0 + 3 * x1 - 3 * x2 + x3) * t3),
            0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3),
          );
        }
      }
    }
    return out;
  };

  // prefix of a polyline by fraction of arc length; returns {pts, tip:[x,y]}
  SB.prefix = (pts, frac) => {
    if (frac >= 1) return { pts: pts, tip: [pts[pts.length - 2], pts[pts.length - 1]], len: SB.polyLen(pts) };
    const total = SB.polyLen(pts), want = total * Math.max(0, frac), out = [pts[0], pts[1]];
    let acc = 0;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const l = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
      if (acc + l >= want) {
        const k = l > 0 ? (want - acc) / l : 0;
        const x = pts[i] + (pts[i + 2] - pts[i]) * k, y = pts[i + 1] + (pts[i + 3] - pts[i + 1]) * k;
        out.push(x, y);
        return { pts: out, tip: [x, y], len: total };
      }
      acc += l;
      out.push(pts[i + 2], pts[i + 3]);
    }
    return { pts: out, tip: [out[out.length - 2], out[out.length - 1]], len: total };
  };
  SB.polyLen = (pts) => { let s = 0; for (let i = 0; i + 3 < pts.length; i += 2) s += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]); return s; };

  // camera (page -> screen). Most pages hold still; a few push in for a reason.
  SB.view = { cx: W / 2, cy: H / 2, z: 1 };
  SB.setView = (cx, cy, z) => { SB.view.cx = cx; SB.view.cy = cy; SB.view.z = z; };
  SB.toS = (x, y) => { const v = SB.view; return [(x - v.cx) * v.z + W / 2, (y - v.cy) * v.z + H / 2]; };
})();
