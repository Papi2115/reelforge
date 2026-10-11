// focal: the wooden sword left in the sand, then the editor's goblet | cast: champion, editor |
// place: arenaSand | traces: the footprints walking away from the sword, the wine stains, the
// crowd roaring, the rudis at the lens in the wide.
// ECU of the wooden sword lying in the sand on "Freedom"; CU of the editor sipping, satisfied, on
// "had a price" (sip, payoff); pull back wide: the champion back on the sand with a real sword, the
// wooden one in the foreground.
export const meta = { id: 's07_price', title: 'Freedom had a price', treatment: 'metaphor-object' };

const ED = { x: 1560, y: 470, s: 0.55 };
const RUDIS = [520, 1020];

export function build(ctx) {
  const stage = ctx.kit.fx.inkStage();
  ctx.scene.add(stage);
  const ink = stage.ink;
  const editor = ctx.kit.people.editor;
  const fig = { character: editor, placement: { ...ED, yaw: -1 }, pose: editor.pose('stand') };
  const face = [ink.anchorWorld(fig, 'forehead'), ink.anchorWorld(fig, 'chin')];
  const s = { stage, price: ctx.anchor('had a price.').t };
  s.sip = s.price - 0.5;
  s.wide = s.price + 0.7;
  s.cuts = [
    {
      at: 0,
      name: 'rudis',
      ...ink.frameOn([RUDIS[0] + 100, RUDIS[1] - 10], 'ecu', {
        side: 'centre',
        rot: -3,
        z: 3,
        push: 0.06,
        end: s.sip,
      }),
    },
    {
      at: s.sip,
      name: 'sip',
      ...ink.frameOn(face, 'close', { side: 'right', push: 0.06, end: s.wide }),
    },
    {
      at: s.wide,
      name: 'wide',
      x: 1000,
      y: 560,
      z: 1.05,
      ease: 'out',
      to: { x: 1000, y: 560, z: 0.95 },
      end: 3.26,
    },
  ];
  return s;
}

function paintShot(g, env, s, ctx) {
  const { champion, editor } = ctx.kit.people;
  const sand = ctx.kit.places.arenaSand;
  const cam = env.ink.applyCamera(g, env.ink.resolveCut(s.cuts, env.t));
  const e = cam.env;
  sand.draw(g, e, env.t, { crowd: 'cheer', t0: 0, shield: false });
  editor.draw(g, e, {
    ...ED,
    view: -1,
    expr: 'smug',
    t: env.t,
    gag: { kind: 'sip', t0: s.sip - 0.75, rate: 2, vessel: 'goblet' },
  });
  sand.foreground(g, e, env.t, {});
  champion.draw(g, e, {
    x: 1080,
    y: 940,
    s: 0.74,
    view: 'three-quarter',
    expr: 'smug',
    t: env.t,
    props: { sword: 60 },
  });
  // The wooden sword left in the sand: in the ECU it is the subject, in the wide it lies at the lens.
  const near = env.t >= s.wide;
  env.ink.props.weapon(g, e, {
    x: near ? 260 : RUDIS[0],
    y: near ? 1060 : RUDIS[1],
    kind: 'sword',
    rot: -8,
    size: near ? 1.6 : 0.9,
    tone: 'paleWood',
    wear: 0.3,
    seed: 71,
  });
}

export function update(t, s, ctx) {
  s.stage.paint(t, (g, env) => paintShot(g, env, s, ctx));
}
