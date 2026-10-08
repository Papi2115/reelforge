// Sketchbook open vocabulary 1 of 6: FOREST (look A, layout 'landscape'). Built only from the
// open layer: generators (hills, forest row, oak, deer, birds, clouds), a project figure (the
// ranger, defineFigure) and a project prop drawn with the doodle DSL (the fire lookout tower).
// Narration: "Rangers still count the old oaks one by one. This one is three hundred years old."
// Focal: the big oak on the right, then its red ring and "300 yrs".
// Traces: "200" crossed out in red and corrected, a pencil margin note, a coffee ring; the
// backdrop blooms in pale while the hand draws the hero.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'so1',
  title: 'Sketch open vocabulary: forest',
  treatment: 'character-scene',
};

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    stock: 'cartridge',
    page: 11,
    seed: 311,
    layout: 'landscape',
  });
  ctx.scene.add(page);
  const s = page.slots();
  const [gx0, gy, gx1] = s.ground;
  // The film's own recurring things (in a real project: assets/sketchbook/ranger.json, ...).
  page.defineFigure('ranger', {
    clothes: 'vest',
    color: 'green',
    hat: 'brim',
    hatColor: 'kraft',
    hair: 'short',
    skin: 'tan',
    holds: 'map',
  });
  // A fire lookout tower: four splayed legs, cross braces, a cabin with a window, a flat roof.
  page.defineProp('fire-tower', {
    h: 150,
    doodle: {
      box: [80, 150],
      parts: [
        { line: [14, 150, 30, 50], sharp: true, width: 2 },
        { line: [66, 150, 50, 50], sharp: true, width: 2 },
        { zigzag: [24, 140, 34, 60], teeth: 5, amp: 34, nib: 'fine' },
        { rect: [22, 26, 36, 24], fill: 'kraft' },
        { rect: [30, 32, 20, 10], fill: 'skyPencil', shade: 'dense' },
        { poly: [16, 28, 40, 14, 64, 28], fill: 'coffee' },
      ],
    },
  });

  // Backdrop: pale, blooms in by itself while the hand works on the hero.
  page.draw('hills', { x: 480, y: gy - 40, w: gx1 - gx0, h: 120, at: 0.2, appear: 'bloom' });
  page.draw('forest', { x: 470, y: gy - 30, w: 760, h: 110, count: 15, at: 0.3, appear: 'bloom' });
  page.use('fire-tower', { x: 120, y: gy - 46, h: 120, at: 0.4, appear: 'bloom' });
  page.draw('sky', { type: 'clouds', ...skyBand(s.sky), count: 2, at: 0.4, appear: 'bloom' });

  // The title first, then the hero: the old oak, drawn by the hand.
  const title = page.write('OLD OAKS', { ...s.label, hand: 'marker', tool: 'marker', at: 0.2 });
  const oak = page.draw('tree', {
    type: 'oak',
    ...s.hero,
    h: 270,
    hero: true,
    at: title.end + 0.1,
  });
  const ranger = page.person({
    like: 'ranger',
    ...s.figures[0],
    h: 170,
    action: 'point',
    face: 1,
    mood: [
      { at: 0, mood: 'neutral' },
      { at: 6.2, mood: 'surprised' },
    ],
    at: oak.end + 0.1,
    until: oak.end + 1.5,
  });
  page.draw('beast', {
    type: 'deer',
    action: 'walk',
    x: 470,
    y: gy + 2,
    h: 92,
    flip: true,
    at: 3.4,
    appear: 'bloom',
  });
  page.draw('bird', { type: 'distant', count: 3, x: 560, y: 120, h: 36, at: 2.6, appear: 'bloom' });

  // Words: the big label, a small note that appears, the correction on the point.
  page.write('counted one by one', {
    ...s.note,
    hand: 'scrawl',
    tool: 'pencil',
    appear: 'bloom',
    at: 4.1,
  });
  const [ox, oy, ow] = oak.box;
  page.write('200 yrs', {
    x: ox + ow - 10,
    y: oy + 40,
    size: 26,
    hand: 'scrawl',
    at: ranger.end + 0.2,
    quick: true,
  });
  // A beat, then the red correction.
  page.crossOut(ox + ow - 14, oy + 16, 92, 28, { style: 'strike', at: 6 });
  page.loop(ox + ow / 2, oy + 70, ow * 0.55, 80, { tool: 'red', at: 6.3, dur: 0.6 });
  page.write('300 yrs', {
    x: ox + ow - 6,
    y: oy + 82,
    size: 30,
    hand: 'scrawl',
    tool: 'red',
    at: 7,
  });
  page.coffeeRing(880, 470, 38);
  return { page };
}

/** The sky slot [x, y, w, h] as a backdrop placement (bottom-centre anchor). */
function skyBand(sky) {
  const [x, y, w, h] = sky;
  return { x: x + w / 2, y: y + h, w, h };
}

export function update(t, state) {
  state.page.update(t);
}
