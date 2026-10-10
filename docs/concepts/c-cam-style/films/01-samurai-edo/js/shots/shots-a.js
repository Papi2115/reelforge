/* Shots 1-3: title poster, waking up at dawn, the daydream and the real desk. render(ctx, t) paints the whole frame
   for shot time t. Acting is on twos: poses come from ST.twos(t), expression changes snap, turns walk through 3/4. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, K = ST.key, S = ST.step, CAST = ST.CAST;
  const tw = ST.twos;

  // heavy poster lettering: bone fill, rust extrusion, fat ink outline; letters thud in one by one on twos
  ST.posterWord = (ctx, word, x, y, size, t, t0, rotBase) => {
    ctx.save();
    ctx.font = `${size}px Impact, 'Arial Black', sans-serif`;
    const widths = [...word].map((ch) => ctx.measureText(ch).width * 0.97), total = widths.reduce((a, b) => a + b, 0);
    let cx = x - total / 2;
    [...word].forEach((ch, i) => {
      const on = tw(t) >= t0 + i * 0.04, lx = cx + widths[i] / 2, rot = rotBase + ST.rnd(-4, 4, 77, i), dy = ST.rnd(-8, 8, 78, i);
      cx += widths[i];
      if (!on) return;
      const drop = tw(t) < t0 + i * 0.04 + 0.09 ? -18 : 0;
      ctx.save();
      ctx.translate(lx, y + dy + drop);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      const ex = size * 0.07;
      ctx.lineWidth = size * 0.1;
      ctx.strokeStyle = C.INK;
      ctx.strokeText(ch, ex * 0.7, ex);
      ctx.fillStyle = '#5c2616';
      for (let d = ex; d > 0; d -= 2) ctx.fillText(ch, d * 0.7, d);
      ctx.strokeText(ch, 0, 0);
      ctx.fillStyle = '#cdbf94';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  };

  ST.defineShot('title', {
    title: 'Title', role: 'poster', note: 'Grimy poster: Edo castle at dusk, the three mains lined up - the stern Elder, you (nervous), the Merchant with his gold.',
    render(ctx, t) {
      ST.cutCam(ctx, t, [[0, 4, [960, 500, 1.14], [960, 540, 1.0]]]); // slow pull-back off the poster
      ST.setTitle(ctx);
      const Y = CAST.you, E = CAST.elder, M = CAST.merchant;
      E.draw(ctx, { x: 430, y: 1066, s: 0.66, t, yaw: 1, expr: S(t, [[0, 'disgust'], [2.4, 'rage']]), stamp: true, pose: ST.pose('stand', E.D, null, ST.elderStamp(E.D, 0.4)) });
      M.draw(ctx, { x: 1500, y: 1066, s: 0.72, t, yaw: -1, expr: S(t, [[0, 'smug'], [2.0, 'grin']]), koban: [2, 3], pose: ST.pose('stand', M.D, null, ST.merchantOffer(M.D, 0.2)) });
      Y.draw(ctx, { x: 960, y: 1070, s: 0.68, t, yaw: 0, expr: S(t, [[0, 'scared'], [2.8, 'shock'], [3.2, 'scared']]), headDy: tw(t) >= 2.8 && tw(t) < 3.0 ? -14 : 0, look: [0.6, 0] });
      ST.posterWord(ctx, 'WOULD YOU SURVIVE', 960, 96, 100, t, 0.1, -3);
      ST.posterWord(ctx, 'AS A SAMURAI', 960, 222, 150, t, 0.8, 2);
      ST.posterWord(ctx, 'IN PEACEFUL JAPAN?', 960, 350, 92, t, 1.4, -2);
      if (tw(t) >= 2.1) {
        ST.rough(ctx, [740, 410, 1190, 402, 1198, 456, 732, 462], C.INK, { seed: 79, lw: 6, lineColor: C.MUSTARD });
        ST.label(ctx, 'EDO PERIOD  ·  c. 1750', 965, 432, { size: 38, fill: C.MUSTARD, rot: -1 });
      }
    },
  });

  ST.defineShot('wake', {
    title: 'Waking up', role: 'setting', note: 'Your room at dawn: you sleep on a thin futon, wake, sit up in two jerks, see the swords on the rack - one gleams - and smile.',
    render(ctx, t) {
      ST.cutCam(ctx, t, [
        [0, 2.4, [960, 520, 1.0], [980, 560, 1.12]], // high wide: the room, the futon
        [2.4, 3.4, [980, 600, 2.2], [950, 590, 2.4]], // close: you, off-centre, looking right at the rack
        [3.4, 3.9, [1500, 712, 3.4, -3], [1500, 712, 3.8, -3]], // extreme close-up: the gleam
        [3.9, 6, [800, 590, 2.2], [760, 575, 2.8]], // push in on the grin
      ]);
      const tt = tw(t), gleam = tt < 3.4 ? 0 : tt < 3.7 ? (tt - 3.4) / 0.3 : Math.max(0.35, 1 - (tt - 3.7));
      ST.setHouse(ctx, t, gleam);
      const Y = CAST.you, D = Y.D, s = 0.9, HX = 700, HY = 892;
      ST.futonBase(ctx, 820, 900, HX - 330);
      const lean = K(tt, [[1.6, -86], [2.2, 0, 'out']]), k = (lean + 86) / 86, a = (lean * Math.PI) / 180, L = D.l1l + D.l2l;
      const feet = [ST.lerp(0, D.hy, k), ST.lerp(0, 0.92 * L, k)];
      const P = ST.pose('stand', D, null, Object.assign({ fL: [D.hw, feet[0], feet[1]], fR: [-D.hw, feet[0], feet[1] - 10] }, k > 0.5 ? { hL: ST.handAt(D, 1, -0.05, 0.62, 0.42), hR: ST.handAt(D, -1, -0.05, 0.62, 0.4), kL: 'flat', kR: 'flat' } : {}));
      Y.draw(ctx, {
        x: HX + s * D.hy * Math.sin(a), y: HY - s * D.hy * Math.cos(a), s, t, yaw: 2, head: tt >= 3.9 ? 1 : undefined, lean, noSwords: true, pose: P,
        expr: S(t, [[0, 'asleep'], [1.2, 'deadpan'], [3.7, 'shock'], [4.0, 'grin']]), headDy: tt >= 3.7 && tt < 3.9 ? -10 : 0, look: tt >= 2.5 ? [1, 0.2] : [0.3, 0],
      });
      ST.futonQuilt(ctx, 820, 900, ST.lerp(HX - 200, HX - 40, k));
    },
  });

  const blade = (ctx, g, dx, dy, len) => {
    const l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    ST.tube(ctx, [g[0] - ux * 50, g[1] - uy * 50, g[0] + ux * len, g[1] + uy * len], [16, 8], '#b8b39c', { lw: 4, seed: 91 });
  };
  const fighter = (ctx, ch, x, yaw, raise, t) => {
    const D = ch.D, up = ST.lerp(-0.95, -0.05, raise);
    const P = ST.pose('stand', D, null, { hL: ST.handAt(D, 1, -0.75, up, 0.42 + raise * 0.4), hR: ST.handAt(D, -1, -0.75, up + 0.04, 0.45 + raise * 0.4), kL: 'grip', kR: 'grip', poleL: [1, 0.3, -0.2], poleR: [-1, 0.3, -0.2], fL: ST.footAt(D, 1, 0.1, 0, 0.3), fR: ST.footAt(D, -1, 0.1, 0, -0.3) });
    ch.draw(ctx, { x, y: 930, s: 0.84, t, yaw, pose: P, noSwords: true, layer: { L: 2, R: 2 }, after: (J) => { const g = ST.palm(J.aR, ch.hsz); blade(ctx, g, ST.lerp(-0.4, 1, raise), ST.lerp(-1, -0.7, raise), 330); } });
  };

  ST.defineShot('dream', {
    title: 'The daydream', role: 'expectation vs reality', note: 'Flat sunset, two ink silhouettes charge and lock blades in a shower of sparks... hard cut to you behind a low desk between two towers of paper.',
    render(ctx, t) {
      const tt = tw(t);
      if (tt < 3.6) {
        const cuts = [[0, 1.6, [960, 640, 1.0], [960, 610, 1.12]], [1.6, 3.6, [965, 480, 2.0, -6], [965, 480, 2.4, -6]]]; // low wide, then close on the blades
        const cam = ST.cutFrame(t, cuts);
        ST.cutCam(ctx, t, cuts);
        ST.setDream(ctx, t);
        const raise = K(tt, [[1.3, 0], [1.6, 1, 'out']]), close = K(tt, [[0, 0], [1.5, 1, 'out']]);
        ST.silhouette(ctx, cam, (s) => {
          fighter(s, CAST.you, ST.lerp(420, 742, close), 2, raise, t);
          fighter(s, CAST.rival, ST.lerp(1520, 1196, close), -2, raise, t);
        });
        if (tt >= 1.6) {
          const n = Math.floor(tt * 12) % 3, cx = 965, cy = 470;
          for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI * 2 + n, r = 40 + 50 * ST.hash(93, i, n);
            ST.stroke(ctx, [cx + Math.cos(a) * 16, cy + Math.sin(a) * 16, cx + Math.cos(a) * r, cy + Math.sin(a) * r], { w: 11, color: '#e3c27a', seed: 94 + i });
          }
        }
        return;
      }
      ST.cutCam(ctx, t, [[3.6, 6, [1100, 500, 2.0], [1100, 620, 1.3]]]); // pull back from your face to the paper towers
      ST.setOffice(ctx, t);
      const Y = CAST.you, D = Y.D, s = 0.9, write = Math.floor(tt * 6) % 2, A = D.l1a + D.l2a;
      const P = ST.pose('stand', D, null, { hL: [D.sw * 0.6, -396, 0.5 * A], hR: [-D.sw * 0.3, -400 - write * 8, 0.56 * A], kL: 'flat', kR: 'grip', poleL: [1, 0.6, -0.3], poleR: [-1, 0.6, -0.3] });
      ST.seated(ctx, Y, {
        x: 1100, s, t, yaw: 0, pose: P, noSwords: true, expr: S(t, [[3.6, 'miserable'], [5.0, 'exhausted']]), headDy: tt >= 5.0 ? 8 : 0, look: [-0.2, 0.6],
        after: (J) => { const g = ST.palm(J.aR, Y.hsz); ST.tube(ctx, [g[0] + 2, g[1] - 60, g[0] + 8, g[1] + 34], [9, 9], '#9c8a5a', { lw: 4, seed: 95 }); },
      }, 900);
      ST.lowDesk(ctx, 1100, 900, 560, 144, 96);
      ST.papers(ctx, 900, 756, 150, 26, 97);
      ST.papers(ctx, 1300, 756, 150, 30, 98);
      ST.papers(ctx, 1210, 756, 120, 9, 99);
    },
  });
})();
