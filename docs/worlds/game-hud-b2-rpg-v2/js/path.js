/* The scripted walk. Keys: [t, x, y, yawDeg, pitchPx, eye, easing-into-this-key].
   Distance walked drives the footsteps (uneven seeded strides) and the head-bob. */
'use strict';
(function () {
  const RF = window.RF, E = RF.ease;
  const K = [
    // S1 hook: darkness, the bulb clicks on, a glance at the chalk tally, look down at the sand
    [0.0, 5.0, 20.32, 9, 0, 0.5],
    [1.0, 5.0, 20.32, 9, 0, 0.5, 'lin'],
    [2.6, 7.3, 20.45, 3, 0, 0.5, 'in'],
    [3.35, 8.25, 20.5, -27, 0, 0.5, 'lin'],
    [4.0, 8.95, 20.5, -15, 0, 0.5, 'lin'],
    [4.6, 9.55, 20.5, 2, 0, 0.5, 'out'],
    [5.1, 9.65, 20.5, 2, 22, 0.49, 'inOut'],
    [5.8, 9.65, 20.5, 2, 22, 0.49, 'lin'],
    [6.35, 9.8, 20.5, 0, 0, 0.5, 'inOut'],
    [7.5, 13.5, 20.5, 0, 0, 0.5, 'in'],
    // S2 office: the five-week deadline
    [8.8, 17.4, 20.3, -12, 0, 0.5, 'out'],
    [9.6, 17.6, 20.25, -63, 0, 0.5, 'inOut'],
    [14.0, 17.7, 20.12, -64, 0, 0.5, 'sine'],
    [14.7, 17.8, 20.2, -2, 0, 0.5, 'inOut'],
    [16.0, 20.6, 20.45, 0, 0, 0.5, 'in'],
    // S3 warehouse (walk right of the painted line, never dead centre)
    [17.4, 24.8, 20.68, 3, 0, 0.5, 'lin'],
    [18.5, 27.9, 20.76, 2, 0, 0.5, 'out'],
    [19.15, 28.0, 20.76, -80, 5, 0.5, 'inOut'],
    [20.5, 28.0, 20.76, -82, 9, 0.5, 'sine'],
    [21.4, 28.0, 20.76, -82, 9, 0.5, 'lin'],
    [21.95, 28.1, 20.72, -4, 0, 0.5, 'inOut'],
    [23.45, 35.4, 20.74, -3, 0, 0.5, 'inOut'],
    [24.0, 36.1, 20.74, -5, 0, 0.5, 'out'],
    // S4 menu: stand still
    [31.0, 36.1, 20.74, -5, 0, 0.5, 'lin'],
    // S5 the clone aisle
    [33.4, 42.6, 20.5, 2, 0, 0.5, 'in'],
    [35.2, 45.7, 20.3, -3, 0, 0.5, 'lin'],
    [35.85, 46.0, 20.25, -38, 4, 0.5, 'out'],
    [36.65, 46.0, 20.25, -39, 4, 0.5, 'lin'],
    [37.25, 46.5, 20.3, 0, 0, 0.5, 'inOut'],
    [39.0, 53.6, 20.5, 0, 0, 0.5, 'in'],
    // S6 returns desk: sign left, clerk right of centre, the unsold piles growing at the right edge
    [40.0, 57.2, 20.45, -10, 0, 0.5, 'out'],
    [40.8, 58.3, 20.4, -67, 0, 0.5, 'inOut'],
    [47.0, 58.35, 20.3, -65, 0, 0.5, 'sine'],
    [47.7, 58.7, 20.35, 0, 0, 0.5, 'inOut'],
    [48.0, 59.5, 20.4, 0, 0, 0.5, 'in'],
    // S7 night landfill: to the lip of the pit, look down, let go
    [50.4, 66.6, 20.5, 0, 0, 0.5, 'lin'],
    [52.4, 74.3, 20.45, 3, 0, 0.5, 'out'],
    [53.1, 74.45, 20.45, 3, 34, 0.49, 'inOut'],
    [55.4, 74.45, 20.45, 3, 34, 0.49, 'lin'],
    [56.3, 74.45, 20.45, 0, 6, 0.5, 'inOut'],
    // S8: inside the full fog (57-59.3) the player is moved; nobody sees the step
    [57.2, 74.45, 20.45, 0, 4, 0.5, 'lin'],
    [59.0, 73.5, 20.1, -4, 2, 0.5, 'inOut'],
    [60.3, 73.5, 20.1, -4, 6, 0.48, 'sine'],
    [61.0, 73.5, 20.1, -4, 36, 0.4, 'inOut'],
    [61.85, 73.5, 20.1, -4, 36, 0.4, 'lin'],
    [63.0, 73.5, 20.1, 4, -6, 0.5, 'inOut'],
    [66.0, 73.5, 20.1, 4, -6, 0.5, 'lin'],
  ];
  const cum = [0];
  for (let i = 1; i < K.length; i++) cum.push(cum[i - 1] + Math.hypot(K[i][1] - K[i - 1][1], K[i][2] - K[i - 1][2]));

  function keyAt(t) {
    if (t <= K[0][0]) return { i: 1, u: 0 };
    for (let i = 1; i < K.length; i++) if (t <= K[i][0]) return { i: i, u: (t - K[i - 1][0]) / (K[i][0] - K[i - 1][0]) };
    return { i: K.length - 1, u: 1 };
  }
  function raw(t) {
    const { i, u } = keyAt(t);
    const a = K[i - 1], b = K[i];
    const e = (E[b[6]] || E.lin)(u);
    return {
      x: a[1] + (b[1] - a[1]) * e, y: a[2] + (b[2] - a[2]) * e, yaw: a[3] + (b[3] - a[3]) * e,
      pitch: a[4] + (b[4] - a[4]) * e, eye: a[5] + (b[5] - a[5]) * e, dist: cum[i - 1] + (cum[i] - cum[i - 1]) * e,
    };
  }
  // uneven strides: footsteps are not a metronome
  const steps = [0];
  const sr = RF.rng(1983);
  while (steps[steps.length - 1] < cum[cum.length - 1] + 2) steps.push(steps[steps.length - 1] + 0.56 + sr() * 0.16);
  function stepAt(dist) {
    let lo = 0, hi = steps.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (steps[m] <= dist) lo = m; else hi = m; }
    return { k: lo, u: (dist - steps[lo]) / (steps[lo + 1] - steps[lo]) };
  }
  RF.stepsUntil = function (t) {
    const d = raw(t).dist;
    const out = [];
    for (let k = 1; k < steps.length && steps[k] <= d; k++) out.push(steps[k]);
    return out;
  };
  RF.positionAtDist = function (d) {
    for (let i = 1; i < K.length; i++)
      if (d <= cum[i] || i === K.length - 1) {
        const len = cum[i] - cum[i - 1];
        const u = len > 0 ? RF.clamp01((d - cum[i - 1]) / len) : 0;
        return { x: K[i - 1][1] + (K[i][1] - K[i - 1][1]) * u, y: K[i - 1][2] + (K[i][2] - K[i - 1][2]) * u, dx: K[i][1] - K[i - 1][1], dy: K[i][2] - K[i - 1][2] };
      }
    return { x: 0, y: 0, dx: 1, dy: 0 };
  };

  /** Camera at global time t. */
  RF.camera = function (t) {
    const c = raw(t);
    const speed = (raw(t + 0.04).dist - raw(t - 0.04).dist) / 0.08;
    const walk = RF.clamp01((speed - 0.25) / 0.9);
    const st = stepAt(c.dist);
    const lift = Math.sin(Math.PI * st.u);
    const side = st.k % 2 ? 1 : -1;
    const breathe = Math.sin((t / 3.7) * Math.PI * 2) * (1 - walk);
    c.eye += walk * 0.016 * (lift - 0.5) + breathe * 0.003;
    c.bobX = walk * side * lift * 4;
    c.bobY = walk * (1 - lift) * 3 + breathe * 1.2;
    c.yaw += walk * side * lift * 0.35;
    c.speed = speed;
    c.walk = walk;
    c.a = (c.yaw * Math.PI) / 180;
    c.shake = 0;
    if (RF.shakeAt) {
      const s = RF.shakeAt(t);
      c.pitch += s;
    }
    return c;
  };
})();
