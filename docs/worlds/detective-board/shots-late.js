/* detective-board showcase - shots 3 to 5. */
(function () {
  'use strict';
  const DB = window.DB;
  const { C, E, seg, lerp, wobble, hash, surf, art, pin, string, props } = DB;
  const K = DB.shotKit;

  // ---------- shot 3: B-roll - the evidence desk ----------
  const S3 = {
    report: { x: 150, y: 120, a: -0.085 },
    map: { x: 410, y: 200, a: 0.03 },
    ticket: { x: 178, y: 270, a: 0.19 },
  };
  /** Route progress: steady start, a hesitation over the Alps, then on to Florence. */
  function routeProgress(t) {
    if (t < 2.32) return 0;
    if (t < 3.2) return 0.47 * E.outQuad(seg(t, 2.32, 3.2));
    if (t < 3.48) return 0.47;
    return lerp(0.47, 1, E.inOutSine(seg(t, 3.48, 4.42)));
  }
  function shot3(t) {
    const f = surf(640, 360, C.CORK_D);
    const cam = { x: 0, y: 0 };
    K.background(f, art.desk(640, 360, 303), cam);
    const rp = props.report();
    K.place(f, rp, S3.report.x, S3.report.y, S3.report.a, cam, [4, 5]);
    K.place(f, props.ticket(), S3.ticket.x, S3.ticket.y, S3.ticket.a, cam, [3, 4]);
    const p = routeProgress(t);
    const circle = seg(t, 4.72, 5.12);
    const m = props.mapRoute(p, circle, 700 + Math.floor(t * 10));
    K.place(f, m.s, S3.map.x, S3.map.y, S3.map.a, cam, [4, 6]);
    // magnifier slides onto the underlined line of the report, eases past it and settles
    const target = K.at(rp, S3.report.x, S3.report.y, S3.report.a, 148, 64, cam);
    const k = E.inOutCubic(seg(t, 0.15, 1.25));
    const settle = wobble(t - 1.25, 14, 7) * (t > 1.25 ? 3 : 0);
    const mx = lerp(target[0] - 70, target[0], k) + settle;
    const my = lerp(target[1] + 120, target[1], k) - settle * 0.4;
    const under = DB.copy(f);
    props.magnifier(f, Math.round(mx), Math.round(my), 30, under);
    // the pencil: comes in, draws, hesitates at the Alps, finishes, lifts away
    if (t > 1.85 && t < 5.0) {
      const tip = K.at(m.s, S3.map.x, S3.map.y, S3.map.a, m.tip[0], m.tip[1], cam);
      const inK = E.outCubic(seg(t, 1.85, 2.32));
      const outK = E.inQuad(seg(t, 4.5, 4.95));
      const lift = (1 - inK) + outK * 1.5;
      props.pencil(f, tip[0] + (1 - inK) * 120 + outK * 140, tip[1] - (1 - inK) * 90 - outK * 120, lift);
    }
    const fade = 3.4 * (1 - E.outCubic(seg(t, 0, 0.22))) + 3.4 * E.inQuad(seg(t, 7.1, 7.6));
    const nz = DB.noiseField(640, 360, 13, 50);
    DB.light(f, (x, y) => K.lampD(x, y, 270, 90, 450) + nz.at(x, y) * 0.8 + K.vignette(x, y, 640, 360, 2.6) + fade);
    return f;
  }

  // ---------- shot 4: C-roll - a theory dies, a name is pinned ----------
  const S4_NOTE = 'worked at the Louvre?';
  function lampX(t) {
    return 330 + 64 * Math.sin(1.05 * t + 0.4);
  }
  function shadowFrom(lx, ox, oy, h) {
    return [((ox - lx) / 260) * 9 * h, (((oy + 60) / 260) * 7 + 1) * h];
  }
  function flicker(t) {
    const n = hash(404, Math.floor(t * 15), 1);
    let d = n > 0.93 ? 1.5 : n > 0.8 ? 0.45 : 0;
    if (t > 1.6 && t < 1.67) d = 1.6; // one stutter inside the silence
    if (t > 6.62) d += hash(405, Math.floor(t * 20), 2) > 0.45 ? 4 : 1.2;
    if (t > 6.95) d = 5;
    return d;
  }
  function shot4(t) {
    const f = surf(640, 360, C.CORK);
    const cam = { x: 0, y: 0 };
    K.background(f, art.cork(640, 360, 404), cam);
    const lx = lampX(t);
    // the APOLLINAIRE label stays behind on the board after his print is gone
    K.place(f, K.labelTape('APOLLINAIRE', 36), 532, 190, 0.04, cam, shadowFrom(lx, 532, 190, 0.3));
    // old theory peels off: corner lifts, pin pops, print drops out of frame
    if (t < 1.45) {
      const peel = t > 0.5;
      const spr = art.photo(peel ? 'ap4p' : 'ap4', art.portrait('apollinaire'), {
        left: 5, top: 5, right: 6, bottom: 12, seed: 19, curl: 'tl', curlSize: peel ? 22 : 6,
      });
      const ft = Math.max(0, t - 0.62);
      const x = 520 + ft * 40;
      const y = 112 + 0.5 * 1100 * ft * ft;
      const a = 0.06 + 2.2 * ft * ft + (peel ? 0.03 : 0);
      const lift = 1 + Math.min(1.6, ft * 5);
      K.place(f, spr, x, y, a, cam, shadowFrom(lx, x, y, lift));
      const pp = K.at(spr, 520, 112, 0.06, 52, 6, cam);
      if (t < 0.5) pin(f, pp[0], pp[1], 'brass', 0.6, 1);
      else if (t < 0.8) {
        const k = seg(t, 0.5, 0.8);
        pin(f, pp[0] + k * 34, pp[1] - Math.sin(k * Math.PI) * 30 + k * 10, 'brass', 0.6, 1, 1.3 + k * 1.5);
      }
    }
    // the note that has waited all along: its "?" is scribbled out and a red tick drawn
    const nt = DB.copy(art.card(150, 40, 44));
    const w = DB.handText(nt, S4_NOTE, 8, 19, C.INK, 47, { slant: 0.26, rise: -0.025 });
    const qx = 8 + w - 3;
    const boil = Math.floor(t * 10);
    DB.stroke(nt, [qx - 3, 17, qx + 2, 10, qx - 2, 17, qx + 3, 11, qx - 1, 18, qx + 4, 13], E.inOutSine(seg(t, 3.32, 3.56)), C.INK, 900 + boil, 0.5);
    const tick = E.outQuad(seg(t, 3.64, 3.92));
    DB.stroke(nt, [qx + 8, 19, qx + 12, 27, qx + 13, 26, qx + 26, 6], tick, C.RED, 950 + boil, 0.6);
    DB.stroke(nt, [qx + 9, 19, qx + 13, 27], tick > 0.3 ? 1 : 0, C.RED, 951, 0);
    K.place(f, nt, 470, 266, 0.07, cam, shadowFrom(lx, 470, 266, 0.7));
    const np = K.at(nt, 470, 266, 0.07, 7, 6, cam);
    pin(f, np[0], np[1], 'pearl', 0.6, 1);
    // the thief: shadow arrives first, then the print slaps down
    const th = art.photo('pe', art.portrait('peruggia'), { left: 6, top: 6, right: 7, bottom: 14, seed: 29, curl: 'br', curlSize: 7 });
    const l = K.land(t, 2.42, 0.3);
    const tp = K.at(th, 292, 166, -0.035, 52, 7, cam);
    if (t > 2.72) {
      const reach = E.outQuad(seg(t, 2.72, 2.9));
      const sag = t < 2.95 ? 60 : 3 + 57 * wobble(t - 2.95, 24, 7);
      string(f, -30, 62, lerp(-30, tp[0], reach), lerp(62, tp[1], reach), sag, 1, 2, 4, 91);
    }
    if (l) {
      K.place(f, th, 292, 166, -0.035 + l.wob, cam, shadowFrom(lx, 292, 166, l.lift), l.scale);
      const nameIn = K.land(t, 4.42, 0.14);
      if (nameIn) K.place(f, K.labelTape('V. PERUGGIA', 93), 300, 248, 0.025, cam, shadowFrom(lx, 300, 248, 0.3 * nameIn.lift), nameIn.scale);
    }
    if (t > 2.72) {
      const dp = K.pinDrop(t, 2.66, 0.22);
      pin(f, tp[0], tp[1], 'red', 0.6, 1, dp ? dp.lift : 1, dp && dp.squash);
    } else {
      const dp = K.pinDrop(t, 2.66, 0.22);
      if (dp) pin(f, tp[0], tp[1], 'red', 0.6, 1, dp.lift, dp.squash);
    }
    const fade = 3.2 * (1 - E.outQuad(seg(t, 0, 0.3)));
    const fl = flicker(t);
    const nz = DB.noiseField(640, 360, 14, 70);
    DB.light(f, (x, y) => K.lampD(x, y, lx, 120, 360) + 0.3 + nz.at(x, y) * 0.6 + K.vignette(x, y, 640, 360, 2.6) + fade + fl);
    return f;
  }

  // ---------- shot 5: payoff - Florence, and home ----------
  const S5_NEW = 'Florence, Dec 1913';
  const S5_TIMES = K.writing(S5_NEW, 1.4, 55, 12);
  const S5_RET = 'Returned. 1914.';
  const S5_RTIMES = K.writing(S5_RET, 5.85, 57, 12);
  function shot5(t) {
    const f = surf(640, 360, C.CORK);
    const board = art.cork(1200, 420, 505);
    const travel = E.inOutSine(seg(t, 3.3, 4.95));
    const cam = { x: Math.round(lerp(18, 380, travel)), y: Math.round(24 + Math.sin(Math.PI * travel) * 8) };
    K.background(f, board, cam);
    // old print of the empty wall, under the new one
    const old = art.photo('s2wall', art.wall(false), { left: 7, top: 7, right: 7, bottom: 20, seed: 13, curl: 'tr', curlSize: 7 });
    const oldC = DB.copy(old);
    DB.handText(oldC, '22 Aug', 10, old.h - 6, C.INK, 33, { slant: 0.28, rise: -0.04 });
    K.place(f, oldC, 772, 196, -0.05, cam, [3, 4]);
    const oldPin = K.at(old, 772, 196, -0.05, 77, 69, cam);
    pin(f, oldPin[0], oldPin[1], 'red', 0.8, 1);
    // the correction: old card struck through, new card pinned across it
    const gone = DB.copy(art.card(96, 40, 45));
    DB.handText(gone, 'gone?', 12, 19, C.INK, 58, { slant: 0.3, rise: -0.03 });
    DB.stroke(gone, [8, 16, 26, 14, 44, 15, 40, 18], E.inOutSine(seg(t, 0.55, 0.8)), C.INK, 960 + Math.floor(t * 10), 0.5);
    K.place(f, gone, 214, 178, -0.09, cam, [2, 3]);
    const gp = K.at(gone, 214, 178, -0.09, 48, 5, cam);
    pin(f, gp[0], gp[1], 'pearl', 0.8, 1);
    const nl = K.land(t, 1.05, 0.2);
    let notePin = null;
    if (nl) {
      const nc = DB.copy(art.card(148, 42, 46));
      DB.handText(nc, S5_NEW, 9, 20, C.INK, 55, { slant: 0.24, rise: -0.02, reveal: DB.handReveal(S5_TIMES, t, 1.4) });
      K.place(f, nc, 262, 214, 0.055 + nl.wob, cam, [2 * nl.lift, 3 * nl.lift], nl.scale);
      notePin = K.at(nc, 262, 214, 0.055, 9, 6, cam);
    }
    // the framed wall lands over the empty one
    const fr = art.photo('fr', art.wall(true), { left: 7, top: 7, right: 7, bottom: 22, seed: 37 });
    const fl = K.land(t, 5.22, 0.26);
    const frC = DB.copy(fr);
    DB.handText(frC, S5_RET, 10, fr.h - 8, C.INK, 57, { slant: 0.3, rise: -0.03, reveal: DB.handReveal(S5_RTIMES, t, 5.85) });
    if (fl) K.place(f, frC, 792, 182, 0.03 + fl.wob, cam, [3 * fl.lift, 4 * fl.lift], fl.scale);
    const frPin = K.at(fr, 792, 182, 0.03, 74, 4, cam);
    // string: carried from the new card with the camera, hooked on the framed print
    if (notePin && t > 1.3) {
      const attach = 5.45;
      if (t < 3.3) string(f, notePin[0], notePin[1], notePin[0] + 26, notePin[1] + 30, 6, 1, 2, 3, 95);
      else if (t < attach) {
        const k = E.inOutSine(seg(t, 3.3, attach - 0.1));
        string(f, notePin[0], notePin[1], lerp(notePin[0] + 26, frPin[0], k), lerp(notePin[1] + 30, frPin[1], k), 34, 1, 2, 3, 95);
      } else string(f, notePin[0], notePin[1], frPin[0], frPin[1], 14 + 20 * wobble(t - attach, 10, 3.5), 1, 2, 3, 95);
    }
    if (notePin) {
      const dp = K.pinDrop(t, 1.22, 0.16);
      if (dp) pin(f, notePin[0], notePin[1], 'red', 0.8, 1, dp.lift, dp.squash);
    }
    if (fl && fl.lift <= 1) {
      const dp = K.pinDrop(t, 5.45, 0.18);
      if (dp) pin(f, frPin[0], frPin[1], 'red', 0.8, 1, dp.lift, dp.squash);
    }
    const fade = 3 * (1 - E.outQuad(seg(t, 0, 0.45))) + 3.4 * E.inQuad(seg(t, 8.35, 8.8));
    const nz = DB.noiseField(1200, 420, 15, 90);
    DB.light(f, (x, y) => {
      const wx = x + cam.x;
      const wy = y + cam.y;
      return Math.min(K.lampD(wx, wy, 240, 200, 330) + 0.3, K.lampD(wx, wy, 800, 190, 430) - 0.15) + nz.at(wx, wy) * 0.45 + K.vignette(x, y, 640, 360, 1.9) + fade;
    });
    return f;
  }

  DB.shots.push(
    {
      id: 3,
      name: 'B-roll',
      dur: 7.6,
      render: shot3,
      caption: 'It was taken on a Monday, when the museum was closed. Then it vanished - until a train left Paris for Florence.',
      note: 'Top-down desk under a hard lamp: the magnifier finds the detail, the pencil draws the route, one red circle.',
    },
    {
      id: 4,
      name: 'C-roll',
      dur: 7.2,
      render: shot4,
      caption: 'The man carrying it had worked at the Louvre. His name: Vincenzo Peruggia.',
      note: 'A theory peels off, a held silence under a stuttering lamp, then the thief is pinned and the string snaps taut.',
    },
    {
      id: 5,
      name: 'Payoff',
      dur: 8.8,
      render: shot5,
      caption: 'Gone for over two years - then caught in Florence, December 1913, trying to sell it to an art dealer. Returned in 1914. World-famous.',
      note: 'The correction note, the string goes home, the framed wall lands over the empty one; one handwritten line, then stillness.',
    },
  );
})();
