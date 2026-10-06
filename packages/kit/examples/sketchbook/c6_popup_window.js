// Sketchbook look C (sketch-loud), pop-up inspiration 3 of 4: a WINDOW with a sliding strip and
// a SCALE pointer. Claim: "between 325 and 1582 the spring equinox slid from 21 March to 11
// March". A lever is pulled out of the left edge: the pointer travels 325 -> 1582 along the
// scale while the date strip slides behind its window, 21 MAR -> 16 MAR -> 11 MAR, staggered.
// Mechanism ideas, not a layout to copy: invent the motion that shows YOUR claim, and never use
// the same mechanism twice in one film.
// Focal: the window showing 11 MAR as the pointer reaches 1582.
// Traces: the cut-out sun, the pencil note, a red loop on the window.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'sc6',
  title: 'Sketch loud: pop-up window',
  treatment: 'node-graph/timeline',
};

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    stock: 'cartridge',
    page: 9,
    seed: 109,
  });
  ctx.scene.add(page);
  page.popup({
    intent: 'as the years run from 325 to 1582 the equinox date slides back from 21 to 11 March',
    x: 260,
    y: 210,
    w: 520,
    depth: 220,
    at: 0.3,
    elements: [
      { kind: 'scale', id: 'year', u: 60, v: 40, w: 300, ends: ['325', '1582'], ticks: 6 },
      {
        kind: 'window',
        id: 'date',
        u: 210,
        v: 140,
        w: 130,
        h: 44,
        items: ['21 MAR', '16 MAR', '11 MAR'],
      },
      { kind: 'cutout', u: 400, w: 90, h: 110, depth: 70, draw: 'sun', text: 'EQUINOX' },
      { kind: 'note', text: 'the date drifts', u: 30, depth: 176 },
    ],
    pull: {
      at: 3.2,
      tab: 'lever',
      side: 'left',
      dur: 2,
      ease: 'sine',
      motions: [
        { target: 'year', to: { value: 1 }, ease: 'lin' },
        { target: 'date', to: { index: 1 }, span: [0.15, 0.5], ease: 'back' },
        { target: 'date', to: { index: 2 }, span: [0.6, 0.95], ease: 'back' },
      ],
      focus: 'date',
      callout: 'loop',
    },
    seed: 4800,
  });
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
