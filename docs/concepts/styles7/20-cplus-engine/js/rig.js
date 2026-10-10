/* Rig: the anatomy rules every character obeys.
   - Views: v = 0 front, 1 three-quarter, 2 profile, 3 back; mir = facing screen-left (drawn mirrored).
   - Turns walk the ring front -> 3/4 -> profile -> back -> profile -> 3/4 one view per animation frame: never a flip.
   - Body space: x = toward the character's LEFT, y = down (feet at 0), z = forward.
   - Limbs: 2-bone IK with a pole, solved in body space, then projected.
   - Anchors (shoulders, hips, head box, face points) come from the CHARACTER (character.js: one source of truth used
     both to draw the torso/head and by this solver); the solver never invents its own.
   - Face guard: continuous. A hand target inside the head box (+ the hand's own size) is carried along the ray from
     the middle of the head's FAR edge out to the box edge: under the chin, over the top or out to its own side.
     Moving targets therefore slide around the head instead of jumping. Only face-contact targets (touch) skip it. */
'use strict';
(function () {
  const ST = window.ST;
  const RING = [0, 1, 2, 3, -2, -1];
  const DEG = [0, 45, 90, 180];

  ST.yawOfRing = (i) => RING[((Math.round(i) % 6) + 6) % 6];
  // turn(t, keys): keys [[time, ring], ...]; ring 0 front, 1 3/4 right, 2 profile right, 3 back, 4 profile left,
  // 5 3/4 left, 6 front again (keep counting for spins). From each key time the ring walks one step per frame on twos.
  ST.turn = (t, keys, rate) => {
    const tt = ST.twos(t), r = rate || ST.ANIM;
    let cur = keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [kt, kv] = keys[i];
      if (tt < kt) break;
      const until = i + 1 < keys.length ? Math.min(tt, keys[i + 1][0]) : tt;
      const steps = Math.floor((until - kt) * r + 1e-6) + 1;
      cur += Math.sign(kv - cur) * Math.min(Math.abs(kv - cur), steps);
    }
    return ST.yawOfRing(cur);
  };
  ST.view = (yaw) => ({ yaw: yaw, v: Math.min(3, Math.abs(yaw)), mir: yaw < 0 });

  // body point -> [figure x, figure y, depth toward camera] (x is negated first in mirrored views, so a mirrored view
  // is a true rotation: the right hand stays the right hand; ST.figure applies the mirror itself)
  ST.proj = (V, p) => {
    const a = (DEG[V.v] * Math.PI) / 180, x = V.mir ? -p[0] : p[0];
    return [p[2] * Math.sin(a) + x * Math.cos(a), p[1], p[2] * Math.cos(a) - x * Math.sin(a)];
  };
  // move a body point by (dx, dy) in figure space without changing its depth (inverse of ST.proj along the screen)
  ST.lift = (V, p, dx, dy) => {
    const a = (DEG[V.v] * Math.PI) / 180;
    return [p[0] + dx * Math.cos(a) * (V.mir ? -1 : 1), p[1] + dy, p[2] + dx * Math.sin(a)];
  };

  // pull a target along the view depth toward the shoulder's depth until it is within len of the shoulder S
  ST.fitReach = (V, S, T, len) => {
    const d3 = Math.hypot(T[0] - S[0], T[1] - S[1], T[2] - S[2]);
    if (d3 <= len) return T;
    const a = (DEG[V.v] * Math.PI) / 180, dz = [-Math.sin(a) * (V.mir ? -1 : 1), 0, Math.cos(a)];
    const sd = ST.proj(V, S)[2], td = ST.proj(V, T)[2], plane = Math.hypot(d3, 0) ** 2 - (td - sd) ** 2;
    const want = Math.sqrt(Math.max(0, len * len - plane)) * Math.sign(td - sd), k = td - sd - want;
    return Math.abs(td - sd) < 1e-6 ? T : [T[0] - dz[0] * k, T[1], T[2] - dz[2] * k];
  };
  // two-bone IK in 3D: elbow/knee E on the pole side, wrist/ankle H clamped to reach. Returns [E, H].
  ST.ik = (S, T, l1, l2, pole) => {
    const dx = T[0] - S[0], dy = T[1] - S[1], dz = T[2] - S[2], d0 = Math.hypot(dx, dy, dz) || 1e-6;
    const d = Math.min(l1 + l2 - 0.5, Math.max(Math.abs(l1 - l2) + 0.5, d0));
    const u = [dx / d0, dy / d0, dz / d0], pn = Math.hypot(pole[0], pole[1], pole[2]) || 1;
    const perp = (v) => { const k = v[0] * u[0] + v[1] * u[1] + v[2] * u[2]; return [v[0] - k * u[0], v[1] - k * u[1], v[2] - k * u[2]]; };
    // when the target lies along the pole axis the bend direction is undefined and used to flip: blend in a
    // "hanging elbow" (down) pole smoothly as the pole's usable part shrinks
    const pp = perp([pole[0] / pn, pole[1] / pn, pole[2] / pn]), dn = perp([0, 1, 0.2]), lp = Math.hypot(pp[0], pp[1], pp[2]), ld = Math.hypot(dn[0], dn[1], dn[2]) || 1;
    const w = ST.smooth(1 - lp / 0.8), kp = (1 - w) / (lp || 1), kd = w / ld;
    let p = [pp[0] * kp + dn[0] * kd, pp[1] * kp + dn[1] * kd, pp[2] * kp + dn[2] * kd];
    const pl = Math.hypot(p[0], p[1], p[2]);
    p = pl < 1e-6 ? [u[1], -u[0], 0] : [p[0] / pl, p[1] / pl, p[2] / pl];
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return [[S[0] + u[0] * a + p[0] * h, S[1] + u[1] * a + p[1] * h, S[2] + u[2] * a + p[2] * h], [S[0] + u[0] * d, S[1] + u[1] * d, S[2] + u[2] * d]];
  };
  // limb joints in figure space + layering. behind = the limb sits on the far side of the body plane for this view.
  ST.limbRig = (V, S, T, l1, l2, pole, sideW) => {
    const [E, H] = ST.ik(S, T, l1, l2, pole);
    const s = ST.proj(V, S), e = ST.proj(V, E), h = ST.proj(V, H);
    const depth = (s[2] + e[2] + h[2]) / 3;
    // hand direction = the forearm on screen. A forearm pointing at the camera is short on screen and its direction
    // spins as the wrist passes the elbow: there the hand turns smoothly toward the upper arm's direction instead
    // (blend over half the forearm length) and is foreshortened (fore 0.45..1). The palm (grips, contact) is the
    // projection of the 3D hand, so it moves continuously whatever the drawn mitten does - no mitten swinging round in a frame
    const fl = Math.hypot(h[0] - e[0], h[1] - e[1]) || 1e-6, ul = Math.hypot(e[0] - s[0], e[1] - s[1]) || 1e-6, w = ST.smooth(1 - fl / (0.5 * l2));
    const fx = ((h[0] - e[0]) / fl) * (1 - w) + ((e[0] - s[0]) / ul) * w, fy = ((h[1] - e[1]) / fl) * (1 - w) + ((e[1] - s[1]) / ul) * w;
    const fore = Math.max(0.45, Math.min(1, fl / l2));
    return {
      s, e, h, S3: S, E3: E, H3: H, T3: T, pole, len: l1 + l2, depth, behind: depth < -0.3 * (sideW || Math.abs(S[0])),
      miss: Math.hypot(T[0] - H[0], T[1] - H[1], T[2] - H[2]), fore, pdir: [(h[0] - e[0]) / l2, (h[1] - e[1]) / l2], ang: (Math.atan2(fx, fy) * 180) / Math.PI,
    };
  };
  // the default elbow pole for an arm on side sgn (+1 left, -1 right): out, slightly down, behind
  ST.elbowPole = (sgn, k) => [sgn * (k === undefined ? 0.7 : k), 0.25, -1];
  ST.kneePole = (sgn, out) => [sgn * (out === undefined ? 0.18 : out), 0, 1]; // out > 0.5 = bow legs, < 0 = knock-knees
  // grip point: centre of the palm = the wrist + the projected 3D hand (continuous even when the forearm points at
  // the camera); joints without 3D data (props, extras) use the forearm angle
  ST.palm = (j, hsz) => {
    if (j.pdir) return [j.h[0] + j.pdir[0] * hsz * 0.55, j.h[1] + j.pdir[1] * hsz * 0.55];
    const a = (j.ang * Math.PI) / 180;
    return [j.h[0] + Math.sin(a) * hsz * 0.55, j.h[1] + Math.cos(a) * hsz * 0.55];
  };

  // ---- the continuous face guard (figure space). hb = { cx, hw, top, bottom }, r = the hand's reach around the
  // wrist, s = +1 when this hand belongs to the head's +x side, reach = { c: shoulder [x, y], R: radius } (optional).
  // The exit point is found along the ray from the middle of the FAR edge; if the arm cannot reach it, the point slides
  // along the box edge (top -> own side -> bottom) to the nearest reachable spot. Returns the guarded 2D point.
  ST.guardPoint = (hb, q, r, s, reach) => {
    const x0 = hb.cx - hb.hw - r, x1 = hb.cx + hb.hw + r, y0 = hb.top - r, y1 = hb.bottom + r;
    if (q[0] <= x0 || q[0] >= x1 || q[1] <= y0 || q[1] >= y1) return q;
    const xf = s > 0 ? x0 : x1, xn = s > 0 ? x1 : x0, py = (y0 + y1) / 2, dx = q[0] - xf, dy = q[1] - py;
    const Lw = Math.abs(xn - xf), Lh = y1 - y0, at = (u) => (u <= Lw ? [xf + s * u, y0] : u <= Lw + Lh ? [xn, y0 + u - Lw] : [xn - s * (u - Lw - Lh), y1]);
    let t = Math.abs(dx) > 1e-9 ? (xn - xf) / dx : Infinity, u;
    if (dy > 1e-9 && (y1 - py) / dy < t) { t = (y1 - py) / dy; u = Lw + Lh + Math.abs(xn - (xf + dx * t)); }
    else if (dy < -1e-9 && (y0 - py) / dy < t) { t = (y0 - py) / dy; u = Math.abs(xf + dx * t - xf); }
    else u = Lw + (py + dy * t - y0);
    if (!reach) return at(u);
    const ok = (v) => { const g = at(v); return Math.hypot(g[0] - reach.c[0], g[1] - reach.c[1]) <= reach.R; };
    if (ok(u)) return at(u);
    const L = 2 * Lw + Lh, n = 240;
    let best = null;
    for (let i = 0; i <= n; i++) { const v = (L * i) / n; if (ok(v) && (best === null || Math.abs(v - u) < Math.abs(best - u))) best = v; }
    if (best === null) return at(u);
    let lo = best, hi = best + (u > best ? L / n : -L / n); // refine the edge of the reachable stretch toward u
    for (let k = 0; k < 12; k++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
    return at(lo);
  };
  // the arm can only put its wrist inside its reach disk (2D, after the target's depth): targets are first pulled
  // into that disk, THEN guarded, so a hand never ends up clamped back onto the face
  function guard(V, A, T, side) {
    const hb = A.head;
    if (!hb) return T;
    const q = ST.proj(V, T), sh = A.sh[side], S = ST.proj(V, sh.b), len = (A.D.l1a + A.D.l2a) * 0.97;
    const R = Math.sqrt(Math.max(1, len * len - (q[2] - S[2]) * (q[2] - S[2]))), d = Math.hypot(q[0] - S[0], q[1] - S[1]);
    const c = d > R ? [S[0] + ((q[0] - S[0]) * R) / d, S[1] + ((q[1] - S[1]) * R) / d] : [q[0], q[1]];
    const s = V.v === 2 ? 1 : sh.p[0] >= hb.cx ? 1 : -1; // profile: hands go round the face side
    const g = ST.guardPoint(hb, c, A.D.hsz * 1.05, s, { c: [S[0], S[1]], R });
    return g === c && d <= R ? T : ST.lift(V, T, g[0] - q[0], g[1] - q[1]);
  }

  // resolve a pose for a character's anchors A (character.js): arm and leg rigs + bob. Hand targets ride with the
  // upper body (they drop with the bob) unless P.absL/absR; P.palmL/palmR = the target is the palm, not the wrist;
  // P.touchL/touchR = a face-contact target (A.face resolves it), guard off for THAT hand only.
  ST.solve = (V, A, P) => {
    const D = A.D, bob = A.bob, out = { bob, A };
    ['L', 'R'].forEach((side) => {
      const sgn = side === 'L' ? 1 : -1, S = A.sh[side].b, pole = P['pole' + side] || ST.elbowPole(sgn, D.elbowOut);
      const touch = P['touch' + side], palm = touch || P['palm' + side];
      let T = P['h' + side];
      if (touch) T = A.face(touch, side, T);
      else if (!P['abs' + side]) T = [T[0], T[1] + bob, T[2]];
      let W = touch ? T : guard(V, A, T, side), j = ST.limbRig(V, S, W, D.l1a, D.l2a, pole, D.sw);
      const req = T;
      if (palm) {
        const goal = ST.proj(V, T);
        for (let k = 0; k < 14; k++) { // damped: the hand direction itself depends on where the wrist goes
          const g = ST.palm(j, D.hsz), damp = k < 4 ? 1 : 0.6;
          W = ST.lift(V, W, (goal[0] - g[0]) * damp, (goal[1] - g[1]) * damp);
          j = ST.limbRig(V, S, touch ? W : guard(V, A, W, side), D.l1a, D.l2a, pole, D.sw);
        }
        const g = ST.palm(j, D.hsz);
        j.palmMiss = Math.hypot(goal[0] - g[0], goal[1] - g[1]);
      }
      j.touch = touch || null;
      j.req = req; // the pose's own target, before the guard
      j.palmTarget = !!palm;
      out['a' + side] = j;
      const hip = A.hip[side].b;
      out['l' + side] = ST.limbRig(V, hip, P['f' + side], D.l1l, D.l2l, ST.kneePole(sgn, D.kneeOut), D.hw);
    });
    return out;
  };
  // draw layer of an arm: 0 = behind the torso, 1 = over the torso but under the head (a hand raised above the chin
  // passes BEHIND the head, never across the face), 2 = in front of everything. Face-contact hands are always 2.
  ST.armLayer = (j, A, force) => {
    if (force !== undefined) return force;
    if (j.touch) return 2;
    if (j.behind) return 0;
    const y = A.head ? A.head.bottom : -Infinity;
    return j.h[1] < y || j.e[1] < y - 20 ? 1 : 2;
  };
  // the head may look elsewhere than the body: returns the head view and whether to mirror it inside figure space
  ST.headView = (bodyYaw, headYaw) => {
    const hy = headYaw === undefined || headYaw === null ? bodyYaw : headYaw, HV = ST.view(hy);
    return { V: HV, flip: hy < 0 !== bodyYaw < 0 };
  };
})();
