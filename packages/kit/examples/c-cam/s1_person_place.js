// Grim Ink (c-cam) example (PLAN.md#14.12): a person in a place through the stage's env.ink, written
// the way the prompts teach. The night baker (people/nightBaker.js) holds up one loaf in the back
// room of the bakery (places/bakeryBackRoom.js); the camera cuts wide -> the loaf in his hand ->
// his shocked face with a slow push-in, and the chalk sign on the wall says what is wrong.
// focal: the loaf in the baker's palm | cast: nightBaker | place: bakeryBackRoom | traces: the
// shock jolt, the Dutch tilt on the tense close-up, the sack silhouette at the lens.
// Scene contract: no imports; build() makes the stage and the cut table, update(t) repaints.
export const meta = {
  id: 'cs1',
  title: 'Grim Ink: a person in a place',
  treatment: 'character-scene',
};

// Beats (local seconds, on the 1/12 s grid so the cuts land exactly).
const LOAF = 1.5;
const SHOCK = 3.5;
// The baker: feet on the floor right of the table, three-quarter view facing screen-left.
const AT = { x: 1150, y: 930, s: 0.9 };
const YAW = -1;
// The loaf, held up in his right palm (world px).
const HOLD = [1010, 560];

function cutTable() {
  return [
    { at: 0, name: 'wide', x: 1100, y: 560, z: 1.05 },
    { at: LOAF, name: 'loaf', x: 1040, y: 560, z: 2.6, rot: -3 },
    {
      at: SHOCK,
      name: 'face',
      x: 1130,
      y: 330,
      z: 2.1,
      rot: 5,
      ease: 'out',
      to: { x: 1135, y: 320, z: 2.5, rot: 5 },
      end: SHOCK + 1.4,
    },
  ];
}

/** The pose of the shot: standing, the right hand ON the loaf (solved before the camera). */
function bakerPose(env, baker) {
  const pose = baker.pose('stand');
  const placement = { ...AT, yaw: YAW };
  const hR = env.ink.reachPalm({ character: baker, placement, pose }, 'R', HOLD);
  return { ...pose, hR, kR: 'open' };
}

function loaf(g, e, env, palm) {
  const [x, y] = palm;
  // A domed loaf sitting on the palm: flat underside, lumpy crust.
  // prettier-ignore
  const crust = [x - 78, y - 6, x - 72, y - 40, x - 38, y - 64, x + 8, y - 70, x + 52, y - 58, x + 80, y - 30, x + 74, y - 4, x, y + 4];
  env.ink.blob(g, e, crust, env.C.MUSTARD, {
    seed: 61,
    shade: [env.C.MUSTARD_D, 12, 14],
    hatch: { n: 4, len: 30, ang: -40, w: 3 },
    lw: 6,
  });
  // The burnt crack across its top: what the shot is about.
  env.ink.brushStroke(g, e, [x - 44, y - 40, x - 10, y - 50, x + 30, y - 38, x + 52, y - 46], {
    seed: 62,
    w: 6,
    color: env.C.BLACK_D,
  });
}

/** A chalk sign over the oven: hand lettering in ink strokes, words of the "narration". */
function sign(g, e, env) {
  env.ink.rect(g, e, 1640, 170, 300, 150, env.C.BLACK_D, {
    seed: 70,
    lw: 7,
    shade: [env.C.INK, 8, 8],
  });
  const chalk = { face: 'hand', size: 40, x: 1790, seed: 71, fill: env.C.LINEN, align: 'center' };
  env.ink.drawText('NO BURNT', { ...chalk, y: 232, rot: -2 });
  env.ink.drawText('LOAVES', { ...chalk, y: 290, seed: 72, rot: 1 });
}

function paintShot(g, env, s, ctx) {
  const room = ctx.kit.places.bakeryBackRoom;
  const baker = ctx.kit.people.nightBaker;
  // Contacts first, in world space.
  const pose = bakerPose(env, baker);
  const palm = env.ink.palmWorld({ character: baker, placement: { ...AT, yaw: YAW }, pose }, 'R');
  // The camera, then the place behind everything.
  const cam = env.ink.applyCamera(g, env.ink.resolveCut(s.cuts, env.t));
  room.draw(g, cam.env, env.t, { light: true });
  sign(g, cam.env, env);
  // The baker: deadpan, then the shock snaps in with a head jolt for 0.2 s.
  const expr = env.ink.exprAt(
    [
      [0, 'deadpan'],
      [SHOCK, 'shock'],
    ],
    env.t,
  );
  const jolt = env.t >= SHOCK && env.t < SHOCK + 0.2 ? -16 : 0;
  baker.draw(g, cam.env, { ...AT, view: YAW, pose, expr, headDy: jolt, t: env.t });
  loaf(g, cam.env, env, palm);
  // A sack shoulder at the lens on the tense close-up only.
  if (env.t >= SHOCK) {
    env.ink.fgScreen(g, () =>
      env.ink.silhouette(g, [0, 1080, 0, 760, 160, 690, 330, 760, 380, 1080]),
    );
  }
}

export function build(ctx) {
  const stage = ctx.kit.fx.inkStage();
  ctx.scene.add(stage);
  return { stage, cuts: cutTable() };
}

export function update(t, s, ctx) {
  s.stage.paint(t, (g, env) => paintShot(g, env, s, ctx));
}
