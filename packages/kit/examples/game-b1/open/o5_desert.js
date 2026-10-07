// Game B1 open vocabulary (PLAN.md#13.15), example 5: a DESERT film. Built only from the film's
// own vocabulary: a camel caravan from the animal generator (traits: long neck, hump) drawn as one
// player copied three times (NUSIZ), a guide,
// a hand-drawn sun, a palm at the oasis, two dune playfields scrolling in whole blocks at two
// speeds (the 2600's coarse parallax), a counter of a real number, a visual collision.
// Narration: "Crossing the Sahara by caravan took forty days. At the oasis a camel can drink a
// hundred litres in ten minutes."
// Focal: the lead camel at the shrinking pool; the day count landing on 40.
// Traces: the guide walks off the camels' beat; the near dunes scroll faster than the
// far ones and stop in a held step; the pool shrinks in uneven gulps once the camel's box meets
// it; the sun shimmers on its own slow cadence; the place typed irregularly.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-o5',
  title: 'Open vocabulary: desert',
  treatment: 'character-scene',
};

/** What would live in assets/b1/caravan.json. */
const ASSETS = {
  version: 1,
  world: 'game-b1',
  sprites: {
    sun: {
      describe: 'the noon sun',
      frames: [
        ['..####..', '.######.', '########', '########', '.######.', '..####..'],
        ['..####..', '.######.', '########', '#######.', '.######.', '..####..'],
      ],
      colours: ['gold', 'gold', 'cream', 'cream', 'gold', 'gold'],
      fps: 1.5,
      size: 2,
      rowH: 2,
    },
  },
  generated: {
    caravan: { kind: 'animal', like: 'camel', copies: 3, gap: 'medium', colour: 'teak', legColour: 'walnutDark', hornColour: 'walnut', seed: 3 },
    guide: { kind: 'person', role: 'plain', hat: 'hood', tool: 'staff', colours: { hatColour: 'blue', top: 'blue', band: 'night', legs: 'night', hair: 'walnutDark' } },
    palm: { kind: 'tree', shape: 'palm', height: 22, size: 2, seed: 5 },
    farDunes: { kind: 'scenery', type: 'dunes', rows: 4, rowH: 4, seed: 21, colours: ['teak', 'teak'] },
    nearDunes: { kind: 'scenery', type: 'dunes', rows: 5, rowH: 4, seed: 9, colours: ['tan', 'tan'] },
  },
}; // prettier-ignore

const ARRIVE = 5.6;
const POOL = { x: 112, y: 150, w: 32, h: 4 };

function picture(g, t) {
  const { scroll, hit, hash } = g.util;
  const tt = Math.min(t, ARRIVE);
  g.bands(0, 160, [
    [0, 'blue'],
    [46, 'aqua'],
    [58, 'cream'],
  ]);
  g.draw('sun', 112, 14, { flicker: false, playfield: true });
  g.field('farDunes', 66, { shift: scroll(tt, 6) });
  g.bands(0, 160, [[82, 'teak']]);
  g.field('nearDunes', 100, { shift: scroll(tt, 16) });
  g.bands(0, 160, [[120, 'tan']]);
  // the oasis slides in from the right with the near dunes, then holds
  const oasisX = 170 - Math.floor((Math.max(0, tt - 3.4) * 32) / 4) * 4;
  g.draw('palm', oasisX + 14, 106, { playfield: true });
  const camelBox = g.box('caravan', 30, 128);
  const pool = { ...POOL, x: oasisX - 2 };
  const drinking = hit(camelBox, pool) && t > ARRIVE;
  const gulps = drinking ? Math.min(5, Math.floor((t - ARRIVE) * 2.2 + hash(4, 1, 1))) : 0;
  if (oasisX < 165) g.rect(pool.x + gulps * 3, pool.y, Math.max(4, pool.w - gulps * 6), pool.h, 'blue');
  const walking = t < ARRIVE;
  g.draw('guide', 6, 122, { frame: walking ? undefined : 0, phase: 1 });
  // one player copied three times (NUSIZ): the 2600's caravan, no flicker, stepping as one
  g.draw('caravan', 30, 128, { frame: walking ? undefined : 0, squash: drinking && Math.floor(t * 4) % 2 === 0 ? 0.92 : 1, flicker: false });
  const days = g.counter({
    means: 'days on the caravan route',
    keys: [[0, 1], [1.1, 9], [2.3, 17], [3.0, 26], [4.4, 33], [ARRIVE, 40]],
    x: 6,
    y: 26,
    colour: t >= ARRIVE ? 'crimson' : 'white',
    cell: [4, 4],
  });
  g.text('DAYS', 6, 38, { colour: days >= 40 ? 'crimson' : 'cream' });
  g.text('THE SAHARA', 6, 166, { colour: 'walnut', type: { at: 0.6, cps: 15 } });
} // prettier-ignore

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 40,
  });
  screen.assets(ASSETS);
  screen.tv(picture);
  screen.progress({ from: 0.67, to: 0.83, slots: 6 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
