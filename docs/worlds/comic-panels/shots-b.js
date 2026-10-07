/* comic-panels showcase - shots 3 (B-roll info page), 4 (C-roll tension) and 5 (payoff). */
'use strict';
(function () {
  const CP = window.CP;
  const { C, E, seg, track, lerp, layer, halftone, dither, rnd, rndRange } = CP;
  const { camera, paper, misFor, panel } = CP.page;
  const A = CP.art;
  const clamp01 = CP.clamp01;

  function pop(t, t0, dur) {
    return track([[t0, 0], [t0 + dur * 0.62, 1.1, E.outQuad], [t0 + dur, 1, E.inOutSine]], t);
  }
  function rotPts(pts, cx, cy, a) {
    const out = [];
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i] - cx;
      const y = pts[i + 1] - cy;
      out.push(cx + x * ca - y * sa, cy + x * sa + y * ca);
    }
    return out;
  }
  /** Bayer dissolve between paper and the frame: p=0 all paper, p=1 all frame; sweeps left to right. */
  function dissolve(p, sweep) {
    if (p >= 1) return;
    const fb = CP.fb;
    for (let y = 0; y < CP.H; y++) {
      for (let x = 0; x < CP.W; x++) {
        const local = p * (1 + sweep) - (x / CP.W) * sweep;
        if (CP.BAYER4[(y & 3) * 4 + (x & 3)] >= local * 16) fb[y * CP.W + x] = C.PAPER;
      }
    }
  }

  // ===================== SHOT 3 - B-ROLL: why the computer survived =====================
  const S3P1 = [12, 12, 404, 14, 400, 348, 13, 347];
  const S3P2 = [420, 150, 628, 152, 626, 300, 421, 298];
  const WELL = { x: 138, y: 136, w: 136, bottom: 300 };
  const CARD_H = 21;
  // Jobs in the order they arrive; kept = survives the restart.
  const CARDS = [
    { label: 'GUIDANCE', kept: true, t: 0.62 },
    { label: 'NAVIGATION', kept: true, t: 0.98 },
    { label: '', kept: false, t: 1.24 },
    { label: '', kept: false, t: 1.61 },
    { label: '', kept: false, t: 1.77 },
    { label: '', kept: false, t: 2.06 },
  ];
  const OVERFLOW_T = 2.3;
  const STAMP_T = 2.66;
  const RESTART_T = 3.3;
  const TOSS = [3.36, 3.41, 3.55, 3.6, 3.74];

  function card(pts, label, kept, glow, ts) {
    CP.poly(pts.map((v) => v + 2), C.INK);
    CP.poly(pts, kept ? (glow ? C.YEL : C.YEL_P) : layer((x, y) => ((x + y) % 5 === 0 ? C.MOON_M : -1), C.MOON_L));
    CP.polyline(pts, C.INK, 1, true);
    if (label) {
      const cx = (pts[0] + pts[4]) / 2;
      const cy = (pts[1] + pts[5]) / 2;
      CP.text('hand', label, cx - CP.measure('hand', label, ts, true) / 2, cy - 3.5 * ts, C.INK, { key: label, bold: true, scale: ts, jitter: ts });
    }
  }
  function cardRect(P, x, y, w, h) {
    return P.map([x, y, x + w, y + 1, x + w, y + h, x, y + h - 1]);
  }

  function shot3(t) {
    const push = seg(t, 7.25, 7.9, E.inCubic);
    const P = camera(lerp(320, 206, push), lerp(180, 250, push), lerp(1, 2.4, push), CP.shake(t, STAMP_T, 4, 0.12, 's3k'));
    paper(P, 'p3');
    const mis = misFor('s3');
    const rise = Math.round(14 * (1 - seg(t, 0, 0.42, E.outCubic)));
    const Pp = camera(lerp(320, 206, push), lerp(180, 250, push) - rise / P.s, P.s);
    const ts = Math.max(1, Math.floor(P.s + 1e-6));
    // --- the cutaway panel ---
    panel(Pp, S3P1, 's3p1', () => {
      const K = Pp.at(0, 0, 1);
      const F = K.shift(mis[0], mis[1]);
      F.rect(0, 0, 420, 360, layer(halftone(C.CYAN, 0.06, { cell: 4, angle: 0.26 }), C.PAPER));
      // The computer: a flat metal box with connector rows on top, its front cut open.
      F.rect(70, 112, 280, 206, layer(halftone(C.MOON_D, A.local(K, (lx) => 0.1 + 0.3 * clamp01((lx - 200) / 150)), { cell: 3, angle: 0.78 }), C.MOON_M));
      F.poly([70, 112, 350, 112, 368, 96, 88, 96], C.MOON_L);
      for (let i = 0; i < 9; i++) K.rect(100 + i * 26 + rnd('conn', i) * 3, 99, 14, 7, C.MOON_D);
      A.inkPoly(K, [70, 112, 350, 112, 350, 318, 70, 318], 's3box', K.w(1.4), 0.5);
      A.inkPoly(K, [70, 112, 88, 96, 368, 96, 350, 112], 's3lid', K.w(1), 0.5);
      K.line(350, 318, 368, 302, C.INK, K.w(1));
      K.line(368, 96, 368, 302, C.INK, K.w(1));
      // Jagged cut through the front plate (cutaway convention), interior in cyan-over-night.
      const clipped = tornRect(112, 124, 300, 308, 'cut');
      F.poly(clipped, layer(halftone(C.CYAN_D, 0.45, { cell: 3 }), C.NIGHT));
      A.inkPoly(K, clipped, 's3cut', K.w(1), 0.6);
      // The well where jobs wait.
      K.line(WELL.x - 3, WELL.y, WELL.x - 3, WELL.bottom + 2, C.MOON_L, K.w(1));
      K.line(WELL.x + WELL.w + 3, WELL.y, WELL.x + WELL.w + 3, WELL.bottom + 2, C.MOON_L, K.w(1));
      K.line(WELL.x - 6, WELL.bottom + 3, WELL.x + WELL.w + 6, WELL.bottom + 3, C.MOON_L, K.w(1));
      // Callout: the object's real name, lettered by hand, with a kinked leader to the box.
      CP.text('hand', 'THE GUIDANCE COMPUTER', K.x(26), K.y(30), C.INK, { key: 'agc', bold: true, scale: ts, jitter: ts });
      CP.polyline(CP.boil(K.map([96, 44, 104, 62, 102, 92]), 'leader', 0.5), C.INK, 1, false);
    });
    const K = Pp.at(0, 0, 1);
    // --- jobs (drawn over the panel so tossed cards can fly out through its border) ---
    const restart = t >= RESTART_T;
    let tossIndex = 0;
    CARDS.forEach((c, i) => {
      if (t < c.t) return;
      const restY = WELL.bottom - (i + 1) * (CARD_H + 2);
      const fall = seg(t, c.t, c.t + 0.2 + i * 0.012, E.inQuad);
      let y = lerp(40, restY, fall);
      if (fall >= 1) y += Math.round(2 * Math.sin(seg(t, c.t + 0.2, c.t + 0.3) * Math.PI));
      let x = WELL.x;
      let ang = 0;
      if (restart && !c.kept) {
        const t0 = TOSS[tossIndex++];
        const tau = Math.max(0, t - t0);
        x += tau * (330 + i * 46);
        y += -150 * tau + 560 * tau * tau;
        ang = tau * (1.1 + i * 0.25);
      }
      const pts = cardRect(K, x, y, WELL.w, CARD_H);
      const glow = c.kept && t >= 4.05;
      const pp = ang ? rotPts(pts, K.x(x + WELL.w / 2), K.y(y + CARD_H / 2), ang) : pts;
      card(pp, c.label, c.kept, glow && t < 4.25, ts);
    });
    // The job with nowhere to go: bounces on the lip, then is the first thing thrown out.
    if (t >= OVERFLOW_T) {
      const top = WELL.bottom - 7 * (CARD_H + 2) + 4;
      let y = track([[OVERFLOW_T, 30], [OVERFLOW_T + 0.18, top, E.inQuad], [OVERFLOW_T + 0.3, top - 16, E.outQuad], [OVERFLOW_T + 0.46, top - 6, E.inQuad]], t);
      let x = WELL.x + 8;
      let ang = Math.sin(seg(t, OVERFLOW_T + 0.18, OVERFLOW_T + 0.5) * Math.PI) * 0.08;
      if (restart) {
        const tau = Math.max(0, t - TOSS[0] + 0.04);
        x += tau * 420;
        y += -190 * tau + 560 * tau * tau;
        ang = tau * 1.6;
      }
      const pts = cardRect(K, x, y, WELL.w, CARD_H);
      card(rotPts(pts, K.x(x + WELL.w / 2), K.y(y + CARD_H / 2), ang), '', false, false, ts);
    }
    // Rubber stamp: the code, in the only red on the page.
    if (t >= STAMP_T) {
      const k = track([[STAMP_T, 1.5], [STAMP_T + 0.09, 1, E.inQuad]], t);
      stamp(K.x(330), K.y(282), k * K.s, -0.14);
    }
    // Restart: the box blinks once (two frames), like a reset.
    if (t >= RESTART_T && t < RESTART_T + 0.067) CP.rect(K.x(140), K.y(130), 136 * K.s, 4, C.PAPER);
    // --- right column: captions and the load chart ---
    if (t >= 0.82) CP.caption(['TOO MANY JOBS.', 'NO ROOM TO RUN THEM.'], Pp.x(424), Pp.y(20) + Math.round(-4 * (1 - seg(t, 0.82, 0.95, E.outQuad))), { key: 's3c1', tilt: 1, zoom: P.s });
    if (t >= 4.3) CP.caption(['SO IT RESTARTS', 'AND KEEPS ONLY', 'WHAT MATTERS.'], Pp.x(436), Pp.y(70) + Math.round(-4 * (1 - seg(t, 4.3, 4.42, E.outQuad))), { key: 's3c2', tilt: -1, zoom: P.s });
    panel(Pp, S3P2, 's3p2', () => chart(Pp, t, mis));
    // --- the hand: a pencilled note where the dropped jobs went ---
    if (t >= 4.85) {
      const p = seg(t, 4.85, 5.3, E.inOutSine);
      CP.handArrow(Pp.x(476), Pp.y(326), Pp.x(414), Pp.y(296), p, C.PENCIL, 's3arrow', 1);
      if (t >= 5.3) CP.text('hand', 'DROPPED', Pp.x(486), Pp.y(320), C.PENCIL, { key: 'dropped', reveal: Math.floor(seg(t, 5.3, 5.62) * 7.99), slant: 1, jitter: 1.6, scale: ts });
    }
    CP.smudge(Pp.x(612), Pp.y(338), 7, 2.6, 's3smudge');
    CP.thumbprint(Pp.x(408), Pp.y(352), 'thumb3', C.SHADE);
    if (t >= 7.9) CP.clear(C.PAPER);
    return null;
  }
  /** A cutaway opening: a rectangle whose edges are torn metal (alternating seeded notches). */
  function tornRect(x0, y0, x1, y1, key) {
    const pts = [];
    const edge = (ax, ay, bx, by, nx, ny, base) => {
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.max(2, Math.round(len / 11));
      for (let i = 0; i < n; i++) {
        const s = i / n;
        const d = (i % 2 ? 4 : -2) + rndRange(key, base + i, -2.5, 2.5);
        pts.push(lerp(ax, bx, s) + nx * d, lerp(ay, by, s) + ny * d);
      }
    };
    edge(x0, y0, x1, y0, 0, 1, 0);
    edge(x1, y0, x1, y1, -1, 0, 100);
    edge(x1, y1, x0, y1, 0, -1, 200);
    edge(x0, y1, x0, y0, 1, 0, 300);
    return pts;
  }
  function stamp(cx, cy, k, ang) {
    const w = 92 * k;
    const h = 40 * k;
    const box = rotPts([cx - w / 2, cy - h / 2, cx + w / 2, cy - h / 2, cx + w / 2, cy + h / 2, cx - w / 2, cy + h / 2], cx, cy, ang);
    const worn = (x, y) => (rnd('stampwear', (x * 7 + y * 13) % 997) < 0.1 ? -1 : C.RED);
    CP.polyline(box, worn, Math.max(2, Math.round(2 * k)), true);
    '1202'.split('').forEach((ch, i) => {
      const off = (i - 1.5) * 20 * k;
      CP.bigLetter(ch, cx + Math.cos(ang) * off, cy + Math.sin(ang) * off, 3.4 * k, ang + (i === 2 ? 0.05 : 0), worn, { key: 'st' + i, outline: 0, extrude: [0, 0], mis: [0, 0] });
    });
  }
  function chart(Pp, t, mis) {
    const K = Pp.at(420, 150, 1);
    const F = K.shift(mis[0], mis[1]);
    F.rect(-4, -4, 216, 160, C.PAPER);
    const ox = 20;
    const oy = 128;
    const w = 176;
    const full = 30;
    K.line(ox, 18, ox, oy, C.INK, 1);
    K.line(ox, oy, ox + w, oy, C.INK, 1);
    for (let x = ox + 2; x < ox + w; x += 6 + (x % 3)) K.line(x, full, x + 3, full, C.INK, 1);
    CP.text('hand', 'FULL', K.x(ox + 5), K.y(full - 11), C.INK, { key: 'full', bold: true });
    CP.text('hand', 'LOAD', K.x(ox + 4), K.y(oy + 6), C.INK, { key: 'load', bold: true });
    // Load: climbs to the ceiling, restart drops it, it climbs back (the next alarm).
    const pts = [];
    const shape = (u) => {
      if (u < 0.42) return 0.18 + 0.82 * Math.pow(u / 0.42, 1.4);
      if (u < 0.47) return lerp(1, 0.3, (u - 0.42) / 0.05);
      if (u < 0.86) return 0.3 + 0.7 * Math.pow((u - 0.47) / 0.39, 1.7);
      return lerp(1, 0.34, Math.min(1, (u - 0.86) / 0.05));
    };
    const drawn = seg(t, 0.85, 6.0, (p) => p);
    const steps = Math.floor(70 * drawn);
    for (let i = 0; i <= steps; i++) {
      const u = i / 70;
      pts.push(K.x(ox + 2 + u * (w - 4)), K.y(oy - 4 - shape(u) * (oy - 4 - full)));
    }
    if (pts.length >= 4) CP.polyline(CP.boil(pts, 'loadline', 0.6), C.INK, 2, false);
    const mark = (u, code, t0) => {
      if (t < t0) return;
      const x = K.x(ox + 2 + u * (w - 4));
      const y = K.y(full);
      CP.poly([x - 4, y - 10, x + 4, y - 10, x, y - 3], C.RED);
      CP.text('hand', code, x - 12, y - 21, C.RED, { key: code, bold: true, jitter: 0.5 });
    };
    mark(0.42, '1202', 2.66);
    mark(0.86, '1201', 5.35);
  }

  CP.SHOTS.push({
    title: 'B-roll',
    dur: 8,
    render: shot3,
    narration: 'Too many jobs, no room to run them. So the computer restarted, dropped the low-priority work and kept only what mattered: guidance and navigation. Then the load climbed again.',
    note: 'a technical cutaway in comic grammar: the jobs are physical cards, the restart literally throws them out of the panel; the pencil note is the reader\'s hand, not the printer\'s.',
  });

  // shots 4 and 5 follow in shots-c.js
  CP.helpers = { pop, rotPts, dissolve };
})();
