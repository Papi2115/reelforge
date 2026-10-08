// Sketchbook open vocabulary 5 of 6: DESERT (look A, layout 'close-up'). Built only from the open
// layer: one camel drawn huge (beast generator, bold, dense crayon), dunes and a cactus behind it,
// the sun icon, a callout diagram on the hump, a facts stack, and spot-art water drops.
// Narration: "A camel's hump is not a water tank, it stores fat. When it finds water, a camel can
// drink a hundred litres in ten minutes."
// Focal: the hump of the huge camel, then the red "fat" over the crossed-out "water?".
// Traces: the wrong word crossed out and corrected in red, a strip of tape on the fact list,
// a graphite smudge in the sand.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'so5',
  title: 'Sketch open vocabulary: desert',
  treatment: 'metaphor-object',
};

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    stock: 'cartridge',
    page: 15,
    seed: 315,
    layout: 'close-up',
  });
  ctx.scene.add(page);
  const s = page.slots();
  const [gx0, gy, gx1] = s.ground;
  page.defineProp('drop', {
    h: 30,
    spot: {
      rows: [
        '...b...',
        '...b...',
        '..bbb..',
        '.bbbbb.',
        'bbbbwbb',
        'bbbbbwb',
        '.bbbbb.',
        '..bbb..',
      ],
      legend: { b: 'skyPencil', w: 'paper' },
      px: 4,
    },
  });

  page.draw('dunes', {
    x: (gx0 + gx1) / 2 + 40,
    y: gy + 8,
    w: gx1 - gx0 + 120,
    h: 120,
    at: 0.2,
    appear: 'bloom',
  });
  page.draw('icon', { type: 'sun', x: 120, y: 120, h: 60, at: 0.3, appear: 'bloom' });
  page.draw('cactus', { type: 'saguaro', x: 90, y: gy - 30, h: 110, at: 0.4, appear: 'bloom' });

  // Hero: the camel, huge, drawn by the hand.
  const camel = page.draw('beast', {
    type: 'camel',
    ...s.hero,
    h: 320,
    shade: 'dense',
    hero: true,
    subject: true,
    at: 0.6,
    until: 3,
  });
  const [bx, by, bw] = camel.box;
  const [hx, hy] = [bx + bw * 0.42, by + 36];

  page.write('THE HUMP', { ...s.label, hand: 'marker', tool: 'marker', at: camel.end + 0.2 });
  const guess = page.diagram('callout', {
    x: hx,
    y: hy,
    label: 'water?',
    from: [s.note.x, s.note.y + 20],
    size: 26,
    at: camel.end + 1,
  });
  page.diagram('stack', {
    x: s.thing[0] + 30,
    y: s.thing[1] + 60,
    items: [{ label: '100 litres' }, { label: 'in 10 minutes' }],
    bullet: 'dash',
    size: 24,
    at: guess.end + 0.2,
  });
  for (let i = 0; i < 3; i += 1) {
    page.use('drop', {
      x: s.thing[0] + 236 + i * 30,
      y: s.thing[1] + 70 - (i % 2) * 8,
      h: 30,
      at: guess.end + 0.6 + i * 0.1,
      appear: 'pop',
    });
  }
  page.tape(s.thing[0] + 6, s.thing[1] + 20, 70, 20, -14);

  // A beat, then the correction on the point.
  page.crossOut(s.note.x - 4, s.note.y - 4, 104, 30, { style: 'zigzag', at: 6.8 });
  page.write('fat', {
    x: s.note.x + 112,
    y: s.note.y + 22,
    size: 40,
    hand: 'scrawl',
    tool: 'red',
    rot: -6,
    at: 7.3,
  });
  page.smudge(420, 500, 70, 18, 6);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
