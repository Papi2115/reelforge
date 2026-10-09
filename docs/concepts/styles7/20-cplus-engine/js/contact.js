/* Shared contact: two characters (or a character and a prop) touching at ONE world point. Each hand used to be a
   body-space guess from its own character's size, so any change of scale / yaw / camera broke the meeting (film 15:
   the deck handshake missed by ~240 px). Here the contact point is computed in world (or screen) space from the very
   transforms the drawing uses (ST.figMatrix, ST.camMatrix) and both arms are solved to it, palm on palm.
   ST.meet          handshake, coin / ledger hand-over, high five, two hands on one object
   ST.handAtWorld   a palm on a world point (a prop, a counter, another character's shoulder via ST.anchorWorld)
   ST.palmWorld / ST.anchorWorld   where a palm / an anchor of a drawn character is in the world */
'use strict';
(function () {
  const ST = window.ST, aff = () => ST.aff;
  const matrix = (R, cam) => aff().mul(ST.camMatrix(cam), ST.figMatrix(R.frame));
  const sideSgn = (side) => (side === 'L' ? 1 : -1);

  ST.palmWorld = (ch, p, side, cam) => {
    const R = ch.solveFor(p);
    return aff().apply(matrix(R, cam), ST.palm(R.J['a' + side], ch.spec.arm.hsz));
  };
  // name: 'neck' | 'head' | 'shoulderNear' | 'shoulderFar' | 'shoulderL' | 'shoulderR' | a face anchor ('chin', ...)
  ST.anchorWorld = (ch, p, name, cam) => {
    const R = ch.solveFor(p), A = R.A;
    const q = name === 'neck' ? A.neck : name === 'head' ? [A.head.cx, (A.head.top + A.head.bottom) / 2]
      : name === 'shoulderNear' ? A.shoulderNear.p : name === 'shoulderFar' ? A.shoulderFar.p
        : name === 'shoulderL' ? A.sh.L.p : name === 'shoulderR' ? A.sh.R.p : A.facePoint(name, null);
    return q ? aff().apply(matrix(R, cam), q) : null;
  };

  // pose overrides that put the palm of hand `side` on a world point. Keeps the hand's natural depth, pulls it toward
  // the shoulder's depth when the 3D reach would be exceeded (ST.fitReach). Returns { over, reach (2D distance / max), ok }.
  ST.handAtWorld = (ch, p, side, world, cam, base) => {
    const p0 = Object.assign({}, p, { pose: base || ch.pose(p) }), R = ch.solveFor(p0), A = R.A, D = ch.D, j = R.J['a' + side];
    const f = aff().apply(aff().inv(matrix(R, cam)), world), S = A.sh[side].b, s2 = A.sh[side].p;
    const q = ST.proj(R.V, j.T3);
    let T = ST.lift(R.V, j.T3, f[0] - q[0], f[1] - q[1]);
    const len = D.l1a + D.l2a;
    T = ST.fitReach(R.V, S, T, len * 0.97);
    const reach = Math.hypot(f[0] - s2[0], f[1] - s2[1]) / (len * 0.98 + 0.5 * ch.spec.arm.hsz);
    return { over: { ['h' + side]: T, ['abs' + side]: true, ['palm' + side]: true }, reach, ok: reach <= 1 };
  };

  // a: { ch, p, hand: 'R' | 'L', cam, kind }, b: { ... }. point: 'mid' (default) | 'a' | 'b' | [x, y] (world).
  // offer: [out, down, fwd] where a free hand would be offered (arm-length units, default a handshake); 'mid' is
  // weighted by the two reaches, so the longer arm does more of the work.
  // move: true -> a character whose arm would be stretched over 90% is slid along x toward the point (only as far
  // as needed, at most 1.2 arm lengths, never into the other body; a straight-armed handshake looks stiff anyway).
  // Returns { a: p for a, b: p for b (pose + x set), point, gap (px between the palms), moved: [dxa, dxb], ok, reason }.
  // A meeting that cannot be reached is REPORTED (ok false + reason), never faked.
  ST.meet = (o) => {
    const offer = o.offer || [-0.15, 0.5, 0.85], sides = [o.a, o.b], moved = [0, 0];
    const ch0 = (s) => s.ch.pose(s.p);
    const natural = (s) => {
      const P = ch0(s), sg = sideSgn(s.hand);
      P['h' + s.hand] = ST.handAt(s.ch.D, sg, offer[0], offer[1], offer[2]);
      return ST.palmWorld(s.ch, Object.assign({}, s.p, { pose: P }), s.hand, s.cam);
    };
    const ps = sides.map((s) => Object.assign({}, s.p));
    const reachOf = (i) => (sides[i].ch.D.l1a + sides[i].ch.D.l2a) * ps[i].s;
    const w = sides.map((s, i) => natural(Object.assign({}, s, { p: ps[i] }))), k = reachOf(0) / (reachOf(0) + reachOf(1)); // 'mid' leans toward the shorter reach
    const point = Array.isArray(o.point) ? o.point : o.point === 'a' ? w[0] : o.point === 'b' ? w[1] : [w[0][0] + (w[1][0] - w[0][0]) * k, w[0][1] + (w[1][1] - w[0][1]) * k];
    // a handshake never happens in front of anybody's face: keep the point below both chins (+ a hand)
    if (!Array.isArray(o.point)) sides.forEach((s, i) => {
      const R = s.ch.solveFor(ps[i]), M = aff().mul(ST.camMatrix(s.cam), ST.figMatrix(R.frame)), hb = R.A.head;
      const chin = aff().apply(M, [hb.cx, hb.bottom + s.ch.spec.arm.hsz * 1.2]);
      if (point[1] < chin[1]) point[1] = chin[1];
    });
    for (let it = 0; it < 4 && o.move; it++) { // slide whoever is over-stretched (> 90% of the arm) toward the point
      let again = false;
      sides.forEach((s, i) => {
        const r = ST.handAtWorld(s.ch, ps[i], s.hand, point, s.cam);
        if (r.reach <= 0.9) return;
        const sh = ST.anchorWorld(s.ch, ps[i], 'shoulder' + s.hand, s.cam), need = (r.reach - 0.88) * (s.ch.D.l1a + s.ch.D.l2a) * ps[i].s;
        const cos = Math.abs(point[0] - sh[0]) / Math.max(1, Math.hypot(point[0] - sh[0], point[1] - sh[1])), dx = (Math.sign(point[0] - sh[0]) * need) / Math.max(0.4, cos);
        const cap = (s.ch.D.l1a + s.ch.D.l2a) * ps[i].s * 1.2; // never walk anybody across the set: report instead
        let step = Math.max(-cap - moved[i], Math.min(cap - moved[i], dx));
        const o2 = ps[1 - i], gapMin = 1.6 * (s.ch.D.sw * ps[i].s + sides[1 - i].ch.D.sw * o2.s), side2 = Math.sign(ps[i].x - o2.x) || 1;
        if (side2 * (ps[i].x + step - o2.x) < gapMin) step = o2.x + side2 * gapMin - ps[i].x; // never walk into the other body
        if (Math.sign(step) !== Math.sign(dx)) step = 0;
        if (Math.abs(step) < 0.5) return;
        ps[i].x += step;
        moved[i] += step;
        again = true;
      });
      if (!again) break;
    }
    const out = sides.map((s, i) => {
      const r = ST.handAtWorld(s.ch, ps[i], s.hand, point, s.cam);
      return Object.assign(ps[i], { pose: Object.assign(ch0(Object.assign({}, s, { p: ps[i] })), r.over, { ['k' + s.hand]: s.kind || 'grip' }), reach: r.reach });
    });
    const pa = ST.palmWorld(o.a.ch, out[0], o.a.hand, o.a.cam), pb = ST.palmWorld(o.b.ch, out[1], o.b.hand, o.b.cam);
    const gap = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]), short = out.filter((p) => p.reach > 1).length;
    return { a: out[0], b: out[1], point, gap, moved, ok: gap <= 4, reason: gap <= 4 ? '' : short ? 'out of reach (sliding along x was not enough: change y, scale or point)' : 'did not converge' };
  };
})();
