// Comic breakthrough (look comic-loud), open composition 2 of 3: one bridge, one city.
// Narration: "Three villages on two banks, and no bridge between them. Then the bridge opened,
// and the three villages grew into one city."
// Mechanism (page.panelBreak, invented for this claim, never a preset): each village grows in as
// its own shard of a panel, apart, with the river lost in the gutters between them; on "the
// bridge opened" the three shards are pulled together, the west one leading, into register as
// ONE picture across both pages (the gutters close, a spine crease down the fold), the bridge
// inks itself across the river and the city rises behind it.
// Focal: the bridge crossing the fold, the skyline growing behind it.
// Traces: the pieces sliding into register, a pencilled note, the caption off-square, a smudge
// and a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cb2',
  title: 'Comic panel break: three villages, one city',
  treatment: 'kinetic-text',
};

const OPEN = 3.4;
const GROW = 4.8;
/** Where each piece lands: overlapping, together they bleed off every edge of the page. */
const FINAL = {
  west: [-12, -12, 360, 384],
  north: [306, -12, 346, 214],
  south: [306, 182, 346, 190],
};

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 512, anchor: ctx.anchor, duration: ctx.shot.duration });
  ctx.scene.add(page);
  const { art } = page;
  const { seg } = page.util;
  const BIG = [-20, -20, 680, 400];
  // The one picture, in page px; every piece shows its own part of it.
  const city = (g, t) => {
    const grown = seg(t, GROW, GROW + 1.6, 'outQuad');
    art.sky(g, { box: BIG, kind: 'dusk', horizon: 0.36, clouds: 3 });
    if (grown > 0) {
      art.skyline(g, { box: BIG, horizon: 0.36, count: 16, height: 0.06 + 0.2 * grown, lit: true });
    }
    art.land(g, { box: BIG, kind: 'meadow', horizon: 0.36 });
    const river = [292, 120, 344, 120, 392, 380, 250, 380];
    g.plate.poly(river, 'cyan');
    g.ink([292, 120, 250, 380], { closed: false, key: 'bank-w' });
    g.ink([344, 120, 392, 380], { closed: false, key: 'bank-e' });
    for (const y of [170, 236, 300, 346]) g.line(296 + (y - 120) * 0.1, y, 320, y + 3, 'cyanDeep');
    art.building(g, { x: 150, y: 266, kind: 'church', size: 92 });
    art.building(g, { x: 84, y: 280, kind: 'cottage', size: 52, seed: 2 });
    art.building(g, { x: 214, y: 290, kind: 'house', size: 58, seed: 3 });
    art.building(g, { x: 470, y: 150, kind: 'barn', size: 50, seed: 4 });
    art.building(g, { x: 540, y: 146, kind: 'cottage', size: 44, seed: 5 });
    art.building(g, { x: 500, y: 320, kind: 'house', size: 64, seed: 6 });
    art.building(g, { x: 586, y: 330, kind: 'shop', size: 56, seed: 7 });
    if (grown > 0.4) art.building(g, { x: 410, y: 262, kind: 'tower', size: 110 * grown, seed: 8 });
    const built = seg(t, OPEN + 0.9, OPEN + 1.8, 'outQuad');
    if (built > 0) {
      const span = 176 * built;
      g.plate.rect(232, 220, span, 8, 'sepiaMid');
      g.strokeOn([232, 220, 408, 218], built, 'ink', 2);
      g.strokeOn([232, 228, 408, 226], built, 'ink', 2);
      for (let x = 262; x < 232 + span; x += 36) g.line(x, 228, x, 262, 'ink', 3);
    }
  };
  const piece = (id) => {
    const [fx, fy] = FINAL[id];
    return (g, t) => city(g.at(-fx, -fy), t);
  };
  page.panelBreak({
    intent:
      'the bridge pulled the three villages on two banks together into one city across the river',
    at: 0.2,
    fold: 320,
    panels: [
      {
        id: 'west',
        box: [24, 40, 244, 290],
        shape: 'shard',
        lean: 16,
        enter: 'grow',
        from: 'bottom',
        draw: piece('west'),
      },
      {
        id: 'north',
        box: [312, 30, 300, 142],
        shape: 'shard',
        lean: 14,
        at: 0.6,
        enter: 'grow',
        from: 'bottom',
        draw: piece('north'),
      },
      {
        id: 'south',
        box: [340, 196, 270, 140],
        shape: 'shard',
        lean: 18,
        at: 1.0,
        enter: 'grow',
        from: 'bottom',
        draw: piece('south'),
      },
    ],
    moves: [
      { target: 'west', at: OPEN, dur: 1.1, to: { box: FINAL.west } },
      { target: 'north', at: OPEN + 0.2, dur: 1.1, to: { box: FINAL.north } },
      { target: 'south', at: OPEN + 0.38, dur: 1.1, to: { box: FINAL.south } },
    ],
    gutters: { kind: 'close', at: OPEN + 0.3, dur: 1.1 },
  });
  page.note('NO BRIDGE', { x: 270, y: 344, at: 2.1, dur: 0.5 });
  page.caption('ONE CITY.', { x: 404, y: 30, at: GROW + 0.6, tilt: -1 });
  page.smudge(300, 20, { length: 7, angle: 1.9 });
  page.thumbprint(26, 348);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
