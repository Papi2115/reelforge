// Game B1 look C (atari-boss), template: boss 2, the flood (showcase game-hud-b1-boss-v2 shot 6).
// Inside the TV a store: the kid on the shelf as a wall of near-identical cartridges rises in
// surges; the boss has no body, it is the amount: its bar fills as the flood rises. Dad's note
// names the weak point (QUALITY CONTROL); the flood wins with a hit-stop and a flash, then the
// picture drains line by line (the crash).
// Focal: the rising wall of clones, then the boss bar full.
// Traces: surges in a fast-fast-pause rhythm with decaying shakes; the crest flickers (the 2600
// cannot draw that many objects on a line); the kid's input-lag crouch before the jump and the
// landing squash; the note slapped on and underlined; hit-stop + flash; the line-by-line drain.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-c1',
  title: 'Atari boss: the flood',
  treatment: 'character-scene',
};

const STRIPES = ['orange', 'teal', 'avocado', 'mauve', 'orange', 'gold'];
/** [start, end, from, to]: flood level (TV units) per surge, fast-fast-pause. */
const SURGES = [
  [0, 0.5, 22, 30],
  [1.6, 2.15, 30, 52],
  [2.65, 3.05, 52, 72],
  [3.9, 4.45, 72, 98],
  [6.0, 6.45, 98, 142],
];
const HIT = 6.45;
const KID = {
  rows: ['..####..', '.######.', '.##.###.', '..####..', '...##...', '.######.', '########',
    '#.####.#', '#.####.#', '#.####.#', '..####..', '..#..#..', '..#..#..', '..#..#..', '.##..##.'],
  cols: ['walnut', 'walnut', 'tan', 'tan', 'tan', 'teal', 'cream', 'teal', 'cream', 'teal', 'teal',
    'blue', 'blue', 'blue', 'cream'],
}; // prettier-ignore

function level(t, ease, lerp) {
  let lv = SURGES[0][2];
  for (const [a, b, from, to] of SURGES) {
    if (t >= b) lv = to;
    else if (t >= a) return lerp(from, to, ease.out((t - a) / (b - a)));
    else break;
  }
  return lv;
}

function store(g) {
  const { hash } = g.util;
  g.bands(0, 160, [
    [0, 'tube'],
    [14, 'tealDark'],
    [24, 'tube'],
    [40, 'tealDark'],
    [150, 'tube'],
  ]);
  const backs = ['walnut', 'teak', 'tealDark', 'dusk'];
  [64, 100, 136].forEach((sy, k) => {
    g.rect(0, sy, 160, 2, 'teak');
    g.rect(0, sy + 2, 160, 1, 'walnutDark');
    let x = 4 + k * 3;
    let i = 0;
    while (x < 156) {
      const w = 4 + Math.floor(hash(55, k, i) * 3);
      const h = 10 + Math.floor(hash(56, k, i) * 5);
      g.rect(x, sy - h, w, h, backs[Math.floor(hash(57, k, i) * 4)]);
      g.rect(x, sy - h + 2, w, 1, 'walnutDark');
      x += w + 1 + Math.floor(hash(58, k, i) * 3);
      i += 1;
    }
  });
}

function kid(g, t) {
  const { lerp } = g.util;
  let [x, top, squash] = [22, 70, 1];
  if (t >= 2.84 && t < 2.98) squash = 0.8;
  else if (t >= 2.98 && t < 3.34) {
    const k = (t - 2.98) / 0.36;
    top = lerp(70, 34, k) - Math.sin(Math.PI * k) * 12;
    x = 22 + Math.round(k * 3);
  } else if (t >= 3.34) {
    [x, top] = [25, 34];
    if (t < 3.44) squash = 0.82;
  }
  g.sprite(KID.rows, KID.cols, x, Math.round(top), { rowH: 2, squash, flicker: false });
}

function flood(g, lv, t) {
  const { hash } = g.util;
  const rows = Math.ceil(lv / 7);
  for (let r = 0; r < rows; r += 1) {
    const y = 180 - (r + 1) * 7;
    for (let c = -1; c < 21; c += 1) {
      const x = c * 8 + (r % 2 ? 4 : 0) + Math.round((hash(7, r, c) - 0.5) * 2);
      const stripe = STRIPES[Math.floor(hash(7, r, c + 9) * 6)];
      if (r === rows - 1) {
        if (hash(7, r, c + 50) * 7 > lv - r * 7 + 2 || (c + g.frame) % 2 === 0) continue;
        const wave = Math.round(Math.sin(c * 0.9 + t * 5) * 1.5);
        g.cart(x, y + wave, stripe, { label: 'tan', tumble: true, phase: c, playfield: true });
        continue;
      }
      g.cart(x, y, stripe, { label: r < rows - 3 ? 'tan' : 'cream', playfield: true });
    }
  }
}

function picture(g, t) {
  const { ease, lerp, seg, shake } = g.util;
  const tt = Math.min(t, HIT); // hit-stop: the flood freezes when it wins
  let [sx, sy] = [0, 0];
  SURGES.forEach(([a], i) => {
    const s = shake(tt, a, 2 + i * 0.6, 8, 500 + i);
    sx += s.x;
    sy += s.y;
  });
  if (t >= HIT && t < HIT + 0.21) {
    const s = shake(t, HIT, 6, 7, 599);
    sx += s.x;
    sy += s.y;
  }
  g.offset(sx * 4, sy * 2);
  store(g);
  kid(g, tt);
  flood(g, level(tt, ease, lerp), tt);
  g.offset(0, 0);
  if (t >= HIT && t < HIT + 0.05) g.remap('flash');
  const drain = seg(t, 6.7, 7.35);
  if (drain > 0) {
    const rows = drain * 180;
    g.remap('drain', undefined, [0, rows]);
    if (drain < 1) g.remap('drain', 0.5, [rows, rows + 1]);
  }
}

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 52,
  });
  screen.tv(picture);
  // The boss is the amount: its bar fills with every surge (segments = the flood's share).
  screen.boss({
    num: 2,
    name: 'THE FLOOD',
    from: 'right',
    x: 400,
    y: 56,
    at: 0.95,
    seed: 52,
    hp: {
      n: 8,
      keys: [
        [0.9, 0.5],
        [2.15, 2],
        [3.05, 3.3],
        [4.45, 5.1],
        [6.45, 8],
      ],
    },
  });
  screen.note(['WEAK POINT:', 'QUALITY CONTROL'], {
    at: 5.22,
    x: 178,
    y: 196,
    w: 236,
    h: 58,
    angle: -0.045,
    seed: 71,
    under: 1,
  });
  screen.year('1983', { at: -1 });
  screen.progress({ from: 0.5, to: 0.6, slots: 10 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
