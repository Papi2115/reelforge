/* Rig: the anatomy rules every character obeys, shared as helpers only.
   - Views: v = 0 front, 1 three-quarter, 2 profile, 3 back; mir = facing screen-left (drawn mirrored).
   - Turns walk the ring front -> 3/4 -> profile -> back -> profile -> 3/4 one view per animation frame: never a flip.
   - Body space: x = toward the character's LEFT, y = down (feet at 0), z = forward. Shoulders, hips, hands, feet live
     there; the view projects them, so shoulders are wide in front, overlap in profile, swap in the back view.
   - Limbs: 2-bone IK with a pole (elbow/knee hint) solved in body space, then projected. Far limbs are drawn before the
     torso, near limbs after it. Characters still draw their own torso and head for each view by hand. */
'use strict';
(function () {
  const ST = window.ST;
  const RING = [0, 1, 2, 3, -2, -1];
  const DEG = [0, 45, 90, 180];
  const TILT = 0.16; // feet only: the camera sits a little above, so a forward-pointing foot reads lower on screen

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

  // body point -> [screen x, screen y, depth toward camera] in figure space (the mirror flip is applied by ST.figure;
  // x is negated first so a mirrored view is a true rotation: the right hand stays the right hand)
  ST.proj = (V, p) => {
    const a = (DEG[V.v] * Math.PI) / 180, x = V.mir ? -p[0] : p[0];
    return [p[2] * Math.sin(a) + x * Math.cos(a), p[1], p[2] * Math.cos(a) - x * Math.sin(a)];
  };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

  // two-bone IK in 3D: elbow/knee E on the pole side, wrist/ankle H clamped to reach. Returns [E, H].
  ST.ik = (S, T, l1, l2, pole) => {
    const dx = T[0] - S[0], dy = T[1] - S[1], dz = T[2] - S[2], d0 = Math.hypot(dx, dy, dz) || 1e-6;
    const d = Math.min(l1 + l2 - 0.5, Math.max(Math.abs(l1 - l2) + 0.5, d0));
    const u = [dx / d0, dy / d0, dz / d0], pd = pole[0] * u[0] + pole[1] * u[1] + pole[2] * u[2];
    let p = [pole[0] - pd * u[0], pole[1] - pd * u[1], pole[2] - pd * u[2]];
    const pl = Math.hypot(p[0], p[1], p[2]);
    p = pl < 1e-6 ? [u[1], -u[0], 0] : [p[0] / pl, p[1] / pl, p[2] / pl];
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return [[S[0] + u[0] * a + p[0] * h, S[1] + u[1] * a + p[1] * h, S[2] + u[2] * a + p[2] * h], [S[0] + u[0] * d, S[1] + u[1] * d, S[2] + u[2] * d]];
  };

  // limb joints on screen + layering. behind = the limb sits on the far side of the body plane for this view.
  ST.limbRig = (V, S, T, l1, l2, pole, sideW) => {
    const [E, H] = ST.ik(S, T, l1, l2, pole);
    const s = ST.proj(V, S), e = ST.proj(V, E), h = ST.proj(V, H);
    const depth = (s[2] + e[2] + h[2]) / 3;
    let fx = h[0] - e[0], fy = h[1] - e[1];
    if (Math.hypot(fx, fy) < 12) { fx = h[0] - s[0]; fy = h[1] - s[1]; }
    return { s, e, h, H3: H, depth, behind: depth < -0.3 * (sideW || Math.abs(S[0])), ang: (Math.atan2(fx, fy) * 180) / Math.PI };
  };
  // the default elbow pole for an arm on side sgn (+1 left, -1 right): out, slightly down, behind
  ST.elbowPole = (sgn, k) => [sgn * (k === undefined ? 0.7 : k), 0.25, -1];
  ST.kneePole = (sgn) => [sgn * 0.18, 0, 1];

  // grip point: centre of the palm for a hand drawn at the wrist j.h along the forearm angle
  ST.palm = (j, hsz) => {
    const a = (j.ang * Math.PI) / 180;
    return [j.h[0] + Math.sin(a) * hsz * 0.55, j.h[1] + Math.cos(a) * hsz * 0.55];
  };

  // arm drawing. st: { cloth, clothD, w: [shoulder, elbow, wrist], bare: 0..1 (skin from this fraction of the forearm,
  // 1 = fully sleeved), skin, skinD, hsz, hand, cuff, hatch, seed, lw }
  ST.drawArm = (ctx, j, st) => {
    const { s, e, h } = j, lw = st.lw || 6, seed = st.seed || 50;
    const w = st.w, bare = st.bare === undefined ? 1 : st.bare;
    if (bare < 1) {
      const bx = e[0] + (h[0] - e[0]) * bare, by = e[1] + (h[1] - e[1]) * bare;
      ST.tube(ctx, [bx, by, h[0], h[1]], [w[1] * 0.86, w[2] * 0.9], st.skin, { lw, seed: seed + 1, shade: [st.skinD, -w[2] * 0.22, 2], hatch: st.hair ? { c: 'rgba(25,18,12,0.5)', n: 3, len: 10, gap: 4, k: 3, ang: 60 } : null });
      const ex = bx + (e[0] - bx) * -0.12, ey = by + (e[1] - by) * -0.12;
      ST.tube(ctx, [s[0], s[1], e[0], e[1], ex, ey], [w[0], w[1], w[1] * 1.05], st.cloth, { lw, seed, shade: [st.clothD, -w[1] * 0.25, 3], hatch: st.hatch });
      if (st.cuff) ST.tube(ctx, [ex + (e[0] - ex) * 0.6, ey + (e[1] - ey) * 0.6, ex, ey], [w[1] * 1.12, w[1] * 1.12], st.cuff, { lw: lw * 0.8, seed: seed + 3 });
    } else {
      ST.tube(ctx, [s[0], s[1], e[0], e[1], h[0], h[1]], w, st.cloth, { lw, seed, shade: [st.clothD, -w[1] * 0.25, 3], hatch: st.hatch });
      if (st.cuff) ST.tube(ctx, [e[0] + (h[0] - e[0]) * 0.8, e[1] + (h[1] - e[1]) * 0.8, h[0], h[1]], [w[2] * 1.12, w[2] * 1.1], st.cuff, { lw: lw * 0.8, seed: seed + 3 });
    }
    if (st.hand !== 'none') ST.hand(ctx, h[0], h[1], j.ang, st.hsz, st.skin, st.hand || 'fist', { seed: seed + 5, lw: lw * 0.9, shade: st.skinD });
  };

  // leg drawing: tube hip -> knee -> ankle, then the shoe, built from a projected heel/ball/toe so it turns with the view.
  // st: { cloth, clothD, w: [hip, knee, ankle], shoe, shoeD, len, sw (shoe width), seed, lw, splay, skin (bare shin) }
  ST.drawLeg = (ctx, V, j, sgn, st) => {
    const { s, e, h } = j, lw = st.lw || 6, seed = st.seed || 70;
    ST.tube(ctx, [s[0], s[1], e[0], e[1], h[0], h[1] - 4], st.w, st.cloth, { lw, seed, shade: [st.clothD, -st.w[1] * 0.25, 2], hatch: st.hatch });
    if (st.skin) ST.tube(ctx, [e[0] + (h[0] - e[0]) * 0.35, e[1] + (h[1] - e[1]) * 0.35, h[0], h[1] - 4], [st.w[1] * 0.8, st.w[2]], st.skin, { lw, seed: seed + 2, shade: [st.skinD, -5, 0] });
    ST.drawFoot(ctx, V, j.H3, sgn, st);
  };
  ST.drawFoot = (ctx, V, A, sgn, st) => {
    const len = st.len, sp = (st.splay === undefined ? 0.25 : st.splay) * sgn;
    const pt = (dx, dy, dz) => { const q = ST.proj(V, add(A, [dx, dy, dz])); return [q[0], q[1] + q[2] * TILT]; };
    const heel = pt(-sp * len * 0.2, 4, -len * 0.25), ball = pt(sp * len * 0.45, 8, len * 0.5), toe = pt(sp * len * 0.8, 4, len * 0.85);
    ST.tube(ctx, [heel[0], heel[1], ball[0], ball[1], toe[0], toe[1]], [st.sw * 0.95, st.sw, st.sw * 0.72], st.shoe, { lw: st.lw || 6, seed: (st.seed || 70) + 9, shade: [st.shoeD, -4, 4], light: st.shoeL ? [st.shoeL, 3, -4] : null });
  };

  // resolve a pose for a character's dimensions: screen rigs for both arms and legs + the bob (hip drop). Hand targets
  // ride with the upper body (they drop with the bob); feet are planted in body space.
  // Face guard: a hand target that would land on the head silhouette (D.head: per-view centre x, top, bottom, half
  // width) is slid along this view's screen axis until it clears it - so no pose, in any view, puts a hand on the face.
  // Raised arms are then drawn under the head (ST.armLayer), so only the clear hand shows, never an arm across a face.
  function guard(V, D, T, bob) {
    const h = D.head;
    if (!h) return T;
    const p = ST.proj(V, T), cx = h.x[V.v], m = h.hw + 34;
    if (p[1] < h.top + bob || p[1] > h.bottom + bob || Math.abs(p[0] - cx) >= m) return T;
    const a = (DEG[V.v] * Math.PI) / 180, dir = p[0] - cx >= 0 ? 1 : -1, shift = dir * m - (p[0] - cx);
    return [T[0] + shift * Math.cos(a) * (V.mir ? -1 : 1), T[1], T[2] + shift * Math.sin(a)];
  }
  ST.solve = (V, D, P) => {
    const bob = (P.bob || 0) * (D.l1l + D.l2l);
    const shL = [D.sw, D.sy + bob, D.sz || 0], shR = [-D.sw, D.sy + bob, D.sz || 0];
    const off = (q) => guard(V, D, [q[0], q[1] + bob, q[2]], bob);
    return {
      bob,
      aL: ST.limbRig(V, shL, off(P.hL), D.l1a, D.l2a, P.poleL || ST.elbowPole(1, D.elbowOut), D.sw),
      aR: ST.limbRig(V, shR, off(P.hR), D.l1a, D.l2a, P.poleR || ST.elbowPole(-1, D.elbowOut), D.sw),
      lL: ST.limbRig(V, [D.hw, D.hy + bob, 0], P.fL, D.l1l, D.l2l, ST.kneePole(1), D.hw),
      lR: ST.limbRig(V, [-D.hw, D.hy + bob, 0], P.fR, D.l1l, D.l2l, ST.kneePole(-1), D.hw),
    };
  };
  // draw layer of an arm: 0 = behind the torso, 1 = over the torso but under the head (any hand raised above the neck:
  // a raised near arm passes BEHIND the head, never across the face), 2 = in front of everything. force: 2 for hands
  // that must sit on the face (pipe at the lips, hankie at the nose).
  ST.armLayer = (j, neckY, force) => (force !== undefined ? force : j.behind ? 0 : j.h[1] < neckY || j.e[1] < neckY - 20 ? 1 : 2);
  // the head may look elsewhere than the body: returns the head view and whether to mirror it inside figure space
  ST.headView = (bodyYaw, headYaw) => {
    const hy = headYaw === undefined ? bodyYaw : headYaw, HV = ST.view(hy);
    return { V: HV, flip: hy < 0 !== bodyYaw < 0 };
  };
})();
