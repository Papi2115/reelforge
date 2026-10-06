/* sketchbook - figures: expressive stick people (pose = pure function of t, redrawn on twelves) and doodles. */
'use strict';
(function () {
  const SB = window.SB, C = SB.C;
  const R = (d) => (d * Math.PI) / 180;
  const dir = (a, l) => [Math.sin(R(a)) * l, Math.cos(R(a)) * l]; // 0 = down, 90 = right, 180 = up

  // skeleton for a pose. o: {x, y (ground), h}; P: {lean, head, armL:[a1,a2], armR, legL, legR, hipDx, hipDy, face, look}
  SB.skel = (o, P) => {
    const H = o.h;
    const hip = [o.x + (P.hipDx || 0) * H, o.y - 0.47 * H + (P.hipDy || 0) * H];
    const nb = dir(180 + (P.lean || 0), 0.3 * H);
    const neck = [hip[0] + nb[0], hip[1] + nb[1]];
    const hr = 0.115 * H;
    const hb = dir(180 + (P.lean || 0) + (P.head || 0), hr * 1.08);
    const head = [neck[0] + hb[0], neck[1] + hb[1]];
    const sh = [neck[0] + (hip[0] - neck[0]) * 0.13, neck[1] + (hip[1] - neck[1]) * 0.13];
    const limb = (root, a, l1, l2) => { const e1 = dir(a[0], l1), j = [root[0] + e1[0], root[1] + e1[1]]; const e2 = dir(a[1], l2); return [root, j, [j[0] + e2[0], j[1] + e2[1]]]; };
    return {
      hip: hip, neck: neck, head: head, hr: hr, sh: sh, H: H,
      armL: limb(sh, P.armL || [-20, -10], 0.17 * H, 0.16 * H), armR: limb(sh, P.armR || [20, 10], 0.17 * H, 0.16 * H),
      legL: limb(hip, P.legL || [-12, -4], 0.245 * H, 0.235 * H), legR: limb(hip, P.legR || [12, 4], 0.245 * H, 0.235 * H),
      face: P.face || 0, look: P.look || 0, lean: P.lean || 0, headA: (P.lean || 0) + (P.head || 0),
    };
  };
  const flat = (...ps) => ps.reduce((a, p) => a.concat(p), []);

  // standard figure marks; returns {t, J(t)} so shots can hang props on the joints
  SB.figure = (list, o) => {
    const pose = typeof o.pose === 'function' ? o.pose : () => o.pose;
    const J = (t) => SB.skel(o, pose(t));
    let t = o.t0;
    const sd = o.seed | 0, from = list.length;
    const gap = (i) => SB.rnd(0.03, 0.11, sd, i, 1);
    const add = (fnPts, dur, extra) => {
      list.push(SB.stroke(null, Object.assign({ fn: fnPts, t0: t, dur: dur, seed: sd + list.length * 17, tool: o.tool || 'felt', bfps: o.bfps || 12 }, extra || {})));
      t += dur + gap(list.length);
    };
    const tool = o.tool || 'felt';
    // head: one loop, starts at the chin side, overlaps itself
    add((tt) => { const j = J(tt); const p = SB.ellipsePts(j.head[0], j.head[1], j.hr, j.hr * 1.04, 15, 0, R(100 + (sd % 40))); p.push(p[0] + 2, p[1] - 1); return p; }, 0.24);
    if (o.beforeBody) t = o.beforeBody(t, J) || t;
    add((tt) => { const j = J(tt); const top = [j.head[0] + (j.neck[0] - j.head[0]) * 0.92, j.head[1] + (j.neck[1] - j.head[1]) * 0.92]; const mid = [(top[0] + j.hip[0]) / 2 + (o.belly || 0), (top[1] + j.hip[1]) / 2]; return flat(top, mid, j.hip); }, 0.13);
    add((tt) => flat(...J(tt).legL, footOf(J(tt).legL, -1)), 0.15, { corners: [false, true, true, false] });
    add((tt) => flat(...J(tt).legR, footOf(J(tt).legR, 1)), 0.14, { corners: [false, true, true, false] });
    add((tt) => flat(...J(tt).armL), 0.13, { corners: [false, true, false] });
    add((tt) => flat(...J(tt).armR), 0.13, { corners: [false, true, false] });
    if (o.face !== false) t = SB.faceMarks(list, J, t, o, tool) + 0.02;
    if (o.t1 != null) t = SB.fitMarks(list, from, o.t0, o.t1);
    return { t: t, J: J };
  };
  function footOf(leg, side) {
    const f = leg[2];
    return [f[0] + side * 7, f[1] + 0.5];
  }

  // face: eyes look where the figure looks, mouth/brow per expression (functions of t allowed)
  SB.faceMarks = (list, J, t, o, tool) => {
    const ex = typeof o.expr === 'function' ? o.expr : () => o.expr || {};
    const sd = (o.seed | 0) + 900;
    const eye = (side) => (tt) => {
      const j = J(tt), e = ex(tt), k = j.hr;
      const cx = j.head[0] + j.face * k * 0.38 + side * k * 0.34, cy = j.head[1] - k * 0.12 + j.look * k * 0.25;
      if (e.eyes === 'closed') return { pts: [cx - k * 0.2, cy, cx, cy + k * 0.13 * (e.happy ? -1 : 1), cx + k * 0.2, cy], corners: null };
      if (e.eyes === 'wide') return { pts: SB.ellipsePts(cx, cy, k * 0.14, k * 0.17, 7), corners: null };
      return { pts: [cx, cy - k * 0.1, cx + 0.3, cy + k * 0.12], corners: null };
    };
    const tl = tool === 'felt' ? 'fine' : tool;
    list.push(SB.stroke(null, { fn: eye(-1), t0: t, dur: 0.05, tool: tl, w: 2, seed: sd + 1, bfps: 12 }));
    t += 0.09;
    list.push(SB.stroke(null, { fn: eye(1), t0: t, dur: 0.05, tool: tl, w: 2, seed: sd + 2, bfps: 12 }));
    t += 0.1;
    list.push(SB.stroke(null, {
      fn: (tt) => {
        const j = J(tt), e = ex(tt), k = j.hr, cx = j.head[0] + j.face * k * 0.42, cy = j.head[1] + k * 0.42 + j.look * k * 0.12;
        const m = e.mouth || 'smile';
        if (m === 'o') return SB.ellipsePts(cx, cy, k * 0.13, k * 0.16, 8).concat([cx + k * 0.13, cy]);
        if (m === 'flat') return [cx - k * 0.22, cy + 1, cx + k * 0.24, cy];
        if (m === 'frown') return [cx - k * 0.24, cy + k * 0.1, cx, cy - k * 0.04, cx + k * 0.24, cy + k * 0.1];
        if (m === 'grin') return [cx - k * 0.32, cy - k * 0.1, cx - k * 0.05, cy + k * 0.16, cx + k * 0.32, cy - k * 0.12];
        if (m === 'tongue') return [cx - k * 0.26, cy, cx + k * 0.22, cy - k * 0.03, cx + k * 0.16, cy + k * 0.2, cx + k * 0.06, cy + 1];
        return [cx - k * 0.26, cy - k * 0.04, cx, cy + k * 0.12, cx + k * 0.26, cy - k * 0.06];
      },
      t0: t, dur: 0.1, tool: tl, w: 1, seed: sd + 3, bfps: 12,
    }));
    t += 0.12;
    if (o.brows) {
      for (const side of [-1, 1]) {
        list.push(SB.stroke(null, {
          fn: (tt) => {
            const j = J(tt), e = ex(tt), k = j.hr, cx = j.head[0] + j.face * k * 0.38 + side * k * 0.34, cy = j.head[1] - k * 0.42 + j.look * k * 0.2;
            const tilt = (e.brow || 0) * side * k * 0.12; // +: frown (inner ends down), -: worried/raised
            return [cx - k * 0.17, cy - tilt, cx + k * 0.17, cy + tilt];
          },
          t0: t, dur: 0.05, tool: tl, w: 1, seed: sd + 5 + side, bfps: 12,
        }));
        t += 0.07;
      }
    }
    return t;
  };

  // the sun doodle: one loop, uneven rays, orange pencil inside (slightly out of the lines)
  SB.sun = (list, cx, cy, r, t0, o) => {
    o = o || {};
    const sd = o.seed || 4242;
    let t = t0;
    const ring = SB.ellipsePts(cx, cy, r, r * 0.97, 16, 0, R(200));
    ring.push(ring[0] + 3, ring[1] + 2);
    list.push(SB.stroke(ring, { t0: t, tool: o.tool || 'felt', speed: 480, seed: sd, bfps: o.bfps }));
    t += list[list.length - 1].dur + 0.08;
    const n = o.rays || 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + SB.rnd(-0.14, 0.14, sd, i, 1) + 0.3;
      const r0 = r + SB.rnd(5, 9, sd, i, 2), r1 = r0 + SB.rnd(9, 20, sd, i, 3) * (o.rayScale || 1);
      list.push(SB.stroke([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], { t0: t, tool: o.tool || 'felt', dur: SB.rnd(0.04, 0.08, sd, i, 4), seed: sd + i * 3, bfps: o.bfps }));
      t += SB.rnd(0.05, 0.12, sd, i, 5);
    }
    if (o.fill !== false) {
      list.push(SB.fill(SB.ellipsePts(cx + 2, cy + 1, r - 1, r - 2, 14), { col: C.ORANGE, t0: t + 0.1, dur: o.fillDur || 0.5, sp: 2, seed: sd + 77 }));
      t += 0.1 + (o.fillDur || 0.5);
    }
    return t;
  };
})();
