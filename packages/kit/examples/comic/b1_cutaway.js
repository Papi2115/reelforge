// Comic look B (comic-info), template 1: "the cutaway" (showcase comic-panels-v2 shot 4).
// Too many jobs, no room to run them: the guidance computer drawn with its front torn open, the
// jobs falling into it as physical cards; the restart throws the unimportant ones out of the
// panel and keeps GUIDANCE and NAVIGATION. A load chart beside it climbs to FULL twice.
// Focal: the cards thrown out at the restart, then the red 1202 stamp (the only red is the code).
// Traces: the torn cutaway edge and a kinked leader, the stamp off-square with a page hit, a
// pencilled DROPPED with a two-stroke arrow in the margin, a thumbprint, a smudge.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cb1',
  title: 'Comic info: the cutaway',
  treatment: '3d-reconstruction',
};

/** The incoming transition covers the first beat, so the page starts still. */
const LEAD = 0.75;
const CUT = [12, 12, 404, 14, 400, 348, 13, 347];
const CHART = [420, 150, 628, 152, 626, 300, 421, 298];
const WELL = { x: 138, y: 136, w: 136, bottom: 300 };
const CARD_H = 21;
/** Jobs in the order they arrive; kept = survives the restart (only the real names are lettered). */
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

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function rotate(pts, cx, cy, a) {
  const out = [];
  const c = Math.cos(a);
  const s = Math.sin(a);
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i] - cx;
    const y = pts[i + 1] - cy;
    out.push(cx + x * c - y * s, cy + x * s + y * c);
  }
  return out;
}

/** The computer: a flat metal box, connector rows on the lid, its front torn open. */
function cutaway(g, torn) {
  const F = g.plate;
  F.rect(0, 0, 420, 360, g.layer(g.tone('cyan', 0.06, { cell: 4, angle: 0.26 }), 'paper'));
  const metal = (lx) => 0.1 + 0.3 * clamp01((lx - 200) / 150);
  F.rect(
    70,
    112,
    280,
    206,
    g.layer(g.tone('greyDark', metal, { cell: 3, angle: 0.78 }), 'greyMid'),
  );
  F.poly([70, 112, 350, 112, 368, 96, 88, 96], 'greyLight');
  for (let i = 0; i < 9; i++) g.rect(100 + i * 26 + g.rnd('conn', i) * 3, 99, 14, 7, 'greyDark');
  g.ink([70, 112, 350, 112, 350, 318, 70, 318], { key: 'box', boil: 0.5 });
  g.ink([70, 112, 88, 96, 368, 96, 350, 112], { key: 'lid', boil: 0.5 });
  g.line(350, 318, 368, 302, 'ink');
  g.line(368, 96, 368, 302, 'ink');
  // The cutaway convention: a jagged tear through the front plate, the inside in the dark plate.
  F.poly(torn, g.layer(g.tone('cyanDeep', 0.45, { cell: 3 }), 'night'));
  g.ink(torn, { key: 'cut', boil: 0.6 });
  // The well where jobs wait.
  g.line(WELL.x - 3, WELL.y, WELL.x - 3, WELL.bottom + 2, 'greyLight');
  g.line(WELL.x + WELL.w + 3, WELL.y, WELL.x + WELL.w + 3, WELL.bottom + 2, 'greyLight');
  g.line(WELL.x - 6, WELL.bottom + 3, WELL.x + WELL.w + 6, WELL.bottom + 3, 'greyLight');
  // The object's real name, lettered by hand, with a kinked leader to the box.
  g.text('THE GUIDANCE COMPUTER', 26, 30, { bold: true });
  g.ink([96, 44, 104, 62, 102, 92], { closed: false, key: 'leader' });
}

function card(g, pts, label, kept, glow) {
  g.poly(
    pts.map((v) => v + 2),
    'ink',
  );
  const blank = g.layer((x, y) => ((x + y) % 5 === 0 ? g.color('greyMid') : -1), 'greyLight');
  g.poly(pts, kept ? (glow ? 'yellow' : 'yellowPale') : blank);
  g.polyline(pts, 'ink', { w: 1, closed: true });
  if (!label) return;
  const cx = (pts[0] + pts[4]) / 2;
  const cy = (pts[1] + pts[5]) / 2;
  g.text(label, cx - g.textWidth(label, 1, true) / 2, cy - 3.5, { bold: true });
}

function cardRect(x, y, w, h) {
  return [x, y, x + w, y + 1, x + w, y + h, x, y + h - 1];
}

/** The jobs: they fall into the well; the restart throws the unimportant ones out of the panel. */
function jobs(g, t, u) {
  const restart = t >= RESTART_T;
  let toss = 0;
  CARDS.forEach((c, i) => {
    if (t < c.t) return;
    const rest = WELL.bottom - (i + 1) * (CARD_H + 2);
    const fall = Math.min(1, Math.max(0, (t - c.t) / (0.2 + i * 0.012)));
    let y = 40 + (rest - 40) * fall * fall;
    if (fall >= 1) y += Math.round(2 * Math.sin(clamp01((t - c.t - 0.2) / 0.1) * Math.PI));
    let x = WELL.x;
    let a = 0;
    if (restart && !c.kept) {
      const tau = Math.max(0, t - TOSS[toss++]);
      x += tau * (330 + i * 46);
      y += -150 * tau + 560 * tau * tau;
      a = tau * (1.1 + i * 0.25);
    }
    const pts = cardRect(x, y, WELL.w, CARD_H);
    const glow = c.kept && t >= 4.05 && t < 4.25;
    card(g, a ? rotate(pts, x + WELL.w / 2, y + CARD_H / 2, a) : pts, c.label, c.kept, glow);
  });
  // The job with nowhere to go bounces on the lip, then is the first one thrown out.
  if (t >= OVERFLOW_T) {
    const top = WELL.bottom - 7 * (CARD_H + 2) + 4;
    let y = u.track(
      [
        [OVERFLOW_T, 30],
        [OVERFLOW_T + 0.18, top, 'inQuad'],
        [OVERFLOW_T + 0.3, top - 16, 'outQuad'],
        [OVERFLOW_T + 0.46, top - 6, 'inQuad'],
      ],
      t,
    );
    let x = WELL.x + 8;
    let a = Math.sin(u.seg(t, OVERFLOW_T + 0.18, OVERFLOW_T + 0.5) * Math.PI) * 0.08;
    if (restart) {
      const tau = Math.max(0, t - TOSS[0] + 0.04);
      x += tau * 420;
      y += -190 * tau + 560 * tau * tau;
      a = tau * 1.6;
    }
    card(
      g,
      rotate(cardRect(x, y, WELL.w, CARD_H), x + WELL.w / 2, y + CARD_H / 2, a),
      '',
      false,
      false,
    );
  }
  // Restart: the box blinks once (two frames), like a reset.
  if (t >= RESTART_T && t < RESTART_T + 0.067) g.rect(140, 130, 136, 4, 'paper');
}

/** The load: climbs to FULL, the restart drops it, it climbs back (the next alarm). */
function chart(g, t) {
  const K = g.at(420, 150);
  K.plate.rect(-4, -4, 216, 160, 'paper');
  const [ox, oy, w, full] = [20, 128, 176, 30];
  K.line(ox, 18, ox, oy, 'ink', 1);
  K.line(ox, oy, ox + w, oy, 'ink', 1);
  for (let x = ox + 2; x < ox + w; x += 6 + (x % 3)) K.line(x, full, x + 3, full, 'ink', 1);
  K.text('FULL', ox + 5, full - 11, { bold: true });
  K.text('LOAD', ox + 4, oy + 6, { bold: true });
  const shape = (u) => {
    if (u < 0.42) return 0.18 + 0.82 * Math.pow(u / 0.42, 1.4);
    if (u < 0.47) return 1 - 0.7 * ((u - 0.42) / 0.05);
    if (u < 0.86) return 0.3 + 0.7 * Math.pow((u - 0.47) / 0.39, 1.7);
    return 1 - 0.66 * Math.min(1, (u - 0.86) / 0.05);
  };
  const steps = Math.floor(70 * clamp01((t - 0.85) / 5.15));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / 70;
    pts.push(ox + 2 + u * (w - 4), oy - 4 - shape(u) * (oy - 4 - full));
  }
  if (pts.length >= 4) K.ink(pts, { closed: false, w: 2, boil: 0.6, key: 'loadline' });
  const mark = (u, code, t0) => {
    if (t < t0) return;
    const x = ox + 2 + u * (w - 4);
    K.poly([x - 4, full - 10, x + 4, full - 10, x, full - 3], 'red');
    K.text(code, x - 12, full - 21, { color: 'red', bold: true, jitter: 0.5 });
  };
  mark(0.42, '1202', STAMP_T);
  mark(0.86, '1201', 5.35);
}

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 104, anchor: ctx.anchor });
  ctx.scene.add(page);
  const torn = page.util.torn(112, 124, 300, 308, 'cut');
  page.panel(CUT).draw((g) => cutaway(g, torn));
  // Drawn between the two panels: tossed cards fly out through the cutaway's border, under the chart.
  page.draw((g, t) => jobs(g, t, page.util), { z: 0.5 });
  page.caption('TOO MANY JOBS.\nNO ROOM TO RUN THEM.', { x: 424, y: 20, at: 0.82, tilt: 1 });
  page.caption('SO IT RESTARTS\nAND KEEPS ONLY\nWHAT MATTERS.', {
    x: 436,
    y: 70,
    at: 4.3,
    tilt: -1,
  });
  page.panel(CHART).draw(chart);
  page.stamp('1202', { x: 330, y: 282, at: STAMP_T, angle: -0.14, wear: 0.18, shake: 4 });
  page.arrow([476, 326], [414, 296], { at: 4.85, dur: 0.45 });
  page.note('DROPPED', { x: 486, y: 320, at: 5.3, dur: 0.32 });
  page.smudge(612, 338, { length: 7, angle: 2.6 });
  page.thumbprint(408, 352);
  return { page };
}

export function update(t, state) {
  state.page.update(Math.max(0, t - LEAD));
}
