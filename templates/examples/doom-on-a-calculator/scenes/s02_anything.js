// s02 · kinetic-text: "Fridges, watches, even a printer." Each item pops in on its spoken word
// with a burst of voxel shards in the dark void; the camera drifts around the bursts.
export const meta = { id: 's02', title: 'Fridges, watches, printers', treatment: 'kinetic-text' };

const ITEMS = [
  { phrase: 'Fridges', text: 'FRIDGES,', origin: [-2.2, 1.6, 0], color: 'accent3' },
  { phrase: 'watches', text: 'WATCHES,', origin: [0, 1.2, -1], color: 'accent1' },
  { phrase: 'even a printer', text: 'EVEN A PRINTER', origin: [2.2, 1.6, 0], color: 'hero' },
];

export function build(ctx) {
  const { kit, scene, three, palette, anchor, sfx } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: 'dramatic' }));
  const stage = kit.env.void({ seed: 4, cubes: 40, shards: 20, clear: 2.5 });
  scene.add(stage);
  const bursts = ITEMS.map((item, index) => {
    const at = anchor(item.phrase).t;
    sfx.at(at, 'pop');
    const burst = kit.fx.shardExplosion({
      origin: item.origin,
      at,
      count: 60,
      seed: index + 1,
      spread: 1,
      speed: [1.5, 4],
      gravity: 2,
      floor: null,
      colors: [item.color, 'heroTrim', 'text'],
    });
    scene.add(burst);
    return burst;
  });
  const words = ITEMS.map((item) => ({ text: item.text, t: anchor(item.phrase).t }));
  return { stage, bursts, words };
}

export function update(t, s, ctx) {
  ctx.camera.orbit({
    target: [0, 1.4, 0],
    radius: 8,
    height: 0.8,
    degrees: [-14, 14],
    ease: 'easeInOutSine',
  })(t);
  s.stage.update(t);
  s.bursts.forEach((burst) => burst.update(t));
  ctx.text.kinetic(s.words, {
    id: 'list',
    scale: 4,
    style: 'pop',
    highlight: 'hero',
    maxWidth: 0.8,
  });
}
