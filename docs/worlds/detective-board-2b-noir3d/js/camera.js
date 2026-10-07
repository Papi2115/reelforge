/* ONE camera path for the whole 64 s film. Holds, eased moves, and "follow" segments in which the camera rides the
 * string tip from one item to the next (target = lagged tip + an offset that eases from the start to the end framing).
 * Segment boundaries are continuous in position and (eased) velocity, so "Play all" has no cuts. */
'use strict';
(function () {
  const NB = window.NB;
  const S = NB.story;
  const B = NB.world.G.board;
  const bp = (u, v, h) => [B.cx + u, B.cy + v, -(h || 0)];
  const P = (target, yaw, pitch, dist, f, roll) => ({ target, yaw, pitch, dist, f: f || 900, roll: roll || 0 });

  const POSE = {
    window: P([1.72, 1.74, 1.45], -9, 1, 2.75, 860),
    wide0: P([0.55, 1.52, 0.4], -21, 4, 4.7, 740),
    sketch: P(bp(-0.56, 0.37), -8, -4, 1.06),
    ticket: P(bp(-0.98, -0.1), 7, -2, 1.02),
    plane: P(bp(-0.74, -0.33), 10, 0, 0.98),
    A: P(bp(-0.74, -0.02), 15, 1, 1.85),
    brief: P(bp(-0.34, -0.27), 6, -3, 0.9),
    demand: P(bp(-0.05, 0.0), -2, -2, 0.82),
    seattle: P(bp(0.17, 0.35), -9, 4, 0.72),
    map: P([0.1, 0.8, -1.1], -8, -50, 0.74),
    mapClose: P([0.115, 0.8, -1.105], -11, -52, 0.6),
    jump: P(bp(0.58, 0.0), -9, -4, 0.7),
    fan: P(bp(0.68, -0.1), -18, -3, 1.45),
    spent: P(bp(0.98, -0.36), -22, -6, 0.98, 900, -3),
    spentClose: P(bp(1.0, -0.41), -24, -7, 0.8, 900, -4.5),
    river: P(bp(-0.3, -0.52), -4, -6, 0.86),
    landed: P(bp(0.2, -0.42), -10, -4, 1.45),
    memo: P(bp(0.86, 0.5), -14, 4, 0.8),
    sweep: P(bp(-0.45, 0.25), 12, -3, 1.9, 860),
    final: P([0.35, 1.52, 0.3], -21, 3, 4.35, 760),
    
  };
  const seg = (t0, t1, kind, to, extra) => Object.assign({ t0, t1, kind, to: POSE[to] }, extra || {});
  const TRACK = [
    seg(0, 0.95, 'hold', 'window'),
    seg(0.95, 2.45, 'move', 'wide0', { ease: 'inOut' }),
    seg(2.45, 2.75, 'hold', 'wide0'),
    seg(2.75, 4.9, 'move', 'sketch', { ease: 'quint' }),
    seg(4.9, 7.15, 'hold', 'sketch'),
    seg(7.15, 9.0, 'follow', 'ticket', { s: 's1' }),
    seg(9.0, 10.9, 'hold', 'ticket'),
    seg(10.9, 12.55, 'follow', 'plane', { s: 's2' }),
    seg(12.55, 13.9, 'move', 'A'),
    seg(13.9, 15.1, 'hold', 'A'),
    seg(15.1, 16.85, 'follow', 'brief', { s: 's3' }),
    seg(16.85, 17.75, 'hold', 'brief'),
    seg(17.75, 18.75, 'follow', 'demand', { s: 's4' }),
    seg(18.75, 20.3, 'hold', 'demand'),
    seg(20.3, 21.85, 'follow', 'seattle', { s: 's5' }),
    seg(21.85, 23.6, 'hold', 'seattle'),
    seg(23.6, 26.3, 'follow', 'map', { s: 's6', breathe: 0.45 }),
    seg(26.3, 27.7, 'hold', 'map'),
    seg(27.7, 30.6, 'move', 'mapClose', { ease: 'sine' }),
    seg(30.6, 31.6, 'hold', 'mapClose'),
    seg(31.6, 33.95, 'follow', 'jump', { s: 's7', breathe: 0.45 }),
    seg(33.95, 34.7, 'hold', 'jump'),
    seg(34.7, 36.4, 'move', 'fan'),
    seg(36.4, 40.0, 'hold', 'fan'),
    seg(40.0, 41.45, 'follow', 'spent', { s: 's11' }),
    seg(41.45, 41.9, 'hold', 'spent'),
    seg(41.9, 43.05, 'move', 'spentClose', { ease: 'sine' }),
    seg(43.05, 47.7, 'hold', 'spentClose'),
    seg(47.7, 49.85, 'follow', 'river', { s: 's11', relay: 1, breathe: 0.25 }),
    seg(49.85, 51.45, 'hold', 'river'),
    seg(51.45, 53.0, 'follow', 'landed', { s: 's12' }),
    seg(53.0, 55.0, 'hold', 'landed'),
    seg(55.0, 56.85, 'follow', 'memo', { s: 's13', breathe: 0.35 }),
    seg(56.85, 58.0, 'hold', 'memo'),
    seg(58.0, 61.2, 'follow', 'sweep', { s: 's14' }),
    seg(61.2, 63.7, 'move', 'final', { ease: 'inOut' }),
    seg(63.7, 65.0, 'hold', 'final'),
  ];
  const DUR = 65.0;
  const SBY = {};
  S.STRINGS.forEach((s) => (SBY[s.id] = s));

  function blend(a, b, k) {
    return {
      tx: NB.lerp(a.target[0], b.target[0], k),
      ty: NB.lerp(a.target[1], b.target[1], k),
      tz: NB.lerp(a.target[2], b.target[2], k),
      yaw: NB.lerp(a.yaw, b.yaw, k),
      pitch: NB.lerp(a.pitch, b.pitch, k),
      dist: NB.lerp(a.dist, b.dist, k),
      f: NB.lerp(a.f, b.f, k),
      roll: NB.lerp(a.roll, b.roll, k),
    };
  }
  /** Where the carried pin is at t for a string (ignores the camera). */
  function tipPos(s, t, relay) {
    const g = S.stringAt(s, t);
    if (g && g.tip) return g.tip;
    const ref = relay ? s.relay.to : s.b;
    const p = S.pinAt(ref, t);
    return p ? p.neck : null;
  }
  function poseAt(tIn) {
    const t = NB.clamp(tIn, 0, DUR);
    let i = 0;
    while (i < TRACK.length - 1 && t >= TRACK[i].t1) i++;
    const sg = TRACK[i];
    const from = i > 0 ? TRACK[i - 1].to : sg.to;
    const k = NB.seg(t, sg.t0, sg.t1);
    const toRad = (p) => Object.assign(p, { yaw: (p.yaw * Math.PI) / 180, pitch: (p.pitch * Math.PI) / 180, roll: (p.roll * Math.PI) / 180 });
    if (sg.kind === 'hold') return toRad(blend(sg.to, sg.to, 0));
    if (sg.kind === 'move') return toRad(blend(from, sg.to, NB.E[sg.ease || 'inOut'](k)));
    // follow: lagged tip + offset easing between the framings
    const s = SBY[sg.s];
    const ts = sg.relay ? s.relay.t0 : s.t0;
    const te = sg.relay ? s.relay.t1 : s.t1;
    const tA = tipPos(s, ts + 1e-4, sg.relay);
    const tB = tipPos(s, te + 0.01, sg.relay);
    const tip = tipPos(s, NB.clamp(t - 0.05, ts + 1e-4, te + 0.01), sg.relay);
    const e = NB.E.inOut(k);
    const off0 = [from.target[0] - tA[0], from.target[1] - tA[1], from.target[2] - tA[2]];
    const off1 = [sg.to.target[0] - tB[0], sg.to.target[1] - tB[1], sg.to.target[2] - tB[2]];
    const w = sg.loose ? 1 - e : 1;
    const tgt = [0, 1, 2].map((j) => {
      const locked = tip[j] + NB.lerp(off0[j], off1[j], e);
      const free = NB.lerp(from.target[j], sg.to.target[j], e);
      return NB.lerp(free, locked, w);
    });
    const p = blend(from, sg.to, e);
    p.dist += (sg.breathe || 0) * Math.sin(Math.PI * e);
    p.tx = tgt[0];
    p.ty = tgt[1];
    p.tz = tgt[2];
    return toRad(p);
  }

  const SHOTS = [
    { id: 1, title: 'Hook', t0: 0, t1: 7, focal: 'the faceless sketch in the lamp pool',
      narration: 'November 24, 1971. A man hijacks a jet, takes the money, and jumps into the night. Who was he?' },
    { id: 2, title: 'A - ticket', t0: 7, t1: 15, focal: 'DAN COOPER on the ticket, then the correction',
      narration: 'He flew as Dan Cooper - "D. B." was a press mix-up. Northwest Orient, flight 305, Portland to Seattle, the day before Thanksgiving.' },
    { id: 3, title: 'A - demand', t0: 15, t1: 23.5, focal: '$200,000, circled',
      narration: 'His briefcase, he said, held a bomb. He demanded $200,000 and four parachutes. In Seattle, the Boeing 727 took on fuel, and the passengers were released.' },
    { id: 4, title: 'B - the desk', t0: 23.5, t1: 31.5, focal: 'the dashed stretch of the route under the lens',
      narration: 'From Seattle the jet turned south, bound for Mexico City. Somewhere along this line, he stepped off.' },
    { id: 5, title: 'B - the jump', t0: 31.5, t1: 39.5, focal: 'the lowered rear stair, then three open questions',
      narration: 'He lowered the rear stair and jumped into the night. Did he survive? Did he die in the jump? Landed where? Nobody knows.' },
    { id: 6, title: 'C - tension', t0: 39.5, t1: 46.5, focal: 'SPENT THE MONEY? tearing loose',
      narration: 'If he survived, he would have spent the money. But for years, not one ransom bill turned up.' },
    { id: 7, title: 'Turn - 1980', t0: 46.5, t1: 54.5, focal: '$5,800 on the river print',
      narration: 'Then, in 1980, a boy on the bank of the Columbia River found about $5,800 of it.' },
    { id: 8, title: 'Payoff - 2016', t0: 54.5, t1: 65, focal: 'SUSPENDED, then the whole connected board',
      narration: 'In 2016, the FBI suspended its active investigation. The man the press named D. B. Cooper was never identified.' },
  ];

  NB.camera = { poseAt, POSE, TRACK, DUR, SHOTS };
})();
