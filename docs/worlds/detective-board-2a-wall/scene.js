/* detective-board 2a - poses of the pinned items, the string network (catenary sag, laying, twang,
 * taut, snap) and the pins, all evaluated for a global time t. */
(function () {
  'use strict';
  const D2 = window.D2;
  const { C, E, T, seg, lerp, clamp, wobble, hash, spritePoint } = D2;
  const WD = D2.world;
  const byId = new Map(WD.ITEMS.map((it) => [it.id, it]));

  // ---------- item poses ----------
  const DBC_SNAP = 44.62;
  const DBC_DROP = 45.22;
  /** Pose {x, y, a, hover} of a wall item at t, or null when not (yet / any more) on the wall. */
  function pose(it, t) {
    if (it.id === 'dbc') return dbcPose(it, t);
    if (it.land === undefined) return { x: it.x, y: it.y, a: it.a, hover: 0 };
    const t0 = it.land - 0.24;
    if (t < t0) return null;
    if (t < it.land) {
      const off = 1 - E.outCubic(seg(t, t0, it.land));
      const from = it.from || [0, -30];
      return { x: it.x + from[0] * off, y: it.y + from[1] * off, a: it.a + 0.07 * off, hover: 0.35 + off * 0.65 };
    }
    // slap, then settle with a small rotational wobble
    return { x: it.x, y: it.y, a: it.a + 0.035 * wobble(t - it.land, 21, 9) * (t - it.land < 0.6 ? 1 : 0), hover: 0 };
  }
  /** The D. B. Cooper card: leans toward the taut string, its pin pops, it hangs on the tape, drops. */
  function dbcPose(it, t) {
    const s = sprite(it, t);
    const tapeL = [76, 4];
    const pivot = spritePoint(s, it.x, it.y, it.a, tapeL[0], tapeL[1]);
    let a = it.a;
    if (t < DBC_SNAP) a += -0.035 * E.inQuad(seg(t, 43.95, DBC_SNAP));
    else {
      const dt = t - DBC_SNAP;
      a += 0.62 * (1 - Math.exp(-7 * dt)) + 0.14 * Math.sin(10 * dt) * Math.exp(-3.5 * dt);
    }
    // centre rotates about the tape corner
    const lx = s.w / 2 - tapeL[0];
    const ly = s.h / 2 - tapeL[1];
    let x = pivot[0] + lx * Math.cos(a) - ly * Math.sin(a);
    let y = pivot[1] + lx * Math.sin(a) + ly * Math.cos(a);
    if (t >= DBC_DROP) {
      const dt = t - DBC_DROP;
      if (dt > 1.2) return null;
      y += 0.5 * 900 * dt * dt + 8 * dt;
      x += 22 * dt;
      a += 1.4 * dt * dt;
    }
    return { x, y, a, hover: t >= DBC_DROP ? 0.8 : t >= DBC_SNAP ? 0.35 : 0 };
  }
  function sprite(it, t) {
    return it.sprite ? it.sprite(t) : null;
  }

  // ---------- pins: string pins appear when their string first uses them ----------
  const pinTimes = new Map();
  WD.STRINGS.forEach((s) => {
    [
      [s.a, s.pre !== undefined ? s.pre : s.tL],
      [s.b, s.tH],
    ].forEach(([ref, time]) => {
      const key = (ref.i || 'desk:' + ref.d) + ':' + ref.p;
      if (!pinTimes.has(key) || pinTimes.get(key) > time) pinTimes.set(key, time);
    });
  });
  // the hook's last beat: the first pin goes into the composite before its string is laid
  pinTimes.set('composite:2', 5.55);
  // a card pinned on camera gets its first pin the moment it lands
  WD.ITEMS.forEach((it) => {
    if (it.land === undefined || !it.pins.length) return;
    const key = it.id + ':0';
    if (!pinTimes.has(key) || pinTimes.get(key) > it.land) pinTimes.set(key, it.land);
  });
  const pinTime = (key) => (pinTimes.has(key) ? pinTimes.get(key) : -Infinity);

  // ---------- anchors to screen space ----------
  /** Screen point of a string anchor, or null if its item is gone. */
  function anchor(ref, t, view) {
    if (ref.i) {
      const it = byId.get(ref.i);
      const p = pose(it, t);
      if (!p) return null;
      const s = sprite(it, t);
      const pin = it.pins[ref.p];
      const w = s ? spritePoint(s, p.x, p.y, p.a, pin[0], pin[1]) : [p.x + pin[0], p.y + pin[1]];
      return view.wall(w[0], w[1]);
    }
    const d = WD.DESK_ITEMS[ref.d];
    const s = ref.d === 'map' ? D2.desk.mapAt(t) : { w: 370, h: 196 };
    const pin = d.pins[ref.p];
    const w = spritePoint(s, d.u, d.v, d.a, pin[0], pin[1]);
    return view.desk(w[0], w[1]);
  }

  // ---------- strings ----------
  /**
   * Geometry of every string at t in screen space: {pts:[x,y,...], desk: bool, head: [x,y]|null, headLift}.
   * Sag is a parabola under gravity; while laid the slack is long; on hooking it is pulled in with a twang.
   */
  function strings(t, view) {
    const out = [];
    for (const s of WD.STRINGS) {
      const start = s.pre !== undefined ? s.pre : s.tL;
      if (t < start) continue;
      const A = anchor(s.a, t, view);
      if (!A) continue;
      const touchesDesk = !!(s.a.d || s.b.d);
      if (s.snap !== undefined && t >= s.snap) {
        out.push(dangling(s, A, t, view));
        continue;
      }
      const B = anchor(s.b, t, view);
      if (!B) continue;
      // a short tail tied to the first pin before the string is carried away
      const tail = s.pre !== undefined ? [A[0] + (-5 + Math.sin(t * 2.1) * 1.5) * view.z, A[1] + 24 * view.z] : A;
      if (t < s.tL) {
        out.push({ pts: parabola(A, tail, 1.5 * view.z), desk: touchesDesk, head: null });
        continue;
      }
      if (t < s.tH) {
        const h = (s.tH - s.tL > 1 ? E.inOutCubic : E.outCubic)(seg(t, s.tL, s.tH));
        const head = [lerp(tail[0], B[0], h), lerp(tail[1], B[1], h)];
        const len = Math.hypot(head[0] - A[0], head[1] - A[1]);
        out.push({ pts: parabola(A, head, s.lay * len + 2 * view.z), desk: touchesDesk, head, headLift: 1 - 0.7 * h });
        continue;
      }
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      let sagK = s.sag + (s.lay - s.sag) * wobble(t - s.tH, 15, 4.2);
      if (s.taut && t >= s.taut[0]) {
        const k = E.inOutCubic(seg(t, s.taut[0], s.taut[1]));
        sagK = lerp(sagK, 0, k) + (k > 0.6 ? 0.004 * Math.sin(t * 95) : 0);
      }
      out.push({ pts: parabola(A, B, sagK * len), desk: touchesDesk, head: null });
    }
    return out;
  }
  function parabola(A, B, sag) {
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const n = Math.max(2, Math.ceil(len / 6));
    const pts = [];
    for (let i = 0; i <= n; i += 1) {
      const u = i / n;
      pts.push(lerp(A[0], B[0], u), lerp(A[1], B[1], u) + 4 * sag * u * (1 - u));
    }
    return pts;
  }
  /** After the snap the string recoils and swings from the composite, its popped pin at the end. */
  function dangling(s, A, t, view) {
    const dt = t - s.snap;
    const L = 108 * view.z;
    const phi = 2.3 * Math.exp(-0.75 * dt) * Math.cos(3.1 * dt + 0.2) * (dt < 0.12 ? 1 + (0.12 - dt) * 3 : 1);
    const E2 = [A[0] + Math.sin(phi) * L, A[1] + Math.cos(phi) * L];
    // a little slack: the middle hangs a touch below the straight line
    const pts = parabola(A, E2, 0.05 * L * Math.abs(Math.cos(phi)));
    return { pts, desk: false, head: E2, headLift: 0.5, loose: true };
  }

  /** Every pin visible at t: [x, y, lift] in screen space. */
  function pins(t, view) {
    const out = [];
    for (const it of WD.ITEMS) {
      const p = pose(it, t);
      if (!p) continue;
      it.pins.forEach((pin, idx) => {
        if (t < pinTime(it.id + ':' + idx)) return;
        if (it.id === 'dbc' && t >= DBC_SNAP) return;
        const s = sprite(it, t);
        const w = s ? spritePoint(s, p.x, p.y, p.a, pin[0], pin[1]) : [p.x + pin[0], p.y + pin[1]];
        const sp = view.wall(w[0], w[1]);
        out.push([sp[0], sp[1], p.hover, false]);
      });
    }
    for (const key of Object.keys(WD.DESK_ITEMS)) {
      const d = WD.DESK_ITEMS[key];
      (d.pins || []).forEach((pin, idx) => {
        if (t < pinTime('desk:' + key + ':' + idx)) return;
        const out2 = anchor({ d: key, p: idx }, t, view);
        out.push([out2[0], out2[1], 0, true]);
      });
    }
    return out;
  }

  Object.assign(D2, { scene: { pose, sprite, strings, pins, anchor, byId, DBC_SNAP, DBC_DROP } });
})();
