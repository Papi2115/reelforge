export const meta = {
  id: 's04',
  title: 'Clock counter stops at 1 MHz',
  treatment: 'counter/odometer',
};

export function build(ctx) {
  const { kit, palette, anchor, sfx } = ctx;
  const stage = kit.env.studio({ floor: palette.ground, glow: palette.accent2 });
  const prop = kit.props.odometer({ digits: 4, color: palette.accent3 }).on(stage);
  const hit = anchor('jednego megaherca');
  sfx.at(hit.t, 'tick');
  return { stage, prop, hit };
}

export function update(t, s, ctx) {
  const progress = ctx.ease.easeOutCubic(Math.min(1, t / Math.max(s.hit.t, 0.001)));
  s.prop.setValue(Math.round(progress * 1024));
  ctx.text.kinetic('1 MHZ', { from: s.hit.t, to: ctx.shot.duration });
  ctx.camera.orbit({ target: s.prop, radius: 7 - progress * 2, angle: 0.4 + t * 0.05 })(t);
}
