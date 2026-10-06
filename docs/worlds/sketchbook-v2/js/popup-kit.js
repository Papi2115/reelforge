/* sketchbook v2 - pop-up kit: a tiny 2.5D camera for paper models standing up out of the page (shot 5).
   The camera looks straight down at the page from height CAM.h with a shifted lens centre (CAM.x, CAM.y), so the
   page plane Z = 0 maps 1:1 onto the screen (the notebook looks exactly as in every other shot) while anything lifted
   off the page grows toward the camera and leans away from the lens centre. A flat piece of paper is a plane
   P(u, v) = O + u U + v V (U, V orthonormal); faces are filled through the inverse homography so the paper fibres stay
   glued to the paper. Shading and cast shadows are flat palette remaps (SB.SOFT / SB.HARD), never dither.
   Pure maths: no state survives a frame except scratch buffers that are fully rewritten before use. */
'use strict';
(function () {
  const SB = window.SB, W = SB.W, H = SB.H;
  const PU = (SB.POP = {});
  const CAM = { x: 470, y: 1470, h: 1400 };
  const EYE = [CAM.x, CAM.y, CAM.h];

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  // key light: high, a little right and in front of the card (shadows fall back and slightly left)
  const L = unit([0.25, 0.42, 0.87]);

  PU.proj = (X, Y, Z) => { const k = CAM.h / (CAM.h - Z); return [CAM.x + (X - CAM.x) * k, CAM.y + (Y - CAM.y) * k]; };

  // flat paper plane; n = its front normal (default U x V)
  PU.plane = (O, U, V, n) => {
    const at = (u, v) => [O[0] + u * U[0] + v * V[0], O[1] + u * U[1] + v * V[1], O[2] + u * U[2] + v * V[2]];
    const xf = (u, v) => { const p = at(u, v); return PU.proj(p[0], p[1], p[2]); };
    // (u, v, 1) -> homogeneous screen; x (h - Z) = h X - cx Z, y (h - Z) = h Y - cy Z, w = h - Z
    const m = [
      CAM.h * U[0] - CAM.x * U[2], CAM.h * V[0] - CAM.x * V[2], CAM.h * O[0] - CAM.x * O[2],
      CAM.h * U[1] - CAM.y * U[2], CAM.h * V[1] - CAM.y * V[2], CAM.h * O[1] - CAM.y * O[2],
      -U[2], -V[2], CAM.h - O[2],
    ];
    const nn = unit(n || cross(U, V));
    return { O: O, U: U, V: V, n: nn, at: at, xf: xf, minv: inverse3(m), facing: dot(nn, sub(EYE, O)) > 0 };
  };
  function inverse3(m) {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h, B = -(d * i - f * g), Cc = d * h - e * g;
    const det = a * A + b * B + c * Cc;
    if (Math.abs(det) < 1e-9) return null;
    const k = 1 / det;
    return [A * k, -(b * i - c * h) * k, (b * f - c * e) * k, B * k, (a * i - c * g) * k, -(a * f - c * d) * k, Cc * k, -(a * h - b * g) * k, (a * e - b * d) * k];
  }
  PU.uvPoly = (pl, uv) => { const out = []; for (let i = 0; i < uv.length; i += 2) out.push(...pl.xf(uv[i], uv[i + 1])); return out; };
  // rectangle [u0,u1] x [v0,v1] as a flat uv polygon
  PU.rect = (u0, v0, u1, v1) => [u0, v0, u1, v0, u1, v1, u0, v1];

  // light level of a face: null = lit, SOFT = turned away a little, HARD = turned away
  PU.shadeOf = (pl) => { const l = dot(pl.n, L); return l >= 0.6 ? null : l >= 0.12 ? SB.SOFT : SB.HARD; };

  // fill a face with its own paper fibres (texture lives in uv, so it travels with the paper). o: {col, fib, fib2, fo, shade, edge}
  PU.face = (b, pl, uv, o) => {
    const pts = PU.uvPoly(pl, uv), mi = pl.minv;
    if (!mi || Math.abs(polyArea(pts)) < 1) return pts;
    const col = o.col, fib = o.fib != null ? o.fib : col, fib2 = o.fib2 != null ? o.fib2 : fib, fo = o.fo || 0, sh = o.shade || null;
    SB.fillPoly(b, pts, (x, y) => {
      const X = x + 0.5, Y = y + 0.5, w = mi[6] * X + mi[7] * Y + mi[8];
      const f = SB.fibreAt((mi[0] * X + mi[1] * Y + mi[2]) / w + fo, (mi[3] * X + mi[4] * Y + mi[5]) / w + 200);
      const c = f === 1 ? fib : f === 2 ? fib2 : col;
      return sh ? sh[c] : c;
    });
    if (o.edge != null) SB.outline(b, pts, o.edge);
    return pts;
  };
  // flat colour shape on a plane (cut paper pieces, printed bands)
  PU.flat = (b, pl, uv, col, edge) => {
    const pts = PU.uvPoly(pl, uv);
    SB.fillPoly(b, pts, col);
    if (edge != null) SB.outline(b, pts, edge);
    return pts;
  };
  // crisp printed / cut line on a plane
  PU.line = (b, pl, u0, v0, u1, v1, col) => {
    const a = pl.xf(u0, v0), z = pl.xf(u1, v1), pix = SB.pixelPath([a[0], a[1], z[0], z[1]], true);
    for (let i = 0; i < pix.length; i += 2) SB.put(b, pix[i], pix[i + 1], col);
  };
  function polyArea(p) { let s = 0; for (let i = 0, n = p.length; i < n; i += 2) { const j = (i + 2) % n; s += p[i] * p[j + 1] - p[j] * p[i + 1]; } return s / 2; }

  // ---- cast shadows: caster points (3D) are pushed along the light onto a receiver plane ----
  function onPlane(P, pl) {
    const ln = dot(L, pl.n);
    const t = dot(sub(P, pl.O), pl.n) / ln, S = [P[0] - t * L[0], P[1] - t * L[1], P[2] - t * L[2]], d = sub(S, pl.O);
    return [dot(d, pl.U), dot(d, pl.V)];
  }
  function hull(pts) {
    const p = [];
    for (let i = 0; i < pts.length; i += 2) p.push([pts[i], pts[i + 1]]);
    p.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return [];
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
    lo.pop(); hi.pop();
    return lo.concat(hi).reduce((a, q) => a.concat(q), []);
  }
  // Sutherland-Hodgman against an axis-aligned uv box
  function clipBox(poly, box) {
    let out = poly;
    const edges = [[0, box[0], 1], [0, box[2], -1], [1, box[1], 1], [1, box[3], -1]];
    for (const [ax, lim, sgn] of edges) {
      const inp = out, n = inp.length >> 1;
      out = [];
      if (!n) break;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, a = [inp[2 * i], inp[2 * i + 1]], c = [inp[2 * j], inp[2 * j + 1]];
        const ia = (a[ax] - lim) * sgn >= 0, ic = (c[ax] - lim) * sgn >= 0;
        if (ia) out.push(a[0], a[1]);
        if (ia !== ic) { const k = (lim - a[ax]) / (c[ax] - a[ax]); out.push(a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k); }
      }
    }
    return out;
  }
  // screen polygon of the shadow a convex caster (list of 3D points) throws on a receiver plane, clipped to box (uv)
  PU.shadowOn = (pl, casters, box) => {
    if (dot(L, pl.n) < 0.1) return null;
    const uv = [];
    for (const P of casters) uv.push(...onPlane(P, pl));
    let h = hull(uv);
    if (box) h = clipBox(h, box);
    return h.length >= 6 ? PU.uvPoly(pl, h) : null;
  };
  // darken the union of screen polygons once (overlaps never double up)
  const MASK = new Uint8Array(W * H);
  PU.shade = (b, polys, table) => {
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    const list = polys.filter(Boolean);
    for (const p of list) for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
    x0 = Math.max(0, Math.floor(x0) - 1); y0 = Math.max(0, Math.floor(y0) - 1); x1 = Math.min(W - 1, Math.ceil(x1) + 1); y1 = Math.min(H - 1, Math.ceil(y1) + 1);
    if (x1 < x0 || y1 < y0) return;
    for (let y = y0; y <= y1; y++) MASK.fill(0, y * W + x0, y * W + x1 + 1);
    for (const p of list) SB.fillPoly(MASK, p, 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; if (MASK[i]) b[i] = table[b[i]]; }
  };
})();
