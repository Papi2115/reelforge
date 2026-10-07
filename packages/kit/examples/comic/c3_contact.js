// Comic look C (comic-loud), template 3: "contact" (new; the moment between showcase shots 8 and
// 10, in the same grammar). Narration: "Contact light. ... Okay. Engine stop."
// One footpad of Eagle comes down in a big low panel; the probe under it touches, bends, and the
// page hits: a small panel SLAMS in over the big one and past the page margin (the blue light
// comes on in the cabin), the word CONTACT is slammed across both panels on uneven beats, dust
// streaks out along the ground. Then nothing moves for a beat, and the radio line lands small.
// Focal: CONTACT (the only yellow-and-magenta on the page), then the lit lamp.
// Traces: letters off-square on uneven beats breaking the frame, a smudge where the slam landed,
// speed lines that stop before the pad, plates off register, a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cc3',
  title: 'Comic loud: contact',
  treatment: 'kinetic-text',
};

const LOW = [14, 14, 470, 16, 466, 346, 12, 344];
/** The slammed panel overlaps the big one and breaks past the page margin on the right. */
const LAMP = [404, 34, 632, 26, 636, 194, 398, 204];
const TOUCH_T = 1.2;
const SLAM_T = 1.26;
const STOP_T = 3.3;
const PROBE = 70;
const PAD_X = 236;
/** Where the pad's rim rests, and the ground under it (page px). */
const LAND_Y = 226;
const GROUND_Y = 250;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function padY(t, u) {
  return u.track(
    [
      [0, 70],
      [TOUCH_T, GROUND_Y - 16 - PROBE, 'linear'],
      [TOUCH_T + 0.42, LAND_Y, 'outQuad'],
    ],
    t,
  );
}

/** Low along the ground: the footpad comes down, its probe touches first and bends. */
function low(g, t, u) {
  g.plate.rect(0, 0, 480, 360, g.layer(g.tone('cyanDeep', 0.2, { cell: 4, angle: 0.26 }), 'night'));
  g.ground({
    x0: -20,
    x1: 480,
    horizon: 150,
    xc: 240,
    radius: 5000,
    bottom: 360,
    craters: 16,
    craterScale: 0.8,
    key: 'low',
  });
  const gy = GROUND_Y;
  const y = padY(t, u);
  // The pad's shadow under a low sun from the left, long to the right, closing in as it lands.
  g.ellipse(PAD_X + 74 + (gy - y - 16) * 0.5, gy + 2, 70, 8, g.dither('none', 'greyDark', 0.8));
  // The probe: straight while it hangs, bent once the ground pushes it up.
  const reach = Math.min(PROBE, gy - y - 16);
  const kink = (PROBE - reach) * 0.6;
  g.ink(
    [
      PAD_X - 34,
      y + 14,
      PAD_X - 34 + kink,
      y + 14 + reach * 0.5,
      PAD_X - 38 + kink * 0.4,
      y + 14 + reach,
    ],
    { closed: false, w: g.w(2), key: 'probe' },
  );
  // The leg: a foil-wrapped strut up out of the panel, a thin brace to the right.
  const foil = g.tone('magenta', 0.35, { cell: 3, angle: 1.31, on: 'yellow' });
  const strut = [PAD_X - 9, y - 6, PAD_X + 9, y - 6, PAD_X - 104, y - 250, PAD_X - 124, y - 244];
  g.plate.poly(strut, foil);
  g.ink(strut, { key: 'strut' });
  g.line(PAD_X + 40, y - 6, PAD_X + 150, y - 230, 'ink', g.w(2));
  // The pad: a shallow dish, lit from the left.
  const dish = g.ellipsePts(PAD_X, y + 6, 66, 16, 26);
  const lit = (lx) => 0.15 + 0.5 * clamp01((lx - PAD_X + 20) / 80);
  g.plate.poly(dish, g.tone('greyMid', lit, { cell: 3, angle: 0.78, on: 'paper' }));
  g.ink(dish, { key: 'dish', w: g.w(2) });
  g.ink([PAD_X - 66, y + 6, PAD_X - 60, y - 6, PAD_X + 60, y - 6, PAD_X + 66, y + 6], {
    closed: false,
    key: 'rim',
  });
  // Dust thrown out along the ground on contact, the streaks stopping short of the pad.
  if (t >= TOUCH_T) {
    const k = clamp01((t - TOUCH_T) / 0.5);
    for (const dir of [-1, 1]) {
      g.speedLines({
        x: PAD_X + dir * 40,
        y: gy - 4,
        dx: dir,
        dy: -0.04,
        count: 9,
        length: 40 + 70 * k,
        spread: 14,
        gap: 26,
        color: 'greyLight',
        key: 'dust' + dir,
      });
    }
  }
}

/** The cabin: a grey panel face, a row of dark lamps, one blue lamp that lights on contact. */
function lamp(g, t) {
  g.plate.rect(
    380,
    0,
    280,
    220,
    g.layer(g.tone('greyDark', 0.3, { cell: 3, angle: 0.5 }), 'greyMid'),
  );
  for (let i = 0; i < 4; i++) {
    const x = 432 + i * 44 + g.rnd('lamp', i) * 4;
    const on = i === 2 && t >= SLAM_T;
    g.plate.rect(x, 82, 34, 26, on ? 'cyan' : 'night');
    g.ink([x, 82, x + 34, 82, x + 34, 108, x, 108], { boil: 0, key: 'l' + i });
    if (on) g.rect(x + 4, 86, 6, 3, 'paper');
  }
  for (const [sx, sy] of [
    [420, 54],
    [598, 50],
    [420, 160],
    [596, 158],
  ]) {
    g.ellipse(sx, sy, 2.4, 2.4, 'greyDark');
    g.line(sx - 1, sy, sx + 1, sy, 'ink');
  }
}

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 109, anchor: ctx.anchor });
  ctx.scene.add(page);
  const u = page.util;
  page.panel(LOW).draw((g, t) => low(g, t, u));
  page.panel(LAMP, { border: 3 }).enter({ at: SLAM_T, kind: 'slam' }).draw(lamp);
  page.shake(SLAM_T, 5, 0.14);
  page.sfx('CONTACT', {
    x: 318,
    y: 306,
    at: SLAM_T + 0.04,
    size: 7.5,
    pitch: 52,
    beats: [0, 0.05, 0.13, 0.17, 0.26, 0.3, 0.37],
    angles: [-0.12, 0.06, -0.04, 0.1, -0.08, 0.03, 0.11],
    rise: [6, -4, 3, -7, 2, -3, 5],
  });
  page.smudge(392, 214, { length: 9, angle: 2.4 });
  page.balloon('ENGINE STOP.', { x: 540, y: 268, at: STOP_T, kind: 'radio', tail: [520, 200] });
  page.thumbprint(620, 346);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
