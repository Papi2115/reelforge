// focal: the coins pouring into the champion's palm | cast: champion | place: arenaGate | traces:
// the tilt on the climax ECU, the ringed arm at the lens, the hand that stops twitching.
// Wide: the champion outside the dropped grille looking back in on "But some came back"; the
// reverse over a ringed arm reaching to the bars with a purse on "Tiberius reportedly paid"; ECU
// (climax, framed on the solved palm): coins pour into his palm on "one hundred thousand
// sesterces", 100 000 lettered on the purse; CU: his twitching hand stops and closes on the coins;
// medium: he steps out through the raised grille onto the sand with a real sword.
export const meta = { id: 's06_paid', title: 'Paid to come back', treatment: 'character-scene' };

const IN = { x: 1000, y: 820, s: 0.62 };

function championPose(champion) {
  const D = champion.D;
  const arm = D.l1a + D.l2a;
  return champion.pose('stand', 0, {
    hR: [-D.sw * 0.1, D.sy + 0.45 * arm, 0.95 * arm],
    kR: 'open',
  });
}

export function build(ctx) {
  const stage = ctx.kit.fx.inkStage();
  ctx.scene.add(stage);
  const ink = stage.ink;
  const champion = ctx.kit.people.champion;
  const fig = { character: champion, placement: { ...IN, yaw: 1 }, pose: championPose(champion) };
  const palm = ink.palmWorld(fig, 'R');
  const purse = [palm[0] + 70, palm[1] - 80];
  const s = {
    stage,
    palm,
    purse,
    back: ctx.anchor('came back.').t,
    paid: ctx.anchor('Tiberius reportedly paid').t,
    sum: ctx.anchor('one hundred thousand sesterces').t,
    ret: ctx.anchor('each to return.').t,
  };
  s.step = s.ret + 0.6;
  const face = [ink.anchorWorld(fig, 'forehead'), ink.anchorWorld(fig, 'chin')];
  s.cuts = [
    {
      at: 0,
      name: 'outside',
      x: 1000,
      y: 520,
      z: 1.05,
      to: { x: 1000, y: 520, z: 1.15 },
      end: s.paid,
    },
    {
      at: s.paid,
      name: 'reverse',
      ...ink.frameOn([face[0], palm], 'medium', { side: 'left', rot: -3 }),
    },
    {
      at: s.sum,
      name: 'coins',
      ...ink.frameOn([palm, purse], 'ecu', {
        side: 'centre',
        rot: 6,
        z: 3.2,
        push: 0.1,
        end: s.ret,
      }),
    },
    {
      at: s.ret,
      name: 'close',
      ...ink.frameOn([face[0], palm], 'close', { side: 'left', height: 0.5 }),
    },
    {
      at: s.step,
      name: 'step',
      x: 1000,
      y: 600,
      z: 1.4,
      ease: 'out',
      to: { x: 1000, y: 620, z: 1.3 },
      end: 7.6,
    },
  ];
  return s;
}

function payer(g, env, cam, s) {
  // The purse held at the bars by a ringed hand from inside the arena (the payer stays a hand).
  const [px, py] = s.purse;
  env.ink.blob(g, cam.env, env.ink.ellipseRing(px, py, 46, 36, 10), env.C.RUST, {
    seed: 61,
    shade: [env.C.RUST_D, -8, 8],
    lw: 6,
  });
  env.ink.brushStroke(g, cam.env, [px - 30, py - 30, px, py - 22, px + 30, py - 30], {
    w: 4,
    seed: 64,
  });
  if (env.t >= s.sum)
    env.ink.drawText('100,000', {
      face: 'hand',
      size: 20,
      x: px,
      y: py + 6,
      seed: 62,
      fill: env.C.LINEN,
      align: 'center',
    });
  const to = cam.toScreen(px + 40, py - 10);
  env.ink.fgScreen(g, (fe) => {
    const arm = env.ink.crowd.foreground(g, fe, {
      kind: 'arm',
      x: 1920,
      y: 260,
      toward: [to.x, to.y],
      s: 1,
      seed: 63,
    });
    const [fx, fy] = arm.points.fingertip;
    env.ink.blob(g, fe, env.ink.ellipseRing(fx + 30, fy - 4, 14, 10, 8), env.C.GOLD, {
      lw: 4,
      seed: 65,
      shade: [env.C.GOLD_D, 0, 3],
    });
  });
}

function paintShot(g, env, s, ctx) {
  const { champion } = ctx.kit.people;
  const gate = ctx.kit.places.arenaGate;
  const cam = env.ink.applyCamera(g, env.ink.resolveCut(s.cuts, env.t));
  const e = cam.env;
  const stepping = env.t >= s.step;
  gate.draw(g, e, env.t, { grille: stepping ? 0.1 : 1, outside: true });
  const pose = env.t >= s.paid && !stepping ? championPose(champion) : 'stand';
  const n = Math.floor(env.time.seg(env.time.twos(env.t), s.sum, s.ret) * 12);
  const out = stepping ? { x: 1000, y: 960 + env.time.seg(env.t, s.step, 7.6) * 40, s: 0.8 } : IN;
  champion.draw(g, e, {
    ...out,
    view: stepping ? 'front' : 'three-quarter',
    pose,
    expr: env.ink.exprAt(
      [
        [0, 'sad'],
        [s.paid, 'confused'],
        [s.sum, 'focused'],
        [s.ret, 'smug'],
      ],
      env.t,
    ),
    t: env.t,
    gag: env.t < s.ret ? { kind: 'fidget', t0: 0, hand: 'L' } : undefined,
    props: env.t >= s.sum && !stepping ? { coins: Math.max(1, n) } : stepping ? { sword: 70 } : {},
  });
  gate.foreground(g, e, env.t, { grille: stepping ? 0.1 : 1 });
  if (env.t >= s.paid && env.t < s.ret) payer(g, env, cam, s);
}

export function update(t, s, ctx) {
  s.stage.paint(t, (g, env) => paintShot(g, env, s, ctx));
}
