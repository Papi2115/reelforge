/* The persistent case: every item, every string and the one camera path live on ONE global timeline (seconds).
 * Shots are only windows into it. Nothing is ever removed; theories that die are crossed out and left hanging. */
'use strict';
(function () {
  const NB = window.NB;
  const W = NB.world;
  const { v3 } = W;
  const B = W.G.board;
  const D = W.G.desk;
  const deg = Math.PI / 180;

  // ---------- items ----------
  const card = (o) => Object.assign({ tIn: -1, pins: [], tl: {}, support: 'board', paper: 'paper' }, o);
  const ITEMS = [
    card({ id: 'stub', art: 'stub', w: 100, h: 150, shape: 'tornL', support: 'desk', dx: -0.24, dz: -1.02, yaw: 17 }),
    card({ id: 'map', art: 'map', w: 420, h: 300, support: 'desk', dx: 0.1, dz: -1.13, yaw: -7, anchors: { sea: [230, 63], q: [218, 166] } }),
    card({ id: 'sketch', art: 'sketch', w: 240, h: 300, u: -0.62, v: 0.33, rot: -2.5, anchor: [120, 16], pinFromStart: 1, tape: [[214, 10, 20, 0.55]] }),
    card({ id: 'ticket', art: 'ticket', w: 340, h: 150, u: -1.0, v: 0.07, rot: 4, shape: 'tornR', anchor: [13, 76], pins: [[284, 76]] }),
    card({ id: 'dbnote', art: 'dbnote', w: 150, h: 95, k: 1.3, u: -1.1, v: -0.28, rot: -5, tl: { strike: 9.45, fix: 9.95 }, lean: [0.001, 0.007] }),
    card({ id: 'plane', art: 'plane', w: 300, h: 220, u: -0.72, v: -0.4, rot: -2, anchor: [150, 14], curl: 14 }),
    card({ id: 'briefcase', art: 'briefcase', w: 240, h: 190, u: -0.33, v: -0.3, rot: 3, anchor: [120, 14], tape: [[16, 180, 18, -0.7]] }),
    card({ id: 'demand', art: 'demand', w: 280, h: 170, u: -0.05, v: -0.02, rot: -1.5, anchor: [30, 14], pins: [[252, 15]], tl: { circle: 18.85 } }),
    card({ id: 'seattle', art: 'seattle', w: 300, h: 220, u: 0.18, v: 0.4, rot: 2.5, anchor: [20, 172], pins: [[150, 12]], curl: 12, tl: { tape: 22.25 } }),
    card({ id: 'jump', art: 'jump', w: 300, h: 240, u: 0.56, v: 0.02, rot: -3, anchor: [150, 14], tl: { arrow: 34.15 } }),
    card({ id: 'landed', art: 'landed', w: 120, h: 110, k: 1.25, u: 0.63, v: -0.31, rot: -7, anchor: [60, 9], tIn: 34.8, lean: [0.001, 0.006] }),
    card({ id: 'survived', art: 'survived', w: 120, h: 110, k: 1.25, u: 0.92, v: -0.21, rot: 5, anchor: [60, 9], tIn: 35.22, lean: [0.001, 0.006] }),
    card({ id: 'died', art: 'died', w: 130, h: 115, k: 1.2, u: 0.99, v: 0.19, rot: -4, anchor: [65, 9], tIn: 35.68, lean: [0.001, 0.006] }),
    card({ id: 'spent', art: 'spent', w: 130, h: 115, k: 1.2, u: 1.1, v: -0.53, rot: 3, anchor: [24, 12], pins: [[108, 12]], tIn: 39.85, tl: { cross: 44.75 }, lean: [0.001, 0.006] }),
    card({ id: 'river', art: 'river', w: 300, h: 220, k: 1.15, u: -0.3, v: -0.57, rot: 2, anchor: [150, 14], tIn: 47.45, curl: 12, tl: { money: 50.05 } }),
    card({ id: 'memo', art: 'memo', w: 260, h: 180, u: 0.9, v: 0.52, rot: -2, anchor: [12, 104], pins: [[236, 12]], tIn: 54.85, tl: { stamp: 57.05 }, dynamic: 1 }),
  ];
  ITEMS.forEach((it, i) => (it.index = i));
  const BY = {};
  ITEMS.forEach((it) => (BY[it.id] = it));
  BY.who = card({ id: 'who', art: 'who', w: 110, h: 100, u: -0.37, v: 0.53, rot: 6, tIn: 4.75, tl: { write: 5.2 }, lean: [0.001, 0.006] });
  ITEMS.splice(3, 0, BY.who);

  const rotAbout = (v, a, ang) => {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const d = v3.dot(a, v);
    const cr = v3.cross(a, v);
    return [v[0] * c + cr[0] * s + a[0] * d * (1 - c), v[1] * c + cr[1] * s + a[1] * d * (1 - c), v[2] * c + cr[2] * s + a[2] * d * (1 - c)];
  };
  const N_BOARD = [0, 0, -1];
  const T_POP = 43.1;

  /** Frame of an item at time t, or null when it is not on the board yet. */
  function frameOf(it, t) {
    if (it.support === 'desk') {
      const r = it.yaw * deg;
      const ax = [Math.cos(r), 0, Math.sin(r)];
      const ay = [-Math.sin(r), 0, Math.cos(r)];
      const o = [it.dx + (it.id === 'map' ? 0 : 0), D.y, it.dz];
      return { o, ax, ay, n: [0, 1, 0], lean0: 0.0008, lean1: 0.0012, plane: W.P.desk, support: 'desk' };
    }
    const land = it.tIn < 0 ? 1 : NB.seg(t, it.tIn - 0.42, it.tIn);
    if (it.tIn >= 0 && t < it.tIn - 0.42) return null;
    const settle = it.tIn < 0 ? 1 : NB.seg(t, it.tIn, it.tIn + 0.3);
    let rot = it.rot * deg;
    let lift = 0;
    let du = 0;
    let dv = 0;
    if (land < 1) {
      const k = NB.E.in(land);
      lift = 0.045 * (1 - k);
      rot += (1 - k) * 9 * deg * (NB.rnd(it.index, 5) > 0.5 ? 1 : -1);
      du = (1 - k) * 0.03;
      dv = (1 - k) * -0.02;
    } else if (settle < 1) rot += Math.sin(settle * Math.PI) * -1.4 * deg * (1 - settle);
    const ax = [Math.cos(rot), Math.sin(rot), 0];
    const ay = [-Math.sin(rot), Math.cos(rot), 0];
    const lean = it.lean || [0.002, 0.008];
    const bounce = settle < 1 && land >= 1 ? Math.sin(settle * Math.PI) * 0.006 : 0;
    const fr = { o: [B.cx + it.u + du, B.cy + it.v + dv, -lift], ax, ay, n: N_BOARD.slice(), lean0: lean[0], lean1: lean[1] + bounce, plane: W.P.board, support: 'board' };
    if (it.id === 'spent') peel(it, fr, t);
    return fr;
  }
  function localToWorld(it, fr, mm) {
    const X = ((mm[0] - it.w / 2) * (it.k || 1)) / 1000;
    const Y = ((it.h / 2 - mm[1]) * (it.k || 1)) / 1000;
    const ln = fr.lean0 + (fr.lean1 - fr.lean0) * NB.clamp(mm[1] / it.h, 0, 1);
    return [0, 1, 2].map((k) => fr.o[k] + fr.ax[k] * X + fr.ay[k] * Y + fr.n[k] * ln);
  }
  /** The theory that dies: pulled taut, its string pin pops, it swings on the other pin and hangs curled. */
  function peel(it, fr, t) {
    if (t < 42.2) return;
    const hinge = localToWorld(it, fr, it.pins[0]);
    let alpha;
    let beta;
    if (t < T_POP) {
      const k = NB.E.in(NB.seg(t, 42.2, T_POP));
      alpha = -0.2 * k;
      beta = -0.05 * k;
    } else {
      const dt = t - T_POP;
      const c = v3.sub(fr.o, hinge);
      const phi = Math.atan2(c[0], -c[1]);
      const bf = -phi;
      beta = -0.05 + (bf + 0.05) * (1 - Math.exp(-2.4 * dt) * Math.cos(2 * Math.PI * 0.95 * dt));
      alpha = -0.2 + 0.06 * (1 - Math.exp(-3 * dt));
    }
    const up = fr.ay;
    const turn = (v) => rotAbout(rotAbout(v, up, alpha), N_BOARD, beta);
    fr.o = v3.add(hinge, turn(v3.sub(fr.o, hinge)));
    fr.ax = turn(fr.ax);
    fr.ay = turn(fr.ay);
    fr.n = turn(fr.n);
  }

  // ---------- strings ----------
  const S = (id, a, b, t0, t1, o) => Object.assign({ id, a, b, t0, t1, sag: 0.045, arc: 1 }, o || {});
  const STRINGS = [
    S('s1', 'sketch', 'ticket', 7.15, 8.75, { arc: 1 }),
    S('s2', 'ticket', 'plane', 10.9, 12.3, { arc: -1, sag: 0.06 }),
    S('s3', 'plane', 'briefcase', 15.1, 16.6, { arc: 1 }),
    S('s4', 'briefcase', 'demand', 17.75, 18.55, { arc: -1, sag: 0.035 }),
    S('s5', 'demand', 'seattle', 20.3, 21.6, { arc: 1 }),
    S('s6', 'seattle', 'map:sea', 23.6, 26.0, { air: 'down', sag: 0.05 }),
    S('s7', 'map:q', 'jump', 31.6, 33.7, { air: 'up', sag: 0.05 }),
    S('s8', 'jump', 'landed', 35.05, 35.6, { arc: -1 }),
    S('s9', 'jump', 'survived', 35.42, 36.12, { arc: 1 }),
    S('s10', 'jump', 'died', 35.98, 36.4, { arc: -1 }),
    S('s11', 'survived', 'spent', 40.0, 41.2, { arc: 1, relay: { to: 'river', t0: 47.7, t1: 49.6 } }),
    S('s12', 'river', 'landed', 51.45, 52.75, { arc: -1 }),
    S('s13', 'river', 'memo', 55.0, 56.6, { arc: 1 }),
    S('s14', 'memo', 'sketch', 58.0, 61.0, { arc: -1, sag: 0.05 }),
  ];
  STRINGS.forEach((s, i) => {
    s.seed = 400 + i * 17;
    s.order = i;
  });
  const PIN_H = 0.019;
  const NECK = 0.011;
  function anchorOf(ref) {
    const [id, key] = ref.split(':');
    const it = BY[id];
    return { it, mm: key ? it.anchors[key] : it.anchor };
  }
  /** Pin base + normal for an anchor ref at time t. */
  function pinAt(ref, t) {
    const { it, mm } = anchorOf(ref);
    const fr = frameOf(it, t);
    if (!fr) return null;
    const base = localToWorld(it, fr, mm);
    return { base, n: fr.n, neck: v3.add(base, v3.mul(fr.n, NECK)), head: v3.add(base, v3.mul(fr.n, PIN_H)) };
  }
  /** Tip path while a string is being laid: lifted arc over the board, or a 3D swoop to/from the desk. */
  function tipAt(s, A, Bp, k, kind) {
    const travel = NB.seg(k, 0, 0.84);
    const press = NB.seg(k, 0.84, 1);
    const hover = v3.add(Bp.neck, v3.mul(Bp.n, 0.018));
    let p;
    if (kind === 'down' || kind === 'up') {
      const e = NB.E.inOut(travel);
      const a = A.neck;
      const d = hover;
      const b = kind === 'down' ? [a[0] + 0.03, W.BY0 + 0.05, -0.12] : [a[0], D.y + 0.32, a[2] + 0.22];
      const c = kind === 'down' ? [d[0] - 0.02, D.y + 0.34, d[2] + 0.3] : [d[0] - 0.02, W.BY0 + 0.1, -0.16];
      const m = 1 - e;
      p = [0, 1, 2].map((i) => m * m * m * a[i] + 3 * m * m * e * b[i] + 3 * m * e * e * c[i] + e * e * e * d[i]);
    } else {
      const e = NB.E.inOut(travel);
      const chord = v3.sub(hover, A.neck);
      const len = Math.hypot(chord[0], chord[1], chord[2]);
      const perp = v3.norm(v3.cross(chord, A.n));
      const bow = Math.sin(Math.PI * e) * Math.min(0.09, len * 0.16) * s.arc;
      const lift = Math.sin(Math.PI * e) * Math.min(0.016, 0.006 + len * 0.015);
      p = v3.add(v3.add(v3.add(A.neck, v3.mul(chord, e)), v3.mul(perp, bow)), v3.mul(A.n, lift));
    }
    if (press > 0) p = v3.add(hover, v3.mul(v3.sub(Bp.neck, hover), NB.E.in(press)));
    return p;
  }
  /** Catenary between two points, sagging along gravity's component perpendicular to the chord. */
  function catenary(P0, P1, sag, vib, out) {
    const ch = v3.sub(P1, P0);
    const L2 = v3.dot(ch, ch) || 1e-9;
    const g = [0, -1, 0];
    const gd = v3.dot(g, ch) / L2;
    const gp = [g[0] - ch[0] * gd, g[1] - ch[1] * gd, g[2] - ch[2] * gd];
    const span = Math.sqrt(L2);
    const kk = 1.3;
    const ch0 = Math.cosh(kk);
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const shape = (ch0 - Math.cosh(kk * (2 * s - 1))) / (ch0 - 1);
      const sv = Math.sin(Math.PI * s);
      for (let k = 0; k < 3; k++) out.push(P0[k] + ch[k] * s + gp[k] * sag * span * shape + (vib ? vib[k] * sv : 0));
    }
    return out;
  }
  const twang = (dt, span, seed) =>
    dt < 0 || dt > 1.4 ? 0 : (0.022 + 0.016 * NB.rnd(seed, 1)) * span * Math.exp(-(3.4 + 1.8 * NB.rnd(seed, 2)) * dt) * Math.sin(2 * Math.PI * (6 + 3 * NB.rnd(seed, 3)) * dt);
  /**
   * Geometry of a string at t: {pts, tip (carried pin head pos or null), kind}. Null before it starts.
   */
  function stringAt(s, t) {
    if (t < s.t0) return null;
    const A = pinAt(s.a, t);
    if (!A) return null;
    const out = [];
    if (s.relay && t >= T_POP) return Object.assign(danglingOrRelay(s, A, t, out), { s });
    const Bp = pinAt(s.b, Math.max(t, s.t1));
    if (t < s.t1) {
      const k = NB.seg(t, s.t0, s.t1);
      const tip = tipAt(s, A, Bp, k, s.air);
      catenary(A.neck, tip, 0.1 - 0.04 * k, null, out);
      return { pts: out, tip, tipN: Bp.n, air: s.air, s };
    }
    const span = Math.hypot(...v3.sub(Bp.neck, A.neck));
    const dt = t - s.t1;
    let sag = s.sag + (0.08 - s.sag) * Math.exp(-9 * dt);
    let vib = null;
    const tw = twang(dt, span, s.seed);
    if (tw) vib = v3.add(v3.mul(A.n, tw * 0.6), [0, tw, 0]);
    if (s.relay && t >= 42.2) {
      const k = NB.E.inOut(NB.seg(t, 42.2, T_POP - 0.1));
      sag = NB.lerp(s.sag, 0.003, k);
      const tr = k > 0.4 ? 0.0012 * Math.sin(t * 2 * Math.PI * 19) : 0;
      vib = v3.add(vib || [0, 0, 0], v3.mul(A.n, tr));
    }
    catenary(A.neck, Bp.neck, sag, vib, out);
    return { pts: out, tip: null, air: s.air, s };
  }
  /** s11 after the pop: the free end swings on the string, later it is picked up and pinned to the 1980 card. */
  function dangleEnd(s, A, t) {
    const Bp0 = pinAt(s.b, T_POP - 0.01);
    const d0 = v3.sub(Bp0.neck, A.neck);
    const Ls = Math.hypot(d0[0], d0[1]) * 1.03;
    const th0 = Math.atan2(d0[0], -d0[1]);
    const dt = t - T_POP;
    const r = Ls * (1 - 0.42 * Math.sin(Math.PI * Math.min(1, dt / 0.32)));
    const th = th0 * Math.exp(-1.1 * dt) * Math.cos(2 * Math.PI * 0.78 * dt);
    return { p: [A.neck[0] + Math.sin(th) * r, A.neck[1] - Math.cos(th) * r, A.neck[2] - 0.004], slack: 1 - r / Ls };
  }
  function danglingOrRelay(s, A, t, out) {
    const R = s.relay;
    if (t < R.t0) {
      const e = dangleEnd(s, A, t);
      catenary(A.neck, e.p, 0.015 + e.slack * 0.45, null, out);
      return { pts: out, tip: e.p, tipN: N_BOARD, loose: 1 };
    }
    const from = dangleEnd(s, A, R.t0).p;
    const Bp = pinAt(R.to, Math.max(t, R.t1));
    if (t < R.t1) {
      const k = NB.seg(t, R.t0, R.t1);
      const tip = tipAt({ arc: -1 }, { neck: from, n: N_BOARD }, Bp, k, null);
      catenary(A.neck, tip, 0.06, null, out);
      return { pts: out, tip, tipN: Bp.n };
    }
    const span = Math.hypot(...v3.sub(Bp.neck, A.neck));
    const dt = t - R.t1;
    const tw = twang(dt, span, s.seed + 50);
    catenary(A.neck, Bp.neck, 0.045 + 0.04 * Math.exp(-9 * dt), tw ? [0, tw, 0] : null, out);
    return { pts: out, tip: null };
  }

  /** Every pin on the board at t: {head, base, n, red, squash}. */
  function pinsAt(t) {
    const pins = [];
    const redAt = {};
    const mark = (ref, from) => {
      if (redAt[ref] === undefined || from < redAt[ref]) redAt[ref] = from;
    };
    STRINGS.forEach((s) => {
      mark(s.a, s.t0);
      mark(s.relay ? s.relay.to : s.b, s.relay ? s.relay.t1 : s.t1);
      if (s.relay) mark(s.b, s.t1);
    });
    for (const it of ITEMS) if (it.pinFromStart) redAt[it.id] = -1;
    for (const ref in redAt) {
      if (t < redAt[ref]) continue;
      if (ref === 'spent' && t >= T_POP) continue;
      const p = pinAt(ref, t);
      if (!p) continue;
      const since = t - redAt[ref];
      pins.push(Object.assign(p, { red: 1, squash: since < 0.14 ? 1 + 0.4 * (1 - since / 0.14) : 1, seed: ref.length * 7 + ref.charCodeAt(0) }));
    }
    for (const it of ITEMS) {
      const fr = frameOf(it, t);
      if (!fr) continue;
      it.pins.forEach((mm, i) => {
        const base = localToWorld(it, fr, mm);
        pins.push({ base, n: fr.n, head: v3.add(base, v3.mul(fr.n, PIN_H)), red: 0, squash: 1, seed: it.index * 13 + i });
      });
    }
    return pins;
  }

  // ---------- lights (pure functions of t) ----------
  function inAny(t, list) {
    for (const [a, b] of list) if (t >= a && t < b) return true;
    return false;
  }
  function lampLevel(t) {
    if (t < 1.3) return 0;
    if (inAny(t, [[1.35, 1.46], [1.5, 1.57], [41.72, 41.8], [42.98, 43.06]])) return 0;
    if (inAny(t, [[1.3, 1.35], [1.46, 1.5], [42.5, 42.57], [44.02, 44.08]])) return 1;
    return 2;
  }
  const deskLampLevel = (t) => (inAny(t, [[43.12, 43.2]]) ? 0 : 2);
  const neonLevel = (t) => (inAny(t, [[41.9, 42.06], [42.72, 42.77], [43.12, 43.32]]) ? 0 : 1);
  const brokenT = (t) => (t >= 39.5 && t < 47 ? Math.floor(t * 9) % 7 === 3 || Math.floor(t * 9) % 11 === 5 : false) || inAny(t, [[0.2, 0.32], [0.5, 0.55], [64.2, 64.34]]);
  /**
   * Where the pendant points. It is knocked at 42.7 s: the first sweep lands the pool on the dying theory at the pop,
   * and while it swings the shade twists on its cord and settles aimed lower-right - so the 1980 turn is in the light.
   */
  function lampAim(t) {
    const rest0 = [-0.52, 1.82];
    const rest1 = [-0.38, 1.3];
    const k = NB.E.inOut(NB.seg(t, 43.4, 46.8));
    let x = NB.lerp(rest0[0], rest1[0], k);
    let y = NB.lerp(rest0[1], rest1[1], k);
    let tilt = 0;
    if (t >= 42.75) {
      const dt = t - 42.75;
      const env = Math.exp(-0.62 * dt);
      const s = Math.sin(2 * Math.PI * 0.62 * dt);
      x += 1.55 * env * s;
      y -= 0.45 * env * Math.abs(s);
      tilt = 0.22 * env * s;
    }
    return { aim: [x, y], tilt };
  }

  NB.story = { ITEMS, BY, STRINGS, frameOf, localToWorld, stringAt, pinsAt, pinAt, lampLevel, deskLampLevel, neonLevel, brokenT, lampAim, T_POP };
})();
