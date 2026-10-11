// focal: the editor's goblet in his box, then the wooden sword | cast: champion, editor | place:
// arenaSand | traces: the champion's twitching hand, the wine stains on the toga, the foreground
// back of the champion, flies over the box.
// Wide of the stands waving cloths on "The crowd wants you free" (heads at the lens); over the
// champion's shoulder up at the editor's box, the champion's sword hand twitching (fidget, setup);
// CU of the editor sipping before he decides (sip, setup); medium: he leans over the rail with the
// wooden sword.
export const meta = {
  id: 's02_crowd',
  title: 'The crowd wants you free',
  treatment: 'character-scene',
};

const BOX = [1560, 470];
const ED = { x: BOX[0], y: BOX[1], s: 0.55 };
const OTS = { x: 720, y: 1380, s: 1.55 };

export function build(ctx) {
  const stage = ctx.kit.fx.inkStage();
  ctx.scene.add(stage);
  const ink = stage.ink;
  const editor = ctx.kit.people.editor;
  const s = {
    stage,
    crowd: ctx.anchor('The crowd').t,
    free: ctx.anchor('wants you free').t,
    man: ctx.anchor('the man paying').t,
    games: ctx.anchor('for the games').t,
  };
  const fig = { character: editor, placement: { ...ED, yaw: -1 }, pose: editor.pose('stand') };
  const face = [ink.anchorWorld(fig, 'forehead'), ink.anchorWorld(fig, 'chin')];
  s.cuts = [
    { at: 0, name: 'stands', x: 900, y: 260, z: 1.2, to: { x: 940, y: 260, z: 1.26 }, end: s.free },
    { at: s.free, name: 'ots', x: 1240, y: 430, z: 1.25 },
    {
      at: s.man,
      name: 'sip',
      ...ink.frameOn(face, 'close', { side: 'right', push: 0.08, end: s.games }),
    },
    { at: s.games, name: 'lean', ...ink.frameOn([BOX[0], 260], 'medium', { side: 'right' }) },
  ];
  return s;
}

function editorPose(env, s, editor) {
  if (env.t < s.games) return { pose: 'stand', lean: 0 };
  const D = editor.D;
  const arm = D.l1a + D.l2a;
  const lean = env.time.key(env.time.twos(env.t), [
    [s.games, 0],
    [s.games + 0.4, 14, 'out'],
  ]);
  return {
    pose: editor.pose('stand', 0, { hL: [D.sw * 0.3, D.sy + 0.5 * arm, 0.9 * arm], kL: 'grip' }),
    lean,
  };
}

function paintShot(g, env, s, ctx) {
  const { champion, editor } = ctx.kit.people;
  const sand = ctx.kit.places.arenaSand;
  const cam = env.ink.applyCamera(g, env.ink.resolveCut(s.cuts, env.t));
  const e = cam.env;
  sand.draw(g, e, env.t, { crowd: env.t < s.crowd + 0.2 ? 'mutter' : 'wave', t0: s.crowd });
  env.ink.pool(g, BOX[0], 300, 420, 200, env.C.FIRE, 0.08);
  const ed = editorPose(env, s, editor);
  editor.draw(g, e, {
    ...ED,
    view: -1,
    pose: ed.pose,
    lean: ed.lean,
    expr: env.ink.exprAt(
      [
        [0, 'smug'],
        [s.man, 'focused'],
        [s.games, 'smug'],
      ],
      env.t,
    ),
    t: env.t,
    gag: env.t < s.games ? { kind: 'sip', t0: s.man - 0.8, rate: 2, vessel: 'goblet' } : undefined,
  });
  if (env.t >= s.games) {
    const palm = env.ink.palmWorld(
      { character: editor, placement: { ...ED, yaw: -1 }, pose: ed.pose },
      'L',
    );
    env.ink.props.weapon(g, e, {
      x: palm[0],
      y: palm[1],
      kind: 'sword',
      rot: 110,
      size: 0.5,
      tone: 'paleWood',
      wear: 0.2,
      seed: 21,
    });
  }
  sand.foreground(g, e, env.t, {});
  env.ink.flies(g, 1640, 150, env.t, 3);
  if (env.t < s.free) {
    // The wide: a row of the crowd's heads at the lens, bobbing as they cheer.
    env.ink.fgScreen(g, (fe) =>
      env.ink.crowd.foreground(g, fe, {
        kind: 'heads',
        x: 960,
        y: 1080,
        s: 1.1,
        n: 4,
        w: 2100,
        bob: true,
        t: env.t,
        seed: 22,
      }),
    );
  } else if (env.t < s.man) {
    // Over the champion's shoulder: his back fills the left third, the sword hand twitching.
    champion.draw(g, e, {
      ...OTS,
      view: 'back',
      t: env.t,
      gag: { kind: 'fidget', t0: s.free, rate: 1.5 },
    });
  }
}

export function update(t, s, ctx) {
  s.stage.paint(t, (g, env) => paintShot(g, env, s, ctx));
}
