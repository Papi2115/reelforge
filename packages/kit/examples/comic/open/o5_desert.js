// Comic look C (comic-loud), open vocabulary 5 of 6: the desert.
// Narration: "Noon in the Sonoran desert. The sand is hot enough to burn. The hiker's canteen is
// empty... and the rattlesnake doesn't care."
// Built only from the open layer: the hiker is a person preset, the saguaros, the vulture, the
// canteen (a bottle turned over) and the rattlesnake come from the generators; three beats of
// equal-ish weight make a strip, the outer columns wider; reveal 'beats': the panels enter on
// their beats over their pencil roughs. The loud beat is the last: a slam, the snake striking,
// RATTLE breaking the frame.
// Focal: the snake's open strike and RATTLE (the snake's tongue is the only red).
// Traces: heat haze wobbling over the sand, the vulture circling off-centre, the last drop
// falling out of the canteen, the letters off-square on uneven beats, a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'co5',
  title: 'Comic open vocabulary: desert',
  treatment: 'character-scene',
};

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 405, anchor: ctx.anchor });
  ctx.scene.add(page);
  const { art } = page;
  const { seg } = page.util;
  art.defineCharacter('hiker', {
    gen: 'person',
    description: 'a hiker: sun hat, blue shirt, worn out',
    hat: 'brim',
    hatColor: 'yellowPale',
    outfit: 'shirt',
    top: 'cyan',
    bottom: 'sepiaTan',
    skin: 'brown',
    hair: 'curly',
    seed: 21,
  });
  art.defineCharacter('rattlesnake', { gen: 'reptile', kind: 'snake', fill: 'aged' });
  const [wide, canteen, strike] = page.layout(
    [
      { at: 0, weight: 1.5, backdrop: { preset: 'desert', horizon: 0.55 } },
      { at: 2.2, weight: 1, backdrop: { preset: 'desert', horizon: 0.3 } },
      {
        at: 4.1,
        weight: 1.5,
        backdrop: { preset: 'desert', horizon: 0.42, seed: 7 },
        enter: 'slam',
      },
    ],
    { seed: 405, reveal: 'beats' },
  );
  const [wx, wy, ww, wh] = wide.box;
  wide.draw((g, t) => {
    art.cactus(g, { x: wx + ww * 0.2, y: wy + wh * 0.92, size: wh * 0.55, seed: 1 });
    art.cactus(g, { x: wx + ww * 0.82, y: wy + wh * 0.7, size: wh * 0.24, seed: 2 });
    art.cactus(g, { x: wx + ww * 0.6, y: wy + wh * 0.9, kind: 'barrel', size: wh * 0.12 });
    art.draw(g, 'hiker', {
      x: wx + ww * 0.52 + t * 3,
      y: wy + wh * 0.74,
      size: wh * 0.2,
      pose: 'walk',
      t,
      speed: 0.6,
    });
    art.effect(g, {
      kind: 'steam',
      x: wx + ww * 0.4,
      y: wy + wh * 0.66,
      size: wh * 0.16,
      color: 'yellowPale',
      t,
    });
    const a = t * 0.7;
    art.bird(g, {
      x: wx + ww * (0.5 + Math.cos(a) * 0.22),
      y: wy + wh * (0.2 + Math.sin(a) * 0.05),
      species: 'vulture',
      pose: 'glide',
      size: wh * 0.12,
      flip: Math.sin(a) > 0,
    });
  });
  const [cx, cy, cw, ch] = canteen.box;
  canteen.draw((g, t) => {
    // The hiker holds the canteen upside down at arm's length: the hands sit at 0.17 / -0.64 of
    // the figure's height, the canteen hangs from them mouth down, the last drop falls out.
    const [hx, hy, size] = [cx + cw * 0.3, cy + ch * 0.97, ch * 0.78];
    art.draw(g, 'hiker', { x: hx, y: hy, size, pose: 'hold', expression: 'sad' });
    art.effect(g, { kind: 'sweat', x: hx + size * 0.02, y: hy - size * 0.86, size: size * 0.2, t });
    const [fx, fy, fs] = [hx + size * 0.19, hy - size * 0.66, size * 0.22];
    art.object(g, { x: fx, y: fy, kind: 'flask', size: fs, angle: Math.PI });
    const fall = seg(t, 2.9, 3.5, 'inQuad');
    if (fall < 1) art.icon(g, { kind: 'drop', x: fx, y: fy + fs + 8 + fall * ch * 0.25, size: 12 });
  });
  const [sx, sy, sw, sh] = strike.box;
  strike.draw((g, t) => {
    const lunge = seg(t, 4.3, 4.55, 'outBack');
    art.draw(g, 'rattlesnake', {
      x: sx + sw * (0.38 + lunge * 0.08),
      y: sy + sh * 0.9,
      size: sw * 0.8,
      pose: lunge > 0 ? 'strike' : 'still',
      t: lunge > 0 ? 0 : t,
    });
    // A rearing snake's head sits at about 0.29 / -0.42 of its length from where it lies.
    const [sx0, size] = [sx + sw * (0.38 + lunge * 0.08), sw * 0.8];
    if (lunge > 0)
      art.effect(g, {
        kind: 'emphasis',
        x: sx0 + size * 0.3,
        y: sy + sh * 0.9 - size * 0.42,
        size: sw * 0.42,
      });
    art.reptile(g, {
      x: sx + sw * 0.85,
      y: sy + sh * 0.98,
      kind: 'lizard',
      size: sw * 0.25,
      pose: 'crawl',
      flip: true,
      t,
    });
  });
  page.caption('NOON. THE SONORAN DESERT.', { x: wx + 8, y: wy + 8, at: 0.3, width: 150 });
  page.caption('EMPTY.', { x: cx + 6, y: cy + 8, at: 2.6, tilt: 2 });
  page.sfx('RATTLE', {
    x: sx + sw * 0.5,
    y: sy + 16,
    at: 4.4,
    size: 5,
    beats: [0, 0.06, 0.1, 0.19, 0.24, 0.33],
    angles: [-0.15, 0.08, -0.05, 0.12, -0.1, 0.06],
    rise: [-4, 3, -2, 5, -3, 2],
  });
  page.shake(4.35, 5, 0.14);
  page.thumbprint(20, 352);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
