/* comic-panels v2 showcase - the page: paper, camera, panels with gutters, plate printing. */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { C, W, H, rnd, rndRange, rndInt, Xf, boil } = CP;

  /** Camera over the page: (x,y) = page point at screen centre, z = zoom. Optional shake (dx,dy). */
  function camera(x, y, z, sh) {
    const d = sh || [0, 0];
    return new Xf(z, Math.round(W / 2 - x * z + d[0]), Math.round(H / 2 - y * z + d[1]));
  }
  /** Same page, scaled by k around page point (cx,cy) - for slams and pops. */
  function scaleAbout(P, cx, cy, k) {
    return new Xf(P.s * k, P.x(cx) - cx * P.s * k, P.y(cy) - cy * P.s * k);
  }

  /** Newsprint: paper tone, fibres and foxing fixed to the page so they travel with the camera. */
  function paper(P, key) {
    CP.clear(C.PAPER);
    for (let i = 0; i < 520; i++) {
      const x = rndRange(key, i, -700, 1340);
      const y = rndRange(key, i + 3000, -300, 660);
      const sx = Math.round(P.x(x));
      const sy = Math.round(P.y(y));
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const r = rnd(key, i + 6000);
      if (r < 0.08) CP.plot(sx, sy, C.AGED);
      else if (r < 0.2) CP.line(sx, sy, sx + 2, sy, C.SHADE);
      else CP.plot(sx, sy, C.SHADE);
    }
  }

  /** Colour-plate offset for a panel: 1-2 px, never zero, seeded. */
  function misFor(key) {
    let dx = rndInt(key, 11, -2, 2);
    let dy = rndInt(key, 12, -1, 2);
    if (dx === 0 && dy === 0) dx = 1;
    return [dx, dy];
  }

  /**
   * One panel. quad = 4 page-space corners (already hand-jittered by the caller's layout).
   * draw(clipMask) paints the content; the border is inked afterwards with a slight boil, and the
   * artist's blue-line pencils overshoot the corners (never erased - a human trace).
   */
  function panel(P, quad, key, draw, opt) {
    const o = opt || {};
    const s = P.map(quad);
    const prev = CP.getClip();
    if (o.pencil !== false) pencils(s, key);
    const mask = CP.maskPoly(s, prev);
    CP.setClip(mask);
    if (o.bg !== undefined) CP.rect(0, 0, W, H, o.bg);
    draw(mask);
    CP.setClip(prev);
    const bw = o.border === undefined ? Math.max(2, Math.round(2 * P.s)) : o.border;
    if (bw > 0) CP.polyline(boil(s, key + 'border', o.boil === undefined ? 0.5 : o.boil), C.INK, bw, true);
    return s;
  }
  function pencils(s, key) {
    const faint = CP.dither(-1, C.PENCIL, 0.45);
    for (let i = 0; i < 4; i++) {
      const ax = s[i * 2];
      const ay = s[i * 2 + 1];
      const bx = s[((i + 1) % 4) * 2];
      const by = s[((i + 1) % 4) * 2 + 1];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const ux = (bx - ax) / len;
      const uy = (by - ay) / len;
      const o0 = rndRange(key, i, 4, 9);
      const o1 = rndRange(key, i + 10, 3, 8);
      const off = rndRange(key, i + 20, -3, 3);
      CP.line(ax - ux * o0 - uy * off, ay - uy * o0 + ux * off, bx + ux * o1 - uy * off * 0.6, by + uy * o1 + ux * off * 0.6, faint);
    }
  }
  /** Quad with each corner nudged 0-2 px (panels are ruled by hand, never exactly square). */
  function quad(x0, y0, x1, y1, key, amp) {
    const a = amp === undefined ? 1.5 : amp;
    const j = (i) => Math.round(rndRange(key, i, -a, a));
    return [x0 + j(1), y0 + j(2), x1 + j(3), y0 + j(4), x1 + j(5), y1 + j(6), x0 + j(7), y1 + j(8)];
  }

  /** Quad scaled by k about (cx,cy) - for panels that slam in. */
  function scaleQuad(q, cx, cy, k) {
    return q.map((v, i) => (i % 2 ? cy + (v - cy) * k : cx + (v - cx) * k));
  }

  /** Printing order of the plates for the press intro: index -> plate letter (sepia inks never take part). */
  const PLATE = ['K', 'CK', '-', '-', '-', 'C', 'C', 'M', 'Y', 'Y', 'M', 'K', 'K', 'K', 'CY', 'K', '-', '-', '-', '-', '-', '-'];
  /** Remap of palette indices to show only the plates printed so far (others fall back to paper). */
  function plateRemap(printed) {
    const map = new Array(PLATE.length);
    for (let i = 0; i < PLATE.length; i++) {
      const need = PLATE[i];
      if (need === '-') map[i] = i;
      else if ([...need].every((p) => printed.includes(p))) map[i] = i;
      else if (i === C.NIGHT && printed.includes('C')) map[i] = C.CYAN_D;
      else if (i === C.DSKY && printed.includes('Y')) map[i] = C.YEL_P;
      else map[i] = C.PAPER;
    }
    return map;
  }

  /**
   * The 1961 flashback is printed as a duotone: a brown key plate and one tan tint plate on yellowed
   * stock. Shots draw with the normal inks, then the frame is pushed through this map.
   */
  const SEPIA = (() => {
    const m = [];
    m[C.INK] = C.SEP_INK;
    m[C.NIGHT] = C.SEP_INK;
    m[C.PAPER] = C.SEP_PAPER;
    m[C.SHADE] = C.SEP_FIBRE;
    m[C.AGED] = C.SEP_TAN;
    m[C.CYAN] = C.SEP_TAN;
    m[C.CYAN_D] = C.SEP_MID;
    m[C.MAG] = C.SEP_MID;
    m[C.YEL] = C.SEP_TAN;
    m[C.YEL_P] = C.SEP_FIBRE;
    m[C.RED] = C.SEP_RED;
    m[C.MOON_L] = C.SEP_FIBRE;
    m[C.MOON_M] = C.SEP_TAN;
    m[C.MOON_D] = C.SEP_MID;
    m[C.DSKY] = C.SEP_TAN;
    m[C.PENCIL] = C.SEP_MID;
    for (let i = C.SEP_PAPER; i <= C.SEP_RED; i++) m[i] = i;
    return m;
  })();

  /** Shot registry: each shots-*.js file fills its own slots (index = shot number - 1). */
  CP.SHOTS = [];

  CP.page = { camera, scaleAbout, scaleQuad, paper, misFor, panel, pencils, quad, plateRemap, SEPIA };
})();
