/* Validators, part 1 (pixels): 1. ANCHORS - the drawn shoulder (recorded by ST.torso) and the arm root (recorded by
   ST.drawArm) agree within 2 px, the root lies inside the torso silhouette and below the real chin (jaw shut,
   measured from the head drawing) + the neck gap.
   2. CONNECTIVITY - each figure rendered flat in one colour is ONE connected component (no floating hand, no detached
   jaw tier) for every view x pose x viseme; each head alone is one component WITH NO HOLES for every view x viseme x
   expression (a hole = the collar showing through a gap between skull and jaw). */
'use strict';
(function () {
  const ST = window.ST;
  const V = (ST.VALIDATE = ST.VALIDATE || {});
  V.YAWS = [0, 1, 2, 3, -2, -1];
  V.VISEMES = [null, 'A', 'E', 'I', 'O', 'F', 'M'];
  // the pose cases every character is checked in (the test sheets show the same rows)
  ST.TEST_POSES = [
    ['stand', (D) => ({ pose: ST.pose('stand', D) })],
    ['akimbo', (D) => ({ pose: ST.pose('akimbo', D) })],
    ['fold', (D) => ({ pose: ST.pose('fold', D) })],
    ['hug', (D) => ({ pose: ST.pose('hug', D) })],
    ['flail', (D) => ({ pose: ST.pose('flail', D, 0.25) })],
    ['jig', (D) => ({ pose: ST.pose('jig', D, 0.25) })],
    ['point R', (D) => ({ pose: ST.pose('point', D, -1) })],
    ['armsUp', (D) => ({ pose: ST.pose('armsUp', D) })],
    ['walk', (D) => ({ pose: ST.pose('walk', D, 0.3) })],
    ['crouch', (D) => ({ pose: ST.pose('crouch', D) })],
    ['chin (touch R)', (D) => ({ pose: ST.pose('stand', D, null, ST.touch('R', 'chin', 0, 14, 'fist')) })],
    ['cheek (touch L)', (D) => ({ pose: ST.pose('stand', D, null, ST.touch('L', 'cheek', 0, 0, 'flat')) })],
  ];
  V.poses = (ch) => ST.TEST_POSES.concat(ch.extraRows || []);

  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  V.canvas = canvas;
  // 8-connected components of opaque pixels (alpha >= 128) with area >= minArea; holes = transparent components
  // that do not touch the border (area >= minHole)
  V.components = (img, w, h, minArea, minHole) => {
    const N = w * h, on = new Uint8Array(N), seen = new Int32Array(N), stack = new Int32Array(N);
    for (let i = 0; i < N; i++) on[i] = img[i * 4 + 3] >= 128 ? 1 : 0;
    const flood = (start, val, mark, eight) => {
      let sp = 0, area = 0, border = false;
      stack[sp++] = start;
      seen[start] = mark;
      while (sp) {
        const i = stack[--sp], x = i % w, y = (i / w) | 0;
        area++;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || (!eight && dx && dy)) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (seen[j] || on[j] !== val) continue;
          seen[j] = mark;
          stack[sp++] = j;
        }
      }
      return { area, border };
    };
    let comps = 0, holes = 0, mark = 0, biggestHole = 0;
    for (let i = 0; i < N; i++) {
      if (seen[i]) continue;
      const r = flood(i, on[i], ++mark, on[i] === 1);
      if (on[i] && r.area >= minArea) comps++;
      if (!on[i] && !r.border && r.area >= (minHole || 8)) { holes++; biggestHole = Math.max(biggestHole, r.area); }
    }
    return { comps, holes, biggestHole };
  };
  const alphaAt = (c, q) => c.getImageData(Math.round(q[0]), Math.round(q[1]), 1, 1).data[3];

  // 1. anchors
  V.anchors = (ch, out) => {
    const W = 1100, H = 1150, cv = canvas(W, H), c = cv.getContext('2d'), tc = canvas(W, H), t = tc.getContext('2d');
    const gap = ch.D.neckGap === undefined ? 6 : ch.D.neckGap;
    V.YAWS.forEach((yaw) => V.poses(ch).forEach(([name, fn]) => {
      const p = Object.assign({ x: W / 2, y: H - 40, s: 1, t: 0.05, yaw, still: true, shadow: false }, ch.demo, fn(ch.D)), id = `${ch.id} yaw ${yaw} ${name}`;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, W, H);
      ST.REC = { arms: [], shoulders: {} };
      ch.draw(c, p);
      const R = ST.REC;
      ST.REC = null;
      const fr = ch.frame(p, R.P, R.A.V), M = ST.figMatrix(fr);
      t.setTransform(1, 0, 0, 1, 0, 0);
      t.clearRect(0, 0, W, H);
      t.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
      t.translate(0, R.A.bob);
      ST.silhouette('#000', () => ch.spec.torso(t, R.A.V.v, R.A, p, ch.face(p)));
      ['L', 'R'].forEach((side) => {
        const j = R.J['a' + side], rec = R.arms.find((a) => a.j === j), drawn = R.shoulders[side];
        if (!rec || !drawn) { out.fail('anchors', id, `${side}: torso or arm not drawn through the anchors (ST.torso / ST.drawArm)`); return; }
        const d = Math.hypot(rec.root[0] - drawn[0], rec.root[1] - drawn[1]);
        out.metric('anchors', 'max drawn-vs-solver shoulder px', d);
        if (d > 2) out.fail('anchors', id, `${side} shoulder drawn ${d.toFixed(1)} px off the arm root`);
        if (alphaAt(t, rec.root) < 128) out.fail('anchors', id, `${side} shoulder anchor outside the torso silhouette`);
        const below = R.A.sh[side].p[1] - (R.A.head.chin + gap);
        out.metric('anchors', `min shoulder clearance below chin+gap px - ${ch.id}`, below, true);
        if (below < 0) out.fail('anchors', id, `${side} shoulder ${(-below).toFixed(1)} px above chin + neck gap`);
        out.pass('anchors');
      });
    }));
  };

  // 2a. whole figures, flat
  V.figures = (ch, out) => {
    const W = 640, H = 620, cv = canvas(W, H), c = cv.getContext('2d'), s = 520 / -ch.D.top;
    let k = 0;
    V.YAWS.forEach((yaw) => V.poses(ch).forEach(([name, fn]) => {
      const vis = V.VISEMES[k++ % V.VISEMES.length], p = Object.assign({ x: W / 2, y: H - 30, s, t: 0.05, yaw, still: true, vis, shadow: false }, ch.demo, fn(ch.D));
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, W, H);
      ST.silhouette('#000', () => ch.draw(c, p));
      ST.LW = 1;
      const r = V.components(c.getImageData(0, 0, W, H).data, W, H, 6, 1e9);
      if (r.comps !== 1) out.fail('connectivity', `${ch.id} yaw ${yaw} ${name} vis ${vis}`, `${r.comps} separate pieces (expected 1)`);
      else out.pass('connectivity');
    }));
  };
  // 2b. heads alone: every head view x viseme x expression (the character's own expressions included)
  V.heads = (ch, out) => {
    const N = 460, cv = canvas(N, N), c = cv.getContext('2d'), exprs = ['deadpan', 'shock', 'grin', 'yelling'].concat(ch.spec.expr ? Object.keys(ch.spec.expr) : []);
    [0, 1, 2, 3].forEach((hv) => exprs.forEach((e) => V.VISEMES.forEach((vis) => {
      const f = ST.act(0.05, ch.seed, e, { still: true, noBlink: true, vis });
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, N, N);
      c.setTransform(1, 0, 0, 1, N / 2, N * 0.68);
      ST.LW = 1;
      ST.silhouette('#000', () => ch.spec.heads[hv](c, f, ch.headOpts(hv, f, { t: 0.05, expr: e }, 1)));
      const r = V.components(c.getImageData(0, 0, N, N).data, N, N, 6, 20); // holes under 20 px = slivers between ink strokes
      out.metric('connectivity', 'biggest hole in a head px', r.biggestHole);
      if (r.comps !== 1 || r.holes) out.fail('connectivity', `${ch.id} head view ${hv} ${e} vis ${vis}`, `${r.comps} pieces, ${r.holes} holes (biggest ${r.biggestHole} px)`);
      else out.pass('connectivity');
    })));
  };
})();
