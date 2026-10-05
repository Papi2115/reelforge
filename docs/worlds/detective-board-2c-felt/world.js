/* detective-board 2c "felt" - the thread plan: every connection is a real thread between two items on the
 * one canvas, with its own schedule on the global timeline. Built once (pure), read every frame. */
(function () {
  'use strict';
  const F = window.FELT;
  const K = F.K;
  const L = F.L;
  const A = F.A;
  const TH = F.TH;
  const E = F.ease;
  const X = (it, p) => K.xf(it, p[0], p[1]);

  const k0 = X(L.ticket, A.TICKET.k0);
  const u1 = X(L.ticket, A.TICKET.u1);
  const u1b = X(L.ticket, [A.TICKET.u1[0] + 5, A.TICKET.u1[1] + 1]);
  const k1 = X(L.man, A.MAN.k1);
  const e1 = X(L.man, [44, 14]);
  const k2 = X(L.briefcase, A.BRIEF.k2);
  const k3 = X(L.cash, A.CASH.k3);
  const e3 = X(L.cash, [2, 27]);
  const chute0 = L.chutes[0];
  const k4 = X(chute0, A.CHUTE.pack);
  const k5 = X(L.map, [A.MAP.seattle[0] - 4, A.MAP.seattle[1] + 3]);
  const jump = X(L.map, A.MAP.jump);
  const sus = L.suspects;
  const k6 = X(sus[1], A.SUSPECT_KNOTS[1]);
  const k7 = X(L.river, A.RIVER.k7);
  const k8 = X(L.tag, A.TAG.k8);
  const e10 = X(L.tag, [62, 40]);
  const mapPts = [[5, -78], [15, -54], [21, -38], A.MAP.jump].map((p) => X(L.map, p));

  // ---------------------------------------------------------------- the main thread, in order
  const hookSlack = (T) => {
    if (T < 3.12) return 3.6;
    if (T < 3.3) return 3.6 + 1.2 * E.out(F.prog(T, 3.12, 3.3));
    const k = F.prog(T, 3.3, 3.52);
    return 4.8 * (1 - E.outBack(k)) + (T > 3.52 ? F.twang(T - 3.52, 5.5, 7) * 0.7 : 0);
  };
  const S = [
    { id: 's1', pts: [k0, u1], t0: 1.55, t1: 2.65, emerge: 0.65, dive: 0.4, slack: hookSlack, knotStartAt: 3.42, seed: 11, r: 1.15, ease: E.inOut },
    { id: 's2', pts: [u1b, [500, 702], [580, 674], [628, 624], k1], t0: 7.7, t1: 11.2, tack: 15, seed: 12, knotStart: false },
    { id: 's3', pts: [e1, [790, 540], [870, 455], [930, 418], k2], t0: 14.15, t1: 15.9, tack: 16, seed: 13 },
    { id: 's4', pts: [k2, [1010, 368], [1080, 368], k3], t0: 17.3, t1: 18.3, tack: 14, seed: 14, knotStart: false },
    { id: 's5', pts: [e3, [1158, 468], [1210, 462], k4], t0: 19.85, t1: 20.7, tack: 15, seed: 15 },
    { id: 's6', pts: [k4, [1290, 508], [1400, 520], [1500, 486], [1600, 448], k5], t0: 23.05, t1: 24.8, tack: 17, seed: 16, knotStart: false },
    { id: 's7', pts: [k5].concat(mapPts), t0: 33.95, t1: 35.0, tack: 13, seed: 17, knotStart: false, emerge: 0.5, bigEnd: true },
    { id: 's8', pts: [jump, X(L.map, [-24, 6]), X(L.map, [-66, 40]), X(L.map, [-110, 82]), [1480, 640], [1362, 830], [1160, 930], [1060, 976], k6], t0: 39.55, t1: 41.6, tack: 17, seed: 18, knotStart: false,
      tug: { t0: 42.2, t1: 43.2, from: 0 }, unpick: { t0: 43.2, t1: 44.05, to: 0.8 } },
    { id: 's9', pts: null, t0: 48.15, t1: 51.0, tack: 16, seed: 19, knotStart: false, ease: E.inOut, emerge: 0.6 },
    { id: 's10', pts: [k7, [1640, 1072], [1780, 1012], [1880, 932], k8], t0: 56.05, t1: 57.6, tack: 16, seed: 20, knotStart: false },
    { id: 's11', pts: [e10, [2084, 944], L.park ? [L.park.x, L.park.y] : e10], t0: 58.35, t1: 59.0, seed: 21, emerge: 0.3, park: true, knotEnd: false,
      slack: (T) => (T < 59 ? 2.5 : 2.5 + 1.5 * E.out(F.prog(T, 59, 59.6))) },
  ];
  const segs = [];
  for (const d of S) {
    if (d.id === 's9') {
      const s8 = segs[segs.length - 1];
      const p = TH.at(s8, s8.total * s8.unpick.to);
      d.pts = [[p[0], p[1]], [p[0] + 60, p[1] - 6], [1380, 942], [1474, 984], k7];
      F.P_POINT = [p[0], p[1]];
      s8.tug.from = s8.total * s8.unpick.to;
    }
    segs.push(TH.build(d));
  }
  F.MAIN = segs;
  F.MAIN_BY = {};
  for (const g of segs) F.MAIN_BY[g.id] = g;

  // ---------------------------------------------------------------- the theory fan from the jump knot
  const live = L.liveScrap;
  const die = L.dieScrap;
  const liveEnd = X(live, [-(F.textWidth('DID HE LIVE?', 2) + 18) / 2 + 5, 2]);
  const dieEnd = X(die, [(F.textWidth('DID HE DIE?', 2) + 18) / 2 - 5, -1]);
  const mp = (u, v) => X(L.map, [u, v]);
  const fans = [
    { id: 'f1', pts: [jump, mp(70, -18), mp(140, -4), mp(186, 30), [1920, 690], liveEnd], t0: 35.6, t1: 36.65, tack: 15, seed: 31 },
    { id: 'f3', pts: [jump, mp(-14, -58), mp(-70, -104), mp(-118, -150), [1540, 344]], t0: 35.68, t1: 36.2, tack: 14, seed: 33, loose: true },
    { id: 'f2', pts: [jump, mp(-36, -6), mp(-100, 40), [1556, 646], dieEnd], t0: 35.82, t1: 37.0, tack: 15, seed: 32 },
    { id: 'f4', pts: [jump, mp(-50, -30), mp(-130, -26), [1500, 504], [1452, 520]], t0: 36.0, t1: 36.42, tack: 13, seed: 34, loose: true },
    { id: 'f5', pts: [jump, mp(-40, -20), mp(-150, 4), [1460, 580], [1240, 720], [1040, 800], [906, 860], X(sus[0], A.SUSPECT_KNOTS[0])], t0: 36.08, t1: 37.3, tack: 17, seed: 35,
      loosen: { t0: 44.35, t1: 45.3 } },
    { id: 'f9', pts: [jump, mp(12, 24), mp(-14, 80), mp(-26, 150), [1640, 760], [1460, 870], [1230, 920], X(sus[2], A.SUSPECT_KNOTS[2])], t0: 36.22, t1: 37.42, tack: 17, seed: 39,
      loosen: { t0: 44.7, t1: 45.7 } },
    { id: 'f6', pts: [jump, mp(20, 24), mp(6, 84), mp(2, 150), [1700, 800], [1660, 880], [1626, 944]], t0: 36.3, t1: 37.05, tack: 15, seed: 36, loose: true },
  ];
  for (const f of fans) {
    f.knotStart = false;
    f.r = 0.95;
    f.ease = E.out;
  }
  F.FANS = fans.map(TH.build);

  /** Small needles that run the fan threads while they are laid. */
  F.fanNeedles = function (T) {
    const out = [];
    for (const g of F.FANS) {
      if (T < g.t0 || T > g.t1 + 0.3) continue;
      const n = TH.needle([Object.assign({}, g, { emerge: 0, dive: 0.28 })], T);
      if (n) out.push(n);
    }
    return out;
  };
})();
