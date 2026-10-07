// Sketchbook look A (sketch-story), template 2: "Caesar, 45 BC" (showcase sketchbook-v2 shot 4).
// Caesar (laurel, sash, decree) pumps the scroll "+1 DAY"; in a pencil-ruled margin a doubt and a
// tiny mitre already point to p.7.
// Focal: the red "+1 DAY" on the raised decree.
// Traces: a double underline that does not match, laurel leaves in green pencil out of line, the
// pencil margin note "a bit too much..." with a doodle, a label arrow in two strokes; one smug pump
// with anticipation and overshoot.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'sa2',
  title: 'Sketch story: Caesar, 45 BC',
  treatment: 'character-scene',
};

const PACE = 1.13;

function title(page) {
  const year = { x: 404, y: 104, size: 58, hand: 'print', width: 3, rot: -2, seed: 91 };
  const written = page.write('45 BC', { ...year, at: 0.2, until: 0.86 });
  page.underline(400, 410 + written.width, 122, { at: 0.94, dur: 0.17, seed: 92, hook: false });
  page.underline(414, 400 + written.width * 0.82, 131, {
    at: 1.16,
    dur: 0.13,
    seed: 93,
    hook: false,
  });
}

function caesar(page, rng) {
  const fig = page.figure({
    x: 236,
    y: 468,
    h: 252,
    at: 1.36,
    until: 2.66,
    seed: 95,
    belly: 6,
    pose: [
      {
        at: 0,
        lean: -4,
        head: -8,
        turn: 0.45,
        look: -0.35,
        armR: [128, 160],
        armL: [-66, 54],
        legL: [-9, -2],
        legR: [14, 7],
      },
      // One smug pump of the decree: anticipation, overshoot up, settle.
      { at: 5.62, to: 5.78, ease: 'inOut', armR: [131.5, 166.3] },
      { at: 5.78, to: 6.08, ease: 'back', overshoot: 2.4, armR: [122, 149.2] },
      { at: 6.2, to: 6.6, ease: 'inOut', armR: [128, 160] },
    ],
    expression: { eyes: 'closed', happy: true, mouth: 'smile', brow: -1 },
  });
  // Laurel: two sprays of leaves around the head, in green pencil (offsets from the head centre).
  const head = fig.joint('head');
  const hr = 0.115 * 252;
  let t = 2.72;
  for (const side of [-1, 1]) {
    for (let k = 0; k < 5; k += 1) {
      const a = ((side < 0 ? 194 - k * 22 : -14 + k * 22) * Math.PI) / 180;
      const cx = Math.cos(a) * hr * 1.05;
      const cy = Math.sin(a) * hr * 1.05 - hr * 0.18;
      const ta = a + (side < 0 ? 1.0 : -1.0);
      const l = hr * 0.5;
      const [nx, ny] = [-Math.sin(ta) * 3.2, Math.cos(ta) * 3.2];
      const [dx, dy] = [Math.cos(ta), Math.sin(ta)];
      const leaf = [
        cx,
        cy,
        cx + dx * l * 0.5 + nx,
        cy + dy * l * 0.5 + ny,
        cx + dx * l,
        cy + dy * l,
        cx + dx * l * 0.5 - nx,
        cy + dy * l * 0.5 - ny,
        cx + 0.5,
        cy + 0.5,
      ];
      page.stroke(leaf, {
        tool: 'cpencil',
        color: 'green',
        width: 2,
        at: t,
        dur: 0.05,
        seed: 100 + side * 10 + k,
        attach: head,
      });
      t += 0.035 + rng() * 0.035;
    }
  }
  // Tunic from the shoulders to the knees, a purple sash across it.
  const [sh, kL, kR, hip] = ['shoulder', 'kneeL', 'kneeR', 'hip'].map((joint) =>
    fig.jointAt(joint, 0),
  );
  page.stroke(
    [sh[0] - 10, sh[1] + 5, kL[0] - 16, kL[1] - 4, kR[0] + 14, kR[1] - 7, sh[0] + 11, sh[1] + 3],
    { at: 3.28, dur: 0.26, corners: [1, 2], seed: 110 },
  );
  page.fill(
    [
      sh[0] - 10,
      sh[1] + 2,
      sh[0] - 1,
      sh[1] - 5,
      hip[0] + 17,
      hip[1] + 3,
      hip[0] + 10,
      hip[1] + 17,
    ],
    { color: 'purple', at: 3.6, dur: 0.24, spacing: 2, dir: -1, seed: 111 },
  );
  return fig;
}

function decree(page, fig) {
  // The scroll hangs from the raised hand and is carried by it (page px around the hand at rest).
  const carry = fig.carry('handR');
  const [hx, hy] = fig.jointAt('handR', 0);
  const [x0, y0] = [hx + 14, hy - 2];
  const [sw, sh] = [168, 150];
  const loop = [];
  for (let i = 0; i < 9; i += 1) {
    const a = 2 + (i / 9) * Math.PI * 2;
    loop.push(hx + 5 + Math.cos(a) * 7, hy - 1 + Math.sin(a) * 6);
  }
  page.stroke([...loop, hx + 11, hy - 5], { at: 3.86, dur: 0.06, seed: 119, attach: carry });
  page.stroke([x0, y0, x0 + sw, y0 - 6], {
    at: 3.92,
    dur: 0.15,
    seed: 120,
    smooth: false,
    attach: carry,
  });
  page.stroke([x0 + sw, y0 - 6, x0 + sw + 8, y0 - 1, x0 + sw + 1, y0 + 5, x0 + sw - 6, y0 + 1], {
    at: 4.1,
    dur: 0.08,
    seed: 121,
    attach: carry,
  });
  page.stroke([x0 + 8, y0 + 2, x0 + 12, y0 + sh], {
    at: 4.22,
    dur: 0.12,
    seed: 122,
    attach: carry,
  });
  page.stroke([x0 + sw - 9, y0 + 1, x0 + sw - 4, y0 + sh - 2], {
    at: 4.37,
    dur: 0.12,
    seed: 123,
    attach: carry,
  });
  page.stroke(
    [
      x0 + 6,
      y0 + sh,
      x0 + 88,
      y0 + sh + 6,
      x0 + sw + 4,
      y0 + sh - 3,
      x0 + sw + 10,
      y0 + sh + 5,
      x0 + sw - 2,
      y0 + sh + 11,
    ],
    { at: 4.52, dur: 0.18, seed: 124, attach: carry },
  );
  const text = { x: x0 + 24, y: y0 + 40, size: 16, hand: 'print', seed: 125, attach: carry };
  page.write('EVERY 4TH', { ...text, at: 4.76, until: 5.06 });
  page.write('YEAR:', { ...text, y: text.y + 25, seed: 126, at: 5.1, until: 5.27 });
  page.write('+1 DAY', {
    ...text,
    x: text.x - 2,
    y: text.y + 84,
    size: 34,
    tool: 'red',
    width: 3,
    seed: 127,
    rot: -3,
    at: 5.34,
    until: 5.6,
  });
}

function margin(page) {
  page.write('Julius Caesar', {
    x: 330,
    y: 452,
    size: 21,
    hand: 'scrawl',
    tool: 'pencil',
    rot: -3,
    seed: 130,
    at: 6.12,
    until: 6.6,
  });
  page.arrow([324, 440, 306, 432, 290, 414], {
    tool: 'pencil',
    at: 6.66,
    dur: 0.12,
    seed: 131,
    head: 9,
  });
  page.write('a bit', {
    x: 772,
    y: 212,
    size: 19,
    hand: 'scrawl',
    tool: 'pencil',
    rot: -3,
    seed: 133,
    at: 6.98,
    until: 7.2,
  });
  page.write('too much...', {
    x: 768,
    y: 240,
    size: 19,
    hand: 'scrawl',
    tool: 'pencil',
    rot: -2,
    seed: 134,
    at: 7.28,
    until: 7.66,
  });
  // A tiny mitre: see p.7.
  const [mx, my] = [800, 296];
  const pencil = { tool: 'pencil' };
  page.stroke(
    [
      mx + 1,
      my + 24,
      mx + 2,
      my + 4,
      mx + 12,
      my - 18,
      mx + 22,
      my + 4,
      mx + 23,
      my + 24,
      mx + 1,
      my + 24,
    ],
    { ...pencil, at: 7.76, dur: 0.2, corners: [2, 4], seed: 135 },
  );
  page.stroke([mx + 2, my + 17, mx + 22, my + 16], { ...pencil, at: 7.97, dur: 0.03, seed: 138 });
  page.stroke([mx + 12, my - 4, mx + 12, my + 20], { ...pencil, at: 7.99, dur: 0.05, seed: 136 });
  page.write('→ p.7', {
    x: 834,
    y: 318,
    size: 17,
    hand: 'scrawl',
    tool: 'pencil',
    seed: 137,
    at: 8.08,
    until: 8.34,
  });
}

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    stock: 'cartridge',
    page: 4,
    margin: 756,
    seed: 104,
  });
  ctx.scene.add(page);
  title(page);
  const fig = caesar(page, ctx.rng);
  decree(page, fig);
  margin(page);
  return { page };
}

export function update(t, state) {
  state.page.update(t * PACE);
}
