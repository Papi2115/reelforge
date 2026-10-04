// Example scene for the source chip (ctx.annotate.sourceChip, PLAN.md#12.18): a B-roll of a
// calculator whose claim is credited in a corner, in three acts of 3 s. Act 1: the default corner
// (bottom right) with a reference number. Act 2: the preferred corner top left, a name given as a
// URL (shown as its host). Act 3: a callout and a lower third take the bottom corners, so the chip
// moves to the free top-right corner.
export const meta = { id: 's04', title: 'Source chip', treatment: 'metaphor-object' };

export function build(ctx) {
  const { kit, scene, three, palette } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: 'default' }));
  const desk = kit.env.desk({ width: 5, depth: 2.2, drawers: false });
  scene.add(desk);
  const calc = kit.props.calculator({ screen: 'text', text: '61 KB', scale: 1.4 }).on(desk);
  return { desk, calc };
}

export function update(t, s, ctx) {
  ctx.camera.dolly({
    start: [-0.8, 3.4, 4.4],
    end: [0.8, 3.2, 4.1],
    target: [0, 1, 0],
    to: 9,
    ease: 'easeInOutSine',
  })(t);
  const a = ctx.annotate;

  // Act 1 (0-3 s): default corner, numbered.
  a.sourceChip({ id: 'chip-default', name: 'Doom Wiki', index: 1, at: 0.3, until: 3 });

  // Act 2 (3-6 s): preferred corner, a URL as the name.
  a.sourceChip({
    id: 'chip-top-left',
    name: 'https://www.ti.com/calculators/ti-84-plus-ce',
    corner: 'top-left',
    at: 3.3,
    until: 6,
  });

  // Act 3 (6-9 s): both bottom corners are taken; the chip finds the free one.
  a.sourceChip({ id: 'chip-avoid', name: 'Cemetech forum', index: 2, at: 6.3, until: 9 });
  a.callout({
    id: 'fact',
    title: 'RAM',
    text: '154 KB free',
    target: { object: s.calc, anchor: 'screen' },
    pos: [0.8, 0.87],
    at: 6.1,
    until: 9,
  });
  ctx.text.lowerThird('TI-84 PLUS CE', null, { id: 'model', at: 6.1, until: 9 });
}
