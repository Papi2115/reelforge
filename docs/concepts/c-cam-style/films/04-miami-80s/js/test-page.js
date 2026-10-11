/* Dev page: turnaround sheets. For every character: 6 views (front, 3/4 R, profile R, back, profile L, 3/4 L) x
   4 poses, plus a row of expressions while the head turns. Hooks: window.__test.sheet(id) -> PNG data URL,
   window.__test.all() -> one PNG with every character (scaled). */
'use strict';
(function () {
  const ST = window.ST;
  const YAWS = [0, 1, 2, 3, -2, -1], YAW_NAMES = ['front', '3/4 R', 'profile R', 'back', 'profile L', '3/4 L'];
  const CW = 230, CH = 290, LABEL = 120, HEAD = 64;
  const ROWS = [
    ['stand', (D) => ({ pose: ST.pose('stand', D) })],
    ['akimbo', (D) => ({ pose: ST.pose('akimbo', D) })],
    ['jig', (D) => ({ pose: ST.pose('jig', D, 0.25) })],
    ['flail', (D) => ({ pose: ST.pose('flail', D, 0.25) })],
    ['point R', (D) => ({ pose: ST.pose('point', D, -1) })],
  ];
  const EXPRS = ['deadpan', 'miserable', 'shock', 'smug', 'rage', 'exhausted'];
  const EXPR_YAWS = [0, 1, 2, 1, 0, -1];

  function sheet(id) {
    const ch = ST.CAST[id], D = ch.D, rows = ROWS.concat(ch.extraRow ? [ch.extraRow] : []);
    const cv = document.createElement('canvas');
    cv.width = LABEL + CW * 6;
    cv.height = HEAD + CH * (rows.length + 1);
    const ctx = cv.getContext('2d');
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
      ctx.font = '20px Georgia';
      ctx.fillText(name, 10, HEAD + r * CH + CH / 2);
      YAWS.forEach((yaw, c) => cell(r, c, (x, y) => ch.draw(ctx, Object.assign({ x, y, s, t: 0.05, yaw, expr: 'deadpan' }, ch.demo, propsFn(D)))));
    });
    const r = rows.length;
    ctx.fillStyle = '#16120e';
    ctx.fillText('faces', 10, HEAD + r * CH + CH / 2);
    EXPRS.forEach((e, c) => cell(r, c, (x, y) => {
      const k = s * 1.75;
      ch.draw(ctx, { x, y: y - (CH - 28) / 2 - (D.top + 95) * k, s: k, t: 0.05, yaw: EXPR_YAWS[c], expr: e, pose: ST.pose('stand', D) });
      ST.label(ctx, e, x, y - 8, { size: 20, fill: '#e8dfc4', stroke: '#16120e', lw: 6, font: 'bold 20px Georgia' });
    }));
    return cv;
  }

  const ids = Object.keys(ST.CAST);
  const host = document.getElementById('sheets');
  ids.forEach((id) => {
    const cv = sheet(id);
    cv.style.width = '100%';
    cv.style.maxWidth = cv.width + 'px';
    host.appendChild(cv);
  });
  window.__test = {
    ids,
    sheet: (id) => sheet(id).toDataURL('image/png'),
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
