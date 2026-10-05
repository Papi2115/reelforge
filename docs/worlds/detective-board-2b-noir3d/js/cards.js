/* Card renderer: card-local mm -> world (with lean off the board), lamp-projected cast shadow, lit paper, art ops with
 * draw-on times, curled corner, thick screen-space outline, tape. Also used by the magnifier (re-draw at 1.8x). */
'use strict';
(function () {
  const NB = window.NB;
  const W = NB.world;
  const C = NB.C;
  const { ART } = NB.art;

  // ---------- card renderer ----------
  const cache = {};
  function artFor(card, t) {
    if (card.dynamic) return ART[card.art](t, card.tl, card);
    if (!cache[card.id]) cache[card.id] = ART[card.art](0, card.tl, card);
    return cache[card.id];
  }
  /** fr: {o, ax, ay, n, lean0, lean1, plane, support:'board'|'desk'} */
  function makeXf(card, fr) {
    const w = card.w;
    const h = card.h;
    const k = card.k || 1;
    return function (p) {
      const out = new Array((p.length / 2) * 3);
      for (let i = 0, j = 0; i < p.length; i += 2, j += 3) {
        const X = ((p[i] - w / 2) * k) / 1000;
        const Y = ((h / 2 - p[i + 1]) * k) / 1000;
        const ln = fr.lean0 + (fr.lean1 - fr.lean0) * NB.clamp(p[i + 1] / h, 0, 1);
        out[j] = fr.o[0] + fr.ax[0] * X + fr.ay[0] * Y + fr.n[0] * ln;
        out[j + 1] = fr.o[1] + fr.ax[1] * X + fr.ay[1] * Y + fr.n[1] * ln;
        out[j + 2] = fr.o[2] + fr.ax[2] * X + fr.ay[2] * Y + fr.n[2] * ln;
      }
      return out;
    };
  }
  /** Project world points from the lamp onto the support plane (board z=0 or desk y=deskY). */
  function castShadow(pts, support) {
    const L = NB.light.lamps[support === 'desk' ? 1 : 0];
    const out = pts.slice();
    for (let i = 0; i < pts.length; i += 3) {
      const dx = pts[i] - L.x;
      const dy = pts[i + 1] - L.y;
      const dz = pts[i + 2] - L.z;
      const s = support === 'desk' ? (W.G.desk.y + 0.0005 - L.y) / dy : (-0.0005 - L.z) / dz;
      out[i] = L.x + dx * s;
      out[i + 1] = L.y + dy * s;
      out[i + 2] = L.z + dz * s;
    }
    return out;
  }
  function partial(p, k) {
    if (k >= 1) return p;
    let total = 0;
    for (let i = 2; i < p.length; i += 2) total += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
    let left = total * k;
    const out = [p[0], p[1]];
    for (let i = 2; i < p.length; i += 2) {
      const l = Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
      if (left >= l) {
        out.push(p[i], p[i + 1]);
        left -= l;
      } else {
        const f = l > 0 ? left / l : 0;
        out.push(p[i - 2] + (p[i] - p[i - 2]) * f, p[i - 1] + (p[i + 1] - p[i - 1]) * f);
        break;
      }
    }
    return out;
  }
  function shaderFor(c, plane) {
    if (typeof c === 'number') return c;
    return { mat: W.M[c], plane };
  }
  function shapeOf(card) {
    const w = card.w;
    const h = card.h;
    if (card.shape === 'tornR') {
      const p = [0, 0, w - 12, 0];
      for (let y = 0, i = 0; y < h; y += 9, i++) p.push(w - 12 + (i % 2 ? 0 : 7), Math.min(h, y + 9));
      p.push(0, h);
      return p;
    }
    if (card.shape === 'tornL') {
      const p = [12, 0, w, 0, w, h, 12, h];
      for (let y = h, i = 0; y > 0; y -= 9, i++) p.push(12 - (i % 2 ? 0 : 7), Math.max(0, y - 9));
      return p;
    }
    if (card.curl) {
      const c = card.curl;
      return [0, 0, w, 0, w, h - c, w - c, h, 0, h];
    }
    return [0, 0, w, 0, w, h, 0, h];
  }
  function drawCard(card, fr, t, opts) {
    const base = makeXf(card, fr);
    const mag = opts && opts.mag;
    const xf = mag
      ? (p) => base(p.map((v, i) => mag.c[i % 2] + (v - mag.c[i % 2]) * mag.k))
      : base;
    const plane = fr.plane;
    const shape = shapeOf(card);
    const world = xf(shape);
    if (!mag && offscreen(world)) return;
    if (!mag) NB.poly3(castShadow(world, fr.support), { dark: 1 });
    NB.poly3(world, { mat: W.M[card.paper || 'paper'], plane });
    const art = artFor(card, t);
    for (const op of art.ops) {
      if (op.t0 !== undefined && t < op.t0) continue;
      if (op.k === 'p') NB.poly3(xf(op.p), shaderFor(op.m, plane));
      else if (op.k === 'd') NB.poly3(xf(op.p), { dark: 1 });
      else if (op.k === 'l') {
        const k = op.t1 !== undefined ? NB.seg(t, op.t0, op.t1) : 1;
        if (k <= 0) continue;
        NB.polyline3(xf(partial(op.p, k)), op.w / 1000, 1, 6, shaderFor(op.c, plane), op.closed && k >= 1);
      } else if (op.k === 't') {
        if (op.t1 !== undefined && t >= op.t1) continue;
        const mode = shaderFor(op.c, plane);
        for (const s of op.s) {
          if (s.ts >= 0 && t < s.ts) continue;
          const k = s.ts >= 0 ? NB.seg(t, s.ts, s.te) : 1;
          NB.polyline3(xf(partial(s.p, k)), op.w / 1000, 1, 5, mode);
        }
      }
    }
    if (card.curl) {
      const c = card.curl;
      const fold = xf([card.w, card.h - c, card.w - c, card.h, card.w - c * 0.86, card.h - c * 0.86]);
      NB.poly3(fold, { mat: W.M.paperB, plane });
      NB.polyline3(fold, 0.0012, 1, 2, C.INK, true);
    }
    if (mag) return;
    const ow = NB.clamp(Math.round((0.0016 * NB.cam.f) / Math.max(0.2, distTo(fr.o))), 1, 3);
    NB.polyline3(world, 0, ow, ow, C.INK, true);
    if (card.tape) card.tape.forEach((tp) => drawTape(xf, tp, plane));
  }
  function offscreen(world) {
    let l = 0;
    let r = 0;
    let u = 0;
    let d = 0;
    const n = world.length / 3;
    for (let i = 0; i < world.length; i += 3) {
      const p = NB.proj(world[i], world[i + 1], world[i + 2]);
      if (!p) return false;
      if (p[0] < -20) l++;
      if (p[0] > NB.W + 20) r++;
      if (p[1] < -20) u++;
      if (p[1] > NB.H + 20) d++;
    }
    return l === n || r === n || u === n || d === n;
  }
  function drawTape(xf, tp, plane) {
    const [x, y, len, ang] = tp;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const hw = 9;
    const p = [x - c * len + s * hw, y - s * len - c * hw, x + c * len + s * hw, y + s * len - c * hw, x + c * len - s * hw, y + s * len + c * hw, x - c * len - s * hw, y - s * len + c * hw];
    NB.poly3(xf(p), { mat: W.M.paperB, plane });
    NB.polyline3(xf(p), 0, 1, 1, C.SLATE, true);
  }
  function distTo(o) {
    return Math.hypot(o[0] - NB.cam.px, o[1] - NB.cam.py, o[2] - NB.cam.pz);
  }

  NB.props = { drawCard, castShadow };
})();
