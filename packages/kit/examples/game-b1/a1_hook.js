// Game B1 look A (atari-story), template 1: the hook (showcase game-hud-b1-boss-v2 shot 1).
// Inside the TV: 1983, New Mexico at dusk. A dump truck tips cartridges into a pit; the last one
// wobbles on the truck bed's lip, falls, and lands lit on top of the dim pile; the truck chugs off.
// Focal: the last cartridge, lit (grey body, orange stripe) on the dim pile, right third.
// Traces: uneven release times; carts in the air flicker when a line is crowded (2600 sprite
// limit); the wobble before the fall; hit-stop + squash + dust + decaying shake on the landing;
// the truck leaves in uneven steps; stars twinkle on their own cadences; the place types
// irregularly. A held still moment after the landing.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1',
  title: 'Atari story: the burial hook',
  treatment: 'metaphor-object',
};

const STRIPES = ['orange', 'teal', 'avocado', 'mauve'];
const DIM = { orange: 'rust', teal: 'tealDark', avocado: 'oliveDark', mauve: 'dusk' };
/** Release times of the carts tipped off the truck: uneven on purpose. */
const RELEASE = [0.22, 0.58, 0.81, 1.24, 1.4, 1.93, 2.12];
const PILE = [
  [92, 138],
  [105, 139],
  [118, 138],
  [131, 139],
  [144, 138],
  [99, 125],
  [125, 125],
];
const HERO = { lip: 2.35, drop: 3.3, land: 3.64, x: 112, y: 111 };
const CART = ['.####.', '######', '#....#', '#....#', '#....#', '#....#', '######'];

function desert(g, t) {
  const { hash } = g.util;
  g.bands(
    0,
    160,
    [
      [0, 'void'],
      [14, 'tube'],
      [42, 'night'],
      [66, 'dusk'],
      [75, 'mauve'],
    ],
    80,
  );
  for (let i = 0; i < 12; i += 1) {
    const x = Math.floor(hash(11, i, 1) * 150) + 4;
    const y = 18 + Math.floor(hash(11, i, 2) * 44);
    const on = hash(11, i, Math.floor(t * (0.8 + hash(11, i, 3) * 1.7) + i)) > 0.22;
    if (on) g.rect(x, y, 1, 1, i % 5 === 0 ? 'aqua' : y > 48 ? 'grey' : 'cream');
  }
  // the Sacramento range to the east: playfield blocks of uneven height
  for (let b = 20; b < 40; b += 1) {
    const h = 3 + Math.floor(Math.abs(Math.sin(b * 1.3)) * 6 + hash(12, b, 1) * 3);
    g.rect(b * 4, 80 - h, 4, h, 'night');
  }
  g.bands(0, 160, [
    [80, 'teak'],
    [82, 'walnut'],
    [118, 'walnutDark'],
    [122, 'walnut'],
    [156, 'walnutDark'],
  ]);
  for (let i = 0; i < 9; i += 1) {
    const x = 4 + Math.floor(hash(14, i, 1) * 70);
    const y = 92 + Math.floor(hash(14, i, 2) * 80);
    g.rect(x, y, 3 + Math.floor(hash(14, i, 3) * 4), 1, i % 2 ? 'walnutDark' : 'teak');
  }
  // the pit: a stepped left wall, the right side runs out of the frame
  for (let y = 82; y < 154; y += 2) {
    const inset = Math.floor((y - 82) / 6) + (y > 120 ? 1 : 0);
    g.rect(84 + inset, y, 90, 2, y < 88 ? 'walnutDark' : 'void');
  }
  g.rect(84, 81, 90, 1, 'walnutDark');
}

function truck(g, x, tilt, t) {
  g.rect(x, 92, 36, 2, 'greyDark');
  for (const wx of [3, 24, 29]) {
    g.rect(x + wx, 94, 4, 3, 'void');
    g.rect(x + wx + 1, 95, 2, 1, 'greyDark');
  }
  g.rect(x, 82, 10, 10, 'orange');
  g.rect(x + 1, 81, 8, 1, 'orange');
  g.rect(x + 2, 84, 5, 3, 'night');
  g.rect(x + 6, 84, 1, 1, 'tan');
  g.rect(x - 1, 89, 1, 2, 'gold');
  for (let i = 0; i < 12; i += 1) {
    const by = Math.round(85 - tilt * (11 - i) * 1.25);
    g.rect(x + 11 + i * 2, by, 2, 6, i === 11 ? 'walnut' : 'teak');
    g.rect(x + 11 + i * 2, by, 2, 1, 'rust');
  }
  // exhaust puffs at a held 6 fps cadence
  const puff = Math.floor(t * 6);
  if (puff % 3 !== 0) g.rect(x + 2 + (puff % 2), 77 - (puff % 3), 2, 2, 'greyDark');
}

function pit(g, t) {
  const { ease, lerp, seg, shake } = g.util;
  const hold = t >= HERO.land && t < HERO.land + 0.1; // hit-stop on the landing
  const tt = hold ? HERO.land : t;
  const sh = shake(t, HERO.land, 3, 8, 101);
  g.offset(sh.x * 2, sh.y * 2);
  desert(g, tt);
  // the pile, dim: labels in shadow (resting carts are playfield, outside the sprite limit)
  RELEASE.forEach((r0, i) => {
    const [px, py] = PILE[i];
    if (tt >= r0 + 0.5)
      g.cart(px, py, DIM[STRIPES[i % 4]], { label: 'teak', scale: 2, playfield: true });
  });
  // carts in the air tumble; the 2600 flickers them when a scanline is crowded
  RELEASE.forEach((r0, i) => {
    if (tt < r0 || tt >= r0 + 0.5) return;
    const k = (tt - r0) / 0.5;
    const [px, py] = PILE[i];
    const x = Math.round(lerp(82, px, k));
    const y = Math.round(60 + (py - 60) * k * k - 8 * k * (1 - k));
    g.cart(x, y, STRIPES[i % 4], { label: 'tan', scale: 2, tumble: true, phase: i });
  });
  // the hero cart: wobbles on the lip, falls, lands lit (never flickers: it is the point)
  if (tt >= HERO.lip && tt < HERO.drop) {
    const wobble = [0, 1, 0, 0, 1, 1, 0][Math.floor((tt - HERO.lip) * 7) % 7];
    g.cart(80 + wobble, 52, 'orange', { scale: 2, body: 'grey', flicker: false });
  } else if (tt >= HERO.drop && tt < HERO.land) {
    const k = ease.in(seg(tt, HERO.drop, HERO.land));
    const x = Math.round(lerp(82, HERO.x, k));
    const y = Math.round(lerp(52, HERO.y, k));
    g.cart(x, y, 'orange', { scale: 2, tumble: true, flicker: false });
  } else if (tt >= HERO.land) {
    if (t < HERO.land + 0.13)
      g.sprite(CART, 'grey', HERO.x, HERO.y, { stretch: 2, rowH: 2, squash: 0.7, flicker: false });
    else g.cart(HERO.x, HERO.y, 'orange', { scale: 2, body: 'grey', flicker: false });
    const d = t - HERO.land;
    if (d > 0.05 && d < 0.5) {
      const s = Math.floor(d * 12); // dust puffs at a held cadence
      g.rect(HERO.x - 3 - s, HERO.y + 12 - (s > 1 ? 1 : 0), 2, 1, 'teak');
      g.rect(HERO.x + 13 + s, HERO.y + 12 - (s > 2 ? 1 : 0), 2, 1, 'teak');
    }
  }
  // the truck chugs off in uneven steps once the bed is down
  const leave = seg(tt, 4.3, 5.4);
  const steps = Math.floor(leave * 7) + (leave > 0.6 ? 1 : 0);
  const tx = 50 - steps * 4 - (leave > 0 && Math.floor(tt * 10) % 3 === 0 ? 1 : 0);
  const tilt = tt < 4.0 ? 1 : 1 - seg(tt, 4.0, 4.3);
  g.offset(sh.x * 2, sh.y * 2 - 34);
  truck(g, tx, tilt, tt);
  g.offset(0, 0);
  // the place under the year, typed with an irregular hand
  g.text('NEW MEXICO', 10, 21, { colour: 'tan', type: { at: 0.75, cps: 18 } });
}

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 1983,
  });
  screen.tv(pit);
  screen.year('1983', { at: 0.5 });
  // one cartridge slot per shot: this is shot 1 of 10
  screen.progress({ from: 0, to: 0.1, slots: 10, at: 0.35 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
