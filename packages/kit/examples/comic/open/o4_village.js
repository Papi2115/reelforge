// Comic look A (comic-story), open vocabulary 4 of 6: a medieval village.
// Narration: "Market day, 1350. The whole village came down from the hill: carts, geese, and a
// baker shouting, 'Bread! Fresh bread!' over the church bells."
// Built only from the open layer: the goose is a duck preset recoloured (a new character from a
// generator's knobs), the baker a person preset, the square a backdrop of sky and cobbles; four
// beats with the first the most important, so the page is 4-l (the tall panel is the crowd).
// Focal: the baker's balloon, then DONG in the last panel.
// Traces: the crowd walking at different paces, geese out of step, the bell swinging on its own
// beat, a smudge in the gutter, the date pencilled in the margin, a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'co4',
  title: 'Comic open vocabulary: medieval village',
  treatment: 'character-scene',
};

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 404, anchor: ctx.anchor });
  ctx.scene.add(page);
  const { art } = page;
  const { seg } = page.util;
  art.defineCharacter('goose', {
    gen: 'bird',
    species: 'duck',
    head: 'paper',
    body: 'paper',
    wing: 'greyLight',
    pose: 'perch',
  });
  art.defineCharacter('baker', {
    gen: 'person',
    description: 'the baker: broad, flour-white shirt and kerchief, a basket of loaves',
    build: 'broad',
    outfit: 'shirt',
    top: 'paper',
    bottom: 'sepiaMid',
    hat: 'kerchief',
    hatColor: 'paper',
    skin: 'light',
    tool: 'basket',
    beard: true,
    seed: 12,
  });
  art.defineBackdrop('market-square', {
    layers: [
      { gen: 'sky', kind: 'day', horizon: 0.6, clouds: 2 },
      { gen: 'land', kind: 'cobbles', horizon: 0.6 },
    ],
  });
  const [hill, road, baker, bell] = page.layout(
    [
      { at: 0, weight: 2.2, backdrop: { preset: 'village', horizon: 0.5 } },
      { at: 1.7, weight: 1, backdrop: { preset: 'meadow', horizon: 0.55 } },
      { at: 3.4, weight: 1, backdrop: 'market-square' },
      {
        at: 5.4,
        weight: 1,
        backdrop: { preset: 'night', time: 'dusk', horizon: 0.9 },
        enter: 'slam',
      },
    ],
    { seed: 404 },
  );
  const [hx, hy, hw, hh] = hill.box;
  hill.draw((g, t) => {
    art.building(g, { x: hx + hw * 0.7, y: hy + hh * 0.44, kind: 'castle', size: hh * 0.2 });
    art.building(g, { x: hx + hw * 0.22, y: hy + hh * 0.56, kind: 'church', size: hh * 0.22 });
    art.crowd(g, {
      x0: hx + 10,
      x1: hx + hw - 10,
      y: hy + hh * 0.98,
      count: 8,
      rows: 2,
      size: hh * 0.32,
      seed: 4,
      t,
      poses: ['walk'],
      facing: 'right',
      outfits: ['robe', 'dress', 'coat', 'shirt'],
      hats: ['kerchief', 'hood', 'none', 'brim'],
    });
  });
  const [rx, ry, rw, rh] = road.box;
  road.draw((g, t) => {
    const x = rx + rw * 0.25 + (t - 1.7) * 18;
    art.vehicle(g, {
      x: x - rh * 0.4,
      y: ry + rh * 0.92,
      kind: 'cart',
      size: rh * 0.75,
      moving: true,
      t,
    });
    art.animal(g, {
      x: x + rh * 0.12,
      y: ry + rh * 0.95,
      species: 'horse',
      size: rh * 0.62,
      pose: 'walk',
      t,
      speed: 0.8,
    });
    for (let i = 0; i < 3; i += 1) {
      const step = Math.floor(t * 4 + i) % 2;
      art.draw(g, 'goose', {
        x: rx + rw * (0.66 + i * 0.1) + step * 2,
        y: ry + rh * (0.95 - (i % 2) * 0.05),
        size: rh * 0.32,
        flip: i === 1,
      });
    }
  });
  const [bx, by, bw, bh] = baker.box;
  baker.draw((g, t) => {
    art.building(g, { x: bx + bw * 0.22, y: by + bh * 0.62, kind: 'cottage', size: bh * 0.5 });
    art.object(g, { x: bx + bw * 0.72, y: by + bh * 0.98, kind: 'table', size: bh * 0.3 });
    for (let i = 0; i < 3; i += 1)
      art.object(g, {
        x: bx + bw * (0.64 + i * 0.08),
        y: by + bh * 0.72,
        kind: 'bread',
        size: bh * 0.08,
      });
    const shout = seg(t, 3.9, 4.1) > 0;
    art.draw(g, 'baker', {
      x: bx + bw * 0.42,
      y: by + bh * 1.02,
      size: bh * 0.82,
      pose: shout ? 'point' : 'hold',
      expression: shout ? 'surprised' : 'happy',
      t,
    });
  });
  const [lx, ly, lw, lh] = bell.box;
  bell.draw((g, t) => {
    // The bell swings about its crown: its base sits where the crown, turned by `swing`, hangs.
    const swing = Math.sin((t - 5.4) * 5) * 0.35;
    const [px, py, size] = [lx + lw * 0.5, ly + lh * 0.1, lh * 0.46];
    art.object(g, {
      x: px - size * Math.sin(swing),
      y: py + size * Math.cos(swing),
      kind: 'bell',
      size,
      angle: swing,
    });
    art.effect(g, {
      kind: 'motion',
      x: px - Math.sign(swing) * size * 0.45,
      y: py + size * 0.6,
      size: size * 0.5,
      angle: swing > 0 ? 0 : Math.PI,
      color: 'paper',
    });
  });
  page.caption('MARKET DAY, 1350.', { x: hx + 8, y: hy + 8, at: 0.4, tilt: -1 });
  page.balloon('BREAD! FRESH BREAD!', {
    x: bx + bw * 0.5,
    y: by + 26,
    at: 3.95,
    width: 110,
    tail: [bx + bw * 0.42 + bh * 0.82 * 0.06, by + bh * 1.02 - bh * 0.82 * 0.82],
  });
  page.sfx('DONG', {
    x: lx + lw * 0.5,
    y: ly + lh * 0.82,
    at: 5.8,
    size: 4,
    beats: [0, 0.1, 0.16, 0.3],
  });
  page.note('1350', { x: hx + 12, y: 349, at: 1.2 });
  page.smudge(rx - 6, ry + rh * 0.5, { at: 1.7 });
  page.thumbprint(622, 352);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
