// Sketchbook look A (sketch-story), template 3: "Gregory, 1582" (showcase sketchbook-v2 shot 9).
// A printed October 1582 sheet is taped into the notebook; Gregory XIII (mitre, crozier) points at
// it; the red pen crosses 5, 6, 7 carefully, then strikes 8-14 at once and links 4 -> 15. Britain's
// September 1752 slaps on top: 3-13 struck.
// Focal: the red cuts on the October grid.
// Traces: careful Xs that get faster, then one impatient zigzag; torn tape at two angles; the slap
// with a lift shadow; pencil labels with a two-stroke arrow; Gregory sticks his tongue out.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'sa3',
  title: 'Sketch story: Gregory, 1582',
  treatment: 'character-scene',
};

const SLAP = 5.42;

function october(page) {
  const sheet = page.sheet({ x: 352, y: 52, deg: 1.6, w: 342, h: 306, holes: true, seed: 700 });
  const cal = sheet.calendar({
    title: 'OCTOBER 1582',
    u: 22,
    v: 84,
    cell: 44,
    titleSize: 21,
    numberSize: 13,
  });
  sheet.tape(171, -2, 84, 22, 3);
  return cal;
}

function gregory(page) {
  const fig = page.figure({
    x: 176,
    y: 462,
    h: 246,
    at: 0.2,
    until: 1.42,
    seed: 171,
    pose: [
      {
        at: 0,
        lean: 5,
        head: 2,
        turn: 0.6,
        look: -0.1,
        armR: [98, 88],
        armL: [-58, -30],
        legL: [-12, -4],
        legR: [10, 3],
      },
      // He points at the sheet: a small jab with overshoot.
      { at: 4.6, to: 4.95, ease: 'back', overshoot: 1.6, armR: [92, 84] },
    ],
    expression: [
      { at: 0, eyes: 'dot', mouth: 'flat', brow: 1 },
      { at: 2.3, mouth: 'tongue' },
      { at: 4.4, mouth: 'flat' },
    ],
  });
  const [sh, fL, fR] = ['shoulder', 'footL', 'footR'].map((joint) => fig.jointAt(joint, 0));
  page.stroke(
    [sh[0] - 8, sh[1] + 6, fL[0] - 18, fL[1] - 14, fR[0] + 16, fR[1] - 16, sh[0] + 9, sh[1] + 4],
    { at: 1.44, dur: 0.05, corners: [1, 2], seed: 176 },
  );
  // Mitre (head units), its seam and a mustard pencil fill; the crozier in the left hand.
  const head = fig.head();
  const mitre = [-0.92, -0.62, -0.8, -1.9, 0.02, -2.75, 0.86, -1.9, 0.95, -0.62];
  page.stroke([...mitre, -0.92, -0.62], {
    at: 1.5,
    dur: 0.26,
    corners: [2, 4],
    seed: 172,
    attach: head,
  });
  page.stroke([0.02, -2.6, 0.02, -0.66], { at: 1.8, dur: 0.08, seed: 173, attach: head });
  page.fill(mitre, {
    color: 'stickyDark',
    at: 1.92,
    dur: 0.2,
    spacing: 2,
    seed: 174,
    attach: head,
  });
  page.stroke([4, 88, 0, 0, -6, -150, -2, -172, 16, -176, 22, -160, 10, -152, 4, -160], {
    at: 2.16,
    dur: 0.24,
    seed: 175,
    attach: fig.joint('handL'),
  });
}

function cuts(page, cal) {
  // Careful crosses on 5, 6, 7 (smaller and quicker each time)...
  let t = 2.5;
  for (const day of [5, 6, 7]) {
    const [cx, cy] = cal.cell(day);
    const s = 14 - (day - 5) * 1.5;
    page.crossOut(cx - s, cy - s, s * 2, s * 2, { style: 'x', at: t, seed: 180 + day });
    t += 0.25 - (day - 5) * 0.04;
  }
  // ...then one impatient zigzag through 8-14, and 4 -> 15.
  const zigzag = [];
  for (let day = 8; day <= 14; day += 1) {
    const [cx, cy] = cal.cell(day);
    zigzag.push(cx - 10, cy - 13, cx + 12, cy + 12);
  }
  page.stroke(zigzag, {
    tool: 'red',
    width: 3,
    at: t + 0.12,
    dur: 0.34,
    seed: 199,
    smooth: false,
    ease: 'lin',
  });
  const [c4, c15] = [cal.cell(4), cal.cell(15)];
  page.arrow(
    [
      c4[0] + 6,
      c4[1] + 16,
      c4[0] - 40,
      c4[1] + 52,
      c15[0] + 50,
      c15[1] - 30,
      c15[0] + 18,
      c15[1] - 6,
    ],
    { tool: 'red', width: 3, at: 3.66, dur: 0.32, seed: 200, head: 13 },
  );
  page.write('Gregory XIII', {
    x: 34,
    y: 156,
    size: 20,
    hand: 'scrawl',
    tool: 'pencil',
    rot: -5,
    seed: 201,
    at: 4.14,
    until: 4.46,
  });
  page.arrow([112, 166, 124, 186, 140, 196], {
    tool: 'pencil',
    at: 4.5,
    dur: 0.1,
    seed: 202,
    head: 8,
  });
}

function britain(page) {
  // 1752: Britain's page slaps on, gets its tape, and two fast strikes.
  const sheet = page.sheet({ x: 640, y: 270, deg: -5, w: 236, h: 200, at: SLAP, seed: 760 });
  const cal = sheet.calendar({
    title: 'SEPTEMBER 1752',
    u: 14,
    v: 58,
    cell: 30,
    titleSize: 14,
    numberSize: 11,
  });
  sheet.tape(224, 8, 60, 20, 40);
  let t = 5.9;
  for (const [from, to, dur] of [
    [3, 7, 0.16],
    [8, 13, 0.14],
  ]) {
    const [p, q] = [cal.cell(from), cal.cell(to)];
    page.stroke(
      [p[0] - 12, p[1] + 2, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 2, q[0] + 12, q[1] - 1],
      { tool: 'red', width: 3, at: t, dur, seed: 210 + from },
    );
    t += dur + 0.09;
  }
  page.write('Britain', {
    x: 744,
    y: 250,
    size: 20,
    hand: 'scrawl',
    tool: 'pencil',
    rot: -6,
    seed: 220,
    at: 6.44,
    until: 6.76,
  });
}

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    stock: 'cartridge',
    page: 7,
    seed: 107,
  });
  ctx.scene.add(page);
  const cal = october(page);
  gregory(page);
  cuts(page, cal);
  britain(page);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
