// Spike 14.0 only: a minimal copy of the C-CAM brushes (docs/concepts/c-cam-style/films/03-apollo-11/js/
// core.js + brushes.js: hash, noise1, curve, inkLine, blob with clip/crescents/mottle/hatch, tube, wobble,
// bands, stars, pool, gloom, camera), with the ST.LW / ST.camZ globals turned into a per-frame state object.
// The real port is PLAN.md#14.3; nothing here ships.
const TAU = Math.PI * 2;
export const INK = '#16120e';

function mix(value) {
  let h = value;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

export function hash(a, b, c, d) {
  let h = mix((a | 0) + 0x9e3779b9);
  h = mix(h ^ ((b | 0) + 0x85ebca6b));
  h = mix(h ^ ((c | 0) + 0xc2b2ae35));
  h = mix(h ^ ((d | 0) + 0x27d4eb2f));
  return h / 4294967296;
}

export const rnd = (lo, hi, a, b, c, d) => lo + (hi - lo) * hash(a, b, c, d);

export function noise1(seed, x) {
  const i = Math.floor(x);
  const f = x - i;
  const k = f * f * (3 - 2 * f);
  return hash(seed, i) * (1 - k) + hash(seed, i + 1) * k;
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const inOut = (x) => {
  const k = clamp01(x);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};
export const twos = (t) => Math.floor(t * 12 + 1e-6) / 12;

export function key(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t < t1) {
      const [t0, v0] = keys[i - 1];
      return v0 + (v1 - v0) * inOut((t - t0) / (t1 - t0));
    }
  }
  return keys[keys.length - 1][1];
}

export function camera(g, s, cx, cy, z, rot) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.translate(s.width / 2, s.height / 2);
  if (rot) g.rotate((rot * Math.PI) / 180);
  g.scale(z, z);
  g.translate(-cx, -cy);
  s.camZ = z;
  s.lw = Math.pow(z, -0.55);
}

export function curve(pts, closed, step) {
  const n = pts.length >> 1;
  if (n < 3) return pts.slice();
  const out = [];
  const st = step || 7;
  const at = (i) => 2 * (closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i)));
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = at(i - 1);
    const b = at(i);
    const c = at(i + 1);
    const d = at(i + 2);
    const [x0, y0, x1, y1] = [pts[a], pts[a + 1], pts[b], pts[b + 1]];
    const [x2, y2, x3, y3] = [pts[c], pts[c + 1], pts[d], pts[d + 1]];
    const m = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / st));
    for (let k = 0; k < m; k++) {
      const t = k / m;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(
        0.5 *
          (2 * x1 +
            (-x0 + x2) * t +
            (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 +
            (-x0 + 3 * x1 - 3 * x2 + x3) * t3),
        0.5 *
          (2 * y1 +
            (-y0 + y2) * t +
            (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 +
            (-y0 + 3 * y1 - 3 * y2 + y3) * t3),
      );
    }
  }
  if (!closed) out.push(pts[2 * n - 2], pts[2 * n - 1]);
  return out;
}

export function path(g, c, closed) {
  g.beginPath();
  g.moveTo(c[0], c[1]);
  for (let i = 2; i < c.length; i += 2) g.lineTo(c[i], c[i + 1]);
  if (closed) g.closePath();
}

function bbox(c) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < c.length; i += 2) {
    x0 = Math.min(x0, c[i]);
    x1 = Math.max(x1, c[i]);
    y0 = Math.min(y0, c[i + 1]);
    y1 = Math.max(y1, c[i + 1]);
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// the ink line: a filled ribbon whose width swells and pinches along its length
export function inkLine(g, s, c, o) {
  const n = c.length >> 1;
  if (n < 2) return;
  const closed = !!o.closed;
  const seed = o.seed || 1;
  const base = (o.w || 7) * s.lw;
  const L = [];
  const R = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const ip = closed ? (i - 1 + n) % n : Math.max(0, i - 1);
    const inx = closed ? (i + 1) % n : Math.min(n - 1, i + 1);
    let tx = c[2 * inx] - c[2 * ip];
    let ty = c[2 * inx + 1] - c[2 * ip + 1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    if (i > 0) acc += Math.hypot(c[2 * i] - c[2 * i - 2], c[2 * i + 1] - c[2 * i - 1]);
    const k = noise1(seed, acc / 30);
    let w = base * (0.4 + 1.25 * k * k + 0.25 * noise1(seed + 7, acc / 9));
    if (!closed && o.taper !== false)
      w *= Math.min(1, 0.12 + 2.2 * Math.sin(Math.PI * (i / (n - 1))));
    L.push(c[2 * i] - (ty * w) / 2, c[2 * i + 1] + (tx * w) / 2);
    R.push(c[2 * i] + (ty * w) / 2, c[2 * i + 1] - (tx * w) / 2);
  }
  g.fillStyle = o.color || INK;
  g.beginPath();
  g.moveTo(L[0], L[1]);
  for (let i = 2; i < L.length; i += 2) g.lineTo(L[i], L[i + 1]);
  if (closed) {
    g.closePath();
    g.moveTo(R[R.length - 2], R[R.length - 1]);
    for (let i = R.length - 4; i >= 0; i -= 2) g.lineTo(R[i], R[i + 1]);
    g.closePath();
  } else for (let i = R.length - 2; i >= 0; i -= 2) g.lineTo(R[i], R[i + 1]);
  g.fill('nonzero');
}

function shifted(c, dx, dy) {
  return c.map((v, i) => v + (i % 2 === 0 ? dx : dy));
}

// flat crescent: the shape minus itself shifted back (evenodd)
function crescent(g, c, [col, dx, dy]) {
  path(g, c, true);
  const s = shifted(c, -dx, -dy);
  g.moveTo(s[0], s[1]);
  for (let i = 2; i < s.length; i += 2) g.lineTo(s[i], s[i + 1]);
  g.closePath();
  g.fillStyle = col;
  g.fill('evenodd');
}

function mottle(g, bb, [col, count, size], seed) {
  g.fillStyle = col;
  for (let k = 0; k < count; k++) {
    const cx = bb.x0 + hash(seed, k, 21) * bb.w;
    const cy = bb.y0 + hash(seed, k, 22) * bb.h;
    const r = size * (0.5 + hash(seed, k, 23));
    const pts = [];
    for (let j = 0; j < 7; j++) {
      const a = (j / 7) * TAU;
      const rr = r * (0.55 + 0.6 * hash(seed, k, j));
      pts.push(cx + Math.cos(a) * rr * 1.35, cy + Math.sin(a) * rr * 0.8);
    }
    path(g, curve(pts, true, 4), true);
    g.fill();
  }
}

function hatch(g, s, bb, h, seed) {
  g.strokeStyle = h.c || 'rgba(22,18,14,0.6)';
  g.lineWidth = (h.w || 2.8) * s.lw;
  g.lineCap = 'round';
  const [n, k, len, gap] = [h.n || 6, h.k || 4, h.len || 30, h.gap || 7];
  for (let i = 0; i < n; i++) {
    const cx = bb.x0 + hash(seed, i, 31) * bb.w;
    const cy = bb.y0 + hash(seed, i, 32) * bb.h;
    const a = ((-40 + rnd(-14, 14, seed, i, 33)) * Math.PI) / 180;
    const [ux, uy] = [Math.cos(a), Math.sin(a)];
    const bend = 0.18 * len;
    g.beginPath();
    for (let j = 0; j < k; j++) {
      const l = len * (0.55 + 0.6 * hash(seed, i, j + 40));
      const ox = cx - uy * gap * j;
      const oy = cy + ux * gap * j;
      g.moveTo(ox - (ux * l) / 2, oy - (uy * l) / 2);
      g.quadraticCurveTo(ox - uy * bend, oy + ux * bend, ox + (ux * l) / 2, oy + (uy * l) / 2);
    }
    g.stroke();
  }
}

// filled shape: base fill -> clip -> crescents, tone shapes, hatching -> ink ribbon
export function blob(g, s, pts, fill, o = {}) {
  const c = o.sharp ? pts : curve(pts, true, o.step);
  const seed = o.seed || 1;
  path(g, c, true);
  g.fillStyle = fill;
  g.fill();
  if (o.shade || o.light || o.mottle || o.hatch) {
    g.save();
    path(g, c, true);
    g.clip();
    const bb = bbox(c);
    if (o.shade) crescent(g, c, o.shade);
    if (o.light) crescent(g, c, o.light);
    if (o.mottle) mottle(g, bb, o.mottle, seed);
    if (o.hatch) hatch(g, s, bb, o.hatch, seed);
    g.restore();
  }
  if (o.lw !== 0) inkLine(g, s, c, { w: o.lw || 7, closed: true, seed });
  return c;
}

// limb / sleeve: a soft tube through joints with per-joint widths, filled like a blob
export function tube(g, s, pts, widths, fill, o) {
  const n = pts.length >> 1;
  const L = [];
  const R = [];
  let [t0, t1] = [
    [0, 1],
    [0, 1],
  ];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    let tx = pts[2 * b] - pts[2 * a];
    let ty = pts[2 * b + 1] - pts[2 * a + 1];
    const tl = Math.hypot(tx, ty);
    if (tl < 1e-3) [tx, ty] = [0, 1];
    else [tx, ty] = [tx / tl, ty / tl];
    if (i === 0) t0 = [tx, ty];
    if (i === n - 1) t1 = [tx, ty];
    const w = widths[i] / 2;
    L.push(pts[2 * i] - ty * w, pts[2 * i + 1] + tx * w);
    R.unshift(pts[2 * i] + ty * w, pts[2 * i + 1] - tx * w);
  }
  const we = widths[n - 1] * 0.45;
  const ws = widths[0] * 0.45;
  const end = [pts[2 * n - 2] + t1[0] * we, pts[2 * n - 1] + t1[1] * we];
  const start = [pts[0] - t0[0] * ws, pts[1] - t0[1] * ws];
  return blob(g, s, L.concat(end, R, start), fill, o);
}

export function ellipseRing(cx, cy, rx, ry, n) {
  const out = [];
  for (let i = 0; i < n; i++)
    out.push(cx + Math.cos((i / n) * TAU) * rx, cy + Math.sin((i / n) * TAU) * ry);
  return out;
}

export function wobble(pts, amp, seed) {
  const n = pts.length >> 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = [pts[2 * i], pts[2 * i + 1]];
    const [bx, by] = [pts[(2 * i + 2) % pts.length], pts[(2 * i + 3) % pts.length]];
    const m = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 80));
    for (let k = 0; k < m; k++) {
      const j = k === 0 ? 0 : amp;
      out.push(
        ax + ((bx - ax) * k) / m + rnd(-j, j, seed, i, k, 1),
        ay + ((by - ay) * k) / m + rnd(-j, j, seed, i, k, 2),
      );
    }
  }
  return out;
}

export function bands(g, x0, y0, x1, y1, cols, seed) {
  const bh = (y1 - y0) / cols.length;
  cols.forEach((col, i) => {
    const top = y0 + i * bh;
    const pts = [];
    for (let x = x0; x <= x1 + 1; x += (x1 - x0) / 12)
      pts.push(x, top + (i ? Math.sin(x / 210 + i * 1.7 + seed) * bh * 0.18 : 0));
    pts.push(x1, y1, x0, y1);
    g.fillStyle = col;
    path(g, pts, true);
    g.fill();
  });
}

export function stars(g, x0, y0, w, h, n, seed, col) {
  g.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const r = hash(seed, i, 3) < 0.12 ? 3.2 : 1.6;
    g.fillRect(x0 + hash(seed, i, 1) * w - r / 2, y0 + hash(seed, i, 2) * h - r / 2, r, r);
  }
}

export function pool(g, cx, cy, rx, ry, col, alpha) {
  g.fillStyle = col;
  for (const k of [1, 0.66, 0.36]) {
    g.globalAlpha = alpha;
    g.beginPath();
    g.ellipse(cx, cy, rx * k, ry * k, 0, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
}

export function gloom(g, x0, y0, w, h, cx, cy, r, col, alpha) {
  g.fillStyle = col;
  [1, 0.72, 0.5].forEach((k, i) => {
    g.globalAlpha = alpha * (i === 0 ? 1 : 0.55);
    g.beginPath();
    g.rect(x0, y0, w, h);
    g.ellipse(cx, cy, r / k, (r * 0.8) / k, 0, 0, TAU, true);
    g.fill();
  });
  g.globalAlpha = 1;
}
