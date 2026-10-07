// Comic look B (comic-info), open vocabulary 2 of 6: the deep ocean.
// Narration: "Two hundred metres down, the sunlight is gone. Down here most animals make their
// own light: the anglerfish dangles a glowing lure, and a jellyfish flashes in the dark."
// Built only from the open layer: a water-column backdrop and the deep defined as backdrops,
// the anglerfish and the jellyfish as characters (fish generator presets), the depth marker as a
// sign; page.layout with the anglerfish as the dominant middle beat (a strip, middle widest).
// Focal: the anglerfish's lure (the only pale-yellow light on a dark page), then the jellyfish.
// Traces: the sounding line drawn down, marine snow drifting, the lure light pulsing on its own
// beat, the jellyfish flashing in uneven steps, a pencilled question in the margin, a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'co2',
  title: 'Comic open vocabulary: ocean',
  treatment: '3d-reconstruction',
};

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 402, anchor: ctx.anchor, duration: 8 });
  ctx.scene.add(page);
  const { art } = page;
  const { seg } = page.util;
  art.defineBackdrop('water-column', {
    description: 'the sea from the surface down, darker with depth',
    layers: [
      { gen: 'sky', kind: 'day', horizon: 0.16, clouds: 1 },
      { gen: 'sea', horizon: 0.16, waves: 5, fill: 'cyan' },
    ],
  });
  art.defineBackdrop('the-deep', {
    description: 'no sunlight: dark water and drifting marine snow',
    gen: 'sky',
    kind: 'space',
    stars: 36,
  });
  art.defineCharacter('anglerfish', { gen: 'fish', kind: 'anglerfish', fill: 'sepiaMid' });
  art.defineCharacter('jelly', { gen: 'fish', kind: 'jellyfish', fill: 'cyan' });
  const [column, angler, jelly] = page.layout(
    [
      { at: 0, weight: 1, backdrop: 'water-column' },
      { at: 2.3, weight: 2.2, backdrop: 'the-deep', enter: 'slam' },
      { at: 5.1, weight: 1, backdrop: 'the-deep' },
    ],
    { seed: 402 },
  );
  const [cx, cy, cw, ch] = column.box;
  column.draw((g, t) => {
    // The light fails with depth: a halftone of night thickening toward the bottom.
    art.shape(g, {
      shape: 'rect',
      at: [cx - 4, cy + ch * 0.45],
      size: [cw + 8, ch * 0.6],
      fill: 'cyanDeep',
      shade: 0.9,
      shadeInk: 'night',
      outline: false,
    });
    art.shape(g, {
      shape: 'rect',
      at: [cx - 4, cy + ch * 0.72],
      size: [cw + 8, ch * 0.3],
      fill: 'night',
      outline: false,
    });
    art.vehicle(g, { x: cx + cw * 0.5, y: cy + ch * 0.17, kind: 'boat', size: cw * 0.5 });
    const down = seg(t, 0.4, 1.8, 'outQuad');
    art.shape(g, {
      shape: 'line',
      pts: [cx + cw * 0.5, cy + ch * 0.17, cx + cw * 0.5, cy + ch * (0.17 + 0.68 * down)],
      w: 1.5,
      color: 'paper',
    });
    art.fish(g, {
      x: cx + cw * 0.3,
      y: cy + ch * 0.32,
      kind: 'fish',
      size: 30,
      fill: 'greyLight',
      t,
    });
    art.fish(g, { x: cx + cw * 0.7, y: cy + ch * 0.38, kind: 'tropical', size: 26, flip: true, t });
    if (down >= 1)
      art.sign(g, {
        x: cx + cw * 0.5,
        y: cy + ch * 0.97,
        kind: 'plaque',
        text: '200 M',
        size: 40,
        fill: 'yellowPale',
      });
  });
  const [ax, ay, aw, ah] = angler.box;
  angler.camera([
    { at: 2.3, x: ax + aw * 0.5, y: ay + ah * 0.5, zoom: 1.12 },
    { at: 7.5, x: ax + aw * 0.55, y: ay + ah * 0.45, zoom: 1, ease: 'inOutSine' },
  ]);
  angler.draw((g, t) => {
    const [fx, fy, size] = [ax + aw * 0.4 + Math.sin(t * 0.8) * 6, ay + ah * 0.6, aw * 0.72];
    art.draw(g, 'anglerfish', { x: fx, y: fy, size, t });
    // The lure hangs at 0.47 / -0.38 of the fish's length from its centre.
    const pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 2.4));
    art.effect(g, {
      kind: 'sparkle',
      x: fx + size * 0.47,
      y: fy - size * 0.38,
      size: 46 * pulse,
      seed: 1,
      t,
    });
    art.effect(g, { kind: 'bubbles', x: ax + aw * 0.2, y: ay + ah * 0.7, size: 60, t });
  });
  const [jx, jy, jw, jh] = jelly.box;
  jelly.draw((g, t) => {
    const drift = Math.sin(t * 0.9) * 5;
    const flash = Math.floor((t - 5.1) * 3) % 3 === 0;
    if (flash)
      art.effect(g, {
        kind: 'emphasis',
        x: jx + jw * 0.5,
        y: jy + jh * 0.34 + drift,
        size: jw * 0.9,
        color: 'cyan',
      });
    art.draw(g, 'jelly', {
      x: jx + jw * 0.5,
      y: jy + jh * 0.32 + drift,
      size: jw * 0.55,
      t,
      fill: flash ? 'cyan' : 'magenta',
    });
  });
  page.caption('TWO HUNDRED METRES DOWN.', {
    x: cx + 6,
    y: cy + ch * 0.5,
    at: 0.6,
    width: Math.min(150, cw - 12),
  });
  page.caption('MOST ANIMALS MAKE THEIR OWN LIGHT.', {
    x: ax + 10,
    y: ay + 8,
    at: 2.7,
    width: 200,
  });
  page.note('A LURE?', { x: ax + aw - 96, y: 349, at: 4.2 });
  page.thumbprint(24, 350);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
