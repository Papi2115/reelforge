// Sketchbook open vocabulary 6 of 6: CITY (look B feel on cartridge, layout 'two-column'). Built
// only from the open layer: then = a cottage, an apple tree and a farmer (person: overalls, brim
// hat, pitchfork); now = a city skyline backdrop, a crowd and a bus; a facts stack under each
// column, a two-stroke arrow from then to now.
// Narration: "In 1950 fewer than one in three people lived in a city. Today it is more than half."
// Focal: the dense right column (skyline + crowd), then the red "more than half".
// Traces: the arrow between the columns in two strokes, a ruled line under the header that sags,
// a coffee ring on the left column.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'so6',
  title: 'Sketch open vocabulary: city',
  treatment: 'metaphor-object',
};

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    stock: 'cartridge',
    page: 16,
    seed: 316,
    layout: 'two-column',
  });
  ctx.scene.add(page);
  const s = page.slots();
  const [left, right] = s.columns;
  const header = page.write('IN CITIES', {
    ...s.label,
    size: 46,
    hand: 'marker',
    tool: 'marker',
    at: 0.2,
  });
  page.underline(s.label.x, s.label.x + 300, s.label.y + 12, { sag: 4, at: header.end + 0.05 });

  // Then: a cottage, a tree, a farmer (left column).
  const hero = s.hero;
  page.draw('building', {
    type: 'cottage',
    x: hero.x - 70,
    y: hero.y,
    h: 120,
    at: 1.7,
    until: 2.7,
  });
  page.draw('tree', { type: 'apple', x: hero.x + 90, y: hero.y, h: 150, appear: 'bloom', at: 2.2 });
  page.person({
    x: hero.x + 20,
    y: hero.y,
    h: 120,
    face: 1,
    action: 'hold',
    clothes: 'overalls',
    color: 'bicLight',
    hat: 'brim',
    hatColor: 'sticky',
    holds: 'pitchfork',
    at: 2.9,
    until: 3.9,
  });

  // Now: skyline, crowd, a bus (right column), drawn denser on purpose.
  const now = s.figures[0];
  const city = page.draw('skyline', {
    x: now.x,
    y: now.y - 20,
    w: 330,
    h: 190,
    hero: true,
    at: 3.9,
    until: 5.3,
  });
  page.crowd({
    x0: now.x - 150,
    x1: now.x + 150,
    y: now.y,
    count: 12,
    h: 60,
    rows: 2,
    at: 4.6,
    appear: 'bloom',
  });
  page.draw('vehicle', {
    type: 'bus',
    x: now.x + 110,
    y: now.y + 2,
    h: 34,
    appear: 'bloom',
    at: 5,
  });
  page.arrow(
    [
      left[0] + left[2] - 20,
      now.y - 90,
      (left[0] + left[2] + right[0]) / 2,
      now.y - 110,
      right[0] + 10,
      now.y - 92,
    ],
    {
      at: city.end + 0.2,
    },
  );

  // The facts under each column; the one that is the point turns red after a beat.
  page.diagram('stack', {
    x: left[0] + 10,
    y: left[1] + 40,
    items: [{ label: '1950' }, { label: 'fewer than 1 in 3' }],
    size: 24,
    labels: 'appear',
    at: 2.4,
  });
  page.diagram('stack', {
    x: right[0] + 10,
    y: right[1] + 40,
    items: [{ label: 'today' }, { label: 'more than half' }],
    size: 24,
    highlight: 1,
    at: 6,
  });
  page.coffeeRing(left[0] + 300, left[1] + 110, 34);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
