// focal: the title over the stunned champion | cast: champion, editor | place: arenaSand | traces:
// the champion's shock snapping in, flies over the editor's goblet, a spear stuck in the sand at
// the lens.
// Title frame (the thumbnail): "FREEDOM HAD A PRICE" thuds in over the champion, stunned, holding
// the wooden sword at arm's length, and the editor, smug, hands on hips, the coin purse at his hip
// (the accent). A slow push-in like the prototype's title shot.
export const meta = { id: 's01_title', title: 'Freedom Had a Price', treatment: 'title-card' };

export function build(ctx) {
  const stage = ctx.kit.fx.inkStage();
  ctx.scene.add(stage);
  return { stage, won: ctx.anchor("You've just won.").t };
}

function paintShot(g, env, s, ctx) {
  const { champion, editor } = ctx.kit.people;
  const push = env.time.key(env.t, [
    [0, 1],
    [1.9, 1.06, 'out'],
  ]);
  g.translate(960, 540);
  g.scale(push, push);
  g.translate(-960, -540);
  const D = champion.D;
  const arm = D.l1a + D.l2a;
  const hold = champion.pose('stand', 0, { hR: [-D.sw * 0.4, D.sy + 0.35 * arm, 0.85 * arm] });
  env.ink.titleCard({
    title: 'Freedom Had a Price',
    place: ctx.kit.places.arenaSand,
    placeOptions: { crowd: 'cheer', t0: 0, shield: false },
    cast: [
      {
        person: champion,
        x: 720,
        y: 1060,
        s: 0.62,
        view: 'three-quarter',
        pose: hold,
        expr: env.ink.exprAt(
          [
            [0, 'deadpan'],
            [s.won + 0.4, 'shock'],
          ],
          env.t,
        ),
        props: { rudis: -20 },
      },
      {
        person: editor,
        x: 1240,
        y: 1050,
        s: 0.58,
        view: -1,
        pose: 'stand',
        expr: 'smug',
        gag: { kind: 'sip', t0: -2.4, rate: 2, vessel: 'goblet' },
      },
    ],
  });
  env.ink.flies(g, 1300, 640, env.t, 7);
  // A spear stuck in the sand at the lens, left of the title's people.
  env.ink.props.weapon(g, env, {
    x: 150,
    y: 1180,
    kind: 'spear',
    rot: -80,
    size: 1.4,
    tone: 'iron',
    wear: 0.6,
    seed: 8,
  });
}

export function update(t, s, ctx) {
  s.stage.paint(t, (g, env) => paintShot(g, env, s, ctx));
}
