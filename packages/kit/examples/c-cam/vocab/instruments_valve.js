// Grim Ink vocabulary example (PLAN.md#14.20), instruments: "the pressure kept falling until
// someone shut the valve by hand". A wall console in a pump room: the gauge needle sinks into the
// red and trembles, the warning light blinks, and on the beat the valve wheel turns (its turn is a
// number from t); the camera ends on an extreme close-up of the wheel with a click mark. The gauge
// word is lettered with drawText at the label spot the console returns for it.
// focal: the valve wheel | instruments: console (gauge, lights, switches), dial | traces: the
// shake on the beat, the Dutch tilt on the close-up, a stain under the console.
// Scene contract: no imports; build() makes the stage and the cut table, update(t) repaints.
export const meta = {
  id: 'cv2',
  title: 'Grim Ink vocabulary: instruments',
  treatment: 'metaphor-object',
};

const FALLING = 1.2;
const SHUT = 3.2;

function cutTable() {
  return [
    { at: 0, name: 'wall', x: 960, y: 540, z: 1.0 },
    { at: FALLING, name: 'gauge', x: 700, y: 470, z: 2.4, rot: 3 },
    { at: SHUT, name: 'wheel', x: 1380, y: 520, z: 3.6, rot: -5 },
  ];
}

function paintShot(g, env, s) {
  const shake = env.ink.fx.shake({ t: env.t, t0: SHUT, px: 8 });
  const cut = env.ink.resolveCut(s.cuts, env.t);
  const cam = env.ink.applyCamera(g, { ...cut, x: cut.x + shake[0] });
  const e = cam.env;
  env.ink.props.panel(g, e, {
    x: -300,
    y: -300,
    w: 2520,
    h: 1600,
    tone: 'steel',
    wear: 0.6,
    seed: 21,
  });
  env.ink.pool(g, 900, 500, 900, 520, env.C.FIRE, 0.07);
  const pressure = env.time.key(env.t, [
    [0, 0.55],
    [SHUT, 0.06, 'lin'],
    [SHUT + 1.5, 0.3, 'out'],
  ]);
  const panel = env.ink.instruments.console(g, e, {
    x: 820,
    y: 760,
    w: 820,
    h: 420,
    kind: 'wall',
    elements: [
      { type: 'gauge', value: pressure, tremble: env.t < SHUT ? 1 : 0, t: env.t },
      { type: 'lights', n: 2, lit: '10', blink: env.t < SHUT, t: env.t },
      { type: 'switches', cols: 3, rows: 4 },
    ],
    seed: 22,
  });
  const label = panel.labels && panel.labels[0];
  if (label) env.ink.drawText('PRESSURE', { ...label, face: 'hand', seed: 23, fill: env.C.INK });
  env.ink.stain(g, e, 820, 800, 300, 90, 24);
  const turn = env.time.key(env.time.twos(env.t), [
    [SHUT, 0],
    [SHUT + 0.6, 1, 'out'],
  ]);
  env.ink.instruments.dial(g, e, { x: 1380, y: 520, r: 110, kind: 'wheel', turn, seed: 25 });
  env.ink.fx.shakeLines(g, e, { x: 1520, y: 400, t: env.t, t0: SHUT, kind: 'click' });
}

export function build(ctx) {
  const stage = ctx.kit.fx.inkStage();
  ctx.scene.add(stage);
  return { stage, cuts: cutTable() };
}

export function update(t, s) {
  s.stage.paint(t, (g, env) => paintShot(g, env, s));
}
