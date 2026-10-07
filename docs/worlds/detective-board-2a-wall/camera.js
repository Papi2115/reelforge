/* detective-board 2a - ONE continuous camera path over the wall for the whole film, the desk-lamp pool
 * that trails it, and the swinging bulb. All pure functions of global time t. */
(function () {
  'use strict';
  const D2 = window.D2;
  const { E, seg, lerp, smooth, wobble, hash } = D2;

  // desk projection: the desk top is foreshortened while the camera looks at the wall and unfolds as it
  // tilts down; zoomed far out the desk front comes closer (stronger perspective) to frame the reveal
  const DESK_D = 300;
  const tiltOf = (cy) => 0.3 + 0.7 * smooth(860, 1060, cy);
  const persp = (z) => 0.35 + 1.4 * (1 - Math.min(1, z));
  const deskDepthY = (v, z) => v + (persp(z) * v * v) / (2 * DESK_D);
  /** Camera centre y that puts desk depth v at the frame centre (tilt converges in a few steps). */
  function deskFocusY(v) {
    let cy = 1060;
    for (let i = 0; i < 4; i += 1) cy = 900 + tiltOf(cy) * deskDepthY(v, 1);
    return cy;
  }

  // holds: camera centre + zoom, and where the lamp pool rests (lx, ly, radius lr, intensity li)
  const H = {
    s0: { x: 1255, y: 343, z: 4, lx: 1232, ly: 368, lr: 188, li: 1 },
    s1: { x: 1232, y: 368, z: 2, lx: 1232, ly: 368, lr: 188, li: 1 },
    s2: { x: 540, y: 670, z: 1, lx: 562, ly: 676, lr: 172, li: 1 },
    s3a: { x: 872, y: 432, z: 1, lx: 796, ly: 418, lr: 205, li: 1 },
    s3b: { x: 792, y: 228, z: 2, lx: 772, ly: 222, lr: 150, li: 1 },
    s4: { x: 812, y: deskFocusY(150), z: 1, lx: 772, ly: 860, lr: 200, li: 0.8 },
    s5: { x: 985, y: 640, z: 1, lx: 945, ly: 652, lr: 236, li: 1 },
    s6: { x: 1341, y: 372, z: 2, lx: 1345, ly: 350, lr: 190, li: 0.6 },
    s7: { x: 380, y: 752, z: 2, lx: 382, ly: 742, lr: 172, li: 1 },
    s8: { x: 640, y: deskFocusY(160), z: 1, lx: 640, ly: 860, lr: 200, li: 0.8 },
    fin: { x: 792, y: 545, z: 0.37, lx: 800, ly: 470, lr: 1020, li: 0.74 },
  };
  // moves: the camera rides each string from one thread to the next (it lags the string head a little)
  const MOVES = [
    { t0: 1.5, t1: 3.05, a: 's0', b: 's1', sag: 0, dip: 1, ease: E.inOutCubic },
    { t0: 6.55, t1: 8.95, a: 's1', b: 's2', sag: 46, dip: 0.72, ease: E.inOutCubic },
    { t0: 14.5, t1: 16.35, a: 's2', b: 's3a', sag: 26, dip: 0.9, ease: E.inOutCubic },
    { t0: 19.2, t1: 20.8, a: 's3a', b: 's3b', sag: 14, dip: 1, ease: E.inOutSine },
    { t0: 23.0, t1: 25.65, a: 's3b', b: 's4', sag: 30, dip: 0.84, ease: E.inOutCubic },
    { t0: 30.5, t1: 32.35, a: 's4', b: 's5', sag: 18, dip: 0.9, ease: E.inOutCubic },
    { t0: 39.5, t1: 41.25, a: 's5', b: 's6', sag: 22, dip: 0.92, ease: E.inOutCubic },
    { t0: 47.5, t1: 50.2, a: 's6', b: 's7', sag: 58, dip: 0.62, ease: E.inOutCubic },
    { t0: 55.0, t1: 56.85, a: 's7', b: 's8', sag: 16, dip: 0.9, ease: E.inOutCubic },
    { t0: 58.7, t1: 62.15, a: 's8', b: 'fin', sag: 0, dip: 1, ease: E.inOutQuint },
  ];
  const KEYS = ['x', 'y', 'lx', 'ly', 'lr', 'li'];

  /** Unsnapped camera state at t (centre, zoom, lamp target). */
  function state(t) {
    let cam = H.s0;
    for (const m of MOVES) {
      if (t < m.t0) break;
      const A = H[m.a];
      const B = H[m.b];
      if (t >= m.t1) {
        cam = B;
        continue;
      }
      const k = m.ease(seg(t, m.t0 + 0.1, m.t1));
      const out = {};
      KEYS.forEach((key) => {
        out[key] = lerp(A[key], B[key], k);
      });
      out.y += 4 * m.sag * k * (1 - k);
      out.z = Math.exp(lerp(Math.log(A.z), Math.log(B.z), k)) * (1 - (1 - m.dip) * Math.sin(Math.PI * k));
      cam = out;
      break;
    }
    return cam;
  }

  function camera(t) {
    const cam = state(t);
    // stamp thud: a short decaying shake
    let sx = 0;
    let sy = 0;
    const st = D2.desk ? D2.desk.STAMP_T : 57.3;
    if (t >= st && t < st + 0.45) {
      const w = wobble(t - st, 46, 11);
      sx = w * 1.5;
      sy = w * 2.5;
    }
    // snap to the pixel grid so holds are crisp
    const z = cam.z;
    const x = Math.round((cam.x + sx) * z) / z;
    const y = Math.round((cam.y + sy) * z) / z;
    return { x, y, z, tilt: tiltOf(y), persp: persp(z) };
  }

  /** Bulb swing angle: damped kicks (already swinging when the film starts; knocked again in shot 6). */
  function bulbAngle(t) {
    const kicks = [
      [-0.4, 0.07, 0.25],
      [41.35, 0.42, 0.3],
    ];
    let a = 0;
    for (const [tk, amp, damp] of kicks) {
      if (t < tk) continue;
      const dt = t - tk;
      a += amp * Math.exp(-damp * dt) * Math.sin(2.3 * dt);
    }
    return a;
  }
  const BULB = { px: 1184, py: -100, len: 432 };

  /** Lamp pool (trails the camera by 0.3 s), bulb, desk light for time t. */
  function lights(t) {
    const lag = state(Math.max(0, t - 0.12));
    let i = lag.li;
    // the desk lamp clicks on with one stutter
    if (t < 6.62) i = 0;
    else if (t < 6.86) i = hash(9, Math.floor(t * 30), 3) < 0.45 ? 0.25 : 1;
    const a = bulbAngle(t);
    // the bulb is off when the film opens and stutters on
    let bi = 0.95;
    if (t < 0.45) bi = 0;
    else if (t < 0.9) bi = [0, 0.95, 0, 0, 0.95, 0.3, 0.95][Math.floor(((t - 0.45) / 0.45) * 7)] || 0.95;
    const bulb = { x: BULB.px + Math.sin(a) * BULB.len, y: BULB.py + Math.cos(a) * BULB.len, r: 185, i: bi, angle: a };
    const tilt = camera(t).tilt;
    return {
      dark: t < 0.9 && bi < 0.5 ? 1 : 0,
      pool: { x: lag.lx, y: Math.min(lag.ly, 860), r: lag.lr, i },
      bulb,
      desk: { u: 700, v: 165, r: 470, i: lerp(0.62, 1, (tilt - 0.3) / 0.7) },
    };
  }

  Object.assign(D2, { camera, lights, cam: { H, MOVES, BULB, DESK_D, tiltOf, persp, deskDepthY, deskFocusY } });
})();
