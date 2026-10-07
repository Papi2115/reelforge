// Sketchbook look C (sketch-loud), pop-up inspiration 1 of 4: a GAUGE that fills. Claim: "a year
// is about a quarter day longer than 365 days; in 4 years that's almost one whole day". A ribbon is
// pulled out of the card's right edge: the leap-day tube fills from a quarter to the top while the
// counter runs yr 1 -> yr 4, and at the end FEB 29 stands up from the fold.
// Mechanism ideas, not a layout to copy: invent the motion that shows YOUR claim, and never use
// the same mechanism twice in one film.
// Focal: the tube reaching the top beside FEB 29.
// Traces: the maker's pencil note, a red loop on the full tube, tape on the card.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'sc4',
  title: 'Sketch loud: pop-up gauge',
  treatment: 'metaphor-object',
};

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    stock: 'cartridge',
    page: 6,
    seed: 106,
  });
  ctx.scene.add(page);
  page.write('a quarter day a year', {
    x: 90,
    y: 120,
    size: 30,
    hand: 'scrawl',
    at: 0.2,
    quick: true,
  });
  page.popup({
    intent: 'a quarter day a year fills up; after four years it makes a whole day: FEB 29',
    x: 330,
    y: 250,
    w: 380,
    depth: 210,
    at: 1.8,
    elements: [
      {
        kind: 'gauge',
        id: 'spare',
        u: 90,
        v: 30,
        h: 150,
        level: 0.25,
        label: 'LEAP DAY',
        marks: ['yr 1', 'yr 2', 'yr 3', 'yr 4'],
        color: 'orange',
      },
      { kind: 'counter', id: 'years', u: 250, v: 150, from: 1, prefix: 'yr ', size: 28 },
      { kind: 'block', id: 'leap', u: 190, w: 120, h: 70, depth: 34, band: 'FEB', text: '29' },
      { kind: 'note', text: 'almost one whole day', u: 24, depth: 168 },
    ],
    pull: {
      at: 4.0,
      tab: 'ribbon',
      side: 'right',
      dur: 1.4,
      ease: 'out',
      motions: [
        { target: 'spare', to: { level: 1 } },
        { target: 'years', to: { value: 4 }, span: [0.1, 1], ease: 'lin' },
        // FEB 29 lies flat until the tube is full, then springs up on its hinge.
        { target: 'leap', from: { rise: 0 }, to: { rise: 1 }, span: [0.75, 1], ease: 'back' },
      ],
      callout: 'loop',
    },
    seed: 4600,
  });
  page.tape(318, 262, 60, 18, -24);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
