// Sketchbook look A (sketch-story), template 1: "a quarter day" (showcase sketchbook-v2 shot 2).
// A farmer, the Sun, the year as a loop that falls short; a beat, then red dashes close the gap.
// Focal: the gap at the end of the year loop, named by the red "+¼ day".
// Traces: pencil fills out of the lines, the orbit arrow in two strokes, the farmer's "?" and
// head-scratch, a wobbly hand-drawn orbit; one still beat before the red.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'sa1',
  title: 'Sketch story: a quarter day',
  treatment: 'metaphor-object',
};

/** The showcase plays this page 15 % faster than real time. */
const PACE = 1.15;

function farmer(page) {
  const fig = page.figure({
    x: 176,
    y: 452,
    h: 222,
    at: 0.25,
    until: 1.85,
    seed: 31,
    pose: [
      {
        at: 0,
        lean: -2,
        turn: 0.55,
        look: 0.1,
        armR: [26, 10],
        armL: [-52, -20],
        legL: [-11, -3],
        legR: [13, 5],
      },
      // Looks up and points at the Sun once it is drawn...
      { at: 4.7, to: 5.15, ease: 'inOut', lean: -6, head: -5, look: -1, armR: [126, 118] },
      // ...and scratches his head when the year comes up short.
      { at: 6.86, to: 6.9, ease: 'lin', head: 4, armR: [150, 232] },
    ],
    expression: [
      { at: 0, eyes: 'dot', mouth: 'flat', brow: 0 },
      { at: 4.93, brow: 1 },
      { at: 6.86, mouth: 'o', brow: -1 },
    ],
  });
  // Hoe in the left hand, straw hat on the head (head units), hat fill in mustard pencil.
  const hand = fig.joint('handL');
  page.stroke([-10, -120, 0, 0, 7, 76], { at: 1.92, dur: 0.18, seed: 33, attach: hand });
  page.stroke([7, 76, -16, 80, -24, 71], {
    at: 2.16,
    dur: 0.09,
    corners: [1],
    seed: 34,
    attach: hand,
  });
  const head = fig.head();
  page.stroke([-2.5, -0.42, -1.2, -0.62, 0.2, -0.66, 1.5, -0.66, 2.6, -0.5], {
    at: 2.32,
    dur: 0.14,
    seed: 35,
    attach: head,
  });
  const crown = [-1.0, -0.56, -0.78, -1.38, 0.1, -1.66, 0.92, -1.36, 1.1, -0.64];
  page.stroke(crown, { at: 2.5, dur: 0.16, seed: 36, attach: head });
  page.stroke([48, 455, 140, 451, 230, 454, 318, 449, 352, 452], { at: 2.75, dur: 0.28, seed: 37 });
  page.fill([46, 458, 350, 454, 356, 500, 44, 502], {
    color: 'green',
    at: 3.08,
    dur: 0.42,
    seed: 38,
  });
  const crownFill = [-0.95, -0.6, -0.72, -1.36, 0.1, -1.62, 0.88, -1.32, 1.05, -0.66];
  page.fill(crownFill, {
    color: 'stickyDark',
    at: 3.56,
    dur: 0.2,
    spacing: 2,
    seed: 39,
    attach: head,
  });
}

function orbit(page, rng) {
  page.sun(664, 232, 40, { at: 3.85, until: 4.62, seed: 41, fillDur: 0.36 });
  const [ox, oy, rx, ry, rot] = [630, 250, 262, 120, -0.07];
  const a0 = (160 * Math.PI) / 180;
  const span = (334 * Math.PI) / 180;
  const at = (a, wobble = 0) => [
    ox + Math.cos(a) * rx * Math.cos(rot) - Math.sin(a) * ry * Math.sin(rot) + wobble,
    oy + Math.cos(a) * rx * Math.sin(rot) + Math.sin(a) * ry * Math.cos(rot) + wobble,
  ];
  // The Earth: a small blue circle where the year starts.
  const [ex, ey] = at(a0);
  const earth = [];
  for (let i = 0; i < 10; i += 1) {
    const a = 1 + (i / 10) * Math.PI * 2;
    earth.push(ex + Math.cos(a) * 10, ey + Math.sin(a) * 9.5);
  }
  earth.push(ex + 11, ey - 3);
  page.stroke(earth, { at: 4.7, dur: 0.13, seed: 42, tool: 'fine', width: 2 });
  const blue = [];
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    blue.push(ex + 1 + Math.cos(a) * 8.5, ey + Math.sin(a) * 8);
  }
  page.fill(blue, { color: 'skyPencil', at: 4.86, dur: 0.14, spacing: 2, seed: 43 });
  // One year: an arrow around the Sun that stops short of the start.
  const path = [];
  for (let i = 0; i <= 36; i += 1)
    path.push(...at(a0 + 0.035 + (i / 36) * span, rng() * 2.4 - 1.2));
  const year = page.arrow(path, { at: 5.1, dur: 1.0, seed: 45, ease: 'sine', head: 14 });
  page.write('365 days', {
    x: 548,
    y: 112,
    size: 25,
    hand: 'scrawl',
    rot: -3,
    seed: 46,
    at: year.end + 0.12,
    until: year.end + 0.7,
  });
  // A beat. Then the red pen closes the gap and names it.
  let t = 7.22;
  for (let d = 0; d < 3; d += 1) {
    const aa = a0 + span + 0.1 + d * 0.11;
    page.stroke([...at(aa), ...at(aa + 0.065)], {
      tool: 'red',
      at: t,
      dur: 0.05,
      seed: 47 + d,
      smooth: false,
    });
    t += 0.08 + d * 0.025;
  }
  page.write('+¼ day', {
    x: 366,
    y: 404,
    size: 36,
    hand: 'scrawl',
    tool: 'red',
    width: 3,
    rot: -5,
    seed: 50,
    at: 7.56,
    until: 8.06,
  });
}

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    stock: 'cartridge',
    page: 2,
    seed: 102,
  });
  ctx.scene.add(page);
  farmer(page);
  orbit(page, ctx.rng);
  // The farmer's question mark, written while he scratches his head.
  page.write('?', {
    x: 206,
    y: 196,
    size: 34,
    hand: 'scrawl',
    rot: 10,
    seed: 52,
    at: 6.88,
    until: 7.02,
  });
  return { page };
}

export function update(t, state) {
  state.page.update(t * PACE);
}
