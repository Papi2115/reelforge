export const meta = {
  id: 's08',
  title: 'Memory counter stops at 4 MB',
  treatment: 'counter/odometer',
};

export function build(ctx) {
  const { kit, palette, anchor, sfx } = ctx;
  const stage = kit.env.studio({ floor: palette.ground, glow: palette.accent2 });
  const prop = kit.props.odometer({ digits: 2, color: palette.accent1 }).on(stage);
  const hit = anchor('4 megabytes');
  sfx.at(hit.t, 'tick');
  return { stage, prop, hit };
}

export function update(t, s, ctx) {
  const progress = ctx.ease.easeOutCubic(Math.min(1, t / Math.max(s.hit.t, 0.001)));
  s.prop.setValue(Math.round(progress * 4));
  ctx.text.kinetic('4 MB', { from: s.hit.t, to: ctx.shot.duration });
  ctx.camera.orbit({ target: s.prop, radius: 7 - progress * 2, angle: 0.4 + t * 0.05 })(t);
}
