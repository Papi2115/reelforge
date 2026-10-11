// Grim Ink vocabulary example (PLAN.md#14.20), crowd: "when the number went up, the whole hall
// gasped, then went quiet". Tiered benches of a meeting hall seen from the floor: the people mutter,
// the board flips on the beat, the gasp ripples out from the middle of the rows, then everyone is
// hushed. Two heads at the lens give depth on the wide framing only. The board's header is the
// narration's word, lettered at the spot the board returns.
// focal: the flip board, then the faces | crowd: rows (tiers), foreground heads | instruments:
// flipBoard | traces: the reaction wave, the foreground silhouettes, a stain on the wall.
// Scene contract: no imports; build() makes the stage and the cut table, update(t) repaints.
export const meta = {
  id: 'cv3',
  title: 'Grim Ink vocabulary: crowd',
  treatment: 'character-scene',
};

const FLIP = 1.5;
const HUSH = 3.6;

function cutTable() {
  return [
    { at: 0, name: 'hall', x: 960, y: 520, z: 1.0 },
    { at: FLIP, name: 'board', x: 960, y: 220, z: 2.2 },
    {
      at: FLIP + 0.75,
      name: 'rows',
      x: 760,
      y: 560,
      z: 1.7,
      rot: 4,
      ease: 'out',
      to: { x: 780, y: 560, z: 1.9, rot: 4 },
      end: HUSH + 1.5,
    },
  ];
}

function paintShot(g, env, s) {
  const cam = env.ink.applyCamera(g, env.ink.resolveCut(s.cuts, env.t));
  const e = cam.env;
  env.ink.rect(g, e, -300, -300, 2520, 1700, env.C.STONE, {
    seed: 31,
    lw: 0,
    mottle: ['rgba(60,50,30,0.16)', 10, 70],
  });
  env.ink.bricks(g, e, -300, -300, 2520, 900, { bh: 60, bw: 150, seed: 32 });
  env.ink.stain(g, e, 1500, 140, 260, 180, 33);
  env.ink.pool(g, 960, 300, 700, 300, env.C.FIRE, 0.08);
  const flip = env.time.seg(env.t, FLIP, FLIP + 0.17);
  const board = env.ink.instruments.flipBoard(g, e, {
    x: 960,
    y: 260,
    w: 300,
    h: 170,
    side: flip < 0.5 ? 'blank' : 'up',
    flip,
    seed: 34,
  });
  if (board.label)
    env.ink.drawText('RENT', { ...board.label, face: 'hand', seed: 35, fill: env.C.INK });
  const reaction = env.t < FLIP ? 'mutter' : env.t < HUSH ? 'gasp' : 'hush';
  env.ink.crowd.rows(g, e, {
    x0: -200,
    x1: 2120,
    y: 1060,
    rows: 4,
    step: 110,
    s: 0.9,
    tiers: true,
    reaction,
    t: env.t,
    t0: reaction === 'mutter' ? 0 : reaction === 'gasp' ? FLIP : HUSH,
    stagger: 0.08,
    palette: 'muted',
    seed: 36,
  });
  if (env.t < FLIP) {
    env.ink.fgScreen(g, (fe) =>
      env.ink.crowd.foreground(g, fe, {
        kind: 'heads',
        x: 960,
        y: 1080,
        s: 0.9,
        n: 2,
        w: 1300,
        seed: 37,
      }),
    );
  }
}

export function build(ctx) {
  const stage = ctx.kit.fx.inkStage();
  ctx.scene.add(stage);
  return { stage, cuts: cutTable() };
}

export function update(t, s) {
  s.stage.paint(t, (g, env) => paintShot(g, env, s));
}
