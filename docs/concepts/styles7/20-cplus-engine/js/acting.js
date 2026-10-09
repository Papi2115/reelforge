/* Acting state (no drawing): one expression table every face interprets its own way, speech as clear mouth shapes
   (visemes A E I O F M) instead of a random jaw flap, micro-movements (blink, a lone brow twitch, eye darts, a 1-2 px
   head drift, chewing), all on twos. f.jaw is THE jaw opening (0..1) - heads feed it to ST.jaw (the jaw rule). */
'use strict';
(function () {
  const ST = window.ST;
  // lid: upper lid 0..1 · eye: eye size · pup: pupil size · bl/br: [raise, knit] · sq: lower-lid squint [l, r]
  // mouth: shape key for kit mouths (ST.mouth) · m: { open 0..1, smile -1..1, wide -1..1, round 0..1, twist -1..1,
  // teeth } for hand-drawn mouths · look: pupils. m.open is also f.jaw.
  const X = (lid, eye, pup, bl, br, mouth, m, extra) => Object.assign({ lid, eye, pup, bl, br, mouth, m }, extra || {});
  ST.EXPR = {
    deadpan: X(0.58, 0.96, 1, [-0.15, 0.1], [-0.1, 0.15], 'flat', { open: 0, smile: -0.08, wide: 0 }),
    miserable: X(0.62, 0.95, 1, [0.1, -0.7], [0.05, -0.6], 'frown', { open: 0, smile: -0.7, wide: -0.1 }, { look: [0, 0.3] }),
    exhausted: X(0.78, 0.95, 1, [-0.1, -0.5], [-0.2, -0.4], 'open', { open: 0.3, smile: -0.25, wide: -0.1 }, { look: [0, 0.4] }),
    shock: X(0, 1.3, 0.45, [1.1, -0.2], [1.1, -0.2], 'open', { open: 0.95, smile: -0.2, wide: -0.2, round: 0.7 }),
    rage: X(0.3, 1.06, 0.7, [-0.6, 1.1], [-0.6, 1.1], 'snarl', { open: 0.52, smile: -0.5, wide: 0.7, teeth: true }, { sq: [0.25, 0.25] }),
    smug: X(0.64, 0.98, 1, [-0.25, 0.25], [0.72, 0], 'smirk', { open: 0, smile: 0.6, wide: 0.3, twist: 0.5 }),
    scared: X(0.01, 1.21, 0.5, [0.82, -1], [0.8, -1], 'wavy', { open: 0.3, smile: -0.4, wide: 0.6, teeth: true }),
    confused: X(0.31, 1.04, 0.9, [0.92, -0.3], [-0.42, 0.5], 'twist', { open: 0.07, smile: -0.15, wide: -0.2, twist: 0.6 }),
    sad: X(0.5, 1, 1, [0.2, -1.1], [0.2, -1.1], 'frown', { open: 0, smile: -0.75, wide: -0.2 }, { look: [0, 0.5] }),
    yelling: X(0.12, 1.16, 0.6, [-0.3, 1], [-0.3, 1], 'yell', { open: 1, smile: -0.1, wide: 0.8, teeth: true }),
    disgust: X(0.5, 1, 1, [-0.6, 0.6], [0.5, 0], 'twist', { open: 0.18, smile: -0.5, wide: 0.1, twist: -0.6 }, { sq: [0.45, 0.1] }),
    grin: X(0.41, 1, 1, [0.3, 0], [0.4, 0], 'grin', { open: 0.39, smile: 1, wide: 0.9, teeth: true }, { sq: [0.25, 0.25] }),
    asleep: X(1, 1, 1, [-0.1, -0.3], [-0.1, -0.3], 'open', { open: 0.25, smile: 0, wide: 0 }),
    focused: X(0.44, 1, 0.85, [-0.35, 0.7], [-0.35, 0.7], 'flat', { open: 0, smile: -0.1, wide: -0.35 }, { sq: [0.2, 0.2] }),
    bored: X(0.72, 0.96, 1, [-0.25, 0], [-0.2, 0], 'flat', { open: 0, smile: -0.12, wide: 0 }, { look: [0.3, 0.2] }),
    pleased: X(0.5, 1, 1, [0.25, 0], [0.3, 0], 'smile', { open: 0, smile: 0.7, wide: 0.3 }, { sq: [0.2, 0.2] }),
    nervous: X(0.1, 1.1, 0.6, [0.6, -0.7], [0.7, -0.6], 'wavy', { open: 0.1, smile: -0.3, wide: 0.3 }, { look: [0.5, 0] }),
  };
  // visemes: A (jaw down), O (round), E (wide, teeth), I (half, wide), F (lip under teeth), M (pressed shut)
  ST.VIS = {
    A: { open: 0.85, wide: 0.15 }, O: { open: 0.55, wide: -0.55, round: 1 }, E: { open: 0.32, wide: 0.85, teeth: true },
    I: { open: 0.22, wide: 0.5, teeth: true }, F: { open: 0.12, wide: 0.2, teeth: true, lip: true }, M: { open: 0, wide: -0.1, press: true },
  };
  const ORDER = ['A', 'E', 'O', 'M', 'I', 'A', 'F', 'E', 'O', 'M'];
  // the mouth shape for the current syllable (on twos), or null outside the speech spans [[from, to], ...]
  ST.viseme = (t, seed, spans) => {
    const tt = ST.twos(t);
    for (const [a, b] of spans || []) {
      if (tt < a || tt >= b) continue;
      const f = Math.floor((tt - a) * ST.ANIM);
      if (ST.hash(seed, f, 7) < 0.18) return 'M'; // a short shut between words
      return ORDER[Math.floor(ST.hash(seed, f, 3) * ORDER.length)];
    }
    return null;
  };
  // a lone brow twitch: every ~2.7 s one brow jumps for two frames; -1 = left brow, +1 = right, 0 = none
  ST.twitch = (t, seed) => {
    const P = 2.7, k = Math.floor(t / P), bt = k * P + 0.6 + ST.hash(seed, k, 21) * 1.6, d = ST.twos(t) - bt;
    return d >= 0 && d < 0.17 ? (ST.hash(seed, k, 22) < 0.5 ? -1 : 1) : 0;
  };
  // eye darts: the pupils hop to a new resting spot every ~1.3 s (small, on twos)
  ST.dart = (t, seed) => {
    const k = Math.floor(ST.twos(t) / 1.3);
    return [ST.rnd(-0.25, 0.25, seed, k, 31), ST.rnd(-0.12, 0.12, seed, k, 32)];
  };

  // resolved face at time t. o: { talk: spans, look, chew (gum / grinding jaw), noBlink, still (no darts/twitch),
  // vis: force a viseme (test sheets) }. Unknown expression names fall back to deadpan (characters keep their own
  // extra expression tables and read f.name).
  ST.act = (t, seed, expr, o) => {
    o = o || {};
    const e = ST.EXPR[expr] || ST.EXPR.deadpan, vis = o.vis !== undefined ? o.vis : o.talk ? ST.viseme(t, seed, o.talk) : null;
    const blink = o.noBlink || e.lid >= 1 ? 0 : ST.blink(t, seed), tt = ST.twos(t);
    const tw = o.still ? 0 : ST.twitch(t, seed + 5), dart = o.look || o.still ? [0, 0] : ST.dart(t, seed), base = o.look || e.look || [0, 0];
    const m = Object.assign({ open: 0, smile: 0, wide: 0, round: 0, twist: 0 }, e.m, vis ? ST.VIS[vis] : {});
    if (vis) m.smile = e.m.smile * 0.5;
    const chew = o.chew && !vis ? (Math.floor(tt * 6) % 2 ? 0.12 : 0.02) : 0;
    m.open = Math.max(m.open, chew);
    return {
      name: expr, lid: Math.max(e.lid, blink), blink, eye: e.eye, pup: e.pup, sq: e.sq || [0, 0], look: [base[0] + dart[0], base[1] + dart[1]],
      bl: [e.bl[0] + (tw < 0 ? 0.35 : 0), e.bl[1]], br: [e.br[0] + (tw > 0 ? 0.35 : 0), e.br[1]], twitch: tw ? 1 : 0,
      vis, m, jaw: m.open, chew, mouth: vis && (e.mouth === 'flat' || e.mouth === 'frown') ? 'open' : e.mouth,
      dx: o.still ? 0 : Math.round((ST.noise1(seed + 5, tt * 0.8) - 0.5) * 4),
    };
  };
  // smear frame for a double take: speed strokes trailing (dx, dy) behind (x, y)
  ST.speedLines = (ctx, x, y, dx, dy, n, seed) => {
    const l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * 18, k = 0.6 + 0.4 * ST.hash(seed, i);
      ST.stroke(ctx, [x + nx * o, y + ny * o, x + nx * o - dx * k, y + ny * o - dy * k], { w: 4, seed: seed + i });
    }
  };
})();
