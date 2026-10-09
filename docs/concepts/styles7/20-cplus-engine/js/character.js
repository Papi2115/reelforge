/* The character contract (see CHARACTER_CONTRACT.md). A character file hand-draws its torso per view and its head per
   view; ST.defineCharacter owns everything that must agree between the drawing and the rig:
   - anchors(view, pose): shoulders (+ the one-shoulder-higher tilt), hips, neck, the head box and the face points,
     computed ONCE per frame and used both by the torso drawing (A.fit / ST.torso) and by the arm solver;
   - the head box is MEASURED from the character's real head drawing (all four views, jaw shut and open);
   - draw order: far arms -> legs -> torso -> raised arms -> head -> near arms; props at the solved palms.
   When ST.REC is set (validators) the drawn shoulder positions and the arm roots are recorded in device pixels. */
'use strict';
(function () {
  const ST = window.ST;
  const SIL = '#000';

  // measure a head view: bbox of its silhouette in head-local units over jaw shut + fully open (hat/props off);
  // rest = the chin line with the jaw shut
  function measure(ch, hv) {
    const cv = document.createElement('canvas'), N = 800, ox = 400, oy = 560;
    cv.width = N; cv.height = N;
    const c = cv.getContext('2d'), keepLW = ST.LW;
    let box = null, rest = 0;
    [0, 1].forEach((open) => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, N, N);
      c.setTransform(1, 0, 0, 1, ox, oy);
      ST.LW = 1;
      const f = ST.act(0, ch.seed, ch.spec.expr0 || 'deadpan', { still: true, noBlink: true, vis: open ? 'A' : null });
      f.jaw = open; f.m.open = open;
      ST.silhouette(SIL, () => ch.spec.heads[hv](c, f, ch.headOpts(hv, f, { measure: true }, 1)));
      const d = c.getImageData(0, 0, N, N).data;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (d[(y * N + x) * 4 + 3] < 128) continue;
        const hx = x - ox, hy = y - oy;
        if (!box) box = { x0: hx, x1: hx, y0: hy, y1: hy };
        else { box.x0 = Math.min(box.x0, hx); box.x1 = Math.max(box.x1, hx); box.y0 = Math.min(box.y0, hy); box.y1 = Math.max(box.y1, hy); }
      }
      if (!open) rest = box.y1;
    });
    ST.LW = keepLW;
    return Object.assign(box, { rest });
  }

  ST.defineCharacter = (spec) => {
    const D = spec.D, seed = spec.seed || 100, boxes = [];
    const ch = { id: spec.id, name: spec.name, D, seed, spec, demo: spec.demo, extraRows: spec.extraRows || [], exprs: Object.keys(spec.expr || ST.EXPR) };
    const fitR = D.fitR || Math.max(36, 0.8 * D.sw);
    ch.headBox = (hv) => boxes[hv] || (boxes[hv] = measure(ch, hv));
    ch.jawSpec = (hv) => (spec.jaw ? (Array.isArray(spec.jaw) ? spec.jaw[hv] : spec.jaw) : null);
    // what every head function receives: o = { J (the jaw rule), ex (the character's own expression entry), p, t,
    // measure (true while the engine measures the head box: skip hats and props), ks (key side, +1 = light on +x) }
    ch.headOpts = (hv, f, p, ks) => {
      const js = ch.jawSpec(hv);
      return { J: js ? ST.jaw(f.jaw, js) : ST.jawClosed(), ex: spec.expr ? spec.expr[f.name] || spec.expr[spec.expr0] : null, p, t: p.t || 0, measure: !!p.measure, ks: ks || 1 };
    };
    ch.face = (p) => ST.act(p.t || 0, seed, p.expr || spec.expr0 || 'deadpan', { talk: p.talk, look: p.look, chew: p.chew, still: p.still, vis: p.vis });
    ch.pose = (p) => Object.assign({}, p.pose || ST.pose('stand', D));
    ch.frame = (p, P, V) => ({ x: p.x, y: p.y, s: p.s, lean: (p.lean || 0) + (P.lean || 0) + (D.lean || 0), flip: V.mir });

    // ---- anchors(view, pose): the single source of truth ----
    ch.anchors = (V, P, p, f) => {
      p = p || {};
      const bob = ((P.bob || 0) + (D.crouch || 0)) * (D.l1l + D.l2l);
      const tilt = D.shY || [D.tilt || 0, -(D.tilt || 0)];
      const sh = {}, hip = {};
      ['L', 'R'].forEach((side, i) => {
        const sgn = i ? -1 : 1, S0 = [sgn * D.sw, D.sy, D.sz || 0], q = ST.proj(V, S0);
        sh[side] = { nominal: [q[0], q[1]], depth: q[2], dy: tilt[i] };
        const H0 = [sgn * D.hw, D.hy + bob, 0], h = ST.proj(V, H0);
        hip[side] = { b: H0, p: [h[0], h[1]], depth: h[2] };
      });
      const near = sh.L.depth >= sh.R.depth ? 'L' : 'R', far = near === 'L' ? 'R' : 'L';
      // shoulders that overlap in the drawing (profile) cannot show two heights: both take the near one's
      if (Math.hypot(sh.L.nominal[0] - sh.R.nominal[0], sh.L.nominal[1] - sh.R.nominal[1]) < fitR) sh[far].dy = sh[near].dy;
      ['L', 'R'].forEach((side, i) => {
        const s = sh[side], sgn = i ? -1 : 1;
        s.p = [s.nominal[0], s.nominal[1] + s.dy + bob];
        s.b = [sgn * D.sw, D.sy + s.dy + bob, D.sz || 0];
      });
      // torso-local displacement field: points near a shoulder move with that shoulder's tilt
      const disp = (x, y) => {
        let dy = 0;
        ['L', 'R'].forEach((side) => {
          const s = sh[side], d = Math.hypot(x - s.nominal[0], y - s.nominal[1]);
          if (side === far && Math.hypot(sh.L.nominal[0] - sh.R.nominal[0], sh.L.nominal[1] - sh.R.nominal[1]) < fitR) return;
          dy += s.dy * ST.smooth(1 - d / fitR);
        });
        return dy;
      };
      const n = spec.neck[V.v], H = ST.headView(V.yaw, p.head), hv = H.V.v, k = D.hk || 1;
      const at = [n[0], n[1] + bob + (p.headDy || 0) + (spec.headDy ? spec.headDy(p) : 0)], sx = (H.flip ? -1 : 1) * k;
      const toFig = (hx, hy) => [at[0] + sx * hx, at[1] + k * hy];
      const b = ch.headBox(hv), c0 = toFig(b.x0, b.y0), c1 = toFig(b.x1, b.rest + (b.y1 - b.rest) * (f ? f.jaw : 0)); // the chin drops with the jaw
      const head = { cx: (c0[0] + c1[0]) / 2, hw: Math.abs(c1[0] - c0[0]) / 2, top: c0[1], bottom: c1[1], chin: toFig(0, b.rest)[1], view: hv, flip: H.flip };
      const A = {
        D: Object.assign({ hsz: spec.arm.hsz }, D), V, bob, sh, hip, head, neck: [n[0], n[1] + bob], headAt: at, headScale: sx, headView: H,
        shoulderNear: sh[near], shoulderFar: sh[far], hipNear: hip[near], hipFar: hip[far], near, far,
        fit: (pts) => pts.map((v, i) => (i % 2 ? v + disp(pts[i - 1], v) : v)),
        headToFig: toFig,
      };
      A.headBox = head;
      // face anchors of the real head drawing (jaw applied), in figure space; cheek / ear pick the hand's own side
      A.facePoint = (name, side) => {
        const tab = spec.face && spec.face[hv];
        if (!tab || !tab[name]) return null;
        const J = ch.headOpts(hv, f || { jaw: 0 }, p, 1).J;
        const cands = Array.isArray(tab[name][0]) ? tab[name] : [tab[name]];
        let best = null;
        cands.forEach((q) => {
          const fq = toFig(q[0], J.y(q[1])), sp = side ? sh[side].p : at;
          const d = Math.hypot(fq[0] - sp[0], fq[1] - sp[1]);
          if (!best || d < best.d) best = { d, p: fq };
        });
        return best.p;
      };
      // a face-contact target -> 3D (lifted from a natural point in front of the chest; the palm lands there)
      A.face = (touch, side, fallback) => {
        const t = typeof touch === 'string' ? { at: touch } : touch, fp = A.facePoint(t.at, side);
        if (!fp) return fallback ? [fallback[0], fallback[1] + bob, fallback[2]] : sh[side].b;
        const sgn = side === 'L' ? 1 : -1, AL = D.l1a + D.l2a, T0 = [sgn * D.sw * 0.3, D.sy + 0.25 * AL + bob, (D.sz || 0) + 0.38 * AL];
        const q = ST.proj(V, T0), gx = fp[0] + sx * (t.dx || 0), gy = fp[1] + k * (t.dy || 0);
        return ST.fitReach(V, sh[side].b, ST.lift(V, T0, gx - q[0], gy - q[1]), (D.l1a + D.l2a) * 0.95);
      };
      return A;
    };
    // everything the drawing will use for p, without drawing (validators, ST.meet)
    ch.solveFor = (p) => {
      const V = ST.view(p.yaw || 0), P = ch.pose(p);
      if (spec.adjust) spec.adjust(P, p);
      const f = ch.face(p), A = ch.anchors(V, P, p, f), J = ST.solve(V, A, P);
      return { V, P, f, A, J, frame: ch.frame(p, P, V) };
    };

    ch.draw = (ctx, p) => {
      const R = ch.solveFor(p), { V, P, f, A, J } = R, lay = p.layer || {}, H = A.headView, hv = H.V.v;
      if (ST.REC) Object.assign(ST.REC, { J, A, P, ch: ch.id });
      const arms = [['L', J.aL], ['R', J.aR]].map(([side, j]) => [side, j, ST.armLayer(j, A, lay[side])]);
      const armsAt = (layer) => arms.forEach(([side, j, l]) => {
        if (l !== layer) return;
        const g = ST.palm(j, spec.arm.hsz), prop = p['prop' + side];
        if (prop) prop(ctx, g[0], g[1], j.ang, j);
        if (spec.hold) spec.hold(ctx, side, j, g, p, A);
        ST.drawArm(ctx, j, Object.assign({}, spec.arm, { hand: p['hand' + side] || P['k' + side] || 'fist', seed: seed + 110 + (side === 'L' ? 1 : 2) }));
        if (spec.holdOver) spec.holdOver(ctx, side, j, g, p, A);
      });
      if (spec.shadowW && p.shadow !== false) ST.footShadow(ctx, p, spec.shadowW);
      ST.figure(ctx, R.frame, V.mir, () => {
        if (spec.behind) spec.behind(ctx, J, A, p);
        armsAt(0);
        [[J.lL, 1], [J.lR, -1]].sort((a, b) => a[0].depth - b[0].depth).forEach(([j, sg]) => ST.drawLeg(ctx, V, j, sg, Object.assign({}, spec.leg, { seed: seed + 120 + sg })));
        ctx.save();
        ctx.translate(0, A.bob);
        spec.torso(ctx, V.v, A, p, f);
        ctx.restore();
        armsAt(1);
        const sm = typeof p.smear === 'number' ? p.smear : 0, at = A.headAt;
        ctx.save();
        ctx.translate(at[0] + f.dx, at[1]);
        ctx.scale(A.headScale * (1 - 0.16 * sm), (D.hk || 1) * (1 + 0.4 * sm));
        spec.heads[hv](ctx, f, ch.headOpts(hv, f, p, ST.keySide(V, H.flip)));
        ctx.restore();
        if (sm > 0) ST.speedLines(ctx, at[0], at[1] - 110 * (D.hk || 1), -(p.smearDir || 1) * 150, 30, 4, seed + 77);
        armsAt(2);
        if (spec.after) spec.after(ctx, J, A, p);
        if (p.after) p.after(J, ctx, A);
      });
      return R;
    };
    ST.CAST[spec.id] = ch;
    return ch;
  };

  // draw the main torso outline through the anchors: the shoulder region follows the tilt, and (for validators) the
  // drawn shoulder points are recorded in device pixels. Extra torso parts near the shoulders use A.fit(pts).
  ST.torso = (ctx, A, pts, fill, o) => {
    if (ST.REC) ['L', 'R'].forEach((side) => {
      const s = A.sh[side];
      ST.REC.shoulders[side] = ST.devPoint(ctx, [s.nominal[0], s.nominal[1] + s.dy]);
    });
    return ST.blob(ctx, A.fit(pts), fill, o);
  };
  // a cast member lit by the shot's key as a whole figure (film 16): hard shadow crescent + rim inside the ink
  ST.actor = (ctx, id, p, L) => {
    const k = p.s * ST.camZ;
    ST.litFigure(ctx, Object.assign({ d: 20 * k, rim: 5 * k, ink: 13 * Math.pow(k, 0.45) }, L), (c) => ST.CAST[id].draw(c, p));
  };
})();
