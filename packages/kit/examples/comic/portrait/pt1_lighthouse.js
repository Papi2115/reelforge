// Comic portrait (9:16 short, look comic-story), 1 of 3: a tall splash over a strip of two.
// Narration: "November 1952. The storm put the lighthouse out, and the keeper saw the ship
// coming straight for the rocks."
// Layout: 'splash-strip' on the 360x640 page (PLAN.md#13.18): the lighthouse in the storm fills
// the tall splash, then the keeper and the ship slam in side by side below it.
// Focal: the dark lighthouse (no beam) against the storm, then CRASH on the rocks.
// Traces: the pencil rough before the strip, a pencilled margin note, a thumbprint, a smudge.
// Lettering in the safe box (central 80 %, below the top 12 %, above the bottom 20 %).
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cpt1',
  title: 'Comic portrait: the dark lighthouse',
  treatment: 'character-scene',
};

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 611, anchor: ctx.anchor, duration: ctx.shot.duration });
  ctx.scene.add(page);
  const { art } = page;
  const { seg } = page.util;
  const [splash, keeper, ship] = page.panels('splash-strip', { weights: [0.62, 0.48] });
  const [sx, sy, sw, sh] = splash.box;
  splash.draw((g, t) => {
    art.backdrop(g, { preset: 'ocean', time: 'night', horizon: 0.62, box: [sx, sy, sw, sh], t });
    art.sky(g, { kind: 'storm', box: [sx, sy, sw, sh * 0.62], horizon: 1, t });
    art.building(g, { kind: 'lighthouse', x: sx + sw * 0.32, y: sy + sh * 0.78, size: 250 });
    art.vehicle(g, { kind: 'ship', x: sx + sw * 0.8, y: sy + sh * 0.7, size: 70, flip: true });
    art.effect(g, { kind: 'rain', box: [sx, sy, sw, sh], t });
    // The wave hits on its beat.
    const hit = seg(t, 1.2, 1.6, 'outQuad');
    if (hit > 0) {
      art.effect(g, {
        kind: 'impact',
        x: sx + sw * 0.5,
        y: sy + sh * 0.84,
        size: 70,
        progress: hit,
      });
    }
  });
  const [kx, ky, kw, kh] = keeper.box;
  keeper.enter({ at: 2.2, kind: 'slam', rough: true }).draw((g, t) => {
    art.backdrop(g, { preset: 'room', box: [kx, ky, kw, kh] });
    art.person(g, {
      x: kx + kw * 0.5,
      y: ky + kh - 2,
      size: kh * 0.8,
      pose: 'point',
      expression: 'scared',
      hat: 'cap',
      outfit: 'coat',
      tool: 'lantern',
      t,
    });
  });
  const [px, py, pw, ph] = ship.box;
  ship.enter({ at: 3.3, kind: 'pop' }).draw((g, t) => {
    art.backdrop(g, { preset: 'ocean', time: 'night', horizon: 0.5, box: [px, py, pw, ph], t });
    art.vehicle(g, {
      kind: 'ship',
      x: px + pw * 0.5,
      y: py + ph * 0.7,
      size: pw * 0.9,
      moving: true,
      t,
    });
  });
  page.caption('NOVEMBER, 1952.', { x: 150, y: 96, at: 0.2, tilt: -1 });
  page.sfx('CRASH', {
    x: 190,
    y: 330,
    at: 1.2,
    size: 6,
    beats: [0, 0.06, 0.14, 0.19, 0.29],
    angles: [-0.1, 0.07, -0.04, 0.1, -0.06],
  });
  page.balloon('THE LIGHT IS OUT!', {
    x: 130,
    y: 372,
    at: 2.6,
    tail: [kx + kw * 0.56, ky + kh * 0.36],
  });
  page.note('NO BEAM', { x: 214, y: 150, at: 1.8, dur: 0.4 });
  page.arrow([210, 160], [150, 190], { at: 2.0 });
  page.thumbprint(330, 610);
  page.smudge(180, 405);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
