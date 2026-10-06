/* sketchbook v2 - the film: ten shots laid end to end on one global clock. Page transitions live in the tail of the
   outgoing shot (so "play shot" starts on a clean page and "play all" never resets). frame = f(t).
   FILM is the single data table of the cut: order, duration, exit transition and the dev-caption narration.
   lines: [from, to, text] in shot time after the shot's pace (as in v1). trans.type is a key of SB.TRANS. */
'use strict';
(function () {
  const SB = window.SB;
  const FPS = 30;
  SB.FPS = FPS;
  const FILM = [
    { id: 'hook', dur: 7.0, trans: { type: 'flip', d: 0.62 },
      lines: [[0.2, 2.9, 'A year has 365 days.'], [2.9, 7.0, 'Except it doesn\'t. Not quite.']] },
    { id: 'quarter', dur: 8.8, trans: { type: 'riffle', d: 0.8 },
      lines: [[0, 4.6, 'Earth takes about 365 and a quarter days to go round the Sun.'], [4.6, 99, 'Count only 365, and the dates drift off the seasons.']] },
    { id: 'maths', dur: 9.0, trans: { type: 'eraser', d: 0.8 },
      lines: [[0, 5.2, 'A quarter day a year: in 4 years, that\'s almost one whole day.'], [5.2, 99, 'So: add one day every fourth year. The leap day.']] },
    { id: 'caesar', dur: 8.6, trans: { type: 'curl', d: 0.7 },
      lines: [[0, 5.9, 'In 45 BC, Julius Caesar made it law.'], [5.9, 99, 'Close. But a little too much.']] },
    { id: 'popup', dur: 8.0, trans: { type: 'flip', d: 0.62 },
      lines: [[0, 3.8, 'A calendar makes a promise: same date, same season.'], [3.8, 99, 'Caesar\'s calendar slowly drifted away from the seasons.']] },
    { id: 'flipbook', dur: 6.7, trans: { type: 'crumple', d: 0.95 },
      lines: [[0, 3.4, 'Year after year, the spring equinox crept earlier.'], [3.4, 6.7, 'Too slow for anyone to notice.']] },
    { id: 'overshoot', dur: 8.6, trans: { type: 'sticky', d: 1.05 },
      lines: [[0, 3.5, 'Caesar\'s year was too long by about 11 minutes.'], [3.5, 99, 'From 325 to 1582, that added up to ten whole days.']] },
    { id: 'accordion', dur: 8.5, trans: { type: 'riffle', d: 0.8 },
      lines: [[0, 4.5, '45 BC. Then more than sixteen centuries of drift.'], [4.5, 99, '1582: the fix. 1752: Britain finally follows.']] },
    { id: 'gregory', dur: 9.0, trans: { type: 'drop', d: 0.8 },
      lines: [[0, 4.9, 'In 1582, Pope Gregory XIII cut ten days: October 4th, then October 15th.'], [4.9, 99, 'Britain waited until 1752, and lost eleven days.']] },
    { id: 'rule', dur: 8.8,
      lines: [[0, 4.4, 'The fix: century years skip the leap day, unless they divide by 400.'], [4.4, 99, '1900, no. 2000, yes. That\'s why there is a February 29.']] },
  ];
  let acc = 0;
  SB.SHOTS = FILM.map((f, i) => {
    const def = SB.SHOT_DEFS[f.id];
    if (!def) throw new Error(`sketchbook: shot "${f.id}" is in the timeline but no script defined it`);
    if (f.trans && !SB.TRANS[f.trans.type]) throw new Error(`sketchbook: unknown transition "${f.trans.type}" after shot "${f.id}"`);
    const t0 = Math.round(acc * 1000) / 1000;
    acc += f.dur;
    return Object.assign({ index: i, id: f.id }, def, f, { t0: t0, t1: Math.round(acc * 1000) / 1000 });
  });
  SB.DURATION = Math.round(acc * 1000) / 1000;
  SB.shotAt = (t) => {
    for (let i = SB.SHOTS.length - 1; i >= 0; i--) if (t >= SB.SHOTS[i].t0) return i;
    return 0;
  };
  // shot-local time snapped to 1 us: a frame shows the same shot moment wherever the shot sits on the timeline
  const localT = (s, t) => Math.round((t - s.t0) * 1e6) / 1e6;
  SB.captionAt = (t) => {
    const s = SB.SHOTS[SB.shotAt(t)];
    const ct = localT(s, t) * (s.pace || 1);
    for (const [a, b, text] of s.lines) if (ct >= a && ct < b) return text;
    return '';
  };
  const bufs = [SB.newBuf(), SB.newBuf(), SB.newBuf()];
  SB.renderFrame = (t) => {
    t = Math.max(0, Math.min(SB.DURATION - 1e-6, t));
    const i = SB.shotAt(t), s = SB.SHOTS[i], lt = localT(s, t);
    const tr = s.trans, next = SB.SHOTS[i + 1];
    if (tr && next && lt >= s.dur - tr.d) {
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
