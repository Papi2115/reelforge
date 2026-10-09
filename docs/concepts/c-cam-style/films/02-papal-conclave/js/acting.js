/* Topic acting helpers built on the shared pose library (ST.handAt / ST.footAt): sitting at the conclave table, holding
   a ballot up, pointing, the head shake. Pure functions of the character's D and of time. */
'use strict';
(function () {
  const ST = window.ST;
  // seated: hips dropped to chair height, feet forward, forearms resting forward at table height
  ST.seat = (D, over) => Object.assign({
    hL: ST.handAt(D, 1, -0.15, 0.48, 0.62), hR: ST.handAt(D, -1, -0.15, 0.5, 0.6), poleL: [1, 0.5, -0.4], poleR: [-1, 0.5, -0.4], kL: 'flat', kR: 'flat',
    fL: ST.footAt(D, 1, 0.06, 0, 0.42), fR: ST.footAt(D, -1, 0.06, 0, 0.38), bob: 0.4,
  }, over || {});
  // a slip of paper held up beside the head (vote / reading the ballot); sgn = which hand
  ST.ballotUp = (D, sgn) => ({ [sgn > 0 ? 'hL' : 'hR']: ST.handAt(D, sgn, 0.35, -0.45, 0.35), [sgn > 0 ? 'poleL' : 'poleR']: [sgn, 0.3, -0.3], [sgn > 0 ? 'kL' : 'kR']: 'grip' });
  // accusing point while seated or standing, toward screen x (sgn of the hand)
  ST.pointAt = (D, sgn, up) => ({ [sgn > 0 ? 'hL' : 'hR']: ST.handAt(D, sgn, 0.1, -0.1 - (up || 0), 0.9), [sgn > 0 ? 'kL' : 'kR']: 'point' });
  // the slow "no": head yaw swings 3/4 left - front - 3/4 right on twos, holding each view
  ST.shake = (t, body, period) => {
    const k = Math.floor(ST.twos(t) / (period || 0.25)) % 4;
    return body + [0, 1, 0, -1][k];
  };
  // a slip of parchment (ballot) at x, y in the current space
  ST.slip = (ctx, x, y, rot, seed, scale) => {
    const k = scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(k, k);
    ST.rough(ctx, [-26, -18, 26, -20, 28, 18, -24, 20], '#b8ad8a', { seed, lw: 4, amp: 1.5, shade: ['#968b6a', -3, 3] });
    [-8, 2].forEach((dy, i) => ST.stroke(ctx, [-16, dy, 0, dy - 2, 16, dy + 1], { w: 2, seed: seed + 1 + i, taper: false }));
    ctx.restore();
  };
})();
