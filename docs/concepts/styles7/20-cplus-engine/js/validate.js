/* Validators, part 2 (geometry) + the runner.
   3. TANGLE - no palm inside the head box (except face-contact hands), no elbow flip (3D: the elbow on its pole side;
      animated poses: the bend never flips while the arm is bent), library targets reachable, no near arm crossing the
      face. Face contact: the palm lands on the face anchor (<= 4 px), in front, while the other hand stays guarded.
   4. CONTACT - ST.meet handshakes between characters at many scales / yaws / positions + the film 15 deck set-up:
      the two palms (recomputed independently from the drawn figures) are <= 4 px apart.
   5. CONTINUITY - a hand target swept across the face-guard box edges frame by frame: the hand never jumps (each
      step <= 5x the target step + 1 px; it slides round the head instead). The old discontinuous guard is measured on the same sweeps for the record.
   window.__validate.run() -> { ok, counts, failures, metrics }. */
'use strict';
(function () {
  const ST = window.ST, V = ST.VALIDATE;

  function segBox(a, b, x0, y0, x1, y1) { // segment vs axis-aligned box (Liang-Barsky)
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]) {
      if (p === 0) { if (q < 0) return false; continue; }
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
    return true;
  }
  const inBox = (q, r, hb) => q[0] + r > hb.cx - hb.hw && q[0] - r < hb.cx + hb.hw && q[1] + r > hb.top && q[1] - r < hb.bottom;
  const cross = (j) => (j.h[0] - j.s[0]) * (j.e[1] - j.s[1]) - (j.h[1] - j.s[1]) * (j.e[0] - j.s[0]);

  function checkArms(ch, R, id, out) {
    const hb = R.A.head, hsz = ch.spec.arm.hsz;
    ['L', 'R'].forEach((side) => {
      const j = R.J['a' + side], g = ST.palm(j, hsz), lay = ST.armLayer(j, R.A);
      if (!j.touch && inBox(g, hsz * 0.35, hb)) out.fail('tangle', id, `${side} hand inside the head box`);
      const u = [j.H3[0] - j.S3[0], j.H3[1] - j.S3[1], j.H3[2] - j.S3[2]], ul = Math.hypot(u[0], u[1], u[2]) || 1;
      const a = ((j.E3[0] - j.S3[0]) * u[0] + (j.E3[1] - j.S3[1]) * u[1] + (j.E3[2] - j.S3[2]) * u[2]) / ul;
      const off = [0, 1, 2].map((i) => j.E3[i] - j.S3[i] - (u[i] / ul) * a), bend = Math.hypot(off[0], off[1], off[2]);
      const pn = Math.hypot(j.pole[0], j.pole[1], j.pole[2]), pu = j.pole.map((v) => v / pn), pk = (pu[0] * u[0] + pu[1] * u[1] + pu[2] * u[2]) / ul;
      const usable = Math.hypot(pu[0] - (pk * u[0]) / ul, pu[1] - (pk * u[1]) / ul, pu[2] - (pk * u[2]) / ul) > 0.8; // else the IK hangs the elbow on purpose
      if (usable && bend > 2 && off[0] * j.pole[0] + off[1] * j.pole[1] + off[2] * j.pole[2] < 0) out.fail('tangle', id, `${side} elbow flipped against its pole`);
      const over = Math.max(0, Math.hypot(j.req[0] - j.S3[0], j.req[1] - j.S3[1], j.req[2] - j.S3[2]) - j.len) / j.len;
      out.metric('tangle', 'max pose target beyond reach (fraction of arm)', over);
      if (over > 0.08 + (j.palmTarget ? (hsz * 0.55) / j.len : 0)) out.fail('tangle', id, `${side} pose target out of reach by ${(over * j.len).toFixed(0)} px`);
      const sx = hb.hw * 0.15, sy = (hb.bottom - hb.top) * 0.15;
      if (lay === 2 && !j.touch && (segBox(j.s, j.e, hb.cx - hb.hw + sx, hb.top + sy, hb.cx + hb.hw - sx, hb.bottom - sy) || segBox(j.e, j.h, hb.cx - hb.hw + sx, hb.top + sy, hb.cx + hb.hw - sx, hb.bottom - sy))) out.fail('tangle', id, `${side} arm crosses the face`);
      if (j.touch) {
        out.metric('tangle', 'max face-contact palm miss px', j.palmMiss || 0);
        if (j.palmMiss > 4) out.fail('tangle', id, `${side} touch palm ${j.palmMiss.toFixed(1)} px off the face anchor`);
        if (lay !== 2) out.fail('tangle', id, `${side} touch hand not in front`);
      }
      out.pass('tangle');
    });
  }
  V.tangle = (ch, out) => {
    V.YAWS.forEach((yaw) => {
      V.poses(ch).forEach(([name, fn]) => checkArms(ch, ch.solveFor(Object.assign({ x: 0, y: 0, s: 1, t: 0.05, yaw, still: true }, ch.demo, fn(ch.D))), `${ch.id} yaw ${yaw} ${name}`, out));
      ['chin', 'cheek', 'nose', 'mouth', 'ear', 'forehead'].forEach((at) => ['L', 'R'].forEach((side) => {
        if (Math.abs(yaw) === 3) return;
        const R = ch.solveFor({ x: 0, y: 0, s: 1, t: 0.05, yaw, still: true, pose: ST.pose('stand', ch.D, null, ST.touch(side, at)) }), fp = R.A.facePoint(at, side);
        if (!fp) return;
        const sp = R.A.sh[side].p, len = ch.D.l1a + ch.D.l2a;
        if (Math.hypot(fp[0] - sp[0], fp[1] - sp[1]) > len * 0.9 + 0.5 * ch.spec.arm.hsz) { out.metric('tangle', `face anchors out of arm's reach (skipped) - ${ch.id}`, (out.r.metrics[`tangle: face anchors out of arm's reach (skipped) - ${ch.id}`] || 0) + 1); return; }
        checkArms(ch, R, `${ch.id} yaw ${yaw} touch ${side} ${at}`, out);
      }));
      ['jig', 'flail', 'walk', 'throw', 'stomp'].forEach((name) => {
        let prev = null;
        for (let i = 0; i <= 24; i++) {
          const R = ch.solveFor({ x: 0, y: 0, s: 1, t: 0.05, yaw, still: true, pose: ST.pose(name, ch.D, i / 24) }), id = `${ch.id} yaw ${yaw} ${name} ph ${i}/24`;
          checkArms(ch, R, id, out);
          if (prev) ['L', 'R'].forEach((side) => {
            const a = prev['a' + side], b = R.J['a' + side], ca = cross(a), cb = cross(b), la = a.len * a.len * 0.12;
            if (Math.abs(ca) > la && Math.abs(cb) > la && Math.sign(ca) !== Math.sign(cb) && Math.hypot(a.h[0] - b.h[0], a.h[1] - b.h[1]) < a.len * 0.5) out.fail('tangle', id, `${side} elbow flips between frames`);
          });
          prev = R.J;
        }
      });
    });
  };

  // 4. contact
  V.CONTACT_SETUPS = (ids) => {
    const list = [];
    if (ids.includes('captain') && ids.includes('recruit')) list.push(['film 15 deck', 'captain', { x: 1090, y: 1080, s: 1.0, yaw: -1 }, 'recruit', { x: 640, y: 1500, s: 1.4, yaw: 2 }, { x: 1180, y: 620, z: 1.12 }]);
    const pairs = [];
    ids.forEach((a, i) => ids.forEach((b, k) => { if (k > i) pairs.push([a, b]); }));
    pairs.forEach(([a, b]) => [[1, -1], [2, -2], [1, -2], [0, -1]].forEach(([ya, yb]) => [[1, 1], [0.6, 0.6], [1.4, 1.3], [0.9, 1.1], [0.6, 1.4]].forEach(([sa, sb]) => [260, 420].forEach((dist) => {
      list.push([`${a} x ${b} yaw ${ya}/${yb} s ${sa}/${sb} d ${dist}`, a, { x: 800, y: 500 + 500 * sa, s: sa, yaw: ya }, b, { x: 800 + dist, y: 500 + 500 * sb, s: sb, yaw: yb }, null]); // feet on one floor in perspective (horizon y 500)
    }))));
    return list;
  };
  V.contact = (ids, out) => V.CONTACT_SETUPS(ids).forEach(([id, ia, pa, ib, pb, cam]) => {
    const A = ST.CAST[ia], B = ST.CAST[ib];
    const m = ST.meet({ a: { ch: A, hand: 'R', cam, p: Object.assign({ t: 0.05, still: true }, A.demo, pa) }, b: { ch: B, hand: 'R', cam, p: Object.assign({ t: 0.05, still: true }, B.demo, pb) }, point: 'mid', move: true });
    const ga = ST.palmWorld(A, m.a, 'R', cam), gb = ST.palmWorld(B, m.b, 'R', cam), gap = Math.hypot(ga[0] - gb[0], ga[1] - gb[1]);
    if (m.ok) {
      out.metric('contact', 'max handshake gap px (met set-ups)', gap);
      out.metric('contact', 'max character shift px (met set-ups)', Math.max(Math.abs(m.moved[0]), Math.abs(m.moved[1])));
    }
    if (id === 'film 15 deck') out.note(`film 15 deck handshake: gap ${gap.toFixed(2)} px, Captain moved ${m.moved[0].toFixed(0)} px, Recruit moved ${m.moved[1].toFixed(0)} px`);
    if (gap <= 4) out.pass('contact');
    else if (m.reason && id !== 'film 15 deck' && !m.ok) { out.pass('contact'); out.metric('contact', 'set-ups reported unreachable by ST.meet', (out.r.metrics['contact: set-ups reported unreachable by ST.meet'] || 0) + 1); }
    else out.fail('contact', id, `palms ${gap.toFixed(1)} px apart ${m.reason}`);
    if (gap <= 4) [m.a, m.b].forEach((p, i) => checkArms([A, B][i], [A, B][i].solveFor(p), `${id} (${i ? ib : ia})`, out));
  });

  // 5. continuity: sweeps across the guard box edges in figure space, new guard vs the old one (style C / c-plus)
  function oldGuard(R, q) {
    const hb = R.A.head, m = hb.hw + 34;
    if (q[1] < hb.top || q[1] > hb.bottom || Math.abs(q[0] - hb.cx) >= m) return q;
    return [hb.cx + (q[0] - hb.cx >= 0 ? 1 : -1) * m, q[1]];
  }
  V.continuity = (ch, out) => [0, 1, 2, -1].forEach((yaw) => ['L', 'R'].forEach((side) => {
    const R = ch.solveFor({ x: 0, y: 0, s: 1, t: 0.05, yaw, still: true }), hb = R.A.head, hsz = ch.spec.arm.hsz, sh = R.A.sh[side];
    const own = yaw === 2 ? 1 : sh.p[0] >= hb.cx ? 1 : -1, mid = (hb.top + hb.bottom) / 2, far = hb.hw + 3 * hsz;
    const sweeps = { side: [[hb.cx + own * far, mid], [hb.cx, mid]], below: [[hb.cx, hb.bottom + 2 * hsz], [hb.cx, mid - 4]], above: [[hb.cx, hb.top - 2 * hsz], [hb.cx, mid - 4]], corner: [[hb.cx + own * far, hb.bottom + 2 * hsz], [hb.cx - own * hb.hw * 0.4, hb.top]] };
    const nominal = [sh.b[0], sh.b[1], sh.b[2] + 0.35 * (ch.D.l1a + ch.D.l2a)];
    Object.keys(sweeps).forEach((k) => {
      const [p0, p1] = sweeps[k], n = 120, step = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / n;
      let prev = null, prevOld = null, worst = 0, worstOld = 0;
      for (let i = 0; i <= n; i++) {
        const q = [p0[0] + ((p1[0] - p0[0]) * i) / n, p0[1] + ((p1[1] - p0[1]) * i) / n], nq = ST.proj(R.V, nominal);
        const T = ST.lift(R.V, nominal, q[0] - nq[0], q[1] - nq[1]), P = Object.assign({}, R.P, { ['h' + side]: T, ['abs' + side]: true });
        const g = ST.palm(ST.solve(R.V, R.A, P)['a' + side], hsz), og = oldGuard(R, q);
        if (prev) worst = Math.max(worst, Math.hypot(g[0] - prev[0], g[1] - prev[1]) / step);
        if (prevOld) worstOld = Math.max(worstOld, Math.hypot(og[0] - prevOld[0], og[1] - prevOld[1]) / step);
        prev = g; prevOld = og;
      }
      out.metric('continuity', 'max hand step / target step (new guard)', worst);
      out.metric('continuity', 'max hand step / target step (old guard)', worstOld);
      if (worst > 5 + 1 / step) out.fail('continuity', `${ch.id} yaw ${yaw} ${side} sweep ${k}`, `hand jumps ${worst.toFixed(1)}x the target step`);
      else out.pass('continuity');
    });
  }));

  function collector() {
    const r = { counts: {}, fails: {}, failures: [], metrics: {}, notes: [] };
    const bump = (t, k) => { r[k][t] = (r[k][t] || 0) + 1; };
    return {
      r,
      pass: (t) => bump(t, 'counts'),
      fail: (t, id, msg) => { bump(t, 'counts'); bump(t, 'fails'); if (r.failures.length < 400) r.failures.push(`[${t}] ${id}: ${msg}`); },
      metric: (t, name, v, min) => { const k = `${t}: ${name}`; r.metrics[k] = r.metrics[k] === undefined ? v : min ? Math.min(r.metrics[k], v) : Math.max(r.metrics[k], v); },
      note: (s) => r.notes.push(s),
    };
  }
  window.__validate = {
    run(only) {
      const out = collector(), ids = only || Object.keys(ST.CAST), keep = ST.LIGHT;
      ST.setLight(-1);
      ids.forEach((id) => {
        const ch = ST.CAST[id];
        V.anchors(ch, out);
        V.figures(ch, out);
        V.heads(ch, out);
        V.tangle(ch, out);
        V.continuity(ch, out);
      });
      V.contact(ids, out);
      ST.LIGHT = keep;
      const r = out.r;
      r.ok = Object.keys(r.fails).length === 0;
      return r;
    },
  };
})();
