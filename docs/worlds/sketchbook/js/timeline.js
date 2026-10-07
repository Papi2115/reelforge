/* sketchbook - the film: shots laid end to end on one global clock; page transitions live in the tail of the
   outgoing shot (so "play shot" starts on a clean page and "play all" never resets). frame = f(t). */
'use strict';
(function () {
  const SB = window.SB;
  const FPS = 30;
  SB.FPS = FPS;
  let acc = 0;
  SB.SHOTS = SB.SHOT_DEFS.map((d, i) => {
    const s = Object.assign({ index: i }, d, { t0: acc, t1: acc + d.dur });
    acc += d.dur;
    return s;
  });
  SB.DURATION = Math.round(acc * 1000) / 1000;
  SB.shotAt = (t) => {
    for (let i = SB.SHOTS.length - 1; i >= 0; i--) if (t >= SB.SHOTS[i].t0) return i;
    return 0;
  };
  SB.captionAt = (t) => {
    const s = SB.SHOTS[SB.shotAt(t)], lt = t - s.t0;
    const ct = lt * (s.pace || 1);
    for (const [a, b, text] of s.lines) if (ct >= a && ct < b) return text;
    return '';
  };
  const bufs = [SB.newBuf(), SB.newBuf(), SB.newBuf()];
  SB.renderFrame = (t) => {
    t = Math.max(0, Math.min(SB.DURATION - 1e-6, t));
    const i = SB.shotAt(t), s = SB.SHOTS[i], lt = t - s.t0;
    const tr = s.trans, next = SB.SHOTS[i + 1];
    if (tr && next && lt >= s.dur - tr.d && SB.TRANS[tr.type]) {
      const k = (lt - (s.dur - tr.d)) / tr.d;
      s.render(bufs[0], lt * (s.pace || 1));
      SB.noPen = true;
      next.render(bufs[1], 0);
      SB.noPen = false;
      SB.TRANS[tr.type](bufs[2], bufs[0], bufs[1], k, tr, { out: s, in: next, lt: lt });
      return bufs[2];
    }
    s.render(bufs[2], lt * (s.pace || 1));
    return bufs[2];
  };
})();
