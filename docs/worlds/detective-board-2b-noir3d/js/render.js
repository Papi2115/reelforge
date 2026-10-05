/* Frame assembly: render(t) = pure function of the global time t (quantised to 30 fps). Painter's order is fixed by
 * the room's layout (outside -> room -> board -> cards -> strings/pins -> desk -> desk strings -> desk props -> lamp). */
'use strict';
(function () {
  const NB = window.NB;
  const W = NB.world;
  const S = NB.story;
  const C = NB.C;
  const { v3 } = W;
  const FPS = 30;

  function drawPinShadow(p, support) {
    const sh = NB.props.castShadow([].concat(p.base, p.head), support);
    NB.polyline3(sh, 0.0016, 1, 3, 'dark');
    const h = NB.proj(sh[3], sh[4], sh[5]);
    if (h) {
      NB.stampAt(h[0], h[1], NB.clamp((0.009 * NB.cam.f) / h[2], 2, 12), 'dark');
    }
  }
  function drawPin(p) {
    const tilt = [NB.sr(p.seed, 1) * 0.004, NB.sr(p.seed, 2) * 0.004, 0];
    const head = v3.add(p.head, p.n[1] > 0.5 ? [tilt[0], 0, tilt[1]] : tilt);
    NB.polyline3([].concat(p.base, head), 0.0012, 1, 2, C.MIST);
    const h = NB.proj(head[0], head[1], head[2]);
    if (!h) return;
    const r = NB.clamp(((p.red ? 0.0052 : 0.0045) * NB.cam.f * p.squash) / h[2], 1.5, 14);
    NB.stampAt(h[0], h[1], r * 2 + 2, C.INK);
    if (p.red) {
      NB.stampAt(h[0], h[1], r * 2, C.RED);
      if (r > 2.5) NB.stampAt(h[0] - r * 0.35, h[1] - r * 0.35, Math.max(1, r * 0.55), C.RED_HOT);
    } else {
      const cls = NB.classAt(head[0], head[1], head[2], p.n[0], p.n[1], p.n[2]);
      NB.stampAt(h[0], h[1], r * 2, W.M.brass[cls]);
      if (r > 2.5) NB.stampAt(h[0] - r * 0.35, h[1] - r * 0.35, Math.max(1, r * 0.5), cls >= 2 ? C.HOTW : C.MIST);
    }
  }
  function stringShadow(g) {
    if (!g.air) {
      NB.polyline3(NB.props.castShadow(g.pts, 'board'), 0.0026, 1, 4, 'dark');
      return;
    }
    const sh = NB.props.castShadow(g.pts, 'desk');
    const d = W.G.desk;
    const keep = [];
    for (let i = 0; i < sh.length; i += 3) {
      const ok = sh[i] > d.x0 && sh[i] < d.x1 && sh[i + 2] > d.z0 && sh[i + 2] < d.z1 && g.pts[i + 1] > d.y;
      if (ok) keep.push(sh[i], sh[i + 1], sh[i + 2]);
      else if (keep.length) break;
    }
    if (keep.length > 5) NB.polyline3(keep, 0.0026, 1, 4, 'dark');
  }
  function drawString(g) {
    const sp = [];
    let wsum = 0;
    let cnt = 0;
    for (let i = 0; i < g.pts.length; i += 3) {
      const p = NB.proj(g.pts[i], g.pts[i + 1], g.pts[i + 2]);
      if (!p) continue;
      sp.push(p[0], p[1]);
      wsum += (0.0032 * NB.cam.f) / p[2];
      cnt++;
    }
    if (sp.length < 4) return;
    const w = NB.clamp(Math.round(wsum / cnt), 2, 4);
    NB.polyline2(sp, w + 4, { glow: C.RED_DK });
    NB.polyline2(sp, w, C.RED);
    if (w >= 2) {
      const hi = sp.map((v, i) => (i % 2 ? v - Math.floor(w / 2) : v));
      NB.polyline2(hi, 1, C.RED_HOT);
    }
  }
  function drawTip(g) {
    if (!g.tip) return;
    const n = g.tipN || [0, 0, -1];
    const head = v3.add(g.tip, v3.mul(n, 0.008));
    const base = v3.add(g.tip, v3.mul(n, -0.011));
    const support = n[1] > 0.5 ? 'desk' : 'board';
    if (!g.air || support === 'desk') drawPinShadow({ base, head }, support);
    drawPin({ base, head, n, red: 1, squash: 1, seed: 99 });
  }

  /** Haze in the pendant's cone: a sparse, hand-placed dither ramp (denser at the shade), only over dark pixels. */
  const beamPts = [];
  function drawBeam() {
    const L = NB.light.lamps[0];
    if (L.on < 2) return;
    const ax = [L.ax, L.ay, L.az];
    const u = v3.norm(v3.cross(ax, [0, 1, 0]));
    const w = v3.cross(ax, u);
    const half = Math.acos(L.cosLit);
    beamPts.length = 0;
    const src = NB.proj(L.x, L.y, L.z);
    if (!src) return;
    let far = null;
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const d = v3.norm(v3.add(ax, v3.add(v3.mul(u, Math.cos(a) * Math.tan(half)), v3.mul(w, Math.sin(a) * Math.tan(half)))));
      const s = d[2] > 0.02 ? -L.z / d[2] : 3;
      const hit = v3.add([L.x, L.y, L.z], v3.mul(d, Math.min(s, 3)));
      const p = NB.proj(hit[0], hit[1], hit[2]);
      if (!p) return;
      beamPts.push(p[0], p[1]);
      far = far ? [far[0] + p[0] / 20, far[1] + p[1] / 20] : [p[0] / 20, p[1] / 20];
    }
    const hull = convexHull(beamPts.concat([src[0] - 6, src[1], src[0] + 6, src[1]]));
    const dx = far[0] - src[0];
    const dy = far[1] - src[1];
    const len2 = dx * dx + dy * dy || 1;
    const fb = NB.fb;
    const lim = NB.LUMA[C.PLUM];
    NB.poly2(hull, {
      fn: (x, y) => {
        const i = y * NB.W + x;
        if (NB.LUMA[fb[i]] >= lim) return -1;
        const k = NB.clamp(((x - src[0]) * dx + (y - src[1]) * dy) / len2, 0, 1);
        return NB.bayer(x, y) < 0.42 - 0.34 * k ? C.PLUM : -1;
      },
    });
  }
  function convexHull(pts) {
    const P = [];
    for (let i = 0; i < pts.length; i += 2) P.push([pts[i], pts[i + 1]]);
    P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const p of P) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper).flat();
  }

  function render(tRaw) {
    const t = Math.floor(tRaw * FPS + 1e-6) / FPS;
    const L = NB.light;
    const lamp = S.lampLevel(t);
    const ls = W.lampState(S.lampAim(t));
    const L0 = L.lamps[0];
    L0.on = lamp;
    [L0.x, L0.y, L0.z] = ls.pos;
    [L0.ax, L0.ay, L0.az] = ls.axis;
    const dl = W.deskLamp;
    const L1 = L.lamps[1];
    L1.on = S.deskLampLevel(t);
    [L1.x, L1.y, L1.z] = dl.pos;
    [L1.ax, L1.ay, L1.az] = dl.axis;
    L.neonOn = S.neonLevel(t);
    L.tFlick = S.brokenT(t);
    [L.nx, L.ny, L.nz] = W.G.neon;
    NB.setCamera(NB.camera.poseAt(t));
    NB.beginFrame();
    W.drawOutside(t, L.neonOn);
    W.drawRoom();
    W.drawBoardBody();
    for (const it of S.ITEMS) {
      if (it.support !== 'board') continue;
      const fr = S.frameOf(it, t);
      if (fr) NB.props.drawCard(it, fr, t);
    }
    const strings = [];
    for (const s of S.STRINGS) {
      const g = S.stringAt(s, t);
      if (g) strings.push(g);
    }
    const pins = S.pinsAt(t);
    const boardPins = pins.filter((p) => p.n[1] < 0.5);
    const deskPins = pins.filter((p) => p.n[1] >= 0.5);
    strings.forEach((g) => !g.air && stringShadow(g));
    boardPins.forEach((p) => drawPinShadow(p, 'board'));
    strings.forEach((g) => !g.air && drawString(g));
    boardPins.forEach(drawPin);
    strings.forEach((g) => !g.air && drawTip(g));
    drawBeam();
    W.drawDeskBody();
    for (const it of S.ITEMS) if (it.support === 'desk') NB.props.drawCard(it, S.frameOf(it, t), t);
    deskPins.forEach((p) => drawPinShadow(p, 'desk'));
    strings.forEach((g) => g.air && stringShadow(g));
    deskPins.forEach(drawPin);
    strings.forEach((g) => g.air && drawString(g));
    strings.forEach((g) => g.air && drawTip(g));
    NB.desk.drawItems(t);
    W.drawLamp(ls, lamp > 0);
    W.drawDeskLamp(L1.on > 0);
    W.drawChair();
    return t;
  }
  NB.render = render;
  NB.FPS = FPS;
})();
