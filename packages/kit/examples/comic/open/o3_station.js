// Comic look A (comic-story), open vocabulary 3 of 6: a space station.
// Narration: "Four hundred kilometres up, the station circles the Earth every ninety minutes.
// Inside, the crew float... and listen. Hsss: a leak."
// Built only from the open layer: the astronaut is a person preset (spacesuit, helmet), the
// station and the Earth come from the building and space generators, the module interior from
// the interior generator; page.layout with the last beat dominant, so the big panel is on the
// right and the page ends on it (3-up-l, mirrored).
// Focal: HSSSS and the steam from the seam, the astronaut's scared face turning to it.
// Traces: the crew tilted at different angles (no floor), the hiss letters off-beat, a warning
// lamp blinking on its own rhythm, a pencilled question in the margin, a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'co3',
  title: 'Comic open vocabulary: space station',
  treatment: 'character-scene',
};

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 403, anchor: ctx.anchor });
  ctx.scene.add(page);
  const { art } = page;
  const { seg } = page.util;
  art.defineCharacter('astronaut', {
    gen: 'person',
    description: 'a station crew member in a white suit and bubble helmet',
    outfit: 'spacesuit',
    top: 'paper',
    hat: 'helmet',
    skin: 'light',
    seed: 31,
  });
  art.defineBackdrop('orbit', { gen: 'space', planet: 'earth', stars: 60 });
  const [orbit, crew, leak] = page.layout(
    [
      { at: 0, weight: 1, backdrop: 'orbit' },
      { at: 1.8, weight: 1, backdrop: { preset: 'station' } },
      { at: 3.4, weight: 2.2, backdrop: { preset: 'station' }, enter: 'slam' },
    ],
    { seed: 403 },
  );
  const [ox, oy, ow, oh] = orbit.box;
  orbit.draw((g, t) => {
    art.building(g, {
      x: ox + ow * (0.38 + t * 0.02),
      y: oy + oh * 0.5,
      kind: 'station',
      size: oh * 0.5,
      angle: -0.15 + t * 0.01,
    });
  });
  const [cx, cy, cw, ch] = crew.box;
  crew.draw((g, t) => {
    const bob = Math.sin(t * 1.1) * 4;
    art.draw(g, 'astronaut', {
      x: cx + cw * 0.3,
      y: cy + ch * 0.92 + bob,
      size: ch * 0.62,
      pose: 'wave',
      angle: 0.25,
      t,
    });
    art.draw(g, 'astronaut', {
      x: cx + cw * 0.72,
      y: cy + ch * 0.8 - bob,
      size: ch * 0.55,
      pose: 'hold',
      tool: 'clipboard',
      flip: true,
      angle: -0.4,
      seed: 32,
      top: 'paper',
    });
  });
  const [lx, ly, lw, lh] = leak.box;
  leak.draw((g, t) => {
    const turn = seg(t, 4.3, 4.6, 'outBack');
    art.draw(g, 'astronaut', {
      x: lx + lw * 0.38,
      y: ly + lh * 1.15,
      size: lh * 1.05,
      pose: turn > 0.5 ? 'look-up' : 'hold',
      expression: turn > 0.5 ? 'scared' : 'neutral',
      flip: turn > 0.5,
      angle: 0.08,
      t,
    });
    art.effect(g, {
      kind: 'steam',
      x: lx + lw * 0.86,
      y: ly + lh * 0.42,
      size: lh * 0.5,
      color: 'paper',
      t,
      count: 4,
    });
    if (Math.floor(t * 2.5) % 2 === 0)
      art.icon(g, { kind: 'warning', x: lx + lw * 0.86, y: ly + lh * 0.16, size: 28 });
  });
  page.caption('400 KM UP.', { x: ox + 8, y: oy + 8, at: 0.4, tilt: -1 });
  page.caption('INSIDE, THE CREW FLOAT...', { x: cx + 8, y: cy + 6, at: 2.1 });
  page.sfx('HSSSS', {
    x: lx + lw * 0.66,
    y: ly + lh * 0.3,
    at: 3.9,
    size: 5,
    fill: 'paper',
    shade: 'cyan',
    beats: [0, 0.12, 0.2, 0.36, 0.44],
    angles: [-0.12, 0.05, -0.02, 0.08, 0.14],
    rise: [6, -2, 3, -4, 0],
  });
  page.note('A LEAK?', { x: lx + 20, y: 347, at: 5.4 });
  page.thumbprint(620, 352);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
