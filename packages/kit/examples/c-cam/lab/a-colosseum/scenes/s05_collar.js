// focal: the iron collar on the champion's neck | cast: champion | place: arenaGate | traces: the
// Dutch tilt on the tense ECU, the stubble under the jaw, the bars at the lens.
// ECU of the iron collar on "A slave might be freed" (framed on the solved chin and neck), tilted;
// CU: his eyes slide up towards the editor's box on "sources disagree" (nobody can tell him).
export const meta = {
  id: 's05_collar',
  title: 'A slave might be freed',
  treatment: 'metaphor-object',
};

const AT = { x: 900, y: 980, s: 0.9 };

export function build(ctx) {
  const stage = ctx.kit.fx.inkStage();
  ctx.scene.add(stage);
  const ink = stage.ink;
  const fig = {
    character: ctx.kit.people.champion,
    placement: { ...AT, yaw: 1 },
    pose: ctx.kit.people.champion.pose('stand'),
  };
  const s = {
    stage,
    slave: ctx.anchor('A slave').t,
    sources: ctx.anchor('sources disagree.').t,
  };
  const neck = [ink.anchorWorld(fig, 'chin'), ink.anchorWorld(fig, 'neck')];
  const face = [ink.anchorWorld(fig, 'forehead'), ink.anchorWorld(fig, 'chin')];
  s.cuts = [
    {
      at: 0,
      name: 'collar',
      ...ink.frameOn(neck, 'ecu', { rot: 5, height: 0.42, push: 0.08, end: s.sources - 0.4 }),
    },
    {
      at: s.sources - 0.4,
      name: 'eyes',
      ...ink.frameOn(face, 'close', { side: 'right', rot: -3, push: 0.08, end: 3.6 }),
    },
  ];
  return s;
}

function paintShot(g, env, s, ctx) {
  const { champion } = ctx.kit.people;
  const gate = ctx.kit.places.arenaGate;
  const cam = env.ink.applyCamera(g, env.ink.resolveCut(s.cuts, env.t));
  const e = cam.env;
  gate.draw(g, e, env.t, { grille: 0.62 });
  champion.draw(g, e, {
    ...AT,
    view: 'three-quarter',
    expr: env.ink.exprAt(
      [
        [0, 'miserable'],
        [s.sources, 'confused'],
      ],
      env.t,
    ),
    look: env.t >= s.sources ? [0.6, -0.9] : [0, 0],
    t: env.t,
  });
  // Two bars of the grille at the lens: he is still on the arena side of the gate.
  env.ink.fgScreen(g, (fe) => {
    env.ink.beam(g, fe, 120, -40, 110, 1120, 46, 52, env.C.RUST_D);
    env.ink.beam(g, fe, 1800, -40, 1812, 1120, 46, 53, env.C.RUST_D);
  });
}

export function update(t, s, ctx) {
  s.stage.paint(t, (g, env) => paintShot(g, env, s, ctx));
}
