/* Shots 1-4: title, the white room (suiting up), the thin walls, the tiny computer. render(ctx, t) paints the whole
   frame for shot time t. Acting is on twos: poses come from ST.twos(t), expression changes snap, turns walk. */
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
  // a rough paper tag with stencil text (labels in inserts)
  ST.tag = (ctx, text, x, y, size, rot, seed) => {
    ctx.save();
    ctx.font = `${size}px Impact, 'Arial Black', sans-serif`;
    const w = ctx.measureText(text).width + size;
    ctx.restore();
    ST.rough(ctx, [x - w / 2, y - size * 0.75, x + w / 2, y - size * 0.8, x + w / 2 + 6, y + size * 0.75, x - w / 2 - 4, y + size * 0.8], '#c4b991', { seed, lw: 5 });
    ST.label(ctx, text, x, y + 2, { size, fill: C.INK, rot });
  };

  ST.defineShot('title', {
    title: 'Title', role: 'poster', note: 'Grimy poster: the Moon rising over a lunar ridge, the three mains lined up - you sweating, the Commander chewing, the lonely one with his sandwich.',
    render(ctx, t) {
      ST.cutCam(ctx, t, [{ at: 0, x: 960, y: [[0, 560], [4, 500]], z: [[0, 1.0], [4, 1.1]] }]); // slow push-in
      ST.setTitle(ctx, t);
      const Y = CAST.you, M = CAST.commander, O = CAST.orbiter;
      O.draw(ctx, { x: 1520, y: 1110, s: 0.8, t, yaw: -1, sandwich: 1, expr: 'sad', pose: ST.pose('stand', O.D, null, { hR: ST.handAt(O.D, -1, 0.05, 0.5, 0.45), poleR: [-1, 0.6, -0.4] }) });
      Y.draw(ctx, { x: 420, y: 1110, s: 0.8, t, yaw: 1, sweat: true, expr: S(t, [[0, 'scared'], [2.6, 'shock'], [2.8, 'scared']]), headDy: tw(t) >= 2.6 && tw(t) < 2.8 ? -14 : 0, look: [0.5, -0.3] });
      M.draw(ctx, { x: 960, y: 1120, s: 0.88, t, yaw: 0, chew: true, expr: 'deadpan', pose: ST.pose('akimbo', M.D) });
      ST.posterWord(ctx, 'WOULD YOU SURVIVE', 960, 100, 104, t, 0.15, -2);
      ST.posterWord(ctx, 'LANDING ON THE MOON?', 960, 236, 150, t, 0.9, 1);
      if (tw(t) >= 2.0) {
        ST.rough(ctx, [740, 334, 1190, 324, 1200, 392, 730, 400], C.INK, { seed: 79, lw: 6, lineColor: C.MUSTARD });
        ST.label(ctx, 'APOLLO 11  ·  1969', 965, 362, { size: 44, fill: C.MUSTARD, rot: -1 });
      }
    },
  });

  ST.defineShot('pad', {
    title: 'Suiting up', role: 'setting', note: 'Wide past a door edge: the white room at the top of the tower. Cut in: your helmet clicks down - you jolt. Cut: a sweaty forced thumbs up, the Commander waiting at the hatch behind you, chewing.',
    render(ctx, t) {
      const cut = ST.cutCam(ctx, t, [
        { at: 0, x: [[0, 900], [1.2, 880]], y: 600, z: [[0, 1.05], [1.2, 1.1]] }, // wide, door edge in the foreground
        { at: 1.2, x: 900, y: 450, z: [[1.2, 2.5], [2.6, 2.7]], rot: -4 }, // close-up: the helmet clicks down
        { at: 2.6, x: [[2.6, 1060], [5, 1100]], y: 560, z: [[2.6, 1.3], [5, 1.42]] }, // thumbs up, the Commander behind
      ]);
      ST.setPad(ctx, t);
      const Y = CAST.you, M = CAST.commander, tt = tw(t);
      ST.crowdFigure(ctx, { x: 300, y: 930, s: 1.55, kind: 3, yaw: ST.turn(t, [[0, 3], [2.8, 1]]), mode: tt < 2.8 ? 'work' : 'stand', ph: (tt * 1.5) % 1, col: C.LINEN, colD: C.LINEN_D, skin: '#8a7058', seed: 320 });
      M.draw(ctx, { x: 1640, y: 1000, s: 0.8, t, yaw: -1, head: tt < 2.4 ? -1 : 0, chew: true, helmet: 1, expr: 'deadpan' });
      const thumb = tt >= 2.6;
      Y.draw(ctx, {
        x: 860, y: 1060, s: 0.92, t, yaw: 0, head: tt < 1.6 ? -1 : 0, helmet: 1, helmetDy: K(t, [[0.3, -46], [1.2, 0, 'out']]), sweat: tt >= 1.4,
        expr: S(t, [[0, 'scared'], [1.2, 'shock'], [1.6, 'scared'], [2.6, 'grin']]), headDy: tt >= 1.2 && tt < 1.4 ? -16 : 0,
        pose: ST.pose('stand', Y.D, null, thumb ? { hR: ST.handAt(Y.D, -1, 0.35, -0.55 + (Math.floor(tt * 6) % 2) * 0.04, 0.25), kR: 'thumb', poleR: [-1, 0.3, -0.3] } : {}),
      });
      if (cut === 0) ST.fgShape(ctx, [-300, -300, 110, -300, 140, 1400, -300, 1400], 301);
      if (tt >= 1.2 && tt < 1.5) [0, 1, 2].forEach((i) => ST.stroke(ctx, [760 - i * 30, 330 + i * 26, 720 - i * 40, 320 + i * 30], { w: 6, seed: 300 + i })); // click
    },
  });

  ST.defineShot('lander', {
    title: 'Thin walls', role: 'the tin can', note: 'Push in on the tiny cabin; cut to an extreme close-up of your finger poking the wall - it dents and wobbles; cut to the Commander shrugging, chewing.',
    render(ctx, t) {
      ST.cutCam(ctx, t, [
        { at: 0, x: [[0, 1000], [3, 1080]], y: 600, z: [[0, 1.0], [3, 1.12]] }, // push in on the two of you
        { at: 3.0, x: 1640, y: 600, z: 2.6, rot: 5 }, // extreme close-up: the finger, the dent
        { at: 4.6, x: 820, y: 560, z: [[4.6, 1.7], [6, 1.8]] }, // close-up: the Commander shrugs
      ]);
      ST.setLM(ctx, t, { scroll: t * 14 });
      const Y = CAST.you, M = CAST.commander, tt = tw(t), YP = { x: 1500, y: 1060, s: 0.9, yaw: ST.turn(t, [[0, 2], [4.0, -1]]) };
      const poke = tt >= 3.0 && tt < 4.0, hit = tt >= 3.3;
      if (hit) ST.dent(ctx, 1700, 610, 30, Math.max(0, 1 - (tt - 3.3) / 0.9), 330);
      const shrug = tt >= 4.6;
      M.draw(ctx, {
        x: 760, y: 1066, s: 0.94, t, yaw: 1, chew: !shrug || tt >= 5.4, expr: S(t, [[0, 'deadpan'], [4.6, 'smug'], [5.4, 'deadpan']]),
        pose: ST.pose('stand', M.D, null, shrug ? { hL: ST.handAt(M.D, 1, 0.42, 0.42, 0.35), hR: ST.handAt(M.D, -1, 0.42, 0.42, 0.35), kL: 'open', kR: 'open', poleL: [1, 0.3, -0.5], poleR: [-1, 0.3, -0.5] } : {}),
        headDy: shrug && tt < 5.0 ? -6 : 0,
      });
      Y.draw(ctx, Object.assign({}, YP, {
        t, head: tt < 1.4 ? 1 : undefined, look: tt < 3 ? [0.3, -0.5] : [0.5, 0], sweat: tt >= 3.3,
        expr: S(t, [[0, 'scared'], [1.6, 'confused'], [3.3, 'shock'], [3.6, 'scared']]), headDy: tt >= 3.3 && tt < 3.5 ? -14 : 0,
        pose: ST.pose('stand', Y.D, null, poke ? { hR: ST.reachTo(YP, hit ? 1696 : 1660, 600, -40), kR: 'point', poleR: [-1, 0.2, -0.6] } : {}),
      }));
    },
  });

  ST.defineShot('computer', {
    title: 'The computer', role: 'the gag', note: 'Close on the guidance computer; pull back as a modern phone thuds in beside it for scale; cut to your squint.',
    render(ctx, t) {
      ST.cutCam(ctx, t, [
        { at: 0, x: 800, y: 500, z: [[0, 1.55], [1.2, 1.65]] }, // close on the computer
        { at: 1.2, x: 960, y: 540, z: [[1.2, 1.0], [3.4, 1.05]] }, // pull back: the phone thuds in
        { at: 3.4, x: 420, y: 560, z: 1.9, rot: -3 }, // close-up: you squint
      ]);
      ST.setPanelWall(ctx, 340);
      const tt = tw(t), dig = Math.min(3, Math.floor(tt * 2));
      ST.dsky(ctx, 560, 200, 1.2, 341, { code: '00000'.slice(0, 2 + dig), press: tt % 1 < 0.25 ? [13, 14, 15][Math.floor(tt) % 3] : -1 });
      ST.tag(ctx, 'YOUR COMPUTER', 800, 150, 46, -2, 342);
      if (tt >= 1.2) {
        const k = 1.5 * ST.ease.back(ST.seg(tt, 1.2, 1.6));
        ST.phone(ctx, 1500, 560, k, 343);
        ST.tag(ctx, 'A MODERN PHONE', 1500, 230, 46, 2, 344);
      }
      if (tt >= 2.2) ST.label(ctx, 'VS', 1250, 560, { size: 90, fill: C.RUST, stroke: C.INK, lw: 10, rot: -6 });
      CAST.you.draw(ctx, { x: 230, y: 1960, s: 2.0, t, yaw: 1, look: [0.6, -0.4], sweat: tt >= 2.4, expr: S(t, [[0, 'confused'], [2.4, 'miserable']]) });
    },
  });
})();
