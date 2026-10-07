/* detective-board 2c "felt" - world-space rasteriser. Everything is drawn per frame at the current
 * camera zoom from procedural definitions (level of detail by screen size), never by scaling a bitmap.
 * Camera: screen x = wx * z - ox (ox pixel-snapped), so integer zooms land on whole pixels. */
(function () {
  'use strict';
  const F = window.FELT;
  const W = F.W;
  const H = F.H;
  const C = F.C;
  const hash = F.hash;
  const fb = new Uint8Array(W * H);
  F.fb = fb;

  const cam = { cx: 0, cy: 0, z: 1, ox: 0, oy: 0 };
  const clip = { x0: 0, y0: 0, x1: W, y1: H };
  F.cam = cam;
  F.clip = clip;
  F.setClip = function (x0, y0, x1, y1) {
    clip.x0 = Math.max(0, Math.floor(x0));
    clip.y0 = Math.max(0, Math.floor(y0));
    clip.x1 = Math.min(W, Math.ceil(x1));
    clip.y1 = Math.min(H, Math.ceil(y1));
  };
  F.resetClip = () => F.setClip(0, 0, W, H);
  F.setCamera = function (cx, cy, z) {
    cam.cx = cx;
    cam.cy = cy;
    cam.z = z;
    cam.ox = Math.round(cx * z - W / 2);
    cam.oy = Math.round(cy * z - H / 2);
  };
  F.sx = (wx) => wx * cam.z - cam.ox;
  F.sy = (wy) => wy * cam.z - cam.oy;

  /** Screen-space box for a world box, clipped; null when off screen. */
  function screenBox(x0, y0, x1, y1) {
    const z = cam.z;
    const a = Math.max(clip.x0, Math.floor(x0 * z - cam.ox));
    const b = Math.max(clip.y0, Math.floor(y0 * z - cam.oy));
    const c = Math.min(clip.x1, Math.ceil(x1 * z - cam.ox) + 1);
    const d = Math.min(clip.y1, Math.ceil(y1 * z - cam.oy) + 1);
    return a >= c || b >= d ? null : [a, b, c, d];
  }
  F.screenBox = screenBox;

  // ---------------------------------------------------------------- linen ground
  // Plain weave, pitch 3 world units per thread. Level of detail by thread size on screen:
  //   macro (>= 10 px): every thread drawn as a rounded pill, crown lit from the upper left, dives shaded;
  //   mid (3.5..10 px): short woven ticks where threads dive, alternating direction cell by cell;
  //   far: calm ground with the odd slub (a short thick stretch of one thread).
  const LIN = [C.LIN0, C.LIN1, C.LIN2, C.LIN3];
  const PITCH = 3;
  const colI = new Int32Array(W);
  const colF = new Float64Array(W);
  /** +1 where thread n is slubbed (thicker, lighter) along cross index m; segments, not whole lines. */
  function slub(n, m, salt) {
    const seg = Math.floor((m + hash(n, salt, 78) * 5) / 5);
    const h = hash(n, seg, salt + 79);
    return h < 0.035 ? 1 : h > 0.988 ? -1 : 0;
  }
  let mi = 1e9;
  let mj = 1e9;
  let mS = 0;
  let mH = 0;
  function weave(i, j, fx, fy, mode, dens, wx, wy) {
    if (mode === 0) return 2;
    const warpTop = ((i + j) & 1) === 0;
    const across = warpTop ? fx : fy;
    const along = warpTop ? fy : fx;
    if (i !== mi || j !== mj) {
      mi = i;
      mj = j;
      mS = warpTop ? slub(i, j, 2) : slub(j, i, 5);
      mH = hash(i, j, 45);
    }
    const s = mS;
    if (mode === 1) {
      // basket weave: one short lit bar per float, alternating direction cell by cell; thins out as we zoom away
      if (mH >= dens) return 2;
      if (across > 0.22 && across < (s > 0 ? 0.62 : 0.45) && along > 0.18 && along < 0.82) return 3;
      return 2;
    }
    // macro: each float is a rounded grain, lit from the upper left
    const a = (across - 0.47) / 0.43;
    const b = (along - 0.5) / 0.53;
    const b2 = b * b;
    if (a * a + b2 * b2 > 1) return Math.abs(b) > 0.92 && Math.abs(a) > 0.8 ? 0 : 1;
    const lit = -a * 0.85 - b * 0.3 + (hash(i, j, 43) - 0.5) * 0.18;
    let tone = lit > 0.42 ? 3 : lit < -0.5 ? 1 : 2;
    // plied yarn: diagonal twist lines across every float
    const tw = along * 2.6 + across * 1.1 + hash(i, j, 44);
    if (tw - Math.floor(tw) < 0.16 && tone > 1) tone -= 1;
    if (s > 0 && tone === 2) tone = 3;
    if (s < 0 && tone === 3) tone = 2;
    if (hash(Math.floor(wx * 2.1), Math.floor(wy * 2.1), 5) < 0.03) tone += 1;
    return tone;
  }
  // The board is an endless quilt of big linen panels (two dye lots), joined by seams with a quilting stitch.
  // Panel rows are 470 units tall; inside a row the column seams repeat every 3000 units, offset per row.
  const COLX = [0, 780, 1440, 2280, 3000];
  const COLP = 3000;
  const ROWH = 470;
  const colSin = new Float64Array(W);
  const seamX = new Float64Array(64);
  const seamShift = new Int8Array(64);
  function rowSeams(r, wy, wx0, wx1) {
    const off = r * 1170 + 310 + Math.sin(wy * 0.011 + r) * 3.5;
    let n = 0;
    let per = Math.floor((wx0 + off) / COLP) - 1;
    for (; n < 60; per++) {
      for (let c = 0; c < 4 && n < 60; c++) {
        seamX[n] = per * COLP + COLX[c] - off;
        seamShift[n] = hash(per * 4 + c, r, 91) < 0.36 ? -1 : 0;
        n++;
      }
      if (per * COLP - off > wx1 + COLP) break;
    }
    return n;
  }
  /** fold: optional pucker {ax, ay, bx, by, amp, width}. */
  F.drawLinen = function (fold, skip) {
    const z = cam.z;
    let k = 1;
    while (PITCH * k * z < 2.5) k *= 2;
    const pitch = PITCH * k;
    const sp = pitch * z;
    const mode = k > 1 ? 0 : sp >= 10 ? 2 : 1;
    const dens = F.clamp((sp - 2.5) / 3.5, 0, 1);
    const seamW = Math.max(0.7, 0.75 / z);
    for (let x = clip.x0; x < clip.x1; x++) {
      const g = (x + 0.5 + cam.ox) / z / pitch;
      colI[x] = Math.floor(g);
      colF[x] = g - colI[x];
    }
    let fb0 = null;
    if (fold && fold.amp > 0.01) {
      let fdx = fold.bx - fold.ax;
      let fdy = fold.by - fold.ay;
      const flen = Math.hypot(fdx, fdy);
      fdx /= flen;
      fdy /= flen;
      fb0 = { fdx, fdy, flen, box: screenBox(Math.min(fold.ax, fold.bx) - fold.width * 1.2, Math.min(fold.ay, fold.by) - fold.width * 1.2, Math.max(fold.ax, fold.bx) + fold.width * 1.2, Math.max(fold.ay, fold.by) + fold.width * 1.2) };
    }
    const wxL = (clip.x0 + cam.ox) / z;
    const wxR = (clip.x1 + cam.ox) / z;
    let lastR = -99999;
    for (let y = clip.y0; y < clip.y1; y++) {
      const wy = (y + 0.5 + cam.oy) / z;
      const gy = wy / pitch;
      const j = Math.floor(gy);
      const fy = gy - j;
      const r = Math.floor((wy + 140) / ROWH);
      const mrow = wy + 140 - r * ROWH;
      const rowE = Math.min(mrow, ROWH - mrow);
      if (r !== lastR) {
        for (let x = clip.x0; x < clip.x1; x++) colSin[x] = Math.sin(((x + 0.5 + cam.ox) / z) * 0.013 + r * 2) * 2.5;
        lastR = r;
      }
      const ns = rowSeams(r, wy, wxL, wxR);
      let si = 0;
      const vDash = ((wy % 7.4) + 7.4) % 7.4 < 4.2;
      let row = y * W + clip.x0;
      const inFoldRow = fb0 && fb0.box && y >= fb0.box[1] && y < fb0.box[3];
      let sx0 = -1;
      let sx1 = -1;
      if (skip) {
        for (const r of skip) {
          if (y >= r[1] && y < r[3]) {
            sx0 = r[0];
            sx1 = r[2];
          }
        }
      }
      for (let x = clip.x0; x < clip.x1; x++, row++) {
        if (x === sx0 && sx1 > sx0) {
          row += sx1 - sx0 - 1;
          x = sx1 - 1;
          continue;
        }
        const wx = (x + 0.5 + cam.ox) / z;
        let tone;
        if (inFoldRow && x >= fb0.box[0] && x < fb0.box[2]) {
          let fx2 = wx;
          let fy2 = wy;
          const rx = wx - fold.ax;
          const ry = wy - fold.ay;
          const u = rx * fb0.fdx + ry * fb0.fdy;
          const d = Math.abs(rx * -fb0.fdy + ry * fb0.fdx);
          let shade = 0;
          if (d < fold.width && u > -fold.width * 0.4 && u < fb0.flen + fold.width * 0.4) {
            const env = (1 - d / fold.width) * Math.sin(Math.PI * F.clamp((u + fold.width * 0.4) / (fb0.flen + fold.width * 0.8), 0, 1));
            const ph = u * 0.42 + Math.sin(d * 0.09) * 1.1;
            const wave = Math.sin(ph) * fold.amp * env;
            fx2 += fb0.fdx * Math.cos(ph) * 3.2 * fold.amp * env;
            fy2 += fb0.fdy * Math.cos(ph) * 3.2 * fold.amp * env;
            shade = wave > 0.62 ? 1 : wave < -0.55 ? -1 : 0;
          }
          const gx = fx2 / pitch;
          const gy2 = fy2 / pitch;
          const i2 = Math.floor(gx);
          const j2 = Math.floor(gy2);
          tone = weave(i2, j2, gx - i2, gy2 - j2, mode, dens, fx2, fy2) + shade;
        } else tone = weave(colI[x], j, colF[x], fy, mode, dens, wx, wy);
        // quilt panel + seams
        while (si < ns - 2 && wx >= seamX[si + 1]) si++;
        const ex = Math.min(wx - seamX[si], seamX[si + 1] - wx);
        const ey = rowE + colSin[x];
        if (ex < seamW || ey < seamW) tone = 1;
        else if ((ey > 3.6 && ey < 4.6 && ((wx % 7.4) + 7.4) % 7.4 < 4.2) || (ex > 3.6 && ex < 4.6 && vDash)) tone = 3;
        else tone += seamShift[si];
        fb[row] = LIN[tone < 0 ? 0 : tone > 3 ? 3 : tone];
      }
    }
  };

  // ---------------------------------------------------------------- shapes
  F.rect = (w, h, r) => ({ k: 0, hw: w / 2, hh: h / 2, r: r || 0, bb: [-w / 2, -h / 2, w / 2, h / 2] });
  F.ell = (rx, ry) => ({ k: 1, rx, ry, bb: [-rx, -ry, rx, ry] });
  F.pinked = (w, h, tooth) => ({ k: 5, hw: w / 2, hh: h / 2, tooth, amp: tooth * 0.45, bb: [-w / 2 - tooth, -h / 2 - tooth, w / 2 + tooth, h / 2 + tooth], inner: [-w / 2, -h / 2, w / 2, h / 2] });
  F.ring = (r0, r1) => ({ k: 4, r0, r1, bb: [-r1, -r1, r1, r1] });
  /** inner: optional [u0, v0, u1, v1] box known to lie fully inside (fast path). */
  F.poly = function (pts, inner) {
    const p = new Float64Array(pts.length * 2);
    let a = Infinity;
    let b = Infinity;
    let c = -Infinity;
    let d = -Infinity;
    pts.forEach((q, i) => {
      p[i * 2] = q[0];
      p[i * 2 + 1] = q[1];
      a = Math.min(a, q[0]);
      b = Math.min(b, q[1]);
      c = Math.max(c, q[0]);
      d = Math.max(d, q[1]);
    });
    return { k: 2, p, n: pts.length, bb: [a, b, c, d], inner: inner || null };
  };
  /** union of parts [{s, x, y}] */
  F.union = function (parts) {
    const bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (const q of parts) {
      bb[0] = Math.min(bb[0], q.s.bb[0] + q.x);
      bb[1] = Math.min(bb[1], q.s.bb[1] + q.y);
      bb[2] = Math.max(bb[2], q.s.bb[2] + q.x);
      bb[3] = Math.max(bb[3], q.s.bb[3] + q.y);
    }
    return { k: 3, parts, bb };
  };
  function inside(s, u, v) {
    if (u < s.bb[0] || v < s.bb[1] || u > s.bb[2] || v > s.bb[3]) return false;
    if (s.k === 0) {
      const dx = Math.abs(u) - s.hw + s.r;
      const dy = Math.abs(v) - s.hh + s.r;
      if (dx <= 0 || dy <= 0) return true;
      return dx * dx + dy * dy <= s.r * s.r;
    }
    if (s.k === 1) return (u * u) / (s.rx * s.rx) + (v * v) / (s.ry * s.ry) <= 1;
    if (s.k === 5) {
      // pinking-shears rectangle: zigzag teeth on every edge, analytic
      const t = s.tooth;
      const fu = u / t - Math.floor(u / t);
      const fv = v / t - Math.floor(v / t);
      const zu = s.amp * (1 - Math.abs(2 * fu - 1));
      const zv = s.amp * (1 - Math.abs(2 * fv - 1));
      return v >= -s.hh - zu && v <= s.hh + zu && u >= -s.hw - zv && u <= s.hw + zv;
    }
    if (s.k === 4) {
      const d2 = u * u + v * v;
      return d2 <= s.r1 * s.r1 && d2 >= s.r0 * s.r0;
    }
    if (s.k === 2) {
      if (cam.z < 5) {
        const m = s.mask || buildMask(s);
        const mx = ((u - s.bb[0]) * MASK_INV) | 0;
        const my = ((v - s.bb[1]) * MASK_INV) | 0;
        const q = m[my * s.mw + mx];
        return q === 1 || q === 2;
      }
      const p = s.p;
      const n = s.n;
      let c = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const yi = p[i * 2 + 1];
        const yj = p[j * 2 + 1];
        if (yi > v !== yj > v) {
          const xi = p[i * 2];
          if (u < ((p[j * 2] - xi) * (v - yi)) / (yj - yi) + xi) c = !c;
        }
      }
      return c;
    }
    for (const q of s.parts) if (inside(q.s, u - q.x, v - q.y)) return true;
    return false;
  }
  F.inside = inside;
  /** Screen rect fully covered by an item's box [u0,v0,u1,v1] (local) at x, y, rot; null if tiny. */
  F.coverRect = function (x, y, rot, box) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const xs = [];
    const ys = [];
    for (const [u, v] of [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]]) {
      xs.push((x + c * u - s * v) * cam.z - cam.ox);
      ys.push((y + s * u + c * v) * cam.z - cam.oy);
    }
    const srt = (a) => a.slice().sort((p, q) => p - q);
    const sx = srt(xs);
    const sy = srt(ys);
    const r = [Math.max(clip.x0, Math.ceil(sx[1]) + 1), Math.max(clip.y0, Math.ceil(sy[1]) + 1), Math.min(clip.x1, Math.floor(sx[2]) - 1), Math.min(clip.y1, Math.floor(sy[2]) - 1)];
    return r[2] - r[0] > 8 && r[3] - r[1] > 8 ? r : null;
  };
  const MASK_RES = 0.25;
  const MASK_INV = 1 / MASK_RES;
  /** Rasterise a polygon once into a local-space inside mask (scanline crossings). */
  function buildMask(s) {
    const w = Math.ceil((s.bb[2] - s.bb[0]) * MASK_INV) + 1;
    const h = Math.ceil((s.bb[3] - s.bb[1]) * MASK_INV) + 1;
    const m = new Uint8Array(w * h);
    const p = s.p;
    const n = s.n;
    const xs = [];
    for (let row = 0; row < h; row++) {
      const v = s.bb[1] + (row + 0.5) * MASK_RES;
      xs.length = 0;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const yi = p[i * 2 + 1];
        const yj = p[j * 2 + 1];
        if (yi > v !== yj > v) xs.push(((p[j * 2] - p[i * 2]) * (v - yi)) / (yj - yi) + p[i * 2]);
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, Math.ceil((xs[k] - s.bb[0]) * MASK_INV - 0.5));
        const b = Math.min(w - 1, Math.floor((xs[k + 1] - s.bb[0]) * MASK_INV - 0.5));
        for (let c = a; c <= b; c++) m[row * w + c] = 1;
      }
    }
    // mark cells at least ERODE cells inside every edge as 2 ("deep": edge fuzz cannot reach them)
    const ERODE = 7;
    const tmp = new Uint8Array(w * h);
    for (let row = 0; row < h; row++) {
      let run = 0;
      for (let c = 0; c < w; c++) {
        run = m[row * w + c] ? run + 1 : 0;
        tmp[row * w + c] = run;
      }
      run = 0;
      for (let c = w - 1; c >= 0; c--) {
        run = m[row * w + c] ? run + 1 : 0;
        tmp[row * w + c] = Math.min(tmp[row * w + c], run) > ERODE ? 1 : 0;
      }
    }
    for (let c = 0; c < w; c++) {
      let run = 0;
      const up = new Uint16Array(h);
      for (let row = 0; row < h; row++) {
        run = tmp[row * w + c] ? run + 1 : 0;
        up[row] = run;
      }
      run = 0;
      for (let row = h - 1; row >= 0; row--) {
        run = tmp[row * w + c] ? run + 1 : 0;
        if (Math.min(up[row], run) > ERODE) m[row * w + c] = 2;
      }
    }
    // outside cells within NEAR cells of the shape (shadow / fuzz reach) become 4; the rest stay 0 (skip)
    const NEAR = 18;
    const pre = new Int32Array(w + 1);
    const nearH = new Uint8Array(w * h);
    for (let row = 0; row < h; row++) {
      for (let c = 0; c < w; c++) pre[c + 1] = pre[c] + (m[row * w + c] ? 1 : 0);
      for (let c = 0; c < w; c++) if (pre[Math.min(w, c + NEAR + 1)] - pre[Math.max(0, c - NEAR)] > 0) nearH[row * w + c] = 1;
    }
    const preV = new Int32Array(h + 1);
    for (let c = 0; c < w; c++) {
      for (let row = 0; row < h; row++) preV[row + 1] = preV[row] + nearH[row * w + c];
      for (let row = 0; row < h; row++) {
        if (m[row * w + c] === 0 && preV[Math.min(h, row + NEAR + 1)] - preV[Math.max(0, row - NEAR)] > 0) m[row * w + c] = 4;
      }
    }
    s.mask = m;
    s.mw = w;
    return m;
  }

  F.buildMask = buildMask;
  F.MASK_INV = MASK_INV;
})();
