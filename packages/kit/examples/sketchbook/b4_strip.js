// Sketchbook look B (sketch-graph), template 4: "accordion timeline" (showcase sketchbook-v2 shot
// 8). A creased paper strip lies across a lined page; the left hand drags it right to left while
// the pen writes the chronology onto it; what has been read bunches into a folded stack at the
// left; a paper clip marks "now". A chronology proof, rare: at most one per ~60-90 s.
// Focal: the entry being written; the red "-10 days" under 1582 after a held beat.
// Traces: uneven panel widths and wandering creases, tape at angles over the joins, the pencil
// axis ruled panel by panel with hand-ruled ticks, a coffee ring half under the strip, a sun
// doodle by "21 March", a graphite thumbprint after the last drag.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'sb4',
  title: 'Sketch graph: accordion timeline',
  treatment: 'node-graph/timeline',
};

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    stock: 'lined',
    seed: 108,
  });
  ctx.scene.add(page);
  page.coffeeRing(872, 372, 47, { seed: 17 });
  page.strip({
    y: 156,
    events: [
      { label: '45 BC', year: -45, note: ['Caesar: +1 day', 'every 4 years'] },
      { label: '325', year: 325, note: 'equinox: 21 March', doodle: 'sun' },
      { label: '1500s', year: 1500, note: ['equinox slipped', '~10 days'] },
      { label: '1582', year: 1582, note: '−10 days' },
      { label: '1752', year: 1752, note: 'Britain: −11 days' },
    ],
    highlight: 3,
    end: 'now',
    at: 0.18,
    until: 7.5,
    seed: 801,
  });
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
