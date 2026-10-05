/* detective-board 2c "felt" - strokes (threads, stitches), knots, the needle and world-space bitmap text. */
(function () {
  'use strict';
  const F = window.FELT;
  const W = F.W;
  const C = F.C;
  const DARK = F.DARK;
  const hash = F.hash;
  const fb = F.fb;
  const cam = F.cam;
  const clip = F.clip;
  const H = F.H;
  const screenBox = F.screenBox;
  const stampBuf = new Uint32Array(W * H);
  let stampId = 1;

  // ---------------------------------------------------------------- strokes (threads, stitches)
  /**
   * Polyline of world points [x0,y0,x1,y1,...] drawn as a round-capped tube.
   * cols {c, hi, lo}; o {twist, shadow (world lift), minR (px), arc0}.
   */
  F.stroke = function (pts, rWorld, cols, o) {
    const opt = o || {};
    const z = cam.z;
    const minR = opt.minR === undefined ? 0.6 : opt.minR;
    const r = Math.max(minR, rWorld * z);
    const n = pts.length / 2;
    if (n < 2) return;
    const sxs = new Float64Array(n);
    const sys = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      sxs[i] = pts[i * 2] * z - cam.ox;
      sys[i] = pts[i * 2 + 1] * z - cam.oy;
    }
    if (opt.shadow) {
      const off = Math.max(1, opt.shadow * z);
      stampId++;
      for (let i = 0; i < n - 1; i++) seg(sxs[i] + off * 0.7, sys[i] + off, sxs[i + 1] + off * 0.7, sys[i + 1] + off, r, null, 0, false);
    }
    stampId++;
    let arc = (opt.arc0 || 0) * z;
    for (let i = 0; i < n - 1; i++) {
      const len = Math.hypot(sxs[i + 1] - sxs[i], sys[i + 1] - sys[i]);
      seg(sxs[i], sys[i], sxs[i + 1], sys[i + 1], r, cols, arc, !!opt.twist);
      arc += len;
    }
  };
  /** One capsule. cols null = darken the ground once (shadow). */
  function seg(ax, ay, bx, by, r, cols, arc0, twist) {
    const x0 = Math.max(clip.x0, Math.floor(Math.min(ax, bx) - r - 1));
    const x1 = Math.min(clip.x1, Math.ceil(Math.max(ax, bx) + r + 1));
    const y0 = Math.max(clip.y0, Math.floor(Math.min(ay, by) - r - 1));
    const y1 = Math.min(clip.y1, Math.ceil(Math.max(ay, by) + r + 1));
    if (x0 >= x1 || y0 >= y1) return;
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy || 1e-9;
    const len = Math.sqrt(l2);
    let nx = -dy / len;
    let ny = dx / len;
    if (nx + ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const r2 = r * r;
    const doTwist = twist && r >= 2.4;
    for (let y = y0; y < y1; y++) {
      const py = y + 0.5;
      let idx = y * W + x0;
      for (let x = x0; x < x1; x++, idx++) {
        const pxx = x + 0.5;
        let t = ((pxx - ax) * dx + (py - ay) * dy) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = pxx - (ax + dx * t);
        const ey = py - (ay + dy * t);
        const d2 = ex * ex + ey * ey;
        if (d2 > r2) continue;
        if (!cols) {
          if (stampBuf[idx] !== stampId) {
            stampBuf[idx] = stampId;
            fb[idx] = DARK[fb[idx]];
          }
          continue;
        }
        const side = (ex * nx + ey * ny) / r; // +1 = lit (upper-left) edge
        let c = cols.c;
        if (doTwist) {
          const ph = (arc0 + t * len - side * r * 1.1) / (r * 1.9);
          const fr = ph - Math.floor(ph);
          if (fr < 0.2 || side < -0.62) c = cols.lo;
          else if (fr > 0.45 && fr < 0.62 && side > -0.3) c = cols.hi;
        } else if (r >= 1.2) {
          if (side > 0.5) c = cols.hi;
          else if (side < -0.45) c = cols.lo;
        }
        fb[idx] = c;
      }
    }
  }

  /** Round knot / dot. cols {c, hi, lo}; coil draws the French-knot wrap at large sizes. */
  F.knot = function (wx, wy, rWorld, cols, o) {
    const opt = o || {};
    const z = cam.z;
    const r = Math.max(opt.minR === undefined ? 1.5 : opt.minR, rWorld * z);
    const cx = wx * z - cam.ox;
    const cy = wy * z - cam.oy;
    const sh = opt.shadow === undefined ? 1.2 : opt.shadow;
    const off = sh > 0 ? Math.max(1, sh * z) : 0;
    const x0 = Math.max(clip.x0, Math.floor(cx - r - 1));
    const x1 = Math.min(clip.x1, Math.ceil(cx + r + off + 1));
    const y0 = Math.max(clip.y0, Math.floor(cy - r - 1));
    const y1 = Math.min(clip.y1, Math.ceil(cy + r + off + 1));
    const coil = opt.coil !== false && r >= 5;
    for (let y = y0; y < y1; y++) {
      let idx = y * W + x0;
      for (let x = x0; x < x1; x++, idx++) {
        const ux = x + 0.5 - cx;
        const uy = y + 0.5 - cy;
        const d = Math.hypot(ux, uy);
        if (d <= r) {
          const lit = -(ux + uy) / (r * 1.414);
          let c = lit > 0.35 ? cols.hi : lit < -0.4 ? cols.lo : cols.c;
          if (coil) {
            const a = Math.atan2(uy, ux);
            const ring = d / r + a / (Math.PI * 2) * 0.5;
            if ((ring * 3.2) % 1 < 0.2) c = cols.lo;
          }
          fb[idx] = c;
        } else if (off > 0 && Math.hypot(ux - off * 0.7, uy - off) <= r) fb[idx] = DARK[fb[idx]];
      }
    }
  };

  /** Needle from its eye (ex, ey) along ang, length len; only the part t in [from, to] (0 eye .. 1 tip) is
   * above the linen. Steel shaft lit from the upper left, open eye, tapered tip, small cast shadow. */
  F.needleSpan = function (ex, ey, ang, len, from, to) {
    const z = cam.z;
    const r = Math.max(1, 0.95 * z);
    const ax = ex * z - cam.ox;
    const ay = ey * z - cam.oy;
    const bx = (ex + Math.cos(ang) * len) * z - cam.ox;
    const by = (ey + Math.sin(ang) * len) * z - cam.oy;
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    const lenS = Math.sqrt(l2);
    let nx = -dy / lenS;
    let ny = dx / lenS;
    if (nx + ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const off = Math.max(1, 1.6 * z);
    const x0 = Math.max(clip.x0, Math.floor(Math.min(ax, bx) - r - 2));
    const x1 = Math.min(clip.x1, Math.ceil(Math.max(ax, bx) + r + off + 2));
    const y0 = Math.max(clip.y0, Math.floor(Math.min(ay, by) - r - 2));
    const y1 = Math.min(clip.y1, Math.ceil(Math.max(ay, by) + r + off + 2));
    stampId++;
    for (let pass = 0; pass < 2; pass++) {
      const sx = pass === 0 ? off * 0.7 : 0;
      const sy = pass === 0 ? off : 0;
      for (let y = y0; y < y1; y++) {
        let idx = y * W + x0;
        for (let x = x0; x < x1; x++, idx++) {
          const px = x + 0.5 - sx;
          const py = y + 0.5 - sy;
          const t = ((px - ax) * dx + (py - ay) * dy) / l2;
          if (t < from || t > to) continue;
          const qx = px - (ax + dx * t);
          const qy = py - (ay + dy * t);
          const rr = t > 0.7 ? r * Math.max(0.15, (1 - t) / 0.3) : t < 0.03 ? r * 0.8 : r;
          const d = Math.hypot(qx, qy);
          if (d > rr) continue;
          if (pass === 0) {
            if (stampBuf[idx] !== stampId) {
              stampBuf[idx] = stampId;
              fb[idx] = DARK[fb[idx]];
            }
            continue;
          }
          const side = (qx * nx + qy * ny) / Math.max(rr, 0.5);
          if (t > 0.05 && t < 0.15 && Math.abs(side) < 0.4 && r >= 2.5) continue;
          fb[idx] = side > 0.3 ? C.WHITE : side < -0.45 ? C.STEEL_S : C.STEEL;
        }
      }
    }
  };

  /** Bitmap text in world space. kind 'type' (typewriter) or 'cross' (cross-stitch). */
  F.text = function (str, x, y, rot, s, col, o) {
    const opt = o || {};
    const kind = opt.kind || 'type';
    const seed = opt.seed || 1;
    const z = cam.z;
    const cz = s * z;
    const glyphs = [];
    for (const ch of str) glyphs.push(F.glyph(ch));
    const adv = 6;
    const wFont = glyphs.length * adv - 1;
    const cs = Math.cos(rot || 0);
    const sn = Math.sin(rot || 0);
    const wWorld = wFont * s;
    const hWorld = 8 * s;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [u, v] of [[0, -s], [wWorld, -s], [0, hWorld], [wWorld, hWorld]]) {
      const wx = x + cs * u - sn * v;
      const wy = y + sn * u + cs * v;
      x0 = Math.min(x0, wx);
      y0 = Math.min(y0, wy);
      x1 = Math.max(x1, wx);
      y1 = Math.max(y1, wy);
    }
    const box = screenBox(x0, y0, x1, y1);
    if (!box) return wWorld;
    const order = kind === 'cross' && opt.count !== undefined ? F.crossOrder(str) : null;
    const greek = cz < 0.85;
    const hiCol = opt.hi === undefined ? F.LIGHT[col] : opt.hi;
    const loCol = opt.lo === undefined ? DARK[col] : opt.lo;
    const faint = opt.faint === undefined ? (col === C.INK ? C.NIGHT_L : col) : opt.faint;
    for (let py = box[1]; py < box[3]; py++) {
      const wy = (py + 0.5 + cam.oy) / z - y;
      let idx = py * W + box[0];
      for (let px = box[0]; px < box[2]; px++, idx++) {
        const wx = (px + 0.5 + cam.ox) / z - x;
        const u = (cs * wx + sn * wy) / s;
        const v = (-sn * wx + cs * wy) / s;
        const gx = Math.floor(u);
        if (gx < 0 || gx >= wFont) continue;
        if (greek) {
          if (v > 2 && v < 5 && glyphs[Math.floor(gx / adv)] !== F.glyph(' ')) fb[idx] = kind === 'type' ? (col === C.INK ? C.NIGHT_L : col) : col;
          continue;
        }
        const ci = Math.floor(gx / adv);
        const cx = gx - ci * adv;
        if (cx >= 5) continue;
        const jump = kind === 'type' && opt.jump !== false && hash(ci, seed, 1) < 0.1 ? -1 : 0;
        const gy = Math.floor(v) - jump;
        if (gy < 0 || gy > 6) continue;
        const g = glyphs[ci];
        if (!g || !g[gy * 5 + cx]) continue;
        const fu = u - gx;
        const fv = v - Math.floor(v);
        if (kind === 'type') {
          const light = hash(ci, seed, 2) < 0.14;
          if (light && cz >= 4 && hash(gx, gy, seed + 5) < 0.12) continue;
          if (cz >= 6 && (fu < 0.13 || fu > 0.87 || fv < 0.13 || fv > 0.87) && hash(Math.floor(u * 6), Math.floor(v * 6), seed) < 0.22) continue;
          fb[idx] = light ? faint : col;
          continue;
        }
        // cross-stitch
        if (order) {
          const k = order[ci][gy * 5 + cx];
          if (k >= opt.count) continue;
        }
        if (cz >= 5) {
          const j1 = (hash(gx, gy, seed) - 0.5) * 0.14;
          const j2 = (hash(gy, gx, seed + 1) - 0.5) * 0.14;
          const a = fu - 0.5 - j1;
          const b = fv - 0.5 - j2;
          const w = Math.max(0.17, 0.75 / cz);
          const dTop = Math.abs(a + b);
          const dUnder = Math.abs(a - b);
          if (Math.abs(a) > 0.47 || Math.abs(b) > 0.47) continue;
          if (dTop < w * 1.414) fb[idx] = a - b < -0.12 ? hiCol : col;
          else if (dUnder < w * 1.414) fb[idx] = loCol;
        } else if (cz >= 2) {
          fb[idx] = fu * cz >= cz - 1 && fv * cz >= cz - 1 ? loCol : col;
        } else fb[idx] = col;
      }
    }
    return wWorld;
  };
  /** World width of a text string at scale s. */
  F.textWidth = (str, s) => (str.length * 6 - 1) * s;
})();
