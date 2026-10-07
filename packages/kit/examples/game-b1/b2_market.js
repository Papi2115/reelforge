// Game B1 look B (atari-menu), template: the market inventory (showcase game-hud-b1-boss-v2
// shot 5). The shot opens on the console close-up: Dad's hand brings the XMAS 82 cartridge down,
// it resists the slot, clicks in (shake, garbage on the TV), the hand lets go and the camera pushes
// into the TV: the game's MARKET 1983 menu draws in line by line, the cursor walks the consoles
// that crowded in, the GAMES grid fills faster and faster until INVENTORY FULL, and the clones
// spill out of the bottom.
// Focal: the GAMES grid filling, then INVENTORY FULL (the only accent) and the spill.
// Traces: the cartridge resists then clicks; Dad's tape label; the panel draws in at an uneven
// speed; the cursor overshoots and settles with uneven holds; names type irregularly; carts are
// stocked by hand (a unit off here and there) and land with a 2-frame drop; the spill flickers.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-b2',
  title: 'Atari menu: the market inventory',
  treatment: 'ui-mockup',
};

const CONSOLES = [
  ['ATARI 2600', 0.56],
  ['INTELLIVISION', 0.42],
  ['ODYSSEY²', 0.34],
  ['COLECOVISION', 0.47],
  ['ATARI 5200', 0.36],
  ['VECTREX', 0.55],
];
const STRIPES = ['orange', 'teal', 'avocado', 'mauve', 'orange', 'gold'];
/** The menu's own clock starts when the camera is inside the TV. */
const MENU = 0.18;

function arrivals(hash) {
  const out = [];
  let a = 4.45;
  for (let i = 0; i < 36; i += 1) {
    out.push(a);
    a += (0.25 * 0.84 ** i + 0.009) * (0.7 + hash(44, i, 1) * 0.6);
  }
  return out;
}

function consoleIcon(g, i, sx, sy) {
  const r = (x, y, w, h, c) => g.rect(sx + x, sy + y, w, h, c);
  if (i === 0) [[2, 9, 12, 4, 'void'], [3, 10, 4, 1, 'greyDark'], [8, 9, 3, 1, 'greyDark'], [2, 13, 12, 3, 'teak']].forEach((a) => r(...a));
  if (i === 1) [[1, 11, 14, 4, 'teak'], [1, 11, 14, 1, 'gold'], [10, 8, 2, 3, 'greyDark'], [13, 8, 2, 3, 'greyDark']].forEach((a) => r(...a));
  if (i === 2) [[2, 10, 12, 5, 'void'], [3, 12, 10, 1, 'grey'], [3, 14, 10, 1, 'greyDark'], [2, 10, 12, 1, 'greyDark']].forEach((a) => r(...a));
  if (i === 3) [[1, 10, 10, 5, 'void'], [2, 10, 8, 1, 'greyDark'], [12, 8, 3, 7, 'greyDark'], [13, 10, 1, 1, 'grey'], [13, 12, 1, 1, 'grey']].forEach((a) => r(...a));
  if (i === 4) [[1, 9, 14, 6, 'greyDark'], [1, 11, 14, 1, 'grey'], [2, 9, 12, 1, 'void']].forEach((a) => r(...a));
  if (i === 5) [[5, 2, 7, 14, 'greyDark'], [6, 3, 5, 9, 'void'], [7, 9, 1, 1, 'aqua'], [8, 7, 1, 1, 'aqua'], [9, 5, 1, 1, 'aqua'], [5, 13, 7, 1, 'grey']].forEach((a) => r(...a));
} // prettier-ignore

function cursorSlot(t) {
  let a = 2.0;
  for (let i = 0; i < CONSOLES.length; i += 1) {
    const end = a + CONSOLES[i][1] + 0.1;
    if (t < end || i === CONSOLES.length - 1) return { i, since: t - a, prev: Math.max(0, i - 1) };
    a = end;
  }
  return { i: 5, since: 9, prev: 4 };
}

function inventory(g, t) {
  const { ease, hash, lerp, seg, typed } = g.util;
  g.bands(0, 160, [
    [0, 'tube'],
    [168, 'night'],
  ]);
  g.rect(12, 28, 118, 128, 'teak');
  g.rect(13, 30, 116, 124, 'void');
  g.text('MARKET 1983', 16, 36, { colour: 'cream' });
  g.text('CONSOLES', 16, 50, { colour: 'tan' });
  const cur = cursorSlot(t);
  const done = t > 2.0 + CONSOLES.reduce((s, c) => s + c[1] + 0.1, 0);
  for (let i = 0; i < 6; i += 1) {
    const sx = 16 + i * 18 + (i === 3 ? 1 : 0);
    g.rect(sx, 58, 16, 20, 'tealDark');
    g.rect(sx + 1, 59, 14, 18, 'teal');
    consoleIcon(g, i, sx, 58);
    if (done) g.dither(sx, 58, 16, 20, 'tube', 0.5);
  }
  if (t >= 2.0 && !done) {
    const e = ease.outBack(Math.min(1, cur.since / 0.12));
    const from = 16 + cur.prev * 18;
    const to = 16 + cur.i * 18 + (cur.i === 3 ? 1 : 0);
    const cx = Math.round(lerp(from, to, cur.i === 0 ? 1 : e));
    for (const [px, py] of [[0, 0], [14, 0], [0, 18], [14, 18]]) {
      g.rect(cx - 1 + px, 57 + py, 3, 1, 'gold');
      g.rect(cx - 1 + px + (px ? 2 : 0), 57 + py + (py ? -1 : 0), 1, 2, 'gold');
    } // prettier-ignore
    const name = CONSOLES[cur.i][0];
    g.text(name.slice(0, typed(name, cur.since, 0.03, 90 + cur.i, 38)), 16, 83, {
      colour: 'cream',
    });
  }
  g.text('GAMES', 16, 98, { colour: t > 4.3 ? 'cream' : 'tan' });
  const arrive = arrivals(hash);
  arrive.forEach((a, i) => {
    if (t < a) return;
    const c = i % 12;
    const r = Math.floor(i / 12);
    const drop = t - a < 0.067 ? -3 : 0;
    const jx = hash(45, i, 2) > 0.8 ? 1 : 0;
    const jy = hash(45, i, 3) > 0.85 ? 1 : 0;
    const x = 16 + c * 9 + (r === 1 ? 1 : 0) + jx;
    g.cart(x, 108 + r * 10 + drop + jy, STRIPES[Math.floor(hash(45, i, 1) * 6)], {
      playfield: true,
    });
  });
  const full = arrive[35] + 0.12;
  if (t > full) {
    const ft = t - full;
    if (!(ft > 0.12 && ft < 0.2) && !(ft > 0.34 && ft < 0.4))
      g.text('INVENTORY FULL', 70, 98, { colour: 'crimson' });
  }
  // the panel draws in line by line (the console builds the picture top-down)
  const draw = seg(t, 1.22, 1.62);
  if (draw < 1) g.rect(0, Math.round(draw * 180), 160, 180, 'tube');
}

function spill(g, t) {
  const { hash, seg } = g.util;
  const k = seg(t, 6.55, 7.5);
  if (k <= 0) return;
  const n = Math.floor(k * 14);
  for (let i = 0; i < n; i += 1) {
    const d = t - (6.55 + i * 0.065);
    if (d < 0) continue;
    const x = Math.round(120 + hash(46, i, 1) * 34 - i * 2);
    const y = Math.round(116 + d * d * 260);
    if (y < 175 && (g.frame + i) % 2 === 1)
      g.cart(x, y, STRIPES[i % 6], { label: 'tan', tumble: true, phase: i, playfield: true });
  }
  // the flood begins from the bottom: clone carts stacked like bricks, the crest flickers
  const level = k * 22;
  const rows = Math.ceil(level / 7);
  for (let r = 0; r < rows; r += 1) {
    const y = 180 - (r + 1) * 7;
    for (let c = -1; c < 21; c += 1) {
      const x = c * 8 + (r % 2 ? 4 : 0) + Math.round((hash(7, r, c) - 0.5) * 2);
      const stripe = STRIPES[Math.floor(hash(7, r, c + 9) * 6)];
      if (r === rows - 1) {
        if (hash(7, r, c + 50) * 7 > level - r * 7 + 2 || (c + g.frame) % 2 === 0) continue;
        const wave = Math.round(Math.sin(c * 0.9 + t * 5) * 1.5);
        g.cart(x, y + wave, stripe, { label: 'tan', tumble: true, phase: c, playfield: true });
        continue;
      }
      g.cart(x, y, stripe, { label: r < rows - 3 ? 'tan' : 'cream', playfield: true });
    }
  }
}

function picture(g, t) {
  // before the click the TV still idles in attract mode (it said INSERT COIN)
  if (t < 0.7) {
    g.attract();
    return;
  }
  if (t < 1.4) {
    g.garbage(47);
    return;
  }
  inventory(g, t - MENU);
  spill(g, t - MENU);
}

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 1983,
  });
  screen.tv(picture);
  const swap = screen.cartridge({
    intent: 'the Christmas cartridge goes in: the market opens and everyone wants in',
    action: 'insert',
    at: 0,
    label: 'XMAS 82',
    enter: 'cut',
    hold: 0,
  });
  for (const cue of swap.cues) ctx.sfx.at(cue.t, cue.name);
  screen.year('1982', { at: -1 });
  screen.year('1983', { at: 1.68 });
  screen.progress({ from: 0.4, to: 0.5, slots: 10 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
