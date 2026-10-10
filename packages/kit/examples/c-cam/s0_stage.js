// Grim Ink (c-cam) skeleton example (PLAN.md#14.2): the ink stage on its own. A muddy field under
// a dirty grey-blue sky, one boulder (a blob with a shade crescent, mottle and hatching), one ink
// ribbon for the far ridge, and the INK frame around it all. No people, faces or camera yet.
// Focal: the boulder, off-centre right, the only shape with an outline.
// Traces: the ridge line boils on twos (its seed steps every 1/12 s), the mud puddles shimmer in
// held steps, the boulder settles a few px into the mud.
// Scene contract: no imports; build() makes the stage once, update(t) repaints it from scratch.
export const meta = { id: 'cs0', title: 'Grim Ink: the stage', treatment: 'metaphor-object' };

const FRAME = 26;

/** Ground polygon: a lumpy horizon at ~y 610, down to the bottom edge. */
function groundOutline(env) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const x = (i / 12) * env.width;
    pts.push(x, 610 + env.time.rnd(-26, 26, 41, i));
  }
  return pts;
}

function sky(g, env) {
  g.fillStyle = env.C.GREYBLUE_D;
  g.fillRect(0, 0, env.width, 640);
  g.fillStyle = env.C.GREYBLUE;
  g.fillRect(0, 380, env.width, 260);
}

function mud(g, env, ridge) {
  const { C, time } = env;
  g.fillStyle = C.BROWN;
  g.beginPath();
  g.moveTo(0, env.height);
  for (let i = 0; i < ridge.length; i += 2) g.lineTo(ridge[i], ridge[i + 1]);
  g.lineTo(env.width, env.height);
  g.closePath();
  g.fill();
  // Puddles and clods: flat shapes, held for 0.5 s each, then re-seeded.
  const beat = Math.floor(time.twos(env.t) / 0.5);
  for (let i = 0; i < 26; i++) {
    const x = time.rnd(40, env.width - 40, 7, i);
    const y = time.rnd(680, env.height - 50, 8, i);
    const wet = time.hash(9, i) < 0.35;
    g.fillStyle = wet ? C.GREYBLUE_D : i % 2 ? C.BROWN_D : C.CLAY_D;
    g.beginPath();
    const shimmer = wet ? time.rnd(-4, 4, 10, i, beat) : 0;
    g.ellipse(x, y, time.rnd(30, 110, 11, i) + shimmer, time.rnd(6, 16, 12, i), 0, 0, Math.PI * 2);
    g.fill();
  }
}

function boulder(env) {
  const { C, time, brush } = env;
  const sink = time.key(time.twos(env.t), [
    [0, 0],
    [3, 6, 'out'],
  ]);
  const pts = [1180, 760, 1290, 660, 1430, 640, 1540, 700, 1580, 800, 1500, 860, 1300, 870];
  const sunk = pts.map((v, i) => (i % 2 ? v + sink : v));
  brush.blob(sunk, C.STONE, {
    seed: 5,
    shade: [C.STONE_D, 30, 26],
    light: [C.LINEN, -26, -22],
    mottle: [C.CLAY_D, 18, 22],
    hatch: { n: 7, len: 34, ang: -35, w: 3 },
    lw: 8,
  });
}

function frame(g, env) {
  g.fillStyle = env.C.INK;
  g.fillRect(0, 0, env.width, FRAME);
  g.fillRect(0, env.height - FRAME, env.width, FRAME);
  g.fillRect(0, 0, FRAME, env.height);
  g.fillRect(env.width - FRAME, 0, FRAME, env.height);
}

function paint(g, env) {
  const ridge = groundOutline(env);
  sky(g, env);
  mud(g, env, ridge);
  // The far ridge: one uneven ink ribbon that boils on twos.
  const step = Math.floor(env.time.twos(env.t) * 12) % 3;
  env.brush.inkLine(env.brush.curve(ridge), { seed: 20 + step, w: 9 });
  boulder(env);
  frame(g, env);
}

export function build(ctx) {
  const stage = ctx.kit.fx.inkStage();
  ctx.scene.add(stage);
  return { stage };
}

export function update(t, state) {
  state.stage.paint(t, paint);
}
