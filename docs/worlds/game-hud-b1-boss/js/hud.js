/* B1 HUD + boss grammar + glass layer.
   HUD (film overlay, never decorative): YEAR = the story's date (odometer roll, burn-in ghost of the old year);
   8 cartridge slots = film progress (one cartridge per shot).
   Boss card (in-game, gets scanlines): BOSS n, the name in Box Art, an HP bar in a real unit or unlabelled.
   Sticky note (on the TV glass, outside the CRT): the weak point, in Dad's hand. */
'use strict';
(function () {
  const K = B1.core;
  const F = B1.fonts;
  const { C } = K;
  const film = B1.film;

  // --- YEAR odometer ---
  const YX = 40; const YY = 22; const CW = 3; const CH = 2;
  function digitsOf(y) { return String(y).split(''); }
  function yearState(gt) {
    let cur = null; let prev = null; let since = 99;
    for (const k of film.years) {
      if (gt >= k[0]) { prev = cur; cur = k[1]; since = gt - k[0]; }
    }
    return { cur, prev, since };
  }
  function drawYear(gt, dim) {
    const ys = yearState(gt);
    if (ys.cur === null) return;
    const dc = digitsOf(ys.cur);
    const dp = ys.prev === null ? null : digitsOf(ys.prev);
    const step = 5 * CW;
    const flash = ys.since < 0.7 && dp !== null;
    const col = dim ? C.GREY_D : ink.dark ? C.WALNUT_D : flash ? C.GOLD : C.TAN;
    const h = 5 * CH;
    // burn-in ghost of the previous year, same place (shows where the digits differ)
    if (dp && !dim) dp.forEach((d, i) => { ghostRect(() => F.score(d, YX + i * step, YY, CW, CH, C.CREAM)); });
    const big = dp && Math.abs(ys.cur - ys.prev) > 5;
    dc.forEach((d, i) => {
      const x = YX + i * step;
      const changed = dp && dp[i] !== d;
      const lag = [0, 0.07, 0.12, 0.04][i];
      const dur = big ? 0.42 + i * 0.09 : 0.26;
      const k = changed ? K.clamp01((ys.since - lag) / dur) : 1;
      if (k >= 1) { F.score(d, x, YY, CW, CH, col); return; }
      const fwd = ys.cur > ys.prev;
      // spin through intermediate digits for big jumps; single step otherwise
      const from = big ? String((Number(d) + 7) % 10) : dp[i];
      const e = big ? K.ease.out(k) : K.ease.outBack(k);
      let showFrom = from; let showTo = d;
      if (big && k < 0.75) {
        const n = Math.floor(k * 14);
        showFrom = String((Number(d) + 10 - (n % 10)) % 10);
        showTo = String((Number(showFrom) + 1) % 10);
      }
      const off = Math.round((big && k < 0.75 ? (k * 14) % 1 : e) * (h + 2)) * (fwd ? 1 : -1);
      F.scoreGlyph(showFrom, x, YY - off, CW, CH, col, YY - 1, YY + h + 1);
      F.scoreGlyph(showTo, x, YY - off + (fwd ? h + 2 : -(h + 2)), CW, CH, col, YY - 1, YY + h + 1);
    });
  }
  // Draws fn into a scratch buffer and lifts dark pixels under it one step (burn-in ghost).
  const scratch = K.newBuffer();
  function ghostRect(fn) {
    const keep = K.fb;
    scratch.fill(255);
    K.target(scratch);
    fn();
    K.target(keep);
    const fb = K.fb;
    for (let i = 0; i < scratch.length; i++) if (scratch[i] !== 255 && !K.DARK[scratch[i]] && K.DARK[fb[i]]) fb[i] = K.GHOST[fb[i]];
  }

  // --- progress: 8 cartridges (film progress, one per shot) ---
  const GAPS = [4, 3, 4, 4, 3, 5, 3];
  function drawProgress(gt, dim) {
    let x = 640 - 40 - 8 * 8 - GAPS.reduce((a, b) => a + b, 0);
    const y = 23;
    for (let i = 0; i < 8; i++) {
      const s = film.shots[i];
      const k = K.clamp01((gt - s.start) / s.dur);
      const wear = i === 2 ? 1 : 0;
      const line = dim ? C.GREY_D : ink.dark ? (k > 0 ? C.WALNUT_D : C.TEAK) : k > 0 ? C.TAN : C.GREY_D;
      // outline: grip notch on top
      K.rect(x + 1, y, 6, 1, line); K.rect(x, y + 1, 1, 9, line); K.rect(x + 7, y + 1, 1, 9, line); K.rect(x, y + 10, 8, 1, line);
      if (k >= 1) {
        K.rect(x + 1, y + 1, 6, 9, dim ? C.GREY_D : ink.dark ? C.WALNUT : C.TAN);
        K.rect(x + 2 + wear, y + 4, 4, 3, dim ? C.TUBE : C.CREAM);
      } else if (k > 0) {
        const fh = Math.round(9 * k);
        K.rect(x + 1, y + 10 - fh, 6, fh, dim ? C.GREY_D : C.ORANGE);
      }
      x += 8 + (GAPS[i] || 0);
    }
  }

  const ink = { dark: false };
  function drawHUD(shotIndex, lt, out) {
    ink.dark = !!(out && out.hudDark);
    const gt = film.shots[shotIndex].start + lt;
    const dim = shotIndex === 7 && lt < 2.85;
    drawYear(gt, dim);
    if (gt > 0.35) drawProgress(gt, dim);
  }

  // --- boss card ---
  // o: { t, t0, num, name, from: 'left'|'right'|'top', x, y, hp: { n, value, label }, seed, gone: 0..1 }
  function bossCard(o) {
    const t = o.t - o.t0;
    if (t < 0) return;
    const s = 3;
    const nameW = F.boxMask(o.name, s).w + 2;
    const nameH = 6 * s;
    // "BOSS n" types first, irregular
    const tag = 'BOSS ' + o.num;
    const vis = K.typed(tag, o.t, o.t0, o.seed, 16);
    if (vis > 0) {
      K.rect(o.x - 3, o.y - 3, F.joyWidth(tag.slice(0, vis), 2) + 6, 18, C.VOID);
      F.joy(tag.slice(0, vis), o.x, o.y, 2, C.TAN);
    }
    // name slam: travel (ease in) -> overshoot -> settle; then a decaying shake
    const ts = t - 0.42;
    if (ts >= 0) {
      let dx = 0; let dy = 0;
      const dist = o.from === 'top' ? 90 : 300;
      const dir = o.from === 'right' ? 1 : -1;
      let p;
      if (ts < 0.13) p = 1 - K.ease.in(ts / 0.13);
      else if (ts < 0.2) p = -0.03 * Math.sin(((ts - 0.13) / 0.07) * Math.PI);
      else p = 0;
      if (o.from === 'top') dy = -p * dist; else dx = dir * p * dist;
      const sh = K.shake(o.t, o.t0 + 0.42 + 0.13, 4, 10, o.seed + 5);
      const nx = o.x + dx + sh.x; const ny = o.y + 17 + dy + sh.y;
      if (!o.gone || o.gone < 1) {
        // plate: a playfield band with a stepped right edge
        K.rect(nx - 6, ny - 4, nameW + 6, nameH + 9, C.VOID);
        K.rect(nx + nameW, ny - 4 + 4, 8, nameH + 5, C.VOID);
        K.rect(nx + nameW + 8, ny - 4 + 10, 8, nameH - 1, C.VOID);
        const flick = o.gone && Math.floor(K.frameOf(o.t)) % 2 === 0;
        if (!flick) F.boxArt(o.name, nx, ny, s, C.CREAM, C.RUST, C.VOID);
      }
    }
    if (o.hp) drawHP(o, t);
  }
  function drawHP(o, t) {
    const hp = o.hp;
    const y = o.y + 17 + 6 * 3 + 12;
    let x = o.x;
    if (hp.label) {
      K.rect(x - 3, y - 3, F.joyWidth(hp.label, 2) + 8, 18, C.VOID);
      x += F.joy(hp.label, x, y, 2, C.TAN) + 7;
    }
    const segW = hp.segW || 12;
    for (let i = 0; i < hp.n; i++) {
      // segments arrive with uneven delays, the last one overshoots
      const arrive = 0.62 + i * 0.07 + K.hash(o.seed, i, 21) * 0.06;
      if (t < arrive) break;
      const sx = x + i * (segW + 2);
      const pop = t - arrive < 0.06 ? -2 : 0;
      K.rect(sx - 1, y - 1 + pop, segW + 2, 14, C.VOID);
      const fillK = K.clamp01(hp.value - i);
      const broken = hp.broken && hp.broken[i] !== undefined ? o.t - hp.broken[i] : -1;
      if (broken >= 0 && broken < 0.07) K.rect(sx, y + pop, segW, 12, C.WHITE);
      else if (fillK > 0) {
        K.rect(sx, y + pop, Math.round(segW * fillK), 12, C.CRIMSON);
        K.rect(sx, y + pop, Math.round(segW * fillK), 2, C.ORANGE);
      } else {
        K.rect(sx, y + pop, segW, 12, C.WALNUT_D);
        K.px(sx + 3 + (i % 3), y + 4 + pop, C.TEAK);
        K.px(sx + 4 + (i % 3), y + 5 + pop, C.TEAK);
      }
    }
  }

  // --- sticky note on the glass ---
  // o: { cx, cy, w, h, ang, t0, t, lines: [str], seed, under: idx, strike: { line, t0 }, tick: t0, size }
  function note(o) {
    const t = o.t - o.t0;
    if (t < 0) return;
    let sc = 1;
    if (t < 0.05) sc = 1.16; else if (t < 0.1) sc = 0.97;
    const lift = t < 0.05 ? -5 : 0;
    const w = o.w * sc; const h = o.h * sc;
    const cx = o.cx; const cy = o.cy + lift;
    const sh = t < 0.05 ? 8 : 4;
    K.poly(K.quad(cx + sh, cy + sh + 1, w, h, o.ang), 0, K.SCAN);
    K.poly(K.quad(cx + sh, cy + sh + 1, w - 4, h - 4, o.ang), 0, K.SCAN);
    const q = K.quad(cx, cy, w, h, o.ang);
    K.poly(q, C.GOLD);
    // bottom-right corner curled up off the glass
    const co = Math.cos(o.ang); const si = Math.sin(o.ang);
    const P = (lx, ly) => [cx + lx * co - ly * si, cy + lx * si + ly * co];
    const c0 = P(w / 2 - 13, h / 2); const c1 = P(w / 2, h / 2 - 11); const c2 = P(w / 2, h / 2);
    K.poly([c0[0], c0[1], c1[0], c1[1], c2[0], c2[1]], C.VOID);
    const c3 = P(w / 2 - 13, h / 2); const c4 = P(w / 2, h / 2 - 11); const c5 = P(w / 2 - 9, h / 2 - 8);
    K.poly([c3[0], c3[1], c4[0], c4[1], c5[0], c5[1]], C.ORANGE);
    if (o.tape) {
      const tp = K.quad(P(-w / 2 + 16, -h / 2)[0], P(-w / 2 + 16, -h / 2)[1], 30, 9, o.ang - 0.5);
      K.poly(tp, 0, K.SCAN.map((v, i) => (i === C.GOLD ? C.CREAM : i === C.VOID || i === C.TUBE ? C.GREY_D : K.GHOST[i])));
    }
    const size = o.size || 2.1;
    const ink = C.WALNUT_D;
    o.lines.forEach((ln, i) => {
      const lx = -w / 2 + 9 + (i === 0 ? 0 : 2 + i);
      const ly = -h / 2 + 10 + i * (size * 7.6);
      const p = P(lx, ly);
      const width = F.hand(ln, { x: p[0], y: p[1], size, angle: o.ang, seed: o.seed + i * 17, c: ink, slant: 0.2 });
      if (o.under === i) {
        const k = K.clamp01((t - 0.35) / 0.25);
        if (k > 0) {
          const a = P(lx - 2, ly + size * 7.4); const b = P(lx + width + 3, ly + size * 7.0);
          F.handStroke(a[0], a[1], b[0], b[1], { c: ink, seed: o.seed + 3, reveal: k, bow: 2.5 });
          const k2 = K.clamp01((t - 0.62) / 0.2);
          if (k2 > 0) {
            const a2 = P(lx + 6, ly + size * 8.3); const b2 = P(lx + width - 4, ly + size * 8.1);
            F.handStroke(a2[0], a2[1], b2[0], b2[1], { c: ink, seed: o.seed + 4, reveal: k2, bow: 2, brush: 1 });
          }
        }
      }
      if (o.strike && o.strike.line === i) {
        const k = K.clamp01((o.t - o.strike.t0) / 0.22);
        if (k > 0) {
          const a = P(lx - 4, ly + size * 3.6); const b = P(lx + width + 4, ly + size * 2.6);
          F.handStroke(a[0], a[1], b[0], b[1], { c: C.CRIMSON, seed: o.seed + 9, reveal: k, bow: 4 });
        }
      }
      if (o.tick !== undefined && i === o.lines.length - 1) {
        const k = K.clamp01((o.t - o.tick) / 0.25);
        if (k > 0) {
          const a = P(lx + width + 8, ly + size * 3.5); const b = P(lx + width + 13, ly + size * 6.2); const c = P(lx + width + 26, ly - size * 1.5);
          F.handStroke(a[0], a[1], b[0], b[1], { c: ink, seed: 61, reveal: K.clamp01(k * 2.5), bow: 1 });
          if (k > 0.4) F.handStroke(b[0], b[1], c[0], c[1], { c: ink, seed: 62, reveal: (k - 0.4) / 0.6, bow: 3 });
        }
      }
    });
  }

  B1.hud = { drawHUD, bossCard, note, ghostRect, yearState };
})();
