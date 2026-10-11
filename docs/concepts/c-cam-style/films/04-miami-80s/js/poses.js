/* Pose library: body-space targets for hands and feet, scaled by each character's own dimensions D (arm length A,
   leg length L). A pose never draws anything; characters project it through their own views. Phase-driven poses take
   ph in [0,1) and should be fed ST.twos time so the acting stays on twos. */
'use strict';
(function () {
  const ST = window.ST;
  const TAU = Math.PI * 2;
  const A = (D) => D.l1a + D.l2a, L = (D) => D.l1l + D.l2l;
  // hand target for side sgn (+1 left, -1 right): out = sideways beyond the shoulder, down from the shoulder, fwd
  const hand = (D, sgn, out, down, fwd) => [sgn * (D.sw + out * A(D)), D.sy + down * A(D), (D.sz || 0) + fwd * A(D)];
  const foot = (D, sgn, out, lift, fwd) => [sgn * (D.hw + out * L(D)), -lift * L(D), fwd * L(D)];

  ST.POSE = {
    stand: (D) => ({ hL: hand(D, 1, 0.1, 0.9, 0.1), hR: hand(D, -1, 0.1, 0.9, 0.12), fL: foot(D, 1, 0.04, 0, 0.04), fR: foot(D, -1, 0.04, 0, -0.03) }),
    // hands on the hips, elbows out
    akimbo: (D) => ({
      hL: [D.waist[0], D.waist[1], 0.04 * A(D)], hR: [-D.waist[0], D.waist[1], 0.04 * A(D)],
      poleL: [1, 0, -0.35], poleR: [-1, 0, -0.35], kL: 'flat', kR: 'flat', fL: foot(D, 1, 0.08, 0, 0.02), fR: foot(D, -1, 0.08, 0, 0),
    }),
    // both hands together in front of the belly (waiting, praying, holding a small thing)
    clasp: (D) => ({ hL: [D.sw * 0.12, D.sy + 0.62 * A(D), 0.42 * A(D)], hR: [-D.sw * 0.12, D.sy + 0.64 * A(D), 0.42 * A(D)], poleL: [1, 0.3, -0.6], poleR: [-1, 0.3, -0.6], fL: foot(D, 1, 0.02, 0, 0.02), fR: foot(D, -1, 0.02, 0, 0) }),
    // one arm pointing straight ahead at eye level (sgn = which hand), the other hanging
    point: (D, sgn) => {
      const P = ST.POSE.stand(D), k = sgn > 0 ? 'hL' : 'hR';
      P[k] = hand(D, sgn, -0.12, -0.05, 0.95);
      P[sgn > 0 ? 'kL' : 'kR'] = 'point';
      return P;
    },
    // both arms up, wide: the shock pose
    armsUp: (D) => ({ hL: hand(D, 1, 0.3, -0.85, 0.12), hR: hand(D, -1, 0.3, -0.85, 0.12), kL: 'open', kR: 'open', poleL: [1, 0.2, -0.3], poleR: [-1, 0.2, -0.3], fL: foot(D, 1, 0.08, 0, 0), fR: foot(D, -1, 0.08, 0, 0) }),
    // the joyless jig: arms flap up and down in opposition, one knee lifts per beat, hips bob, body rocks
    jig: (D, ph) => {
      const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU), dl = -0.18 - 0.62 * s, dr = -0.18 + 0.62 * s;
      const out = (d) => 0.4 + 0.15 * Math.max(0, -d); // a raised hand also swings wider, so it clears the skull in 3/4
      return {
        hL: hand(D, 1, out(dl) + 0.08 * c, dl, 0.24), hR: hand(D, -1, out(dr) - 0.08 * c, dr, 0.24),
        poleL: [1, 0.3, -0.25], poleR: [-1, 0.3, -0.25], kL: 'open', kR: 'open',
        fL: foot(D, 1, 0.06, Math.max(0, s) * 0.32, Math.max(0, s) * 0.22), fR: foot(D, -1, 0.06, Math.max(0, -s) * 0.32, Math.max(0, -s) * 0.22),
        bob: 0.05 + 0.035 * Math.abs(c), lean: 5 * s,
      };
    },
    // heavy stomp: fists low and swinging fore and aft, knees bent, feet slapping the ground
    stomp: (D, ph) => {
      const s = Math.sin(ph * TAU);
      return {
        hL: hand(D, 1, 0.22, 0.62, 0.35 * s), hR: hand(D, -1, 0.22, 0.62, -0.35 * s),
        fL: foot(D, 1, 0.1, Math.max(0, s) * 0.22, 0.12 * s), fR: foot(D, -1, 0.1, Math.max(0, -s) * 0.22, -0.12 * s),
        bob: 0.09 - 0.04 * Math.abs(s), lean: -3 * s,
      };
    },
    // wild, exhausted flailing: one arm high, one out, alternating every half beat
    flail: (D, ph) => {
      const up = Math.floor(ph * 2) % 2 === 0, s = Math.sin(ph * TAU);
      return {
        hL: up ? hand(D, 1, 0.25, -0.8, 0.15) : hand(D, 1, 0.65, 0.15, 0.2), hR: up ? hand(D, -1, 0.65, 0.15, 0.2) : hand(D, -1, 0.25, -0.8, 0.15),
        poleL: [1, 0.2, -0.3], poleR: [-1, 0.2, -0.3], kL: 'open', kR: 'open',
        fL: foot(D, 1, 0.12, up ? 0.25 : 0, up ? 0.15 : 0), fR: foot(D, -1, 0.12, up ? 0 : 0.25, up ? 0 : 0.15), bob: 0.07, lean: 7 * s,
      };
    },
    // spent: arms dangling forward, knees bent, leaning
    slump: (D) => ({ hL: hand(D, 1, -0.02, 0.92, 0.32), hR: hand(D, -1, 0.0, 0.94, 0.28), kL: 'open', kR: 'open', fL: foot(D, 1, 0.1, 0, 0.1), fR: foot(D, -1, 0.1, 0, -0.06), bob: 0.12, lean: 9 }),
    // walking: opposite arm and leg swing, the swinging foot lifts
    walk: (D, ph) => {
      const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU);
      return {
        hL: hand(D, 1, 0.08, 0.88, -0.3 * s), hR: hand(D, -1, 0.08, 0.88, 0.3 * s),
        fL: foot(D, 1, 0.02, Math.max(0, c) * 0.12, 0.28 * s), fR: foot(D, -1, 0.02, Math.max(0, -c) * 0.12, -0.28 * s), bob: 0.025 * Math.abs(c),
      };
    },
  };
  // pose with overrides: ST.pose('stand', D, null, { hR: [...], kR: 'grip' })
  ST.pose = (name, D, ph, over) => Object.assign(ST.POSE[name](D, ph), over || {});
  // a hand target expressed relative to the character's shoulder on side sgn (arm-length units)
  ST.handAt = (D, sgn, out, down, fwd) => hand(D, sgn, out, down, fwd);
  ST.footAt = (D, sgn, out, lift, fwd) => foot(D, sgn, out, lift, fwd);
})();
