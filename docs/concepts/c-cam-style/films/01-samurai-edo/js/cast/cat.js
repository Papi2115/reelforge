/* The stray cat that steals your dignity. Hand-built, not on the human rig: a scruffy grey-brown tabby with a torn
   left ear, a kinked tail, a bald patch on the flank and half-shut, unimpressed eyes. Drawn facing screen-right in
   figure space (origin = between the feet; flip mirrors). modes: 'walk' (ph 0..1), 'sit', 'jump' (curled in the air). */
'use strict';
(function () {
  const ST = window.ST;
  const FUR = '#6f6656', FUR_D = '#4d463b', SEED = 810;
  const furOpts = (seed) => ({ lw: 6, seed, shade: [FUR_D, -10, 6], hatch: { c: 'rgba(30,24,16,0.55)', n: 5, len: 16, gap: 5, k: 3, ang: 70 } });

  function head(ctx, x, y, t, k) {
    ST.blob(ctx, [x - 24, y - 30, x - 18, y - 62, x - 4, y - 36, x + 4, y - 38], FUR, { lw: 5, seed: SEED + 1, shade: [FUR_D, -4, 2] }); // torn ear
    ST.blob(ctx, [x + 8, y - 40, x + 22, y - 68, x + 30, y - 34], FUR, { lw: 5, seed: SEED + 2, shade: [FUR_D, -4, 2] });
    ST.blob(ctx, [x - 34, y, x - 30, y - 30, x - 4, y - 44, x + 26, y - 38, x + 44, y - 12, x + 40, y + 12, x + 10, y + 24, x - 22, y + 18], FUR, furOpts(SEED + 3));
    const f = { eye: 1, pup: 1.2, look: k.look || [0.4, 0], lid: Math.max(k.lid === undefined ? 0.55 : k.lid, ST.blink(t, SEED)), sq: [0, 0] };
    ST.eye(ctx, x + 6, y - 12, 8, 8, f, { skin: FUR, white: '#b6a85e', seed: SEED + 4, lw: 4, bag: false });
    ST.eye(ctx, x + 28, y - 10, 6, 8, f, { skin: FUR, white: '#b6a85e', seed: SEED + 5, lw: 4, bag: false });
    ST.blob(ctx, ST.ellipseRing(x + 40, y + 2, 6, 4, 6), '#5a3a34', { lw: 3, seed: SEED + 6 });
    ST.stroke(ctx, [x + 40, y + 6, x + 34, y + 14, x + 26, y + 12], { w: 3, seed: SEED + 7, taper: false });
    [[48, -2, 74, -10], [48, 4, 76, 6], [20, 4, -6, 0]].forEach((w, i) => ST.stroke(ctx, [x + w[0], y + w[1], x + w[2], y + w[3]], { w: 2, color: '#c9bea0', seed: SEED + 8 + i, taper: false }));
  }
  function tail(ctx, pts) {
    ST.tube(ctx, pts, [16, 13, 12, 10], FUR, { lw: 5, seed: SEED + 12, shade: [FUR_D, -4, 2] });
  }
  // m: { x, y, s, flip, t, mode, ph, look, lid }
  ST.cat = (ctx, m) => {
    const t = m.t || 0;
    ST.figure(ctx, { x: m.x, y: m.y, s: m.s }, m.flip, () => {
      if (m.mode === 'sit') {
        tail(ctx, [-50, -10, -70, 2, -40, 14, 30, 10]);
        ST.blob(ctx, [-60, 0, -66, -50, -40, -96, 0, -120, 30, -100, 40, -50, 36, 0], FUR, furOpts(SEED + 14));
        ST.blob(ctx, ST.ellipseRing(-30, -40, 14, 10, 7), '#8a7c64', { lw: 0, seed: SEED + 15 }); // bald patch
        [12, 30].forEach((x, i) => ST.tube(ctx, [x, -60, x + 2, -4], [16, 14], FUR, { lw: 5, seed: SEED + 16 + i }));
        head(ctx, 14, -122, t, m);
        return;
      }
      const air = m.mode === 'jump', s = air ? 0 : Math.sin((m.ph || 0) * Math.PI * 2), lift = air ? -60 : 0;
      tail(ctx, [-70, -66 + lift, -96, -110 + lift, -86, -136 + lift, -70, -132 + lift]);
      [[-50, -1], [40, 1]].forEach(([x, k], i) => {
        const sw = air ? (k > 0 ? 34 : -34) : s * 18 * k;
        ST.tube(ctx, [x, -50 + lift, x + sw * 0.5, -24 + lift * 0.6, x + sw, lift * 0.3], [16, 13, 12], FUR_D, { lw: 5, seed: SEED + 18 + i });
      });
      ST.blob(ctx, [-76, -50 + lift, -70, -84 + lift, -20, -96 + lift, 40, -90 + lift, 64, -66 + lift, 50, -40 + lift, -10, -34 + lift, -60, -36 + lift], FUR, furOpts(SEED + 20));
      ST.blob(ctx, ST.ellipseRing(-30, -64 + lift, 14, 9, 7), '#8a7c64', { lw: 0, seed: SEED + 21 });
      [[-34, 1], [52, -1]].forEach(([x, k], i) => {
        const sw = air ? (k > 0 ? -30 : 30) : s * 18 * k;
        ST.tube(ctx, [x, -50 + lift, x + sw * 0.5, -24 + lift * 0.6, x + sw, lift * 0.3], [17, 14, 13], FUR, { lw: 5, seed: SEED + 22 + i });
      });
      head(ctx, 70, -96 + lift, t, m);
    });
  };
})();
