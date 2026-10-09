// Portrait example (PLAN.md#13.18): a 9:16 frame (360x640 in Crisp 640, exported 1080x1920) for
// YouTube Shorts. One subject stacked vertically: a skyscraper rising behind a waving hero, the
// camera craning up the facade, a short headline in the top third (the Shorts player covers the
// bottom fifth and the right edge). Reads ctx.shot.format, so it also frames sanely in 16:9.
// Follows the scene contract: no imports, update() sets everything absolutely from t.
export const meta = { id: 'k12', title: 'Portrait 9:16 demo', treatment: 'metaphor-object' };

export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  scene.background = new three.Color(palette.sky);
  scene.add(kit.env.lights({ preset: 'dramatic' }));
  const sky = kit.env.sky({ style: 'dusk' });
  const floor = kit.env.neonGrid({ variant: 'violet', scroll: 0.6 });
  const tower = kit.props.tower({ floors: 14, setbacks: 2, windows: 0.6, seed: 3, scale: 0.16 });
  tower.position.set(0, 0, -2.5);
  const hero = kit.props.character({ variant: 'hero', pose: 'wave' });
  hero.position.set(0, 0, 1.2);
  scene.add(sky, floor, tower, hero);
  const portrait = ctx.shot.format === 'portrait';
  return { sky, floor, hero, portrait };
}

export function update(t, state, ctx) {
  state.sky.update(t);
  state.floor.update(t);
  state.hero.update(t);
  // Portrait: the hero at the bottom, the tower filling the height, a slow tilt up the facade.
  // Landscape: the same subject from the same place (the frame is wider, not taller).
  const position = state.portrait ? [1.2, 1.1, 11] : [1.6, 1.6, 9];
  ctx.camera.lookAt({
    position,
    target: [0, 2.3, 0],
    targetEnd: [0, 3.3, 0],
    to: 5,
    ease: 'easeInOutSine',
  })(t);
  ctx.text.title('GOING UP', { id: 'headline', pos: [0.5, 0.2], at: 0.4, enter: 'pop' });
}
