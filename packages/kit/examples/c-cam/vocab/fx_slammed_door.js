// Grim Ink vocabulary example (PLAN.md#14.20), fx: "and the door slammed behind her". A corridor
// end: the door swings shut on the beat (its swing is a number from t), slam lines fly off its
// edge, the frame shakes for 0.2 s, plaster dust puffs at the threshold and the lamp's light
// jumps. Every effect lives only in its own [t0, t0 + dur].
// focal: the door | fx: shake, shakeLines, dust | props: door, lamp | traces: the slam lines, the
// shake, a crack in the plaster.
// Scene contract: no imports; build() makes the stage and the cut table, update(t) repaints.
export const meta = { id: 'cv5', title: 'Grim Ink vocabulary: fx', treatment: 'metaphor-object' };

const SLAM = 2.0;

function cutTable() {
  return [
    { at: 0, name: 'corridor', x: 960, y: 560, z: 1.1 },
    { at: SLAM, name: 'door', x: 900, y: 560, z: 1.7, rot: 4 },
  ];
}

function paintShot(g, env, s) {
  const shake = env.ink.fx.shake({ t: env.t, t0: SLAM, px: 10, axis: 'both' });
  const cut = env.ink.resolveCut(s.cuts, env.t);
  const cam = env.ink.applyCamera(g, { ...cut, x: cut.x + shake[0], y: cut.y + shake[1] });
  const e = cam.env;
  env.ink.rect(g, e, -300, -300, 2520, 1110, env.C.PLASTER, {
    seed: 51,
    lw: 0,
    mottle: ['rgba(60,50,30,0.16)', 8, 60],
  });
  env.ink.rect(g, e, -300, 810, 2520, 600, env.C.BROWN_D, {
    seed: 52,
    lw: 0,
    hatch: { n: 10, len: 120, ang: 2 },
  });
  env.ink.crack(g, e, 1240, 260, 160, 53);
  const lamp = env.ink.props.lamp(g, e, { x: 1500, y: 80, kind: 'hanging', seed: 54 });
  if (lamp.light)
    env.ink.pool(g, lamp.light.x, lamp.light.y + 300, 700, 400, lamp.light.color, 0.08);
  const swing = env.time.key(env.time.twos(env.t), [
    [0, 0.8],
    [SLAM - 0.4, 0.8],
    [SLAM, 0, 'lin'],
  ]);
  const door = env.ink.props.door(g, e, {
    x: 900,
    y: 820,
    w: 260,
    h: 420,
    kind: 'plank',
    swing,
    wear: 0.6,
    seed: 55,
  });
  env.ink.fx.shakeLines(g, e, {
    x: door.points.handle[0] + 80,
    y: 460,
    t: env.t,
    t0: SLAM,
    kind: 'slam',
    dir: -1,
  });
  env.ink.fx.dust(g, e, { x: 900, y: 820, t: env.t, t0: SLAM, size: 0.45, spread: 0.6 });
}

export function build(ctx) {
  const stage = ctx.kit.fx.inkStage();
  ctx.scene.add(stage);
  return { stage, cuts: cutTable() };
}

export function update(t, s) {
  s.stage.paint(t, (g, env) => paintShot(g, env, s));
}
