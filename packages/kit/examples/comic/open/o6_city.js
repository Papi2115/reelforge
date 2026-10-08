// Comic look B (comic-info), open vocabulary 6 of 6: the city.
// Narration: "Rush hour. Eight million people live in this city, and at six o'clock most of them
// want the same crossing. Then the light turns red."
// Built only from the open layer: the traffic light is spot art (two sprites from the same rows,
// lit green or lit red: a prop defined with the sprite DSL), the zebra crossing is shape parts,
// the crowd, cars and skyline come from the generators; four equal beats make an uneven 4-grid.
// Focal: the light turning red (the only red on the page) and the crowd stopping dead.
// Traces: rain over everything, the crowd at different paces, BEEP letters off-square, a
// pencilled count in the margin, a smudge in the gutter, a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'co6',
  title: 'Comic open vocabulary: city',
  treatment: 'data-chart-3d',
};

const LIGHT_ROWS = [
  '.#####.',
  '#DDDDD#',
  '#DRRRD#',
  '#DRRRD#',
  '#DDDDD#',
  '#DYYYD#',
  '#DYYYD#',
  '#DDDDD#',
  '#DGGGD#',
  '#DGGGD#',
  '#DDDDD#',
  '.#####.',
  '...P...',
  '...P...',
  '...P...',
  '...P...',
  '...P...',
];

function light(lit) {
  return {
    description: `a traffic light, ${lit === 'R' ? 'red' : 'green'} lit`,
    sprite: {
      rows: LIGHT_ROWS,
      px: 6,
      legend: {
        '#': 'ink',
        D: 'greyDark',
        R: lit === 'R' ? 'red' : 'night',
        Y: 'night',
        G: lit === 'G' ? 'phosphor' : 'night',
        P: 'greyMid',
      },
    },
  };
}

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 406, anchor: ctx.anchor });
  ctx.scene.add(page);
  const { art } = page;
  art.defineProp('light-go', light('G'));
  art.defineProp('light-stop', light('R'));
  art.defineProp('zebra', {
    description: 'a zebra crossing seen at a slant',
    height: 40,
    parts: [0, 1, 2, 3, 4, 5].map((i) => ({
      shape: 'poly',
      pts: [-120 + i * 44, 0, -96 + i * 44, 0, -84 + i * 40, -40, -104 + i * 40, -40],
      fill: 'paper',
      outline: 1,
    })),
  });
  art.defineBackdrop('street', {
    layers: [
      { gen: 'sky', kind: 'dusk', horizon: 0.45 },
      { gen: 'skyline', horizon: 0.45, height: 0.5, lit: true },
      { gen: 'land', kind: 'road', horizon: 0.45 },
    ],
  });
  const RED = 4.4;
  const [skyline, crossing, lamp, stop] = page.layout(
    [
      { at: 0, backdrop: { preset: 'city', time: 'dusk', horizon: 0.78 } },
      { at: 1.5, backdrop: 'street' },
      { at: 3, backdrop: 'street', enter: 'slide' },
      { at: RED + 0.2, backdrop: 'street', enter: 'slam' },
    ],
    { seed: 406 },
  );
  const [sx, sy, sw, sh] = skyline.box;
  skyline.draw((g, t) => {
    art.object(g, {
      x: sx + sw * 0.8,
      y: sy + sh * 0.5,
      kind: 'clock',
      size: sh * 0.36,
      t: t * 0.4 + 18.9,
    });
    art.effect(g, { kind: 'rain', box: [sx, sy, sw, sh], t, count: 40 });
  });
  const [cx, cy, cw, ch] = crossing.box;
  crossing.draw((g, t) => {
    art.draw(g, 'zebra', { x: cx + cw * 0.5, y: cy + ch * 0.92, size: ch * 0.3 });
    art.crowd(g, {
      x0: cx + cw * 0.05 + t * 6,
      x1: cx + cw * 0.95 + t * 6,
      y: cy + ch * 0.95,
      count: 10,
      rows: 3,
      size: ch * 0.5,
      seed: 6,
      t,
      poses: ['walk'],
      facing: 'mixed',
      hats: ['none', 'cap', 'none', 'beanie'],
      outfits: ['coat', 'suit', 'shirt', 'dress'],
    });
    art.effect(g, { kind: 'rain', box: [cx, cy, cw, ch], t, count: 40, seed: 2 });
  });
  const [lx, ly, lw, lh] = lamp.box;
  lamp.draw((g, t) => {
    art.draw(g, t < RED ? 'light-go' : 'light-stop', {
      x: lx + lw * 0.5,
      y: ly + lh * 1.02,
      size: lh * 0.9,
    });
    if (t >= RED)
      art.effect(g, {
        kind: 'emphasis',
        x: lx + lw * 0.5,
        y: ly + lh * 0.3,
        size: lh * 0.36,
        color: 'red',
      });
  });
  const [px, py, pw, ph] = stop.box;
  stop.draw((g, t) => {
    // The traffic gets the road: a bus rolls through behind the people stopped at the kerb.
    art.vehicle(g, {
      x: px + pw * 0.62 + (t - RED) * 50,
      y: py + ph * 0.66,
      kind: 'bus',
      size: pw * 0.5,
      moving: true,
      t,
    });
    art.crowd(g, {
      x0: px + pw * 0.02,
      x1: px + pw * 0.42,
      y: py + ph * 1.06,
      count: 4,
      rows: 1,
      size: ph * 0.62,
      seed: 9,
      poses: ['stand', 'slump'],
      facing: 'right',
      expression: 'angry',
    });
    art.effect(g, { kind: 'rain', box: [px, py, pw, ph], t, count: 30, seed: 3 });
  });
  page.caption('RUSH HOUR.', { x: sx + 8, y: sy + 8, at: 0.3, tilt: -1 });
  page.caption('EIGHT MILLION PEOPLE.', { x: cx + 6, y: cy + 6, at: 1.8, width: 160 });
  page.caption('THEN THE LIGHT TURNS RED.', {
    x: lx + 6,
    y: ly + 6,
    at: RED,
    width: Math.min(140, lw - 12),
  });
  page.sfx('BEEP', {
    x: px + pw * 0.7,
    y: py + 22,
    at: RED + 0.6,
    size: 4,
    beats: [0, 0.07, 0.11, 0.2],
  });
  page.note('8 000 000?', { x: cx + cw - 80, y: 349, at: 2.6 });
  page.smudge(lx - 6, ly + lh * 0.5, { at: 3 });
  page.thumbprint(20, 352);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
