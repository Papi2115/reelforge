// Sketchbook look C (sketch-loud), pop-up inspiration 4 of 4: a GEAR turning a COUNTER, driven by
// a pure callback, and a card that dissolves in. Claim: "Britain only switched in 1752, 170 years
// after Rome". The tab turns the gear 1582 -> 1752 (the year under the top pointer is read)
// while the counter runs the year with it (drive(p) rounds it), then BRITAIN dissolves in.
// Mechanism ideas, not a layout to copy: invent the motion that shows YOUR claim, and never use
// the same mechanism twice in one film.
// Focal: 1752 arriving under the pointer and on the counter.
// Traces: a pencil note, the red loop on the gear, a coffee ring.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'sc7',
  title: 'Sketch loud: pop-up gear',
  treatment: 'counter/odometer',
};

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    stock: 'cartridge',
    page: 10,
    seed: 110,
  });
  ctx.scene.add(page);
  page.coffeeRing(160, 430, 48);
  page.popup({
    intent: 'the gear turns from 1582 to 1752: Britain switched 170 years after Rome',
    x: 220,
    y: 260,
    w: 430,
    depth: 190,
    at: 0.3,
    elements: [
      {
        kind: 'wheel',
        id: 'cog',
        u: 120,
        v: 82,
        r: 62,
        labels: ['325', '1582', '1752'],
        angle: -120,
        teeth: true,
        color: 'skyPencil',
      },
      { kind: 'counter', id: 'year', u: 290, v: 120, from: 1582 },
      {
        kind: 'card',
        id: 'britain',
        u: 300,
        v: 52,
        w: 130,
        h: 40,
        text: 'BRITAIN',
        paper: 'sticky',
      },
      { kind: 'note', text: 'Britain: 11 days', u: 230, depth: 150 },
    ],
    pull: {
      at: 3,
      dur: 1.8,
      motions: [
        { target: 'cog', to: { angle: -240 }, ease: 'inOut' },
        { target: 'britain', from: { show: 0 }, to: { show: 1 }, span: [0.8, 1], ease: 'lin' },
      ],
      drive: (p) => ({ year: { value: Math.round(1582 + 170 * Math.min(1, Math.max(0, p))) } }),
      callout: 'loop',
    },
    seed: 4900,
  });
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
