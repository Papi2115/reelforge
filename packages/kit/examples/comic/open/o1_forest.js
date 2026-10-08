// Comic look A (comic-story), open vocabulary 1 of 6: a forest (far from the showcase's Moon).
// Narration: "At first light the ranger walks the old pine forest. Something moves. A red deer
// freezes in the ferns... then a woodpecker starts drumming."
// Built only from the open layer: the film's own things live in its asset file
// (open/assets/comic/forest.json: the ranger, the red deer, the woodpecker, a fern, the bark, the
// pine forest at dawn), loaded once; the page comes from page.layout(beats) - three beats, the
// first the most important, so the tall panel is the walk and the others stack beside it.
// Focal: the deer's head turning toward the reader (emphasis marks), then TOK TOK TOK.
// Traces: the ranger's walk drawn with the boil of the ink, ferns that differ, the drumming
// letters off-beat breaking the frame, a pencilled question in the margin, a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'co1',
  title: 'Comic open vocabulary: forest',
  treatment: 'character-scene',
};

/** The film's asset file (in a project assets/comic/forest.json; here open/assets/...). */
const FOREST = {
  version: 1,
  world: 'comic',
  characters: {
    ranger: {
      gen: 'person',
      description: 'the park ranger: brimmed hat, green shirt, binoculars',
      hat: 'brim',
      hatColor: 'sepiaMid',
      outfit: 'shirt',
      top: 'phosphor',
      bottom: 'sepiaMid',
      skin: 'tan',
      hair: 'short',
      hairColor: 'ink',
      tool: 'binoculars',
      seed: 7,
    },
    'red-deer': {
      gen: 'animal',
      description: 'a red deer stag',
      species: 'deer',
      fill: 'sepiaTan',
      belly: 'shade',
      seed: 3,
    },
    woodpecker: {
      gen: 'bird',
      description: 'a great spotted woodpecker clinging to bark',
      species: 'woodpecker',
      pose: 'perch',
      angle: -1.25,
    },
  },
  props: {
    fern: {
      description: 'a fern clump: three fronds with a midrib each',
      height: 100,
      parts: [
        {
          shape: 'poly',
          pts: [0, 0, -48, -46, -70, -64, -40, -52, -6, -10],
          fill: 'phosphor',
          shade: 0.5,
          shadeInk: 'cyanDeep',
        },
        {
          shape: 'poly',
          pts: [0, 0, 44, -50, 64, -74, 36, -58, 6, -12],
          fill: 'phosphor',
          shade: 0.5,
          shadeInk: 'cyanDeep',
        },
        {
          shape: 'poly',
          pts: [-4, 0, -12, -60, 0, -100, 10, -62, 6, 0],
          fill: 'phosphor',
          shade: 0.4,
          shadeInk: 'cyanDeep',
        },
        { shape: 'line', pts: [0, 0, -30, -36, -66, -62], w: 1.4, color: 'cyanDeep' },
        { shape: 'line', pts: [0, 0, 30, -40, 60, -70], w: 1.4, color: 'cyanDeep' },
        { shape: 'line', pts: [0, 0, -2, -50, 0, -96], w: 1.4, color: 'cyanDeep' },
      ],
    },
    bark: {
      description: 'a close-up of a pine trunk with furrowed bark',
      height: 360,
      parts: [
        {
          shape: 'rect',
          at: [-70, -380],
          size: [140, 380],
          fill: 'sepiaMid',
          shade: 0.5,
          hatch: { gap: 9, angle: 1.5, color: 'sepiaInk' },
        },
        { shape: 'line', pts: [-40, -380, -46, -240, -38, -120, -44, 0], w: 2, color: 'ink' },
        { shape: 'line', pts: [20, -380, 26, -260, 18, -140, 24, 0], w: 2, color: 'ink' },
        { shape: 'ellipse', at: [-6, -200], r: [9, 14], fill: 'ink', outline: false },
      ],
    },
  },
  backdrops: {
    'pine-dawn': {
      description: 'the old pine forest at first light',
      layers: [
        { gen: 'sky', kind: 'dawn', horizon: 0.7, sun: true, clouds: 1 },
        { gen: 'hills', horizon: 0.7, layers: 1, fill: 'greyLight' },
        { gen: 'forest', horizon: 0.8, rows: 2, kind: 'pine' },
        { gen: 'land', horizon: 0.8, kind: 'meadow' },
      ],
    },
  },
};

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 401, anchor: ctx.anchor });
  ctx.scene.add(page);
  const { art } = page;
  const { seg } = page.util;
  art.load(FOREST, 'assets/comic/forest.json');
  const [walk, deer, drum] = page.layout(
    [
      { at: 0, weight: 2, backdrop: 'pine-dawn' },
      { at: 2.1, weight: 1, backdrop: 'pine-dawn', enter: 'slam' },
      { at: 4.2, weight: 1, backdrop: { preset: 'forest', time: 'dawn' }, enter: 'slide' },
    ],
    { seed: 401 },
  );
  const [wx, wy, ww, wh] = walk.box;
  const ground = wy + wh * 0.86;
  walk.draw((g, t) => {
    art.tree(g, { x: wx + 18, y: ground + 6, kind: 'pine', size: wh * 0.95, seed: 2 });
    // The ranger walks in, then stops dead when something moves (2.0 s) and looks.
    const stop = Math.min(t, 2);
    art.draw(g, 'ranger', {
      x: wx + ww * 0.3 + stop * 22,
      y: ground,
      size: wh * 0.52,
      pose: t < 2 ? 'walk' : 'look-up',
      expression: t < 2 ? 'neutral' : 'surprised',
      t,
    });
    for (const [u, s, seed] of [
      [0.08, 0.2, 1],
      [0.62, 0.26, 2],
      [0.86, 0.18, 3],
    ]) {
      art.draw(g, 'fern', { x: wx + ww * u, y: wy + wh + 6, size: wh * s, flip: seed === 2 });
    }
    art.grass(g, { x0: wx, x1: wx + ww, y: wy + wh, height: 9, seed: 4 });
  });
  const [dx, dy, dw, dh] = deer.box;
  deer.draw((g, t) => {
    const look = seg(t, 2.5, 2.8, 'outBack');
    art.draw(g, 'red-deer', {
      x: dx + dw * 0.52,
      y: dy + dh * 0.95,
      size: dh * 0.66,
      pose: look > 0.5 ? 'alert' : 'graze',
      flip: true,
    });
    if (look > 0) {
      art.effect(g, {
        kind: 'emphasis',
        x: dx + dw * 0.36,
        y: dy + dh * 0.42,
        size: dh * 0.42 * look,
      });
    }
    art.draw(g, 'fern', { x: dx + dw * 0.18, y: dy + dh + 4, size: dh * 0.45, seed: 5 });
    art.draw(g, 'fern', { x: dx + dw * 0.82, y: dy + dh + 4, size: dh * 0.38, flip: true });
  });
  const [bx, by, bw, bh] = drum.box;
  drum.draw((g, t) => {
    art.draw(g, 'bark', { x: bx + bw * 0.42, y: by + bh + 8, size: bh + 20 });
    const knock = Math.floor(t * 8) % 2 === 0 ? 0 : 3;
    art.draw(g, 'woodpecker', {
      x: bx + bw * 0.42 + 26 + knock,
      y: by + bh * 0.62,
      size: bh * 0.3,
    });
    if (t > 4.6)
      art.effect(g, { kind: 'impact', x: bx + bw * 0.42 + 12, y: by + bh * 0.4, size: 26 });
  });
  page.caption('AT FIRST LIGHT...', { x: wx + 10, y: wy + 8, at: 0.3, tilt: -1 });
  page.caption('SOMETHING MOVES.', { x: dx + 8, y: dy + 6, at: 2.3, tilt: 1 });
  page.sfx('TOK TOK TOK', {
    x: bx + bw * 0.45,
    y: by + 10,
    at: 4.6,
    size: 3,
    beats: [0, 0.08, 0.15, 0.27, 0.34, 0.42, 0.55, 0.62, 0.7, 0.77, 0.86],
    angles: [-0.08, 0.04, 0.1, 0, -0.1, 0.05, -0.02, 0, 0.08, -0.05, 0.03],
    rise: [-3, 2, -2, 0, 3, -2, 1, 0, -3, 2, 0],
  });
  page.note('A RED DEER!', { x: dx + 12, y: 349, at: 3.1 });
  page.thumbprint(622, 352);
  page.smudge(wx + ww + 4, wy + wh * 0.6, { at: 2.1 });
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
