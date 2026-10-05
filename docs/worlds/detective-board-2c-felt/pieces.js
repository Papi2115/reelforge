/* detective-board 2c "felt" - felt, paper and tape pieces: two-step drop shadow, cut-edge thickness, fuzzy felt
 * edges, analytic deep-interior spans and per-cell fibres. All drawn at the current zoom from shape definitions. */
(function () {
  'use strict';
  const F = window.FELT;
  const W = F.W;
  const DARK = F.DARK;
  const hash = F.hash;
  const fb = F.fb;
  const cam = F.cam;
  const clip = F.clip;
  const inside = F.inside;
  const screenBox = F.screenBox;
  const buildMask = F.buildMask;
  const MASK_INV = F.MASK_INV;

  // ---------------------------------------------------------------- felt / paper pieces
  /**
   * p: {shape, x, y, rot, scale, col, shade, lift, thick, tex: felt|paper|tape|flat, seed, fuzz, fibre}
   * Draws drop shadow (two steps), cut-edge thickness and the textured body in one pass.
   */
  F.piece = function (p) {
    const z = cam.z;
    const s = p.shape;
    const sc = p.scale || 1;
    const rot = p.rot || 0;
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    const tex = p.tex || 'felt';
    const col = p.col;
    const shadeCol = p.shade === undefined ? DARK[col] : p.shade;
    const lightCol = p.light === undefined ? F.LIGHT[col] : p.light;
    const lift = p.lift === undefined ? 2 : p.lift;
    const thick = p.thick === undefined ? (tex === 'felt' ? 0.9 : 0) : p.thick;
    const fuzz = p.fuzz === undefined ? (tex === 'felt' ? 1.1 : 0.2) : p.fuzz;
    const seed = p.seed || 1;
    const sdx = lift > 0 ? Math.max(lift * 0.7, 1 / z) : 0;
    const sdy = lift > 0 ? Math.max(lift, 1 / z) : 0;
    const useThick = thick > 0 && thick * z >= 0.8;
    const tdx = thick * 0.55;
    const tdy = thick;
    const toLocal = (ox, oy) => [(cs * ox + sn * oy) / sc, (-sn * ox + cs * oy) / sc];
    const [su, sv] = toLocal(sdx, sdy);
    const [tu, tv] = toLocal(tdx, tdy);
    const bb = s.bb;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [u, v] of [[bb[0], bb[1]], [bb[2], bb[1]], [bb[0], bb[3]], [bb[2], bb[3]]]) {
      const wx = p.x + (cs * u - sn * v) * sc;
      const wy = p.y + (sn * u + cs * v) * sc;
      x0 = Math.min(x0, wx);
      y0 = Math.min(y0, wy);
      x1 = Math.max(x1, wx);
      y1 = Math.max(y1, wy);
    }
    const box = screenBox(x0 - fuzz - 1, y0 - fuzz - 1, x1 + sdx + fuzz + 1, y1 + sdy + fuzz + 1);
    if (!box) return;
    const q = Math.max(0.42, 1 / z);
    const fibreCell = tex === 'paper' ? 7 : 4.5;
    const doFibre = (tex === 'felt' || tex === 'paper') && fibreCell * z >= 7 && p.fibre !== false;
    const maskDeep = s.k === 2 && z < 5 && fuzz <= 1.15;
    if (maskDeep && !s.mask) buildMask(s);
    const fibreDensity = tex === 'paper' ? 0.07 : p.fibreDensity || 0.36;
    const fibreLight = tex === 'paper' ? 0 : p.fibreLight === undefined ? 0.25 : p.fibreLight;
    const inner = s.inner || (s.k === 0 ? [-s.hw + s.r, -s.hh + s.r, s.hw - s.r, s.hh - s.r] : null);
    const iu0 = inner ? inner[0] + fuzz + 0.01 : 0;
    const iv0 = inner ? inner[1] + fuzz + 0.01 : 0;
    const iu1 = inner ? inner[2] - fuzz - 0.01 : 0;
    const iv1 = inner ? inner[3] - fuzz - 0.01 : 0;
    const ribs = tex === 'tape' && z >= 2.5;
    // u(x) = au * x + bu(row), v(x) = av * x + bv(row): the deep interior of a row is one analytic span
    const au = cs / (z * sc);
    const av = -sn / (z * sc);
    for (let y = box[1]; y < box[3]; y++) {
      const wy = (y + 0.5 + cam.oy) / z - p.y;
      const wx0 = (0.5 + cam.ox) / z - p.x;
      const bu = (cs * wx0 + sn * wy) / sc;
      const bv = (-sn * wx0 + cs * wy) / sc;
      let xs = 1e9;
      let xe = -1e9;
      if (inner) {
        const iu = span(au, bu, iu0, iu1);
        const iv = span(av, bv, iv0, iv1);
        xs = Math.max(box[0], Math.ceil(Math.max(iu[0], iv[0])));
        xe = Math.min(box[2] - 1, Math.floor(Math.min(iu[1], iv[1])));
      }
      let idx = y * W + box[0];
      for (let x = box[0]; x < box[2]; x++, idx++) {
        if (x === xs && xe >= xs) {
          if (ribs) {
            for (; x <= xe; x++, idx++) {
              const v = av * x + bv;
              fb[idx] = (((v * 1.6) % 2) + 2) % 2 < 0.45 ? shadeCol : col;
            }
          } else {
            fb.fill(col, idx, idx + xe - xs + 1);
            idx += xe - xs + 1;
            x = xe + 1;
          }
          x--;
          idx--;
          continue;
        }
        const u = au * x + bu;
        const v = av * x + bv;
        let ju = 0;
        let jv = 0;
        let deep = false;
        if (maskDeep) {
          if (u < bb[0] || v < bb[1] || u > bb[2] || v > bb[3]) {
            if (u < bb[0] - 5 || v < bb[1] - 5 || u > bb[2] + 5 || v > bb[3] + 5) continue;
          } else {
            const mq = s.mask[(((v - bb[1]) * MASK_INV) | 0) * s.mw + (((u - bb[0]) * MASK_INV) | 0)];
            if (mq === 0) continue;
            deep = mq === 2;
          }
        }
        if (fuzz > 0 && !deep) {
          const qu = Math.floor(u / q);
          const qv = Math.floor(v / q);
          ju = (hash(qu, qv, seed) - 0.5) * fuzz * 2;
          jv = (hash(qv, qu, seed + 3) - 0.5) * fuzz * 2;
        }
        if (deep || inside(s, u + ju, v + jv)) {
          fb[idx] = ribs && (((v * 1.6) % 2) + 2) % 2 < 0.45 ? shadeCol : col;
        } else if (useThick && inside(s, u - tu, v - tv)) {
          fb[idx] = shadeCol;
        } else if (lift > 0 && inside(s, u - su, v - sv)) {
          fb[idx] = lift >= 1.6 && inside(s, u - su * 0.45, v - sv * 0.45) ? DARK[DARK[fb[idx]]] : DARK[fb[idx]];
        }
      }
    }
    if (doFibre) drawFibres(p, s, box, cs, sn, sc, col, fibreCell, fibreDensity, fibreLight, shadeCol, lightCol, seed, tex);
  };
  /** x interval (open) where lo < a * x + b < hi. */
  function span(a, b, lo, hi) {
    if (Math.abs(a) < 1e-12) return b > lo && b < hi ? [-1e9, 1e9] : [1e9, -1e9];
    const x1 = (lo - b) / a;
    const x2 = (hi - b) / a;
    return a > 0 ? [x1 + 1e-6, x2 - 1e-6] : [x2 + 1e-6, x1 - 1e-6];
  }
  /** Felt / paper fibres: one short seeded fibre per lucky cell, drawn only over this piece's body pixels. */
  function drawFibres(p, s, box, cs, sn, sc, col, cell, density, lightShare, shadeCol, lightCol, seed, tex) {
    const z = cam.z;
    // visible part of the piece in local space
    let u0 = Infinity;
    let v0 = Infinity;
    let u1 = -Infinity;
    let v1 = -Infinity;
    for (const [sx, sy] of [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]]) {
      const wx = (sx + cam.ox) / z - p.x;
      const wy = (sy + cam.oy) / z - p.y;
      const u = (cs * wx + sn * wy) / sc;
      const v = (-sn * wx + cs * wy) / sc;
      u0 = Math.min(u0, u);
      v0 = Math.min(v0, v);
      u1 = Math.max(u1, u);
      v1 = Math.max(v1, v);
    }
    u0 = Math.max(u0, s.bb[0]);
    v0 = Math.max(v0, s.bb[1]);
    u1 = Math.min(u1, s.bb[2]);
    v1 = Math.min(v1, s.bb[3]);
    const rpx = Math.max(0.55, 0.26 * z * sc);
    const r2 = rpx * rpx;
    for (let cj = Math.floor(v0 / cell); cj <= Math.floor(v1 / cell); cj++) {
      for (let ci = Math.floor(u0 / cell); ci <= Math.floor(u1 / cell); ci++) {
        if (hash(ci, cj, seed * 7 + 1) >= density) continue;
        const fcx = (ci + 0.2 + 0.6 * hash(ci, cj, seed + 11)) * cell;
        const fcy = (cj + 0.2 + 0.6 * hash(ci, cj, seed + 12)) * cell;
        if (!inside(s, fcx, fcy)) continue;
        const ang = hash(ci, cj, seed + 13) * Math.PI;
        const half = (tex === 'paper' ? 0.7 : 1.1) + hash(ci, cj, seed + 14) * 0.8;
        const fcol = hash(ci, cj, seed + 15) < lightShare ? lightCol : shadeCol;
        const ea = Math.cos(ang) * half;
        const eb = Math.sin(ang) * half;
        const toS = (u, v) => [(p.x + (cs * u - sn * v) * sc) * z - cam.ox, (p.y + (sn * u + cs * v) * sc) * z - cam.oy];
        const A = toS(fcx - ea, fcy - eb);
        const B = toS(fcx + ea, fcy + eb);
        const xa = Math.max(clip.x0, Math.floor(Math.min(A[0], B[0]) - rpx));
        const xb = Math.min(clip.x1, Math.ceil(Math.max(A[0], B[0]) + rpx));
        const ya = Math.max(clip.y0, Math.floor(Math.min(A[1], B[1]) - rpx));
        const yb = Math.min(clip.y1, Math.ceil(Math.max(A[1], B[1]) + rpx));
        const dx = B[0] - A[0];
        const dy = B[1] - A[1];
        const l2 = dx * dx + dy * dy || 1e-9;
        for (let y = ya; y < yb; y++) {
          for (let x = xa; x < xb; x++) {
            const idx = y * W + x;
            if (fb[idx] !== col) continue;
            let t = ((x + 0.5 - A[0]) * dx + (y + 0.5 - A[1]) * dy) / l2;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const ex = x + 0.5 - A[0] - dx * t;
            const ey = y + 0.5 - A[1] - dy * t;
            if (ex * ex + ey * ey < r2) fb[idx] = fcol;
          }
        }
      }
    }
  }

})();
