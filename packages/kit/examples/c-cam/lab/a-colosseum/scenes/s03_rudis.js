// focal: the wooden sword landing on the champion's open palm | cast: champion, editor | place:
// arenaSand | traces: the head jolt, the stubble in the close-up, the spear stuck in the sand at
// the lens.
// ECU: the wooden sword drops onto the champion's open palm on "wooden sword" (framed on the
// solved palm), RUDIS lettered along the blade on "the rudis"; CU: he stares at it (a jolt); pull
// back wide: the champion small on the sand holding it, the editor sipping in his box.
export const meta = { id: 's03_rudis', title: 'The rudis', treatment: 'metaphor-object' };

const AT = { x: 760, y: 980, s: 0.9 };
const BOX = [1560, 470];

function championPose(champion) {
  const D = champion.D;
  const arm = D.l1a + D.l2a;
  return champion.pose('stand', 0, { hR: [-D.sw * 0.2, D.sy + 0.3 * arm, 0.95 * arm], kR: 'open' });
}

export function build(ctx) {
  const stage = ctx.kit.fx.inkStage();
  ctx.scene.add(stage);
  const ink = stage.ink;
  const champion = ctx.kit.people.champion;
  const fig = { character: champion, placement: { ...AT, yaw: 1 }, pose: championPose(champion) };
  const palm = ink.palmWorld(fig, 'R');
  const face = [ink.anchorWorld(fig, 'forehead'), ink.anchorWorld(fig, 'chin')];
  const s = { stage, palm, sword: ctx.anchor('wooden sword').t, rudis: ctx.anchor('the rudis.').t };
  s.stare = s.rudis - 0.3;
  s.wide = s.rudis + 0.5;
  s.cuts = [
    {
      at: 0,
      name: 'palm',
      ...ink.frameOn([palm[0] + 110, palm[1] - 20], 'ecu', {
        side: 'centre',
        height: 0.55,
        z: 2.8,
        push: 0.08,
        end: s.stare,
      }),
    },
    { at: s.stare, name: 'stare', ...ink.frameOn(face, 'close', { side: 'right', rot: -3 }) },
    {
      at: s.wide,
      name: 'wide',
      x: 1060,
      y: 560,
      z: 1.0,
      ease: 'out',
      to: { x: 1060, y: 560, z: 0.95 },
      end: 3.2,
    },
  ];
  return s;
}

function rudisOnPalm(g, env, e, s) {
  // The wooden sword falls onto the open palm (it rests across it: drawn over the hand).
  const fall = env.time.key(env.t, [
    [0, -460],
    [s.sword, 0, 'inOut'],
  ]);
  const res = env.ink.props.weapon(g, e, {
    x: s.palm[0] - 20,
    y: s.palm[1] - 12 + fall,
    kind: 'sword',
    rot: -8,
    size: 0.85,
    tone: 'paleWood',
    wear: 0.3,
    seed: 5250,
  });
  if (env.t >= s.sword && env.t < s.sword + 0.3)
    env.ink.fx.impact(g, e, { x: s.palm[0], y: s.palm[1] - 10, t: env.t, t0: s.sword, size: 0.5 });
  if (env.t < s.rudis) return;
  const [gx, gy] = res.points.grip;
  const [tx, ty] = res.points.tip;
  const ang = (Math.atan2(ty - gy, tx - gx) * 180) / Math.PI;
  env.ink.drawText('RUDIS', {
    face: 'hand',
    size: 22,
    x: gx + (tx - gx) * 0.55,
    y: gy + (ty - gy) * 0.55 + 2,
    seed: 31,
    fill: env.C.INK,
    rot: ang,
    align: 'center',
  });
}

function paintShot(g, env, s, ctx) {
  const { champion, editor } = ctx.kit.people;
  const sand = ctx.kit.places.arenaSand;
  const cam = env.ink.applyCamera(g, env.ink.resolveCut(s.cuts, env.t));
  const e = cam.env;
  sand.draw(g, e, env.t, { crowd: 'cheer', t0: 0, shield: false });
  editor.draw(g, e, {
    x: BOX[0],
    y: BOX[1],
    s: 0.55,
    view: -1,
    expr: 'smug',
    t: env.t,
    gag: { kind: 'sip', t0: s.rudis - 1.2, rate: 2, vessel: 'goblet' },
  });
  sand.foreground(g, e, env.t, {});
  env.ink.pool(g, AT.x, 700, 500, 300, env.C.FIRE, 0.08);
  const jolt = env.t >= s.stare && env.t < s.stare + 0.2 ? -16 : 0;
  champion.draw(g, e, {
    ...AT,
    view: 'three-quarter',
    pose: championPose(champion),
    expr: env.ink.exprAt(
      [
        [0, 'deadpan'],
        [s.stare, 'shock'],
        [s.wide, 'confused'],
      ],
      env.t,
    ),
    headDy: jolt,
    t: env.t,
  });
  rudisOnPalm(g, env, e, s);
  if (env.t >= s.wide) {
    // The wide: a spear stuck in the sand at the lens (depth), never over the champion.
    env.ink.props.weapon(g, e, {
      x: 300,
      y: 1250,
      kind: 'spear',
      rot: -78,
      size: 1.3,
      tone: 'iron',
      wear: 0.6,
      seed: 32,
    });
  }
}

export function update(t, s, ctx) {
  s.stage.paint(t, (g, env) => paintShot(g, env, s, ctx));
}
