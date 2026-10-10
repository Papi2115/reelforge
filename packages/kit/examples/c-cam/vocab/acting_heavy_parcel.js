// Grim Ink vocabulary example (PLAN.md#14.20), acting: "the parcel he was promised was much
// heavier than it looked". Two of the film's people (cast: nightBaker hands it over, porter takes
// it; any two people modules work) in a yard: the sack travels palm to palm on an arc, the porter's
// knees go under its weight (a jolt, a lean back), and dust puffs where his feet sink. The gag's
// cues are spread into each person's draw; the sack is drawn where the gag says it is.
// focal: the sack between the palms | acting: handOver | props: container (sack), fx: dust |
// traces: the jolt, the lean, the Dutch tilt on the reaction.
// Scene contract: no imports; build() makes the stage and the cut table, update(t) repaints.
export const meta = {
  id: 'cv4',
  title: 'Grim Ink vocabulary: acting',
  treatment: 'character-scene',
};

const GIVE = 1.0;
const LANDED = GIVE + 0.6 * 1.4;

function cutTable() {
  return [
    { at: 0, name: 'two', x: 980, y: 560, z: 1.2 },
    {
      at: LANDED,
      name: 'knees',
      x: 1120,
      y: 560,
      z: 1.9,
      rot: -5,
      ease: 'out',
      to: { x: 1130, y: 540, z: 2.2, rot: -5 },
      end: LANDED + 1.6,
    },
  ];
}

function paintShot(g, env, s, ctx) {
  const giver = ctx.kit.people.nightBaker;
  const taker = ctx.kit.people.porter;
  // Solved in world space first: both people's cues and the sack's position.
  const act = env.ink.acting.handOver({
    a: { who: giver, x: 860, y: 930, s: 0.9, view: 1 },
    b: { who: taker, x: 1130, y: 930, s: 0.9, view: -1 },
    t: env.t,
    t0: GIVE,
    dur: 1.4,
    weight: 0.9,
    arc: 60,
  });
  const cam = env.ink.applyCamera(g, env.ink.resolveCut(s.cuts, env.t));
  const e = cam.env;
  env.ink.rect(g, e, -300, -300, 2520, 1100, env.C.PLASTER, {
    seed: 41,
    lw: 0,
    mottle: ['rgba(60,50,30,0.16)', 8, 60],
  });
  env.ink.cobbles(g, e, -300, 800, 2220, 1400, 42, env.C.STONE, env.C.STONE_D);
  env.ink.pool(g, 1000, 500, 800, 420, env.C.FIRE, 0.08);
  env.ink.props.container(g, e, { x: 1500, y: 900, kind: 'crate', wear: 0.7, seed: 43 });
  const giverExpr = env.ink.exprAt(
    [
      [0, 'deadpan'],
      [LANDED, 'smug'],
    ],
    env.t,
  );
  giver.draw(g, e, { ...act.a, expr: act.a.expr || giverExpr, t: env.t });
  taker.draw(g, e, { ...act.b, expr: act.b.expr || 'deadpan', t: env.t });
  env.ink.props.container(g, e, {
    x: act.item.x,
    y: act.item.y + 50,
    kind: 'sack',
    size: 0.55,
    seed: 44,
  });
  env.ink.fx.dust(g, e, { x: 1130, y: 935, t: env.t, t0: LANDED, size: 0.5, spread: 0.5 });
}

export function build(ctx) {
  const stage = ctx.kit.fx.inkStage();
  ctx.scene.add(stage);
  return { stage, cuts: cutTable() };
}

export function update(t, s, ctx) {
  s.stage.paint(t, (g, env) => paintShot(g, env, s, ctx));
}
