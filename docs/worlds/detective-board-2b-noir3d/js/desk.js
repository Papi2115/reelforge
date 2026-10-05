/* Desk-level evidence: pencil, the magnifier (its lens re-draws the map 1.8x, clipped to the glass, with a lamp
 * caustic and a ring shadow), and a cold mug. All pure functions of t. */
'use strict';
(function () {
  const NB = window.NB;
  const W = NB.world;
  const S = NB.story;
  const { v3 } = W;
  const C = NB.C;
  const MAT = {
    pencil: Uint8Array.from([C.INK, C.DUSK, C.TAN, C.AMBER, C.TEAL]),
    wood: Uint8Array.from([C.RUST, C.SLATE, C.PEACH, C.HOTW, C.MIST]),
  };
  const mask = NB.newMask();
  const LENS_MM = [236, 158];
  const LENS_R = 0.05;
  const MAG = 1.8;

  function mapPoint(mm, t) {
    const map = S.BY.map;
    return S.localToWorld(map, S.frameOf(map, t), mm);
  }
  function pencil(t) {
    const a = mapPoint([318, 284], t);
    const b = mapPoint([408, 236], t);
    const roll = t >= 29.2 ? Math.min(1, (t - 29.2) / 0.35) : 0;
    const shift = [0, 0, -0.006 * NB.E.outBack(roll)];
    const p0 = v3.add(a, shift);
    const p1 = v3.add(b, shift);
    const ax = v3.norm(v3.sub(p1, p0));
    const len = Math.hypot(...v3.sub(p1, p0));
    const up = [0, 1, 0];
    const side = v3.norm(v3.cross(up, ax));
    const r = 0.0042;
    const c = v3.add(v3.mul(v3.add(p0, p1), 0.5), [0, r, 0]);
    const tip = v3.add(p0, v3.add(v3.mul(ax, -0.022), [0, r * 0.6, 0]));
    // shadow on the map
    const sh = NB.props.castShadow([].concat(v3.add(p0, [0, 2 * r, 0]), v3.add(p1, [0, 2 * r, 0]), tip), 'desk');
    NB.polyline3(sh.slice(0, 6), 0.007, 1, 6, 'dark');
    NB.polyline3([].concat(sh.slice(0, 3), sh.slice(6, 9)), 0.004, 1, 4, 'dark');
    W.obox(c, ax, up, side, len / 2, r, r, MAT.pencil, 1);
    const e = [].concat(v3.add(p0, v3.add(v3.mul(side, r), [0, 0.0005, 0])), v3.add(p0, v3.add(v3.mul(side, -r), [0, 0.0005, 0])), v3.add(p0, [0, 2 * r, 0]), tip);
    NB.poly3([].concat(e.slice(0, 3), e.slice(6, 9), e.slice(9, 12)), { mat: MAT.wood, plane: W.P.desk });
    NB.poly3([].concat(e.slice(0, 3), e.slice(3, 6), e.slice(9, 12)), { mat: MAT.wood, plane: W.P.desk });
    NB.polyline3([].concat(v3.add(p0, v3.mul(ax, -0.016)), tip), 0.003, 1, 3, C.INK);
  }
  function circle3(c, n, r, N) {
    const tmp = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = v3.norm(v3.cross(n, tmp));
    const w = v3.cross(n, u);
    const out = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      out.push(...v3.add(c, v3.add(v3.mul(u, Math.cos(a) * r), v3.mul(w, Math.sin(a) * r))));
    }
    return out;
  }
  function magnifier(t) {
    const k = NB.E.outBack(NB.seg(t, 26.5, 27.35));
    const map = S.BY.map;
    const fr = S.frameOf(map, t);
    const mm = [LENS_MM[0] + (1 - k) * 120, LENS_MM[1] + (1 - k) * 70];
    const base = S.localToWorld(map, fr, mm);
    const c = v3.add(base, [0, 0.042, 0]);
    const cp = NB.proj(c[0], c[1], c[2]);
    if (!cp || cp[0] < -200 || cp[0] > NB.W + 200 || cp[1] < -200 || cp[1] > NB.H + 200) return;
    const n = v3.norm([0.12, 1, -0.2]);
    const ring = circle3(c, n, LENS_R, 30);
    const inner = circle3(c, n, LENS_R - 0.006, 30);
    const handleDir = v3.norm(v3.sub(S.localToWorld(map, fr, [mm[0] + 100, mm[1] + 60]), base));
    const h0 = v3.add(c, v3.mul(handleDir, LENS_R + 0.004));
    const h1 = v3.add(v3.add(c, v3.mul(handleDir, LENS_R + 0.12)), [0, -0.028, 0]);
    // ring shadow + the caustic the lens throws from the lamp
    const shadow = NB.props.castShadow(ring, 'desk');
    NB.polyline3(shadow, 0.004, 1, 4, 'dark', true);
    NB.polyline3(NB.props.castShadow([].concat(h0, h1), 'desk'), 0.009, 1, 8, 'dark');
    const DL = NB.light.lamps[1];
    if (DL.on > 0) {
      const L = [DL.x, DL.y, DL.z];
      const d = v3.sub(c, L);
      const s = (W.G.desk.y + 0.001 - L[1]) / d[1];
      const f = v3.add(L, v3.mul(d, s * 0.985));
      NB.poly3(circle3(f, [0, 1, 0], 0.011, 14), C.PEACH);
      NB.poly3(circle3(f, [0, 1, 0], 0.0055, 10), C.HOTW);
    }
    // the magnified map inside the glass
    const pts = [];
    for (let i = 0; i < inner.length; i += 3) {
      const p = NB.proj(inner[i], inner[i + 1], inner[i + 2]);
      if (!p) return;
      pts.push(p[0], p[1]);
    }
    mask.fill(0);
    NB.setClip(mask);
    NB.poly2(pts, { mask: 1 });
    NB.props.drawCard(map, fr, t, { mag: { c: mm, k: MAG } });
    NB.setClip(null);
    NB.polyline2(pts, 1, C.ICE, true);
    // rim, glint and handle
    W.obox(v3.mul(v3.add(h0, h1), 0.5), v3.norm(v3.sub(h1, h0)), [0, 1, 0], v3.norm(v3.cross([0, 1, 0], v3.sub(h1, h0))), Math.hypot(...v3.sub(h1, h0)) / 2, 0.007, 0.009, W.M.wood, 1);
    NB.polyline3(ring, 0.009, 2, 8, C.INK, true);
    NB.polyline3(ring, 0.003, 1, 3, { mat: W.M.brass, plane: W.P.desk }, true);
    const g = [];
    for (let i = 3; i < 9; i++) g.push(inner[i * 3] * 0.82 + c[0] * 0.18, inner[i * 3 + 1] * 0.82 + c[1] * 0.18, inner[i * 3 + 2] * 0.82 + c[2] * 0.18);
    NB.polyline3(g, 0.002, 1, 2, C.ICE);
  }
  function mug() {
    const c = [0.58, W.G.desk.y, -0.98];
    const r = 0.042;
    const h = 0.095;
    const N = 16;
    const sh = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      sh.push(c[0] + Math.cos(a) * r, c[1] + h, c[2] + Math.sin(a) * r);
    }
    NB.poly3(NB.props.castShadow(sh, 'desk'), { dark: 1 });
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2;
      const a1 = ((i + 1) / N) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const p = (a, y) => [c[0] + Math.cos(a) * r, c[1] + y, c[2] + Math.sin(a) * r];
      W.face([].concat(p(a0, 0), p(a1, 0), p(a1, h), p(a0, h)), [Math.cos(am), 0, Math.sin(am)], W.M.mug, 0);
    }
    W.abox(c[0] + r - 0.002, c[1] + 0.025, c[2] - 0.005, c[0] + r + 0.026, c[1] + 0.075, c[2] + 0.005, W.M.mug, 1);
    const top = [];
    const cof = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      top.push(c[0] + Math.cos(a) * r, c[1] + h, c[2] + Math.sin(a) * r);
      cof.push(c[0] + Math.cos(a) * (r - 0.006), c[1] + h - 0.012, c[2] + Math.sin(a) * (r - 0.006));
    }
    NB.poly3(top, C.SLATE);
    NB.poly3(cof, C.INK);
    NB.polyline3(top, 0, 1, 1, C.INK, true);
  }
  function drawItems(t) {
    pencil(t);
    mug();
    magnifier(t);
  }
  NB.desk = { drawItems };
})();
