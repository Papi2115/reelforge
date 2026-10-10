/* Pose library: body-space targets for hands and feet, scaled by each character's own dimensions D (arm length A,
   leg length L). A pose never draws anything. Phase-driven poses take ph in [0,1) - feed them ST.twos time.
   Union of style C and the c-plus films (slouch, hug, throw, crouch, sit, asymmetric stand, extras' act modes) plus
   fold (crossed arms) and face-contact helpers (ST.touch). */
'use strict';
(function () {
  const ST = window.ST;
  const TAU = Math.PI * 2;
  const A = (D) => D.l1a + D.l2a, L = (D) => D.l1l + D.l2l;
  // hand target for side sgn (+1 left, -1 right): out = sideways beyond the shoulder, down from the shoulder, fwd
  const hand = (D, sgn, out, down, fwd) => [sgn * (D.sw + out * A(D)), D.sy + down * A(D), (D.sz || 0) + fwd * A(D)];
  const foot = (D, sgn, out, lift, fwd) => [sgn * (D.hw + out * L(D)), -lift * L(D), fwd * L(D)];
  const feet = (D, o, f) => ({ fL: foot(D, 1, o, 0, f || 0.02), fR: foot(D, -1, o, 0, 0) });
  // a pose never asks an arm for more than it has: a target beyond 96% of the arm is pulled in toward its shoulder
  // (wide bodies with short arms - a ball-shaped senator - fold their arms as far as they reach)
  const fit = (D, sgn, T, k) => {
    const S = [sgn * D.sw, D.sy, D.sz || 0], d = Math.hypot(T[0] - S[0], T[1] - S[1], T[2] - S[2]), r = (k || 0.96) * A(D);
    return d <= r ? T : [S[0] + ((T[0] - S[0]) * r) / d, S[1] + ((T[1] - S[1]) * r) / d, S[2] + ((T[2] - S[2]) * r) / d];
  };
  ST.fitArm = fit;

  ST.POSE = {
    stand: (D) => ({ hL: hand(D, 1, 0.1, 0.9, 0.1), hR: hand(D, -1, 0.1, 0.9, 0.12), fL: foot(D, 1, 0.04, 0, 0.04), fR: foot(D, -1, 0.04, 0, -0.03) }),
    // nobody stands symmetric: weight on the right leg, the left foot forward and turned out, hands uneven (film 14)
    standAsym: (D) => ({ hL: hand(D, 1, 0.12, 0.86, 0.14), hR: hand(D, -1, 0.06, 0.93, 0.06), fL: foot(D, 1, 0.1, 0, 0.12), fR: foot(D, -1, -0.02, 0, -0.04), lean: -1.5 }),
    // weight on one leg: the hip drops on the free side, the free foot turns out (film 12)
    slouch: (D) => ({ hL: hand(D, 1, 0.06, 0.92, 0.04), hR: hand(D, -1, 0.14, 0.86, 0.16), fL: foot(D, 1, -0.02, 0, 0.0), fR: foot(D, -1, 0.14, 0, 0.12), bob: 0.03, lean: -4 }),
    // hands on the hips, elbows out
    akimbo: (D) => Object.assign({ hL: [D.waist[0], D.waist[1], 0.04 * A(D)], hR: [-D.waist[0], D.waist[1], 0.04 * A(D)], poleL: [1, 0, -0.35], poleR: [-1, 0, -0.35], kL: 'flat', kR: 'flat' }, feet(D, 0.08)),
    // both hands together in front of the belly (waiting, praying, holding a small thing)
    clasp: (D) => Object.assign({ hL: fit(D, 1, [D.sw * 0.12, D.sy + 0.62 * A(D), (D.sz || 0) + 0.42 * A(D)]), hR: fit(D, -1, [-D.sw * 0.12, D.sy + 0.64 * A(D), (D.sz || 0) + 0.42 * A(D)]), poleL: [1, 0.3, -0.6], poleR: [-1, 0.3, -0.6] }, feet(D, 0.02)),
    // arms folded across the chest: each hand tucked at the other elbow, elbows forward and out
    fold: (D) => Object.assign({ hL: fit(D, 1, [-D.sw * 0.55, D.sy + 0.4 * A(D), (D.sz || 0) + 0.36 * A(D)]), hR: fit(D, -1, [D.sw * 0.5, D.sy + 0.36 * A(D), (D.sz || 0) + 0.4 * A(D)]), poleL: [1, 0.55, 0.35], poleR: [-1, 0.55, 0.35], kL: 'flat', kR: 'flat' }, feet(D, 0.05)),
    // freezing: arms clamped round the chest, hands tucked in the armpits, shoulders up, knees together (film 12)
    hug: (D) => ({
      hL: fit(D, 1, [-D.sw * 0.6, D.sy + 0.3 * A(D), (D.sz || 0) + 0.3 * A(D)]), hR: fit(D, -1, [D.sw * 0.5, D.sy + 0.38 * A(D), (D.sz || 0) + 0.34 * A(D)]),
      poleL: [1, 0.7, 0.1], poleR: [-1, 0.7, 0.1], kL: 'flat', kR: 'flat', fL: foot(D, 1, -0.05, 0, 0.03), fR: foot(D, -1, -0.04, 0, -0.02), bob: 0.03,
    }),
    // one arm pointing straight ahead at eye level (sgn = which hand), the other hanging
    point: (D, sgn) => {
      const P = ST.POSE.stand(D), k = sgn > 0 ? 'hL' : 'hR';
      P[k] = hand(D, sgn, -0.12, -0.05, 0.95);
      P[sgn > 0 ? 'kL' : 'kR'] = 'point';
      return P;
    },
    // both arms up, wide: the shock pose
    armsUp: (D) => Object.assign({ hL: hand(D, 1, 0.3, -0.85, 0.12), hR: hand(D, -1, 0.3, -0.85, 0.12), kL: 'open', kR: 'open', poleL: [1, 0.2, -0.3], poleR: [-1, 0.2, -0.3] }, feet(D, 0.08, 0)),
    // palms up, elbows in: "what can you do"
    shrug: (D) => Object.assign({ hL: hand(D, 1, 0.4, 0.35, 0.3), hR: hand(D, -1, 0.4, 0.35, 0.3), kL: 'open', kR: 'open', poleL: [1, 0, -0.4], poleR: [-1, 0, -0.4] }, feet(D, 0.05)),
    // the right hand offered forward at belly height (meet it with ST.meet for a real handshake)
    offer: (D) => Object.assign(ST.POSE.stand(D), { hR: hand(D, -1, -0.15, 0.5, 0.85), kR: 'open', poleR: [-1, 0.4, -0.4] }),
    // the joyless jig: arms flap up and down in opposition, one knee lifts per beat, hips bob, body rocks
    jig: (D, ph) => {
      const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU), dl = -0.18 - 0.62 * s, dr = -0.18 + 0.62 * s;
      const out = (d) => 0.4 + 0.15 * Math.max(0, -d);
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
    // spear-thrower throw (right hand): wind-up back and high, release forward at head height, follow-through low
    throw: (D, ph) => {
      const k = ph < 0.45 ? 0 : ph < 0.6 ? (ph - 0.45) / 0.15 : 1;
      const back = hand(D, -1, 0.18, -0.5, -0.6), rel = hand(D, -1, -0.05, -0.25, 0.85), fol = hand(D, -1, -0.12, 0.55, 0.62);
      const hR = k < 1 ? back.map((v, i) => v + (rel[i] - v) * k) : ph < 0.75 ? rel : fol;
      return {
        hL: hand(D, 1, 0.05, 0.05, 0.78), hR, kL: 'point', kR: 'grip', poleL: [1, 0.4, -0.4], poleR: [-1, 0.5, -0.4],
        fL: foot(D, 1, 0.08, 0, 0.32), fR: foot(D, -1, 0.1, 0, -0.26), lean: k < 1 ? -8 : 10,
      };
    },
    // squatting low on bent knees, hands forward and low
    crouch: (D) => ({ hL: hand(D, 1, -0.1, 0.55, 0.62), hR: hand(D, -1, -0.1, 0.62, 0.6), poleL: [1, 0.6, -0.3], poleR: [-1, 0.6, -0.3], kL: 'open', kR: 'grip', fL: foot(D, 1, 0.18, 0, 0.14), fR: foot(D, -1, 0.16, 0, -0.1), bob: 0.25, lean: 12 }),
    // sitting on a box or a rock: hips dropped, feet forward, knees up, hands in the lap
    sit: (D) => ({ hL: hand(D, 1, -0.2, 0.62, 0.55), hR: hand(D, -1, -0.2, 0.6, 0.6), poleL: [1, 0.6, -0.3], poleR: [-1, 0.6, -0.3], kL: 'grip', kR: 'grip', fL: foot(D, 1, 0.12, 0, 0.5), fR: foot(D, -1, 0.08, 0, 0.4), bob: 0.4 }),
    // background act modes (film 15 extras): vote (right hand up), cheer (both up), cross (arms folded low)
    vote: (D) => Object.assign(ST.POSE.stand(D), { hR: hand(D, -1, 0.15, -0.9, 0.1), kR: 'open', poleR: [-1, 0.2, -0.3] }),
    cheer: (D) => Object.assign(ST.POSE.stand(D), { hL: hand(D, 1, 0.3, -0.85, 0.1), hR: hand(D, -1, 0.3, -0.85, 0.1), kL: 'open', kR: 'open', poleL: [1, 0.2, -0.3], poleR: [-1, 0.2, -0.3] }),
  };
  // pose with overrides: ST.pose('stand', D, null, { hR: [...], kR: 'grip' })
  ST.pose = (name, D, ph, over) => Object.assign(ST.POSE[name](D, ph), over || {});
  // a hand target expressed relative to the character's shoulder on side sgn (arm-length units)
  ST.handAt = (D, sgn, out, down, fwd) => hand(D, sgn, out, down, fwd);
  ST.footAt = (D, sgn, out, lift, fwd) => foot(D, sgn, out, lift, fwd);
  // face contact: the palm of hand side ('L'|'R') goes to a face anchor of the character's REAL head drawing:
  // at = 'chin' | 'cheek' | 'nose' | 'mouth' | 'ear' | 'forehead' (cheek/ear pick the hand's own side), dx/dy = offset
  // in head units (px of the head drawing). The guard stays on for the other hand; this hand is drawn in front.
  ST.touch = (side, at, dx, dy, kind) => ({ ['touch' + side]: { at, dx: dx || 0, dy: dy || 0 }, ['k' + side]: kind || 'flat' });
})();
