// Example scene for the annotation layer (ctx.annotate): a calculator between a phone and a lock
// on a desk, annotated in four acts of 3 s while the camera drifts (annotations follow it).
// Like ctx.text, annotate calls are immediate-mode: they run in update() every frame and
// at/until time them. Colours are palette tokens, so the scene renders in every style preset.
export const meta = { id: 's02', title: 'Annotations', treatment: 'metaphor-object' };

export function build(ctx) {
  const { kit, scene, three, palette } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: 'default' }));
  const desk = kit.env.desk({ width: 5, depth: 2.2, drawers: false });
  scene.add(desk);
  const calc = kit.props.calculator({ screen: 'text', text: '58008', scale: 1.4 }).on(desk);
  const phone = kit.props.phone().on(desk, { at: 'spotLeft' });
  const lock = kit.props.lock().on(desk, { at: 'spotRight' });
  return { desk, calc, phone, lock };
}

export function update(t, s, ctx) {
  ctx.camera.dolly({
    start: [-1.2, 3.6, 4.6],
    end: [1.2, 3.3, 4.2],
    target: [0, 1, 0],
    targetEnd: [0.2, 1, 0],
    to: 12,
    ease: 'easeInOutSine',
  })(t);
  const a = ctx.annotate;
  const screen = { object: s.calc, anchor: 'screen' };
  const keypad = { object: s.calc, anchor: 'keypad' };

  // Act 1 (0-3 s): point at parts.
  a.arrow({
    id: 'to-keypad',
    target: keypad,
    from: { screen: [0.3, 0.82] },
    curve: 'curved',
    text: 'KEYS',
    at: 0.2,
    until: 3,
  });
  a.ring({ id: 'lcd-ring', target: screen, radius: 0.07, at: 0.6, until: 3 });
  a.pin({ id: 'phone-pin', target: s.phone, text: 'PHONE', at: 1, until: 3 });

  // Act 2 (3-6 s): measure, group and count.
  a.dimension({
    id: 'width',
    from: s.calc,
    to: s.calc,
    text: '11 CM',
    flip: true,
    at: 3.1,
    until: 6,
  });
  a.bracket({
    id: 'gadgets',
    from: s.phone,
    to: s.lock,
    text: '3 GADGETS',
    offset: 0.08,
    at: 3.3,
    until: 6,
  });
  [s.phone, s.calc, s.lock].forEach((object, index) => {
    a.badge({
      value: index + 1,
      target: { object, anchor: 'top' },
      nudge: [0, -10],
      at: 3.8 + 0.2 * index,
      until: 6,
    });
  });

  // Act 3 (6-9 s): define, emphasise, confirm.
  ctx.text.title('IT RUNS DOOM', { id: 'claim', pos: [0.5, 0.17], at: 6, until: 9, scale: 3 });
  a.underline({
    id: 'doom-line',
    target: { card: 'claim', words: [2, 2] },
    style: 'scribble',
    at: 6.4,
    until: 9,
  });
  a.callout({
    id: 'lcd-def',
    title: 'LCD',
    text: 'Liquid crystal display, 96 x 64 dots',
    target: screen,
    pos: [0.24, 0.5],
    at: 6.3,
    until: 9,
  });
  a.stamp({ id: 'confirmed', text: 'CONFIRMED', pos: [0.76, 0.72], at: 7, until: 9 });

  // Act 4 (9-12 s): focus.
  a.spotlight({ id: 'focus', target: s.calc, at: 9, until: 12 });
  a.badge({
    id: 'yes',
    value: 'check',
    target: { object: s.calc, anchor: 'top' },
    nudge: [26, -26],
    at: 9.4,
    until: 12,
  });
  a.badge({
    id: 'no',
    value: 'cross',
    target: { object: s.phone, anchor: 'top' },
    nudge: [0, -14],
    at: 9.6,
    until: 12,
  });
  ctx.text.title('ONLY THIS ONE', { id: 'only', pos: [0.5, 0.86], at: 9.2, until: 12, scale: 2 });
  a.highlight({ id: 'only-mark', target: { card: 'only', words: [1, 2] }, at: 9.5, until: 12 });
}
