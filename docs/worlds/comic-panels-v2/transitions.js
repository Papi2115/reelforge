/* comic-panels v2 showcase - panel-native transitions between shots.
 * Each one composites two finished index frames A (outgoing, held: a printed page does not move while
 * it turns) and B (incoming, running) into CP.fb. p runs 0..1 over the transition; all pure.
 */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { W, H, C, E, BAYER4, lerp, clamp01, track, noise2 } = CP;
  const fb = CP.fb;
  const bayer = (x, y) => BAYER4[(y & 3) * 4 + (x & 3)] / 16;

  /** Page slide: A leaves, B arrives, with a strip of the table between the two pages. dir 'x' or 'y'. */
  function slide(A, B, p, o) {
    const vertical = o.dir === 'y';
    const len = vertical ? H : W;
    const G = o.gutter || 16;
    const e = (o.ease || E.inOutCubic)(p);
    const off = Math.round(e * (len + G));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const s = (vertical ? y : x) + off;
        const i = y * W + x;
        if (s < len) fb[i] = vertical ? A[s * W + x] : A[y * W + s];
        else if (s < len + G) {
          // The gap between pages: a fold shadow, darker toward the incoming page.
          const k = (s - len) / G;
          fb[i] = bayer(x, y) < 0.25 + k * 0.6 ? C.AGED : C.SHADE;
          if (s === len) fb[i] = C.INK;
        } else {
          const b = s - len - G;
          fb[i] = vertical ? B[b * W + x] : B[y * W + b];
        }
      }
    }
  }

  /**
   * Page turn. Forward: the fold sweeps right -> left, B is revealed to the right of it, the lifted
   * flap (back of the page, A's lines showing through) lies just left of the fold. back = mirror.
   */
  function turn(A, B, p, o) {
    const back = !!o.back;
    const e = (o.ease || E.inOutSine)(p);
    const slope = o.slope === undefined ? 0.2 : o.slope;
    const f0 = lerp(W + 70, -90, e);
    for (let y = 0; y < H; y++) {
      const fold = f0 + (H - y) * slope - 36 * Math.sin(p * Math.PI) * (y / H);
      const lifted = W - fold;
      const flapW = Math.max(0, Math.min(84, lifted * 0.42)) * Math.sin(Math.min(1, p * 1.2) * Math.PI * 0.5 + 0.0001);
      for (let x = 0; x < W; x++) {
        const xx = back ? W - 1 - x : x;
        const i = y * W + xx;
        const d = x - fold;
        const under = B;
        const over = A;
        if (d >= 0) {
          const shadow = Math.max(0, 1 - d / 16) * 0.75;
          fb[i] = shadow > 0 && bayer(xx, y) < shadow ? C.INK : under[i];
        } else if (-d <= flapW) {
          const u = -d / Math.max(1, flapW);
          if (-d > flapW - 1.5) fb[i] = C.INK;
          else {
            const mx = Math.round(fold + (fold - x) * 1.6);
            const src = mx >= 0 && mx < W ? over[y * W + (back ? W - 1 - mx : mx)] : C.PAPER;
            const through = src === C.INK || src === C.NIGHT || src === C.SEP_INK;
            const curl = u < 0.25 ? 0.55 - u * 2 : (u - 0.25) * 0.5;
            fb[i] = through ? C.SHADE : bayer(xx, y) < curl ? C.AGED : C.PAPER;
          }
        } else fb[i] = over[i];
      }
    }
  }

  /** Distance of every pixel from the bleed origin, roughened by paper fibres. Pure, so cached. */
  const fields = {};
  function bleedField(ox, oy) {
    const k = ox + ',' + oy;
    if (fields[k]) return fields[k];
    const maxD = Math.max(Math.hypot(ox, oy), Math.hypot(W - ox, oy), Math.hypot(ox, H - oy), Math.hypot(W - ox, H - oy));
    const f = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        f[y * W + x] = Math.hypot(x - ox, (y - oy) * 1.25) / maxD + (noise2('bleed', x, y, 18) - 0.5) * 0.26 + (noise2('bleedf', x, y, 4) - 0.5) * 0.07;
      }
    }
    fields[k] = f;
    return f;
  }
  /** Ink-bleed: wet ink creeps out of one point along the paper fibres, the new page under it. */
  function bleed(A, B, p, o) {
    const field = bleedField(o.x, o.y);
    const r = (o.ease || E.inQuad)(p) * 1.3;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const d = field[i];
        if (d < r - 0.045) fb[i] = B[i];
        else if (d < r - 0.03) fb[i] = bayer(x, y) < (r - 0.03 - d) / 0.015 ? B[i] : C.INK;
        else if (d < r) fb[i] = C.INK;
        else if (d < r + 0.03 && bayer(x, y) < 0.3) fb[i] = C.SEP_MID;
        else fb[i] = A[i];
      }
    }
  }

  /** Gutter split: the old page is cut along a leaning gutter and the halves are pulled apart. */
  function split(A, B, p, o) {
    const x0 = o.x0;
    const x1 = o.x1;
    const e = track([[0, 0], [0.18, -0.012, E.outQuad], [1, 1, E.inOutCubic]], p);
    const dxL = -e * W * 0.72;
    const dyL = -e * 46;
    const dxR = e * W * 0.72;
    const dyR = e * 38;
    // Signed distance to the cut line (normalised normal).
    const nx = H;
    const ny = -(x1 - x0);
    const nl = Math.hypot(nx, ny);
    const side = (x, y) => ((x - x0) * nx + y * ny) / nl;
    const piece = (x, y, dx, dy, left) => {
      const sx = Math.round(x - dx);
      const sy = Math.round(y - dy);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) return -1;
      const d = side(sx, sy);
      if (left ? d > 0 : d < 0) return -1;
      return Math.abs(d) < 2 ? C.INK : A[sy * W + sx];
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let c = piece(x, y, dxL, dyL, true);
        if (c < 0) c = piece(x, y, dxR, dyR, false);
        if (c < 0) {
          const shadow = piece(x - 3, y - 3, dxL, dyL, true) >= 0 || piece(x - 3, y - 3, dxR, dyR, false) >= 0;
          c = shadow && bayer(x, y) < 0.6 ? C.INK : B[y * W + x];
        }
        fb[y * W + x] = c;
      }
    }
  }

  /** Panel push: B shoves in from the right as a new panel and squeezes A into a narrowing strip. */
  function push(A, B, p, o) {
    const e = (o.ease || E.outCubic)(p);
    const g = 10;
    const a = Math.round((1 - e) * W);
    const aw = a - g / 2;
    const bx = a + g / 2;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (x < aw) fb[i] = x >= aw - 2 ? C.INK : A[y * W + Math.min(W - 1, Math.floor((x * W) / aw))];
        else if (x < bx) fb[i] = C.PAPER;
        else fb[i] = x < bx + 2 ? C.INK : B[y * W + Math.min(W - 1, Math.floor(((x - bx) * W) / (W - bx)))];
      }
    }
  }

  /** Gutter collapse: the gutters above and below slam shut, crushing A into a slit; B lies outside. */
  function collapse(A, B, p, o) {
    const e = (o.ease || E.inCubic)(p);
    const mid = o.y || H / 2;
    const top = lerp(0, mid, e);
    const bot = lerp(H, mid, e);
    for (let y = 0; y < H; y++) {
      const inside = y >= top && y < bot && bot - top >= 2;
      const sy = inside ? Math.min(H - 1, Math.floor(((y - top) / (bot - top)) * H)) : 0;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!inside) fb[i] = B[i];
        else if (y < top + 2 || y >= bot - 2) fb[i] = C.INK;
        else fb[i] = A[sy * W + x];
      }
    }
  }

  /** Inset: B arrives as a small panel over A (pop, hold), then grows to become the whole page. */
  function inset(A, B, p, o) {
    const pop = track([[0, 0], [0.16, 1.12, E.outQuad], [0.24, 1, E.inOutSine]], p);
    const grow = (o.ease || E.inOutCubic)(clamp01((p - 0.4) / 0.6));
    const s0 = o.size || 0.2;
    const hw = (W * s0 * pop) / 2;
    const hh = (H * s0 * pop) / 2;
    const x0 = lerp(o.x - hw, -2, grow);
    const x1 = lerp(o.x + hw, W + 2, grow);
    const y0 = lerp(o.y - hh, -2, grow);
    const y1 = lerp(o.y + hh, H + 2, grow);
    const rim = 4;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (x >= x0 && x < x1 && y >= y0 && y < y1 && x1 - x0 > 1) {
          const sx = Math.min(W - 1, Math.floor(((x - x0) / (x1 - x0)) * W));
          const sy = Math.min(H - 1, Math.floor(((y - y0) / (y1 - y0)) * H));
          fb[i] = B[sy * W + sx];
        } else if (x >= x0 - rim && x < x1 + rim && y >= y0 - rim && y < y1 + rim && pop > 0.05) {
          const edge = x < x0 - rim + 2 || x >= x1 + rim - 2 || y < y0 - rim + 2 || y >= y1 + rim - 2;
          fb[i] = edge ? C.INK : C.PAPER;
        } else if (x >= x0 - rim + 3 && x < x1 + rim + 3 && y >= y0 - rim + 3 && y < y1 + rim + 3 && pop > 0.05) {
          fb[i] = C.INK;
        } else fb[i] = A[i];
      }
    }
  }

  CP.transitions = { slide, turn, bleed, split, push, collapse, inset };
})();
