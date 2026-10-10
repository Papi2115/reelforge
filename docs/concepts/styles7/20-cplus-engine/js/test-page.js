/* Dev page: turnaround sheets (6 views x the validators' pose cases, incl. face contact and folded arms), a viseme/expression row, the cast
   line-up and a handshake board solved by ST.meet. Hooks: window.__test.sheet(id) / all(scale) / lineup(sil) /
   meetBoard() -> PNG data URLs. The validators live in validate*.js (window.__validate). */
'use strict';
(function () {
  const ST = window.ST;
  const YAWS = [0, 1, 2, 3, -2, -1], YAW_NAMES = ['front', '3/4 R', 'profile R', 'back', 'profile L', '3/4 L'];
  const CW = 230, CH = 300, LABEL = 120, HEAD = 64;
  const FACES = [['deadpan', null], ['shock', null], ['grin', null], ['talk A', 'A'], ['talk O', 'O'], ['talk E', 'E']];
  const FACE_YAWS = [0, 1, 2, 1, 0, -1];

  function sheet(id) {
    const ch = ST.CAST[id], D = ch.D, rows = ST.VALIDATE.poses(ch);
    const cv = document.createElement('canvas');
    cv.width = LABEL + CW * 6;
    cv.height = HEAD + CH * (rows.length + 1);
    const ctx = cv.getContext('2d');
    ST.setLight(-1);
    ctx.fillStyle = '#6f6a58';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#16120e';
    ctx.font = 'bold 26px Georgia';
    ctx.fillText(ch.name, 12, 28);
    ctx.font = '18px Georgia';
    YAW_NAMES.forEach((n, i) => ctx.fillText(n, LABEL + i * CW + 10, 54));
    const s = (CH - 34) / -D.top;
    const cell = (r, c, fn) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(LABEL + c * CW, HEAD + r * CH, CW - 2, CH - 2);
      ctx.clip();
      ctx.fillStyle = (r + c) % 2 ? '#8a846c' : '#837d66';
      ctx.fillRect(LABEL + c * CW, HEAD + r * CH, CW, CH);
      fn(LABEL + c * CW + CW / 2, HEAD + r * CH + CH - 14);
      ctx.restore();
      ST.LW = 1;
    };
    rows.forEach(([name, propsFn], r) => {
      ctx.fillStyle = '#16120e';
      ctx.font = '19px Georgia';
      ctx.fillText(name, 8, HEAD + r * CH + CH / 2);
      YAWS.forEach((yaw, c) => cell(r, c, (x, y) => ch.draw(ctx, Object.assign({ x, y, s, t: 0.05, yaw, still: true }, ch.demo, propsFn(D)))));
    });
    const r = rows.length;
    ctx.fillStyle = '#16120e';
    ctx.fillText('faces', 10, HEAD + r * CH + CH / 2);
    const hb = ch.headBox(0), hk = D.hk || 1, hcy = ch.spec.neck[0][1] + (hk * (hb.y0 + hb.y1)) / 2, k = (CH - 40) / ((hb.y1 - hb.y0) * hk * 1.1);
    FACES.forEach(([e, vis], c) => cell(r, c, (x, y) => {
      const expr = vis ? 'deadpan' : e;
      ch.draw(ctx, { x, y: y - (CH - 28) / 2 + 6 - hcy * k, s: k, t: 0.05, yaw: FACE_YAWS[c], expr, vis, still: true, shadow: false, pose: ST.pose('stand', D) });
      ST.label(ctx, e, x, y - 8, { size: 20, fill: '#e8dfc4', stroke: '#16120e', lw: 6, font: 'bold 20px Georgia' });
    }));
    return cv;
  }

  // the whole cast side by side at one scale; sil = flat black silhouettes (readability check)
  function lineup(sil) {
    const ids = Object.keys(ST.CAST), cw = 260, cv = document.createElement('canvas');
    cv.width = cw * ids.length + 40;
    cv.height = 560;
    const c = cv.getContext('2d');
    ST.setLight(-1);
    c.fillStyle = '#8a846c';
    c.fillRect(0, 0, cv.width, cv.height);
    ids.forEach((id, i) => {
      const x = 40 + i * cw + cw / 2 - 20, y = 500, ch = ST.CAST[id];
      const draw = () => ch.draw(c, Object.assign({ x, y, s: 0.5, t: 0.05, yaw: 1, still: true, shadow: false }, ch.demo));
      if (sil) ST.silhouette('#111', draw); else draw();
      ST.LW = 1;
      c.fillStyle = '#16120e';
      c.font = 'bold 18px Georgia';
      c.textAlign = 'center';
      c.fillText(ch.name.replace('The ', ''), x, y + 36);
    });
    return cv;
  }

  // handshakes solved by ST.meet: one row per pair [idA, idB, scaleA, scaleB, yawA, yawB]; left = as given, right =
  // the second character 30 px higher and 10% smaller in the first (a cheated over-the-shoulder set-up)
  function meetBoard(pairs) {
    const RH = 520, cv = document.createElement('canvas');
    cv.width = 1600;
    cv.height = RH * pairs.length;
    const c = cv.getContext('2d');
    ST.setLight(-1);
    c.fillStyle = '#6f6a58';
    c.fillRect(0, 0, cv.width, cv.height);
    pairs.forEach(([ia, ib, sa, sb, ya, yb], r) => {
      const A = ST.CAST[ia], B = ST.CAST[ib], y0 = RH * (r + 1) - 30, k = (RH - 60) / 880;
      [[300, 0], [1100, 1]].forEach(([x0, cheat]) => {
        const m = ST.meet({ a: { ch: A, hand: 'R', p: { x: x0, y: y0, s: sa * k * (cheat ? 0.9 : 1), t: 0.05, yaw: ya, still: true } }, b: { ch: B, hand: 'R', p: { x: x0 + 300, y: y0 - cheat * 30, s: sb * k, t: 0.05, yaw: yb, still: true } }, point: 'mid', move: true });
        A.draw(c, m.a);
        B.draw(c, m.b);
        ST.LW = 1;
        c.fillStyle = m.ok ? '#1d3a12' : '#7c1f19';
        c.font = 'bold 18px Georgia';
        c.fillText(`${A.name.replace('The ', '')} x ${B.name.replace('The ', '')}: palms ${m.gap.toFixed(1)} px apart${m.ok ? '' : ' - reported: ' + m.reason.split(' (')[0]}`, x0 - 280, y0 - RH + 70);
      });
    });
    return cv;
  }

  const host = document.getElementById('sheets'), report = document.getElementById('report');
  const add = (cv) => { cv.style.width = '100%'; cv.style.maxWidth = cv.width + 'px'; host.appendChild(cv); };
  const ids = Object.keys(ST.CAST);
  if (new URLSearchParams(location.search).get('sheets') !== '0') {
    add(lineup(false));
    ids.forEach((id) => add(sheet(id)));
  }
  // the validators run on demand (they take a few seconds); the headless runner calls window.__validate.run() itself
  document.getElementById('run').addEventListener('click', () => {
    const r = window.__validate.run(), lines = Object.keys(r.counts).map((t) => `${t}: ${r.counts[t] - (r.fails[t] || 0)}/${r.counts[t]} passed`);
    report.className = r.ok ? 'pass' : 'fail';
    report.textContent = [r.ok ? 'ALL GREEN' : 'FAILURES'].concat(lines, r.notes, Object.keys(r.metrics).map((k) => `${k} = ${r.metrics[k].toFixed(2)}`), r.failures).join('\n');
  });
  window.__test = {
    ids,
    sheet: (id) => sheet(id).toDataURL('image/png'),
    lineup: (sil) => lineup(sil).toDataURL('image/png'),
    meetBoard: (pairs) => meetBoard(pairs).toDataURL('image/png'),
    all(scale) {
      const k = scale || 0.5, parts = ids.map(sheet), cols = 2, w = parts[0].width * k, rowH = [];
      parts.forEach((p, i) => { const r = Math.floor(i / cols); rowH[r] = Math.max(rowH[r] || 0, p.height * k); });
      const out = document.createElement('canvas');
      out.width = Math.round(w * cols);
      out.height = Math.round(rowH.reduce((a, b) => a + b, 0));
      const o = out.getContext('2d');
      o.fillStyle = '#1b1814';
      o.fillRect(0, 0, out.width, out.height);
      let y = 0;
      parts.forEach((p, i) => {
        o.drawImage(p, (i % cols) * w, y, w, p.height * k);
        if (i % cols === cols - 1) y += rowH[Math.floor(i / cols)];
      });
      return out.toDataURL('image/png');
    },
  };
})();
