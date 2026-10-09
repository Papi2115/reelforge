/* Shots 7-9 (c-cam): still no pope (over the reader's shoulder, the groan in a tilted close-up, the slow "no"), bread
   and water (two-shot of the serve, extreme close-up on the single loaf, push-in on the sniff), still no pope (accusing
   fingers in the foreground, a low tilted close-up on the chin, extreme close-up on the notebook). */
'use strict';
(function () {
  const ST = window.ST, K = ST.key, S = ST.step, CAST = ST.CAST, tw = ST.twos;
  const LATER = { tally: 70, web: 1, candle: 0.4 }; // the hall after the years have passed

  // groan / sniff marks: three short strokes fanning from a point
  ST.marks = (ctx, x, y, dir, seed) => [0, 1, 2].forEach((i) => ST.stroke(ctx, [x + dir * 10, y - 20 + i * 20, x + dir * 40, y - 30 + i * 30], { w: 5, seed: seed + i, taper: false }));

  ST.defineShot('nopope', {
    title: 'Still no pope', role: 'deadlock', note: 'Over the reading cardinal\'s shoulder (his back fills the left of frame) to the table; cut: tilted close-up, the Tired Cardinal groans; cut: close on the Stubborn Cardinal, a slow smug "no".',
    cuts: [[0, 'ots'], [2.25, 'groan'], [3.5, 'shake']],
    render(ctx, t) {
      const tt = tw(t), read = tt < 2.25, T = CAST.tired, B = CAST.stubborn, cut = ST.cut(t, this.cuts).name;
      if (cut === 'ots') ST.camera(ctx, K(t, [[0, 1060], [2.25, 1100]]), 520, K(t, [[0, 1.1], [2.25, 1.16]]));
      else if (cut === 'groan') ST.camera(ctx, 610, 470, K(t, [[2.25, 2.2], [3.5, 2.35]]), -5);
      else ST.camera(ctx, K(t, [[3.5, 1180], [5, 1200]]), 480, K(t, [[3.5, 2.3], [5, 2.45]]));
      ST.setHall(ctx, t, LATER);
      ST.conclave(ctx, t, {
        extras: (i) => (i === 1 ? 'none' : 'sit'),
        tired: { beard: 1, expr: read ? 'exhausted' : 'miserable', headDy: read ? 0 : 16, head: read ? 1 : 2, talk: read ? null : [[2.3, 3.2]], pose: ST.seat(T.D, { hL: ST.handAt(T.D, 1, -0.2, 0.66, 0.5), hR: ST.handAt(T.D, -1, -0.2, 0.68, 0.48) }) },
        stubborn: { head: read ? -1 : ST.shake(t, -1, 0.42), expr: read ? 'deadpan' : 'smug', book: 'shut', pose: ST.seat(B.D, { hL: ST.handAt(B.D, 1, -0.15, 0.48, 0.55), kL: 'grip' }) },
        items: ST.tableBallots(ctx, 12, 650, true),
        after: () => {
          if (cut === 'groan') ST.marks(ctx, 700, 560, 1, 664);
          if (cut === 'ots') { // the reader in the foreground, from behind, ballot held up
            ST.crowdFigure(ctx, { x: 470, y: 1900, s: 4.2, kind: 5, yaw: 3, t, mode: 'vote', seed: 668 });
            if (read) ST.marks(ctx, 740, 380, 1, 669);
          }
        },
      });
    },
  });

  ST.defineShot('bread', {
    title: 'Bread and water', role: 'cut the food', note: 'Two-shot past the jug: the Baker leans in with one loaf; insert: the loaf lands next to the water jug; push-in, slightly tilted: the Tired Cardinal sniffs it and wilts.',
    cuts: [[0, 'serve'], [2.0, 'loaf'], [2.75, 'sniff']],
    render(ctx, t) {
      const tt = tw(t), served = tt >= 2.0, sniff = tt >= 2.75, T = CAST.tired, B = CAST.stubborn, BK = CAST.baker, cut = ST.cut(t, this.cuts).name;
      const bp = { x: 250, y: 900, s: 0.86, t, yaw: 1, loaf: !served, head: served ? 2 : 1, expr: S(t, [[0, 'deadpan'], [2.0, 'disgust']]), talk: [[0.4, 1.6]], pose: ST.pose('stand', BK.D, null, served ? {} : { hR: ST.handAt(BK.D, -1, -0.1, K(t, [[0, 0.45], [1.8, 0.62]]), K(t, [[0, 0.3], [1.8, 0.85]])), kR: 'grip', poleR: [-1, 0.4, -0.5] }) };
      const drop = ST.palmWorld(BK, Object.assign({}, bp, { t: 1.95, pose: ST.pose('stand', BK.D, null, { hR: ST.handAt(BK.D, -1, -0.1, 0.62, 0.85), kR: 'grip', poleR: [-1, 0.4, -0.5] }) }), 'aR', 40);
      if (cut === 'serve') ST.camera(ctx, K(t, [[0, 520], [2.0, 560]]), 520, 1.55);
      else if (cut === 'loaf') ST.camera(ctx, drop[0] + 170, 680, 3.0, 2);
      else ST.camera(ctx, K(t, [[2.75, 560], [6, 540]]), 500, K(t, [[2.75, 2.2], [6, 2.6]]), 3);
      ST.setHall(ctx, t, LATER);
      BK.draw(ctx, bp);
      ST.conclave(ctx, t, {
        extras: (i) => (i === 0 ? 'none' : 'sit'),
        tired: {
          beard: 1, yaw: -1, lean: sniff ? 16 : 6, head: sniff ? -2 : -1, look: sniff ? [-0.3, 0.8] : [0, 0.4], headDy: sniff ? 26 : 12,
          expr: S(t, [[0, 'exhausted'], [2.0, 'confused'], [2.75, 'exhausted'], [4.2, 'sad']]),
          pose: ST.seat(T.D, { hL: ST.handAt(T.D, 1, -0.2, 0.66, 0.5), hR: ST.handAt(T.D, -1, -0.2, 0.68, 0.48) }),
        },
        stubborn: { head: -1, look: [-0.8, 0.4], expr: S(t, [[0, 'deadpan'], [2.0, 'disgust']]), book: 'open', stylus: true, pose: ST.seat(B.D, ST.writeUp(B, sniff ? Math.floor(tt * 6) % 2 : 0)), layer: { L: 2, R: 2 } },
        items: (top) => {
          ST.jug(ctx, 820, top - 14, 680);
          if (served) ST.loaf(ctx, drop[0], top - 16 - (cut === 'loaf' ? Math.max(0, 2.2 - tt) * 300 : 0), 684);
          ST.slip(ctx, 1080, top + 6, 0.3, 688, 0.9);
        },
        after: () => { if (sniff && tt < 4.2) ST.marks(ctx, drop[0] + 60, drop[1] - 110, 1, 690); },
      });
      if (cut === 'serve') ST.fg(ctx, [1480, 1120, 1500, 820, 1560, 700, 1700, 660, 1840, 700, 1900, 820, 1920, 1120], 692, '#2e1a12'); // the stubborn's shoulder, right at the lens
    },
  });

  ST.defineShot('refuse', {
    title: 'Still no pope', role: 'the holdout', note: 'Accusing fingers poke into frame from both sides; cut: low and tilted on the Stubborn Cardinal lifting his chin and turning away; extreme close-up: the stylus adds one more grievance.',
    cuts: [[0, 'fingers'], [1.25, 'chin'], [3.4, 'page']],
    render(ctx, t) {
      const tt = tw(t), B = CAST.stubborn, away = tt >= 1.25, cut = ST.cut(t, this.cuts).name;
      const bp = {
        x: ST.CONCLAVE.STUB_X, y: ST.CONCLAVE.FEET, s: 0.82, t, yaw: 0, head: away ? ST.shake(t, 0, 0.5) : 0, headDy: tt >= 1.25 && tt < 1.4 ? -18 : away ? -8 : 0,
        expr: S(t, [[0, 'rage'], [1.25, 'smug'], [3.4, 'disgust']]), book: 'open', stylus: true,
        pose: ST.seat(B.D, ST.writeUp(B, tt >= 2.4 ? Math.floor(tt * 6) % 2 : 0)), layer: { L: 2, R: 2 },
      };
      if (cut === 'page') { // the book held out to the side of the stylus hand so the page shows
        const A = B.D.l1a + B.D.l2a, w = Math.floor(tt * 6) % 2;
        bp.pose = ST.seat(B.D, Object.assign(B.write(w), { hL: [40, B.D.sy + 0.5 * A, 0.62 * A], hR: [-60 + w * 8, B.D.sy + 0.46 * A, 0.64 * A] }));
      }
      const page = ST.palmWorld(B, bp, 'aL', 34);
      if (cut === 'fingers') ST.camera(ctx, 1290, 500, K(t, [[0, 1.55], [1.25, 1.62]]));
      else if (cut === 'chin') ST.camera(ctx, 1300, 610, K(t, [[1.25, 1.95], [3.4, 2.15]]), 7);
      else ST.camera(ctx, page[0] - 6, page[1] - 2, K(t, [[3.4, 5.0], [5, 5.4]]), -3);
      ST.setHall(ctx, t, LATER);
      ST.conclave(ctx, t, {
        extras: (i) => (i === 1 ? ['sitpoint', 1] : i === 2 ? 'sitpoint' : 'sit'),
        tired: { beard: 1, expr: 'asleep', headDy: 12 },
        stubborn: bp,
        items: ST.tableBallots(ctx, 12, 650, false),
      });
      if (cut === 'fingers') { // two accusing hands right at the lens
        ST.fgArm(ctx, -120, 1000, 560, K(t, [[0, 700], [1.25, 680]]), 694);
        ST.fgArm(ctx, 2040, 860, 1440, K(t, [[0, 560], [1.25, 590]]), 696);
      }
    },
  });
})();
