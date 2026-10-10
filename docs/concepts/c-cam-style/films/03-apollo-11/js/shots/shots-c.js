/* Shots 9-13: the Commander flies it by hand, the fuel gauge, touchdown and the bubble, the lonely orbit and the
   first step, the payoff. */
'use strict';
(function () {
  const ST = window.ST, C = ST.C, K = ST.key, S = ST.step, CAST = ST.CAST;
  const tw = ST.twos;
  const world = (p, q) => [p.x + p.s * q[0] * (ST.view(p.yaw).mir ? -1 : 1), p.y + p.s * q[1]];
  const local = (p, w) => [((w[0] - p.x) / p.s) * (ST.view(p.yaw).mir ? -1 : 1), (w[1] - p.y) / p.s];

  ST.defineShot('manual', {
    title: 'By hand', role: 'the pilot', note: 'Two-shot, the boulder field racing by; extreme close-up of the glove on the stick, small calm moves; close-up of the Commander chewing; tilted close-up of you sweating.',
    render(ctx, t) {
      const tt = tw(t);
      ST.cutCam(ctx, t, [
        { at: 0, x: [[0, 1000], [2, 1040]], y: 600, z: [[0, 1.05], [2, 1.1]] }, // two-shot
        { at: 2.0, x: 860, y: 700, z: [[2, 2.6], [3.6, 2.8]], rot: 3 }, // extreme close-up: the glove on the stick
        { at: 3.6, x: 790, y: 420, z: 2.2 }, // close-up: the Commander, chewing, calm
        { at: 4.8, x: 1400, y: 450, z: 2.2, rot: -4 }, // close-up: you, sweating
      ]);
      ST.setLM(ctx, t, { scroll: t * 140, k: 0.6, boulders: 30 });
      const Y = CAST.you, M = CAST.commander, MP = { x: 760, y: 1066, s: 0.96, yaw: 1 };
      Y.draw(ctx, {
        x: 1420, y: 1050, s: 0.86, t, yaw: -1, sweat: true, look: tt % 2 < 1 ? [-0.6, 0] : [-0.2, -0.5], lean: 4,
        expr: S(t, [[0, 'scared'], [3.0, 'miserable'], [4.4, 'scared']]), pose: ST.pose('clasp', Y.D),
      });
      const nudge = Math.sin(Math.floor(tt * 3) * 1.7) * 14, base = [870, 800];
      M.draw(ctx, Object.assign({}, MP, {
        t, chew: true, expr: S(t, [[0, 'deadpan'], [2.4, 'focused'], [4.0, 'deadpan']]), look: [0.5, -0.2],
        pose: ST.pose('stand', M.D, null, { hR: ST.reachTo(MP, 846 + nudge, 690, -50), kR: 'grip', poleR: [-1, 0.6, -0.3] }),
        beforeHand: (J) => {
          const b = local(MP, base);
          ST.rect(ctx, b[0] - 80, b[1] + 10, 160, 300, C.STONE_D, { seed: 411, lw: 6, hatch: { c: 'rgba(20,20,16,0.4)', n: 3, len: 40, gap: 8, k: 3, ang: 80 } }); // the stick's console
          ST.controlStick(ctx, b, ST.palm(J.aR, M.D.hsz), 410);
        },
      }));
    },
  });

  ST.defineShot('fuel', {
    title: 'Fuel', role: 'the clock', note: 'Tilted close-up: the fuel needle trembles in the red, LOW LEVEL blinks; extreme close-up of your glove squeezing the armrest; tilted close-up of your face.',
    render(ctx, t) {
      const tt = tw(t), on = Math.floor(tt * 4) % 2 === 0;
      ST.cutCam(ctx, t, [
        { at: 0, x: 560, y: 600, z: [[0, 1.6], [1.6, 1.7]], rot: -5 }, // tilted close: the needle in the red
        { at: 1.6, x: 1300, y: 860, z: 2.4 }, // extreme close-up: the glove squeezes the armrest
        { at: 2.8, x: 1500, y: 540, z: 1.6, rot: 5 }, // close-up: your face
      ]);
      ST.setPanelWall(ctx, 420);
      ST.gauge(ctx, 600, 470, 300, K(t, [[0, -1.75], [4, -2.05]]) + ST.rnd(-0.05, 0.05, 421, Math.floor(tt * 12)), 422, 'DESCENT FUEL');
      ST.rect(ctx, 470, 840, 260, 70, on ? C.RED : C.RED_D, { seed: 423, lw: 6 });
      ST.label(ctx, 'LOW LEVEL', 600, 876, { fill: on ? '#f0d8b0' : '#3a1a14', font: "bold 34px 'Arial Black', Arial, sans-serif" });
      if (on) ST.pool(ctx, 600, 876, 500, 300, C.RED, 0.08);
      ST.tube(ctx, [1060, 868, 1460, 884], [56, 56], '#3a3a33', { lw: 7, seed: 424, hatch: { c: 'rgba(120,110,90,0.35)', n: 3, len: 30, gap: 7, k: 3, ang: 90, bend: 0 } }); // armrest
      const Y = CAST.you, YP = { x: 1560, y: 1720, s: 1.75, yaw: -1 }, sq = (Math.floor(tt * 6) % 2) * 4;
      Y.draw(ctx, Object.assign({}, YP, {
        t, sweat: true, look: [-0.7, 0.2], expr: S(t, [[0, 'miserable'], [2.0, 'scared']]), headDy: (Math.floor(tt * 12) % 2) * -3,
        pose: ST.pose('stand', Y.D, null, { hL: ST.reachTo(YP, 1340, 862 + sq, 40), kL: 'grip', poleL: [1, 0.5, -0.4] }),
      }));
    },
  });

  // touchdown dust: flat grey puffs billowing out from under the engine, rising and spreading as k goes 0 -> 1
  function dust(ctx, x, y, k) {
    for (let i = 0; i < 11; i++) {
      const s = (i - 5) / 5, grow = Math.min(1, k * 1.8), r = (40 + 40 * ST.hash(430, i)) * (0.4 + grow) * (1.1 - Math.abs(s) * 0.4);
      const px = x + s * (120 + 360 * grow), py = y - r * 0.45 - (1 - Math.abs(s)) * 60 * grow;
      ST.blob(ctx, ST.ellipseRing(px, py, r * 1.25, r * 0.8, 10), i % 2 ? '#8f8a7e' : '#a7a295', { lw: 5, seed: 431 + i, shade: ['#6c695f', r * 0.15, r * 0.2], light: ['rgba(230,225,205,0.35)', -r * 0.2, -r * 0.25], hatch: { c: 'rgba(50,48,40,0.35)', n: 2, len: r * 0.5, gap: 6, k: 3, ang: 20 } });
    }
  }
  ST.defineShot('land', {
    title: 'Touchdown', role: 'the landing', note: 'Low angle, pushing in: the lander settles in a puff of grey dust. Cut inside: close-up, you are frozen; extreme close-up, the Commander slowly blows a gum bubble.',
    render(ctx, t) {
      const tt = tw(t);
      if (tt < 2.0) {
        const shake = tt >= 1.5 && tt < 1.7 ? (Math.floor(tt * 12) % 2) * 8 : 0;
        ST.camera(ctx, K(t, [[0, 960], [2, 980]]), 520 + shake, K(t, [[0, 1.15], [2, 1.35]])); // low angle, push-in
        ST.setSurface(ctx, t, { lander: [960, K(t, [[0, 640], [1.5, 900, 'out']]), 0.95], flame: tt < 1.5 ? 0.6 + (Math.floor(tt * 12) % 2) * 0.3 : 0 });
        if (tt >= 1.0) dust(ctx, 960, 910, ST.seg(tt, 1.0, 2.0));
        return;
      }
      ST.cutCam(ctx, t, [
        { at: 2.0, x: 1240, y: 500, z: 2.0 }, // close-up: you, frozen
        { at: 2.6, x: 830, y: 450, z: [[2.6, 2.6], [4, 2.85]] }, // extreme close-up: the bubble grows
      ]);
      ST.setLM(ctx, t, { scroll: 0, k: 0.35 });
      const Y = CAST.you, M = CAST.commander;
      M.draw(ctx, { x: 800, y: 1080, s: 0.94, t, yaw: 1, chew: tt < 2.5, bubble: K(t, [[2.5, 0], [3.7, 0.75, 'out']]), expr: 'deadpan', look: [0.3, 0] });
      Y.draw(ctx, { x: 1240, y: 1076, s: 0.9, t, yaw: -1, sweat: true, expr: 'exhausted', look: [-0.2, 0.1], pose: ST.pose('slump', Y.D) });
    },
  });

  ST.defineShot('orbit', {
    title: 'Alone / outside', role: 'the third man', note: 'Close on the orbiting astronaut with his sandwich, pulling back until he is small and alone with a toy bear. Cut: push in as you step off the footpad, leaving a print.',
    render(ctx, t) {
      const tt = tw(t);
      if (tt < 2.2) {
        ST.camera(ctx, K(t, [[0, 760], [2.2, 960]]), K(t, [[0, 380], [2.2, 540]]), K(t, [[0, 1.9], [2.2, 1.0]])); // pull back: alone
        ST.setCM(ctx, t);
        ST.floaters(ctx, t, 760, 520);
        ST.toyBear(ctx, 1110, 560 + Math.sin(tt * 2) * 14, 1.2, tt * 25, 440);
        const O = CAST.orbiter;
        O.draw(ctx, { x: 700, y: 880 + Math.sin(tt * 1.6) * 14, s: 0.8, t, yaw: 1, lean: K(t, [[0, -10], [2.2, 4]]), sandwich: tt >= 0.6 ? 1 : 0, talk: [[0.8, 2.0]], expr: S(t, [[0, 'sad'], [1.2, 'miserable']]), look: [0.7, -0.2], pose: ST.orbiterFloat(O.D, (tt * 0.5) % 1) });
        return;
      }
      ST.camera(ctx, K(t, [[2.2, 940], [4, 880]]), 560, K(t, [[2.2, 1.25], [4, 1.4]])); // push in on the first step
      ST.setSurface(ctx, t, { lander: [1200, 780, 0.95] });
      const Y = CAST.you, step = ST.seg(tt, 2.4, 3.4), YP = { x: K(t, [[2.4, 1000], [3.4, 820, 'lin']]), y: K(t, [[2.4, 762], [2.9, 800, 'out']]), s: 0.62, yaw: -2 };
      if (tt >= 3.0) ST.blob(ctx, ST.ellipseRing(940, 812, 40, 12, 9), '#4c4a42', { lw: 3, seed: 450, hatch: { c: 'rgba(20,20,16,0.6)', n: 2, len: 20, gap: 6, k: 3, ang: 90, bend: 0 } }); // the print
      const pack = world(YP, [-56, -470]);
      ST.rect(ctx, pack[0] - 38, pack[1] - 70, 76, 200, '#a29c86', { seed: 451, lw: 6, shade: ['#77725f', -10, 0] });
      Y.draw(ctx, Object.assign({}, YP, { t, helmet: 1, expr: S(t, [[2.2, 'scared'], [3.2, 'grin']]), look: [0, 0.5], pose: step < 1 ? ST.pose('walk', Y.D, (step * 0.9) % 1) : ST.pose('stand', Y.D) }));
    },
  });

  ST.defineShot('payoff', {
    title: 'Survival tip', role: 'the payoff', note: 'Extreme close-up: your glove squeezes the Commander\'s arm. Cut wider, pushing in: he keeps chewing, then looks at us.',
    render(ctx, t) {
      const tt = tw(t);
      ST.cutCam(ctx, t, [
        { at: 0, x: 960, y: 590, z: [[0, 2.4], [1.4, 2.5]] }, // extreme close-up: the squeeze
        { at: 1.4, x: [[1.4, 940], [3, 920]], y: 520, z: [[1.4, 1.45], [3, 1.6]] }, // he looks at us, push-in
      ]);
      ST.setLM(ctx, t, { scroll: 0, k: 0.35 });
      const Y = CAST.you, M = CAST.commander, MP = { x: 860, y: 1076, s: 0.94, yaw: 0 }, YP = { x: 1120, y: 1072, s: 0.9, yaw: -1 };
      let arm = [960, 700];
      M.draw(ctx, Object.assign({}, MP, { t, chew: true, head: tt < 1.6 ? 1 : 0, expr: S(t, [[0, 'deadpan'], [2.2, 'smug']]), look: tt >= 1.6 ? [0, 0] : [0.5, 0], after: (J) => { arm = world(MP, [(J.aL.s[0] + J.aL.e[0]) / 2, (J.aL.s[1] + J.aL.e[1]) / 2]); } }));
      const sq = (Math.floor(tt * 6) % 2) * 3;
      Y.draw(ctx, Object.assign({}, YP, {
        t, sweat: tt < 1.4, expr: S(t, [[0, 'exhausted'], [1.4, 'grin']]), look: [-0.5, 0],
        pose: ST.pose('stand', Y.D, null, { hL: ST.reachTo(YP, arm[0] + 26, arm[1] - 24 + sq, 40), kL: 'grip', poleL: [1, 0.4, -0.4] }),
      }));
    },
  });
})();
