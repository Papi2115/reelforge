// focal: the wooden sword snagged across the gate bars | cast: champion | place: arenaGate |
// traces: the yank (a shake), the rust streaks, the twitching fingers at the belt.
// Wide of the gate on "It means you are done", volunteers trudging out under the half-raised
// grille; medium: the champion follows with the wooden sword on "Volunteers walked away"; ECU: the
// sword snags across the bars and yanks him back a step (the accident, framed on the solved tip);
// medium-close: his twitching sword hand at the belt and his face (fidget).
export const meta = {
  id: 's04_gate',
  title: 'Volunteers walked away',
  treatment: 'character-scene',
};

const GRILLE = 0.62;
const AT = { x: 1040, y: 980, s: 0.72 };
const RUDIS = -70;
const FACE = { x: 960, y: 1180, s: 0.9 };

export function build(ctx) {
  const stage = ctx.kit.fx.inkStage();
  ctx.scene.add(stage);
  const ink = stage.ink;
  const champion = ctx.kit.people.champion;
  const fig = { character: champion, placement: { ...AT, yaw: 3 }, pose: champion.pose('stand') };
  const palm = ink.palmWorld(fig, 'R');
  // The sword's tip: 300 px of blade at size 0.9, scaled with the figure, pointing up at RUDIS deg.
  const len = 300 * 0.9 * AT.s;
  const tip = [
    palm[0] + len * Math.cos((RUDIS * Math.PI) / 180),
    palm[1] + len * Math.sin((RUDIS * Math.PI) / 180),
  ];
  const front = {
    character: champion,
    placement: { ...FACE, yaw: 1 },
    pose: champion.pose('stand'),
  };
  const s = {
    stage,
    tip,
    done: ctx.anchor('you are done.').t,
    walked: ctx.anchor('Volunteers walked away.').t,
    away: ctx.anchor('away.').t,
  };
  s.snag = s.walked + 0.4;
  s.hand = s.away + 0.1;
  s.cuts = [
    {
      at: 0,
      name: 'gate',
      x: 1000,
      y: 560,
      z: 1.05,
      to: { x: 1000, y: 560, z: 1.1 },
      end: s.walked,
    },
    { at: s.walked - 0.6, name: 'follow', x: 1020, y: 620, z: 1.45 },
    { at: s.snag, name: 'snag', ...ink.frameOn(tip, 'ecu', { side: 'centre', rot: 4, z: 3 }) },
    {
      at: s.hand,
      name: 'hand',
      ...ink.frameOn(
        [ink.anchorWorld(front, 'forehead'), ink.anchorWorld(front, 'hip.R')],
        'medium',
        { side: 'right', height: 0.5, push: 0.06, end: 4 },
      ),
    },
  ];
  return s;
}

function volunteers(g, env, e) {
  // Three volunteers walking away into the passage, smaller with every step (on twos).
  for (let i = 0; i < 3; i += 1) {
    const u = env.time.clamp01((env.time.twos(env.t) - i * 0.5) / 3.4);
    env.ink.crowd.figure(g, e, {
      x: 900 + i * 90 - u * 60,
      y: 980 - u * 170,
      s: 0.5 - u * 0.25,
      view: 'back',
      body: 'tunic',
      reaction: 'stand',
      palette: 'muted',
      seed: 41 + i,
    });
  }
}

function paintShot(g, env, s, ctx) {
  const { champion } = ctx.kit.people;
  const gate = ctx.kit.places.arenaGate;
  const yank =
    env.t >= s.snag ? env.ink.fx.shake({ t: env.t, t0: s.snag, dur: 0.25, px: 10 }) : [0, 0];
  const cut = env.ink.resolveCut(s.cuts, env.t);
  const cam = env.ink.applyCamera(g, { ...cut, x: cut.x + yank[0], y: cut.y + yank[1] });
  const e = cam.env;
  gate.draw(g, e, env.t, { grille: GRILLE });
  if (env.t >= s.hand) {
    champion.draw(g, e, {
      ...FACE,
      view: 'three-quarter',
      expr: 'miserable',
      t: env.t,
      gag: { kind: 'fidget', t0: s.hand, rate: 1.5 },
    });
    env.ink.fgScreen(g, () => env.ink.silhouette(g, [0, 1080, 0, 700, 140, 640, 260, 1080]));
    return;
  }
  volunteers(g, env, e);
  const back = env.time.key(env.time.twos(env.t), [
    [s.snag, 0],
    [s.snag + 0.3, 1, 'out'],
  ]);
  const walking = env.t < s.snag;
  champion.draw(g, e, {
    x: AT.x - 40 * back,
    y: AT.y + 40 * back,
    s: AT.s,
    view: 'back',
    pose: walking ? champion.pose('walk', (env.time.twos(env.t) * 1.2) % 1) : 'stand',
    lean: -8 * back,
    expr: 'shock',
    t: env.t,
    props: { rudis: RUDIS },
  });
  gate.foreground(g, e, env.t, { grille: GRILLE });
  if (!walking && env.t < s.snag + 0.4)
    env.ink.fx.impact(g, e, { x: s.tip[0], y: s.tip[1], t: env.t, t0: s.snag, size: 0.6 });
}

export function update(t, s, ctx) {
  s.stage.paint(t, (g, env) => paintShot(g, env, s, ctx));
}
