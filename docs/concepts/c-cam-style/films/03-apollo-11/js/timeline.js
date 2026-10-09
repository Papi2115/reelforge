/* Timeline: lays ST.FILM end to end on one global clock and renders frame = f(t), narration burned in at the bottom
   (switchable: ST.showCaptions). */
'use strict';
(function () {
  const ST = window.ST;
  let acc = 0;
  ST.SHOTS = ST.FILM.map((f, i) => {
    const def = ST.SHOT_DEFS[f.id];
    if (!def) throw new Error(`dancing plague: shot "${f.id}" is in the film table but no script defined it`);
    const t0 = Math.round(acc * 1000) / 1000;
    acc += f.dur;
    return Object.assign({ index: i }, def, f, { t0: t0, t1: Math.round(acc * 1000) / 1000 });
  });
  ST.DURATION = Math.round(acc * 1000) / 1000;
  ST.shotAt = (t) => {
    for (let i = ST.SHOTS.length - 1; i >= 0; i--) if (t >= ST.SHOTS[i].t0) return i;
    return 0;
  };
  const localT = (s, t) => Math.round((t - s.t0) * 1e6) / 1e6;
  ST.captionAt = (t) => {
    const s = ST.SHOTS[ST.shotAt(t)], lt = localT(s, t);
    for (const [a, b, text] of s.lines) if (lt >= a && lt < b) return text;
    return '';
  };
  ST.showCaptions = true;

  function caption(ctx, text) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = "bold 46px 'Arial Black', Arial, sans-serif";
    const words = text.split(' '), lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (ctx.measureText(next).width > 1500 && cur) { lines.push(cur); cur = w; } else cur = next;
    }
    lines.push(cur);
    lines.forEach((ln, i) => ST.label(ctx, ln, 960, 1010 - (lines.length - 1 - i) * 58, { font: ctx.font, fill: '#e2d8b8', stroke: '#16120e', lw: 11 }));
  }

  ST.renderFrame = (ctx, t) => {
    t = Math.max(0, Math.min(ST.DURATION - 1e-6, t));
    const s = ST.SHOTS[ST.shotAt(t)];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#16120e';
    ctx.fillRect(0, 0, ST.W, ST.H);
    ctx.save();
    s.render(ctx, localT(s, t));
    ctx.restore();
    ST.camZ = 1;
    ST.LW = 1;
    const text = ST.showCaptions ? ST.captionAt(t) : '';
    if (text) caption(ctx, text);
  };
})();
