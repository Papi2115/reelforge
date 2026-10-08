// Sketchbook open vocabulary 3 of 6: SPACE STATION (look C feel, layout 'big-number'). Built only
// from the open layer: a starfield backdrop, the Earth as a doodle (one big lumpy blob with crayon
// continents), the station generator, a project astronaut (defineFigure: blob body, helmet,
// wrench), an icon; the orbit is a plain arrow along points the scene computes.
// Narration: "The space station flies four hundred kilometres up and goes round the Earth sixteen
// times a day, once every ninety minutes."
// Focal: the huge marker "16", then the station on its orbit and the red "90 min".
// Traces: a pencil margin note ("400 km up"), the orbit arrow in two strokes that overshoots, a
// strip of tape over the corner of the page.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'so3',
  title: 'Sketch open vocabulary: space station',
  treatment: 'metaphor-object',
};

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    stock: 'cartridge',
    page: 13,
    seed: 313,
    layout: 'big-number',
  });
  ctx.scene.add(page);
  const s = page.slots();
  page.defineFigure('astronaut', {
    body: 'blob',
    color: 'graphiteLight',
    hat: 'bubble',
    hatColor: 'skyPencil',
    skin: 'light',
    holds: 'wrench',
    holdSize: 0.3,
  });

  page.draw('space', {
    type: 'stars',
    x: 480,
    y: 530,
    w: 900,
    h: 500,
    count: 20,
    at: 0.1,
    appear: 'bloom',
  });
  // The Earth: most of it below the page, its rim a big lumpy curve.
  const earth = page.doodle(
    {
      box: [600, 300],
      parts: [
        { blob: [300, 300, 290, 250], lumps: 0.04, fill: 'skyPencil', shade: 'light', width: 2 },
        { blob: [190, 120, 70, 30], lumps: 0.4, fill: 'green', outline: false, rot: -10 },
        { blob: [420, 150, 60, 36], lumps: 0.4, fill: 'green', outline: false, rot: 20 },
      ],
    },
    { x: 730, y: 600, w: 560, at: 0.3, speed: 2.2 },
  );

  // The big number: the hero of the text.
  page.write('16', {
    ...s.label,
    hand: 'marker',
    tool: 'marker',
    nib: [24, -40, 5],
    hero: true,
    at: earth.end + 0.1,
  });
  page.write('times a day', { ...s.note, hand: 'scrawl', appear: 'bloom', at: earth.end + 0.8 });

  // The station on its orbit, drawn by the hand.
  const station = page.draw('vehicle', {
    type: 'station',
    x: 700,
    y: 250,
    h: 92,
    rot: -8,
    speed: 1.6,
    at: 2.2,
  });
  const orbit = [];
  for (let i = 0; i <= 14; i += 1) {
    const a = ((200 + i * 7.8) * Math.PI) / 180;
    orbit.push(730 + Math.cos(a) * 330, 600 + Math.sin(a) * 350 + (i % 3) - 1);
  }
  const astronaut = page.person({
    like: 'astronaut',
    x: 530,
    y: 260,
    h: 120,
    action: 'wave',
    mood: 'happy',
    at: station.end + 0.1,
    until: station.end + 1.7,
  });
  page.arrow(orbit, { tool: 'fine', at: astronaut.end + 0.1, dur: 0.8, ease: 'sine' });
  page.write('400 km up', {
    x: 560,
    y: 70,
    size: 18,
    hand: 'scrawl',
    tool: 'pencil',
    appear: 'bloom',
    at: 4.5,
  });

  // A beat, then the red on the point.
  page.write('90 min', { x: 800, y: 296, size: 34, hand: 'scrawl', tool: 'red', rot: -6, at: 7.3 });
  page.draw('icon', { type: 'clock', x: 776, y: 292, h: 30, at: 7.9, appear: 'pop' });
  page.tape(70, 28, 90, 22, -8);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
