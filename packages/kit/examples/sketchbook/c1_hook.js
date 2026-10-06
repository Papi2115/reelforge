// Sketchbook look C (sketch-loud), template 1: "365?" (showcase sketchbook-v2 shot 1, the hook).
// Lined page. A chisel marker slams "365?" down, one held beat, then the red correcting pen
// strikes the doubt and inserts ".24"; a pencil afterthought under the line.
// Focal: the huge "365" and, after the beat, the red ".24" over the struck "?".
// Traces: marker blots and a crooked baseline, a graphite smudge where the hand dragged through
// the wet ink, a caret drawn in one go, an underline that sags, "not quite." in pencil.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'sc1',
  title: 'Sketch loud: 365?',
  treatment: 'kinetic-text',
};

const MARKER = { hand: 'marker', tool: 'marker', nib: [19, -42, 3], fps: 10 };
const RED = { tool: 'red', width: 3, fps: 10 };
const [X, Y, ROT] = [132, 356, -3];

/** A point `d` px along the tilted baseline of "365". */
function along(d) {
  const angle = (ROT * Math.PI) / 180;
  return [X + d * Math.cos(angle), Y + d * Math.sin(angle)];
}

function slam(page) {
  const number = page.write('365', {
    ...MARKER,
    x: X,
    y: Y,
    size: 172,
    rot: ROT,
    seed: 11,
    at: 0.22,
    until: 1.22,
  });
  const [qx, qy] = along(number.width + 46);
  page.write('?', {
    ...MARKER,
    x: qx,
    y: qy + 2,
    size: 176,
    rot: 6,
    seed: 12,
    at: 1.42,
    until: 1.72,
  });
  // The hand dragged through the wet ink.
  const [sx, sy] = along(number.width * 0.62);
  page.smudge(sx + 4, sy + 30, 40, 10, -16, {
    at: 0.98,
    color: 'graphiteLight',
    density: 0.6,
    seed: 5,
  });
  return { width: number.width, q: [qx, qy] };
}

function correct(page, { width, q }) {
  const [qx, qy] = q;
  // A held beat. Then the red pen: strike the doubt, a caret into the gap, ".24" above it.
  page.stroke([qx - 8, qy - 150, qx + 40, qy - 70, qx + 84, qy - 8], {
    ...RED,
    at: 2.62,
    dur: 0.15,
    seed: 21,
  });
  page.stroke([qx + 80, qy - 158, qx + 34, qy - 82, qx - 6, qy - 4], {
    ...RED,
    at: 2.86,
    dur: 0.14,
    seed: 22,
  });
  const [gx, gy] = along(width + 20);
  const top = gy - 170;
  page.stroke([gx - 15, top - 16, gx + 1, top + 8, gx + 16, top - 17], {
    ...RED,
    at: 3.1,
    dur: 0.14,
    corners: [1],
    seed: 23,
  });
  const insert = page.write('.24', {
    ...RED,
    x: gx - 34,
    y: top - 44,
    size: 92,
    hand: 'scrawl',
    width: 4,
    rot: -5,
    seed: 25,
    at: 3.36,
    until: 3.98,
  });
  page.underline(gx - 30, gx - 24 + insert.width + 12, top - 33, {
    ...RED,
    at: 4.1,
    dur: 0.17,
    seed: 26,
    sag: 3,
  });
  page.write('not quite.', {
    x: 306,
    y: 455,
    size: 27,
    hand: 'scrawl',
    tool: 'pencil',
    rot: -2,
    seed: 27,
    at: 4.9,
    until: 5.72,
  });
}

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    stock: 'lined',
    page: 1,
    boilFps: 10,
    seed: 101,
  });
  ctx.scene.add(page);
  correct(page, slam(page));
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
