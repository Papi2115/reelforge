/* Shot 4 - AUTOMAP: the story so far as one level, drawn from the real walkable grid (RF.MAP).
   The arrow replays our walk (corridor -> office -> warehouse), walls appear as it "sees" them (Doom style),
   then the camera drags right and the rooms still ahead come in ghosted. Ends folding into the HUD minimap.

   FOCAL POINT: the player arrow standing at the warehouse's east door + the objective diamond just through
   the TOY STORE door. They are the brightest warm marks (BULB / SAND_L) on a green-and-grey field, left third;
   the margin note's arrow lands on the diamond.
   HUMAN TRACES (all seeded, pure in u):
   1. hand-ruled walls: each room sits 1 px off the grid, long walls restart 1 px over, some corners overrun
      by 1-2 px like a draftsman's pencil (visible from u ~0.4 on);
   2. uneven reveal cadence: pen speed varies +-30 % per wall, the rooms start at uneven gaps, the arrow
      stops at the calendar and at the shelf, the footprints use uneven strides (u 0.2-2.8, 3.4-4.6);
   3. pencil ticks beside THE OFFICE and THE WAREHOUSE, two different hands (u ~1.3 and ~3.0);
   4. a margin note NEXT: THE STORES on a hand baseline (-2 deg stair-step, 1 px wobble) with an arrow drawn in
      two strokes (u 5.3-6.23).
   STILL MOMENT: u 6.25-6.98, only the arrow blinks, the diamond pulses, the caret blinks. The camera holds 0-3.22
   and 4.32-6.98; every map label / note / diamond happens while it holds. */
'use strict';
(function () {
  const RF = window.RF, C = RF.C, E = RF.ease, seg = RF.seg, HUD = RF.HUD, D = RF.AUTOMAP_DATA;
  const SW = RF.HUD_W, SH = RF.HUD_H, S = D.S;
  const DUR = 8.0;
  const MB = new RF.Bmp(SW, SH, C.VOID); // scratch frame, fully overwritten on every call

  // ---------------- camera: hold A, anticipation, drag, overshoot, settle, hold B ----------------
  const CAM_A = { x: 82, y: 2 }, CAM_B = { x: -72, y: -9 };
  function camAt(u) {
    const travel = E.inOut(seg(u, 3.36, 4.08));
    const antic = Math.sin(Math.PI * seg(u, 3.22, 3.38)) * 3;
    const over = Math.sin(Math.PI * seg(u, 3.96, 4.32)) * 5;
    return {
      x: Math.round(RF.lerp(CAM_A.x, CAM_B.x, travel) + antic - over),
      y: Math.round(RF.lerp(CAM_A.y, CAM_B.y, travel) - over * 0.3),
    };
  }

  // ---------------- the replayed walk (cells; headings in degrees, as in path.js) ----------------
  const WALK = [
    [0.0, 5.0, 20.32, 9, 'lin'], [0.32, 5.0, 20.32, 9, 'lin'], [0.86, 13.5, 20.5, 0, 'in'],
    [1.14, 17.5, 20.28, -12, 'out'], [1.24, 17.6, 20.25, -63, 'inOut'], [1.42, 17.6, 20.25, -63, 'lin'],
    [1.66, 22.5, 20.45, 0, 'inOut'], [2.0, 27.9, 20.76, 2, 'out'], [2.1, 28.0, 20.76, -80, 'inOut'],
    [2.36, 28.0, 20.76, -82, 'lin'], [2.44, 28.1, 20.72, -4, 'inOut'], [2.78, 36.1, 20.74, -5, 'out'],
  ];
  const wcum = [0];
  for (let i = 1; i < WALK.length; i++) wcum.push(wcum[i - 1] + Math.hypot(WALK[i][1] - WALK[i - 1][1], WALK[i][2] - WALK[i - 1][2]));
  function walkAt(u) {
    let i = 1;
    while (i < WALK.length - 1 && u > WALK[i][0]) i++;
    const a = WALK[i - 1], b = WALK[i];
    const e = E[b[4]](seg(u, a[0], b[0]));
    return { x: RF.lerp(a[1], b[1], e), y: RF.lerp(a[2], b[2], e), deg: RF.lerp(a[3], b[3], e), dist: RF.lerp(wcum[i - 1], wcum[i], e) };
  }
  function walkPoint(d) {
    for (let i = 1; i < WALK.length; i++)
      if (d <= wcum[i] || i === WALK.length - 1) {
        const len = wcum[i] - wcum[i - 1], k = len > 0 ? RF.clamp01((d - wcum[i - 1]) / len) : 0;
        return { x: RF.lerp(WALK[i - 1][1], WALK[i][1], k), y: RF.lerp(WALK[i - 1][2], WALK[i][2], k), dx: WALK[i][1] - WALK[i - 1][1], dy: WALK[i][2] - WALK[i - 1][2] };
      }
    return { x: 0, y: 0, dx: 1, dy: 0 };
  }
  const STRIDES = [];
  { const r = RF.rng(1982); let d = 0.4; while (d < wcum[wcum.length - 1]) { STRIDES.push(d); d += 0.56 + r() * 0.16; } }

  // ---------------- reveal schedule (uneven on purpose) ----------------
  // region: [t0, t1] walls; interiors trail behind; ghost rooms come in during the drag
  const REVEAL = { 0: [0.06, 0.7], 1: [0.78, 1.47], 2: [1.38, 2.74], 3: [3.42, 3.88], 4: [3.64, 4.2], 5: [3.97, 4.44] };
  const INNER = { 1: [1.22, 1.52], 2: [1.86, 2.62], 4: [4.05, 4.3], 5: [4.22, 4.5] };
  const LABELS = [
    // name, year, cell x, cell y, colour, start, tick
    ['THE OFFICE', '1982', 14, 25.8, C.SAGE, 1.06, 1.28],
    ['THE WAREHOUSE', '1982', 23.1, 10.4, C.SAGE, 2.62, 2.98],
    ['TOY STORE', '1982', 41.2, 22.7, C.SAND, 4.55, 0],
    ['RETURNS', '1983', 56.3, 25.7, C.GREY, 4.79, 0],
    ['ALAMOGORDO, NM', '1983', 70.4, 25.9, C.GREY, 5.12, 0],
  ];
  const DIAMOND = { x: 43.1, y: 20.5, t: 4.42 };
  const PICKUP = { x: 28.45, y: 18.55, t: 2.1 };

  // ---------------- drawing helpers ----------------
  /** Axis-aligned pen line, drawn up to `frac`; dashed / dotted for what we have not seen. Tip glows while drawing. */
  function pen(b, s, ox, oy, frac, col, style) {
    const j = D.JIT[s.r], ax = ox + j[0], ay = oy + j[1];
    const cnt = Math.floor(s.n * frac);
    for (let i = 0; i <= cnt && frac > 0; i++) {
      if (style === 1 && (i + s.phase) % s.period >= s.on) continue;
      if (style === 2 && (i + s.phase) % 4 !== 0) continue;
      const q = s.q + (s.jogAt > 0 && i > s.jogAt * s.n ? s.jog : 0), a = s.p0 + i * s.dir;
      const c = i === cnt && frac < 1 ? C.TUBE : col;
      if (s.h) b.px(ax + a, ay + q, c);
      else b.px(ax + q, ay + a, c);
    }
  }
  /** Draw a region's lines in their pencil order, a weighted share at a time. */
  function drawRegion(b, r, cls, p, ox, oy, col, style) {
    const list = D.ORDER[r][cls];
    if (!list || p <= 0) return;
    let left = p * D.WEIGHT[r][cls];
    for (const s of list) {
      if (left <= 0) return;
      const w = s.len * s.speed;
      pen(b, s, ox, oy, Math.min(1, left / w), col, style);
      left -= w;
    }
  }
  function cellFill(b, cells, ox, oy, level, fn) {
    if (level <= 0) return;
    for (const [cx, cy, r] of cells) {
      const j = D.JIT[r], x0 = ox + cx * S + j[0], y0 = oy + cy * S + j[1];
      for (let y = y0; y < y0 + S; y++)
        for (let x = x0; x < x0 + S; x++) if (x >= 0 && y >= 0 && x < SW && y < SH && RF.bayer(x, y) < level) fn(x, y, x - ox, y - oy);
    }
  }
  function arrow(b, x, y, a, col) {
    const tri = (k) => [x + Math.cos(a) * 8 * k, y + Math.sin(a) * 8 * k, x + Math.cos(a + 2.5) * 6 * k, y + Math.sin(a + 2.5) * 6 * k,
      x + Math.cos(a - 2.5) * 6 * k, y + Math.sin(a - 2.5) * 6 * k];
    b.poly(tri(1.35), C.VOID);
    b.poly(tri(1), col);
  }
  const stroke = (b, pts, c, seed, wob, p) => p > 0 && RF.handStroke(b, pts, c, seed, wob, p, true);
  /** Hand lettering at 2x on a -2 deg stair-step baseline with a seeded 1 px wobble, written char by char. */
  function handText(b, str, x, y, col, count, seed) {
    let cx = x;
    for (let i = 0; i < Math.min(count, str.length); i++) {
      const ch = str[i];
      const wob = RF.hash3(seed, i, 3) < 0.22 ? 1 : 0;
      RF.drawText(b, ch, cx, y + Math.round(-(cx - x) * 0.035) + wob, col, 2);
      cx += (RF.textWidth(ch, 1) + 1) * 2;
    }
  }
  const NOTE = 'NEXT: THE STORES';
  const noteTimes = RF.typeTimes(NOTE, 4747, 5.3, 0.026);

  // ---------------- narration (same dialogue box + irregular typewriter as the rest of the film) ----------------
  const LINES = [
    { t0: 0.48, t1: 3.28, rate: 0.026, text: 'AN OFFICE, A WAREHOUSE:\nTHE GAME IS MADE.', say: 'An office, a warehouse: the game is made.' },
    { t0: 3.92, t1: 6.98, rate: 0.024, text: "NEXT STOP: THE STORES.\nTHAT'S WHERE IT GOES WRONG.", say: "Next stop: the stores. That's where it goes wrong." },
  ];
  LINES.forEach((l, i) => (l.times = RF.typeTimes(l.text, 4400 + i * 23, l.t0 + 0.16, l.rate)));
  function narration(b, u) {
    for (const l of LINES) {
      if (u < l.t0 || u >= l.t1 + 0.12) continue;
      const parts = l.text.split('\n');
      const w = Math.max(230, Math.max(...parts.map((p) => RF.textWidth(p, 2))) + 34), x = 28, hFull = 22 + parts.length * 19;
      const h = Math.round(hFull * E.outBack(seg(u, l.t0, l.t0 + 0.14)) * (1 - seg(u, l.t1, l.t1 + 0.12)));
      if (h < 10) continue; // a box with no body would be a bare woodgrain ribbon: absent until it has one
      const y = 312 - hFull + Math.round((hFull - h) / 2);
      HUD.dialogueBox(b, x, y, w, h, '');
      if (h < hFull - 2) return;
      const caret = RF.drawLines(b, l.text, x + 16, y + 13, C.PAPER, 2, 19, RF.typedCount(l.times, u));
      if (u < l.t1 && (u * 3.3) % 1 < 0.6) b.rect(caret.x + 2, caret.y, 3, 14, C.BULB);
    }
  }

  // ---------------- the map frame ----------------
  function compose(b, u) {
    b.d.fill(C.VOID);
    const cam = camAt(u), ox = cam.x, oy = cam.y;
    const G = 2 * S;
    for (let y = ((oy % G) + G) % G; y < SH; y += G) for (let x = ((ox % G) + G) % G; x < SW; x += G) b.px(x, y, C.MOSS_D);
    // floors of the rooms we have walked through, hatching on the ones we have not
    for (let r = 0; r <= 2; r++) cellFill(b, D.CELLS[r], ox, oy, seg(u, REVEAL[r][1] - 0.25, REVEAL[r][1] + 0.3), (x, y) => b.px(x, y, C.MOSS_D));
    const hatch = (x, y, mx, my) => { if ((mx + my) % 6 === 0) b.px(x, y, C.CHAR); };
    cellFill(b, D.CELLS[4], ox, oy, seg(u, 4.05, 4.45), hatch);
    cellFill(b, D.PIT_CELLS, ox, oy, seg(u, 4.28, 4.62), (x, y, mx, my) => { if ((mx - my + 600) % 5 === 0) b.px(x, y, C.CHAR); });
    // walls in pencil order: seen = solid green ramp, ahead = dashed grey/slate, the desert has no walls
    const look = [[C.SAGE, C.GREEN, 0], [C.SAGE, C.GREEN, 0], [C.SAGE, C.GREEN, 0], [C.GREY, C.SLATE, 1], [C.SLATE, C.SLATE, 1], [C.SLATE, C.SLATE, 1]];
    for (let r = 0; r <= 5; r++) {
      const [c0, c1, dashed] = look[r];
      drawRegion(b, r, 0, seg(u, REVEAL[r][0], REVEAL[r][1]), ox, oy, c0, dashed);
      if (INNER[r]) drawRegion(b, r, 1, seg(u, INNER[r][0], INNER[r][1]), ox, oy, c1, dashed);
      drawRegion(b, r, 2, seg(u, REVEAL[r][0] + 0.1, REVEAL[r][1]), ox, oy, C.SLATE, 2);
    }
    // doors: open gaps with two small ticks (the store door warms up once it is the objective)
    for (const d of D.DOORS) {
      if (u < REVEAL[d.r][0] + 0.25) continue;
      const j = D.JIT[d.r], x = ox + Math.round((d.x + 0.5) * S) + j[0], y = oy + d.y * S + j[1];
      const c = d.next && u > DIAMOND.t ? C.SAND_L : C.TAN;
      b.rect(x, y, 1, 2, c); b.rect(x, y + S - 2, 1, 2, c);
    }
    // footprints (older slate, the last steps sand - same code as the HUD minimap)
    const w = walkAt(u);
    let shown = 0;
    for (let k = 0; k < STRIDES.length && STRIDES[k] <= w.dist; k++) shown = k + 1;
    for (let k = 0; k < shown; k++) {
      const p = walkPoint(STRIDES[k]), len = Math.hypot(p.dx, p.dy) || 1, side = k % 2 ? 0.2 : -0.2;
      b.px(ox + (p.x - (p.dy / len) * side) * S, oy + (p.y + (p.dx / len) * side) * S, shown - k < 18 ? C.SAND : C.SLATE);
    }
    // the cartridge we took off the shelf (the only accent)
    if (u > PICKUP.t) {
      const pop = E.outBack(seg(u, PICKUP.t, PICKUP.t + 0.2));
      const px = Math.round(ox + PICKUP.x * S), py = Math.round(oy + PICKUP.y * S) - Math.round((1 - pop) * 3);
      b.rect(px - 3, py - 3, 7, 8, C.VOID);
      b.rect(px - 2, py - 2, 5, 6, C.ACCENT_D);
      b.rect(px - 1, py - 1, 3, 2, C.ACCENT);
    }
    // labels typed in while the camera holds; ticks in pencil for the rooms we are done with
    LABELS.forEach(([name, year, cx, cy, col, t0, tick], i) => {
      if (u < t0) return;
      const x = Math.round(ox + cx * S) + (i % 2 ? 1 : -1), y = Math.round(oy + cy * S) + (i === 3 ? 1 : 0);
      const n = Math.floor(seg(u, t0, t0 + 0.025 * (name.length + year.length) * (0.8 + RF.hash3(i, 1, 1) * 0.5)) * (name.length + year.length + 1));
      RF.drawText(b, name.slice(0, n), x, y, col, 1);
      RF.drawText(b, year.slice(0, Math.max(0, n - name.length - 1)), x, y + 10, col === C.SAGE ? C.GREEN : col === C.SAND ? C.WOOD : C.SLATE, 1);
      if (tick) stroke(b, [x - 13, y + 3, x - 10, y + 7, x - 3, y - 2 + (i % 2)], C.SAGE, 90 + i * 7, 1.5, seg(u, tick, tick + 0.16));
    });
    // objective diamond in the next room: anticipation, pop, then a slow uneven pulse
    if (u > DIAMOND.t - 0.08) {
      const k = u < DIAMOND.t ? 1 - seg(u, DIAMOND.t - 0.08, DIAMOND.t) * 0.4 : E.outBack(seg(u, DIAMOND.t, DIAMOND.t + 0.24));
      const pulse = u > DIAMOND.t + 0.4 && Math.sin((u - DIAMOND.t) * 7.6 + Math.sin(u * 2.1)) > 0.35;
      const r = (pulse ? 6 : 5) * k, x = Math.round(ox + DIAMOND.x * S), y = Math.round(oy + DIAMOND.y * S);
      b.poly([x, y - r - 1.5, x + r + 1.5, y, x, y + r + 1.5, x - r - 1.5, y], C.VOID);
      b.poly([x, y - r, x + r, y, x, y + r, x - r, y], pulse ? C.BULB : C.SAND_L);
    }
    // the player arrow: replays the walk, then holds and blinks
    const blink = u > 2.8 && RF.hash3(Math.floor(u * 6.5), 9, 9) < 0.2;
    arrow(b, ox + w.x * S, oy + w.y * S, (w.deg * Math.PI) / 180, blink ? C.TUNGSTEN : C.BULB);
    // margin note, written while everything else holds still
    const nn = RF.typedCount(noteTimes, u);
    const nx = Math.round(ox + 39.5 * S), ny = Math.round(oy + 8.6 * S);
    if (nn > 0) handText(b, NOTE, nx, ny, C.SAND, nn, 61);
    stroke(b, [nx + 20, ny + 20, nx + 31, ny + 47, nx + 29, ny + 74], C.SAND, 404, 3, seg(u, 5.86, 6.06));
    stroke(b, [nx + 21, ny + 65, nx + 29, ny + 75, nx + 37, ny + 64], C.SAND, 405, 1.5, seg(u, 6.14, 6.23));
    // legend (texture level, bottom right, above the caption band)
    if (u > 0.5) {
      b.rect(520, 296, 12, 1, C.SAGE);
      RF.drawText(b, 'DONE', 538, 293, C.GREY, 1);
      for (let x = 0; x < 12; x++) if (x % 5 < 3) b.px(520 + x, 308, C.SLATE);
      RF.drawText(b, 'AHEAD', 538, 305, C.GREY, 1);
    }
    narration(b, u);
  }

  // ---------------- wipe in from the minimap, fold back into it ----------------
  const MINI = { x: 542, y: 16, w: 78, h: 58 }; // HUD.minimap inner rect (plate 538,12,86,66 inset by 4)
  const MCX = MINI.x + MINI.w / 2, MCY = MINI.y + MINI.h / 2, MAXD = Math.hypot(MCX, SH - MCY);
  function render(screen, u, unders) {
    u = RF.clamp(u, 0, DUR);
    const out = screen.d, src = MB.d;
    if (u >= 7.97) { out.set(unders.exit.d); return screen; }
    compose(MB, u);
    if (u < 0.5) {
      const p = E.inOut(seg(u, 0, 0.5)), ent = unders.enter.d;
      for (let y = 0; y < SH; y++)
        for (let x = 0; x < SW; x++) {
          const i = y * SW + x;
          const thr = (0.7 * Math.hypot(x - MCX, y - MCY)) / MAXD + 0.3 * RF.bayer(x, y);
          out[i] = thr < p ? src[i] : ent[i];
        }
      return screen;
    }
    if (u < 6.98) { out.set(src); return screen; }
    // fold: a tiny swell (anticipation), then shrink in held steps (~10 fps) onto the minimap
    const steps = Math.floor(seg(u, 7.08, 7.68) * 8) / 8;
    const e = u < 7.08 ? -0.018 * Math.sin(Math.PI * seg(u, 6.98, 7.08)) : E.inOut(steps);
    const pl = { x: CAM_B.x + 36.1 * S, y: CAM_B.y + 20.74 * S };
    const cw = (MINI.w * S) / 3, ch = (MINI.h * S) / 3; // lands at the minimap's 3 px per cell
    const sx = RF.lerp(0, pl.x - cw / 2, e), sy = RF.lerp(0, pl.y - ch / 2, e), sw = RF.lerp(SW, cw, e), sh = RF.lerp(SH, ch, e);
    const dx = Math.round(RF.lerp(0, MINI.x, e)), dy = Math.round(RF.lerp(0, MINI.y, e));
    const dw = Math.round(RF.lerp(SW, MINI.w, e)), dh = Math.round(RF.lerp(SH, MINI.h, e));
    out.set(unders.exit.d);
    const mix = seg(u, 7.7, 7.95); // landed: dither over 8 frames into the real minimap underneath
    for (let y = Math.max(0, dy - 1); y < Math.min(SH, dy + dh + 1); y++)
      for (let x = Math.max(0, dx - 1); x < Math.min(SW, dx + dw + 1); x++) {
        const i = y * SW + x;
        if (x < dx || y < dy || x >= dx + dw || y >= dy + dh) { if (mix === 0) out[i] = C.VOID; continue; }
        if (mix > 0 && RF.bayer(x, y) < mix) continue;
        const qx = Math.floor(sx + ((x - dx + 0.5) * sw) / dw), qy = Math.floor(sy + ((y - dy + 0.5) * sh) / dh);
        out[i] = qx >= 0 && qy >= 0 && qx < SW && qy < SH ? src[qy * SW + qx] : C.VOID;
      }
    return screen;
  }

  RF.AUTOMAP = { dur: DUR, lines: LINES.map((l) => ({ t0: l.t0, t1: l.t1, say: l.say })), render: render };
})();
