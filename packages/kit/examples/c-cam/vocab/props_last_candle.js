// Grim Ink vocabulary example (PLAN.md#14.20), props: "he kept the books until the candle gave
// out". A clerk's corner without the clerk: a desk with an open ledger, the iron candle stand whose
// wax IS the clock of the shot (level 1 -> 0.1), a door left ajar for the draught. The camera cuts
// wide -> the ledger heading -> the guttering flame; the heading is the narration's word, lettered
// with drawText at the spot the ledger returns (the prop never letters).
// focal: the candle | props: table, paper, lamp, door, seat | traces: the stain on the desk, the
// flame flicker on twos, the Dutch tilt on the last framing.
// Scene contract: no imports; build() makes the stage and the cut table, update(t) repaints.
export const meta = {
  id: 'cv1',
  title: 'Grim Ink vocabulary: props',
  treatment: 'metaphor-object',
};

const BOOK = 1.6;
const OUT = 3.6;
const END = 5.5;

function cutTable() {
  return [
    { at: 0, name: 'wide', x: 960, y: 560, z: 1.0 },
    { at: BOOK, name: 'ledger', x: 860, y: 640, z: 2.6 },
    {
      at: OUT,
      name: 'flame',
      x: 1280,
      y: 420,
      z: 3.0,
      rot: -4,
      ease: 'out',
      to: { x: 1285, y: 410, z: 3.4, rot: -4 },
      end: END,
    },
  ];
}

function room(g, e, env) {
  env.ink.rect(g, e, -300, -300, 2520, 1080, env.C.PLASTER, {
    seed: 3,
    lw: 0,
    mottle: ['rgba(60,50,30,0.16)', 8, 60],
  });
  env.ink.rect(g, e, -300, 780, 2520, 600, env.C.BROWN_D, {
    seed: 4,
    lw: 0,
    hatch: { n: 10, len: 120, ang: 2 },
  });
  env.ink.stain(g, e, 1500, 300, 220, 160, 5);
  env.ink.crack(g, e, 300, 160, 140, 6);
  env.ink.props.door(g, e, {
    x: 260,
    y: 790,
    w: 240,
    h: 380,
    kind: 'panel',
    state: 'ajar',
    wear: 0.7,
    seed: 7,
  });
}

function paintShot(g, env, s) {
  const cam = env.ink.applyCamera(g, env.ink.resolveCut(s.cuts, env.t));
  const e = cam.env;
  room(g, e, env);
  // The wax burns down over the whole shot: the only clock the audience needs.
  const level = env.time.key(env.t, [
    [0, 1],
    [END, 0.1, 'lin'],
  ]);
  const lamp = env.ink.props.lamp(g, e, {
    x: 1280,
    y: 800,
    kind: 'stand',
    level,
    t: env.t,
    pool: true,
    seed: 8,
  });
  env.ink.props.seat(g, e, { x: 700, y: 800, kind: 'stool', size: 0.9 });
  const desk = env.ink.props.table(g, e, {
    x: 900,
    y: 800,
    w: 520,
    h: 170,
    kind: 'desk',
    wear: 0.6,
    seed: 9,
  });
  const ledger = env.ink.props.paper(g, e, {
    x: desk.points.top[0] - 40,
    y: desk.points.top[1] - 34,
    kind: 'book',
    state: 'open',
    w: 200,
    page: env.time.seg(env.t, BOOK, BOOK + 0.5),
    seed: 10,
  });
  if (ledger.label)
    env.ink.drawText('LATE', { ...ledger.label, face: 'hand', seed: 11, fill: env.C.INK });
  // When the flame is nearly out a thin smoke curl replaces the light.
  if (env.t >= OUT && lamp.points.flame)
    env.ink.fx.smoke(g, e, {
      x: lamp.points.flame[0],
      y: lamp.points.flame[1] - 30,
      t: env.t,
      t0: OUT,
      n: 1,
    });
}

export function build(ctx) {
  const stage = ctx.kit.fx.inkStage();
  ctx.scene.add(stage);
  return { stage, cuts: cutTable() };
}

export function update(t, s) {
  s.stage.paint(t, (g, env) => paintShot(g, env, s));
}
