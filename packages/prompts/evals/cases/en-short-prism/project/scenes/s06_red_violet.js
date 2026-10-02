export const meta = { id: 's06', title: 'Red bends least, violet most', treatment: 'kinetic-text' };

export function build(ctx) {
  const { kit, palette, anchor, sfx } = ctx;
  const stage = kit.env.studio({ floor: palette.ground, glow: palette.accent2 });
  const prop = kit.props.prism({ color: palette.accent4 }).on(stage);
  const hit = anchor('violet bends the most');
  sfx.at(hit.t, 'pop');
  return { stage, prop, hit };
}

export function update(t, s, ctx) {
  const progress = ctx.ease.easeOutCubic(Math.min(1, t / Math.max(s.hit.t, 0.001)));
  s.prop.setSpread(progress);
  ctx.text.kinetic('RED  VIOLET', { from: 0, to: ctx.shot.duration });
  ctx.camera.orbit({ target: s.prop, radius: 7 - progress * 2, angle: 0.4 + t * 0.05 })(t);
}
