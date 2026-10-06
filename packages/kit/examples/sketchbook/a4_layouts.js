// Sketchbook look A (sketch-story), template 4: the composition presets (`layout` +
// `page.slots()`), so the story pages of one film do not all put small figures bottom-left with a
// label on top. Swap LAYOUT: 'hero-left' (big figure + big label), 'facing' (two figures),
// 'tall-diagram' (tall figure + diagram on the right), 'wide-strip' (three figures on one ground).
// Focal: the hero figure (>= 25 % of the page height) and the one thing the label names.
// Traces: an uneven ground line, a pencil margin note, a red correction on the point.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'sa4',
  title: 'Sketch story: layouts',
  treatment: 'character-scene',
};

const LAYOUT = 'hero-left';

function ground(page, slots) {
  const [x0, y, x1] = slots.ground;
  page.stroke([x0, y + 2, (x0 + x1) / 2, y - 3, x1, y + 3], { tool: 'fine', at: 0.2, dur: 0.3 });
}

function heroLeft(page, s) {
  const fig = page.figure({ ...s.hero, at: 0.5, until: 1.6, pose: { armR: [70, 40] } });
  page.write('365 DAYS', { ...s.label, hand: 'marker', at: 1.8 });
  page.write('not quite.', { ...s.note, hand: 'scrawl', tool: 'pencil', quick: true });
  const [x, y, w] = s.thing;
  page.sun(x + w * 0.55, y + 70, 42, { at: fig.end + 1.6 });
  page.write('+¼', { x: x + w * 0.55 + 60, y: y + 40, size: 40, tool: 'red', at: 5 });
}

function facing(page, s) {
  const [right] = s.figures;
  page.figure({ ...s.hero, at: 0.5, until: 1.5, pose: { turn: 0.5, armR: [80, 70] } });
  page.figure({ ...right, at: 1.6, until: 2.5, pose: { turn: -0.5, armL: [-80, -70] } });
  page.write('365?', { ...s.label, hand: 'marker', at: 2.7 });
  page.write('or 365¼', { ...s.note, hand: 'scrawl', tool: 'pencil', appear: 'bloom', at: 3.9 });
  const [x, y, w, h] = s.thing;
  page.arrow([x + 20, y + h * 0.6, x + w / 2, y + h * 0.4, x + w - 20, y + h * 0.6], { at: 4.4 });
  page.crossOut(s.label.x - 6, s.label.y - s.label.size, s.label.size * 2.4, s.label.size + 8, {
    style: 'strike',
    at: 5.6,
  });
}

function tallDiagram(page, s) {
  page.figure({ ...s.hero, at: 0.5, until: 1.6, pose: { armR: [100, 96], turn: 0.6 } });
  const [x, y, w, h] = s.thing;
  const side = Math.min(w / 5, h / 2.4);
  const nudge = [0, 5, -3, 7];
  const grow = [0, 4, -2, 5];
  [0, 1, 2, 3].forEach((i) => {
    const [bx, by, b] = [x + 20 + i * (side + 22) + nudge[i], y + 60 + grow[i], side + grow[i]];
    page.stroke([bx, by, bx + b, by + 1, bx + b - 1, by + b, bx, by + b + 1, bx + 1, by - 2], {
      tool: 'bic',
      at: 1.9 + i * 0.32,
      dur: 0.24,
      smooth: false,
    });
    const top = by + b - (b * (i + 1)) / 4;
    page.fill([bx + 2, top, bx + b - 2, top, bx + b - 2, by + b - 1, bx + 2, by + b - 1], {
      color: 'orange',
      at: 3.3 + i * 0.28 + (i === 3 ? 0.2 : 0),
      dur: 0.2 + i * 0.04,
    });
    page.write(`yr ${String(i + 1)}`, {
      x: bx + 8,
      y: by + b + 30,
      size: 16,
      quick: true,
      appear: 'type',
      at: 2 + i * 0.32,
    });
  });
  page.write('¼ DAY A YEAR', { ...s.label, hand: 'print', at: 4.9 });
  page.write('= 1 day', { ...s.note, hand: 'scrawl', tool: 'red', at: 5.4 });
}

function wideStrip(page, s) {
  const [left, right] = s.figures;
  page.figure({ ...left, at: 0.5, until: 1.3 });
  page.figure({ ...s.hero, at: 1.4, until: 2.3, pose: { armL: [-150, -168], armR: [150, 168] } });
  page.figure({ ...right, at: 2.4, until: 3.2 });
  page.write('1582', { ...s.label, hand: 'marker', at: 3.4 });
  page.write('ten days gone', { ...s.note, hand: 'scrawl', tool: 'red', at: 4.6 });
}

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    stock: 'cartridge',
    page: 4,
    seed: 140,
    layout: LAYOUT,
  });
  ctx.scene.add(page);
  const slots = page.slots();
  ground(page, slots);
  if (LAYOUT === 'facing') facing(page, slots);
  else if (LAYOUT === 'tall-diagram') tallDiagram(page, slots);
  else if (LAYOUT === 'wide-strip') wideStrip(page, slots);
  else heroLeft(page, slots);
  page.coffeeRing(870, 480, 40);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
