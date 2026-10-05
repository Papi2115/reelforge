/* detective-board 2a - frame = render(t). Wall (texture + items) in world pixels -> resampled to the
 * 640x360 screen -> lamp/bulb lighting quantised in bands (checker dither only at the band edges) ->
 * desk top projected in front -> strings, pins, glints -> desk billboards -> the hanging bulb. */
(function () {
  'use strict';
  const D2 = window.D2;
  const { C, T, W, H, E, RGB, ramp, seg, clamp, hash, surf, px, shade, blitRot, spritePoint } = D2;
  const { quant, poolF, bulbF, deskN, lightWall } = D2.light;
  const room = D2.room;
  const scene = D2.scene;
  const CAM = D2.cam;

  // ---------- view: world/desk -> screen ----------
  function makeView(cam) {
    const z = cam.z;
    const vx0 = cam.x - W / 2 / z;
    const vy0 = cam.y - H / 2 / z;
    const Yb = (room.WALL_H - cam.y) * z + H / 2;
    const kx = (v) => 1 + (cam.persp * Math.min(v, CAM.DESK_D)) / CAM.DESK_D;
    const deskY = (v) => {
      const vv = Math.min(v, CAM.DESK_D);
      let y = Yb + z * cam.tilt * CAM.deskDepthY(vv, z);
      if (v > CAM.DESK_D) y += (v - CAM.DESK_D) * z * kx(CAM.DESK_D) * (1 - 0.6 * cam.tilt);
      return y;
    };
    return {
      z, vx0, vy0, Yb, kx, deskY, cam,
      wall: (wx, wy) => [(wx - vx0) * z, (wy - vy0) * z],
      desk: (u, v) => [W / 2 + (u - cam.x) * z * kx(v), deskY(v)],
    };
  }

  // ---------- wall layer in world pixels ----------
  function wallBuffer(view, t, L) {
    const tex = room.wallTexture();
    const bx0 = Math.floor(view.vx0) - 2;
    const by0 = Math.floor(view.vy0) - 2;
    const bw = Math.ceil(W / view.z) + 6;
    const bh = Math.ceil(H / view.z) + 6;
    const b = surf(bw, bh, C.NIGHT);
    for (let y = 0; y < bh; y += 1) {
      const ty = by0 + y + tex.OY;
      if (ty < 0 || ty >= room.TEX_H) continue;
      const sx0 = Math.max(0, bx0 + tex.OX);
      const sx1 = Math.min(room.TEX_W, bx0 + tex.OX + bw);
      if (sx1 <= sx0) continue;
      b.d.set(tex.s.d.subarray(ty * room.TEX_W + sx0, ty * room.TEX_W + sx1), y * bw + (sx0 - bx0 - tex.OX));
    }
    b.ox = bx0;
    b.oy = by0;
    wallMarks(b, t);
    for (const it of D2.world.ITEMS) drawItem(b, it, t, L);
    return b;
  }
  /** Pencil on the cork: the jump zone circled in dashes, a "?" scribbled twice. */
  function wallMarks(b, t) {
    const zone = scene.byId.get('zone');
    const zx = zone.x - b.ox;
    const zy = zone.y - b.oy;
    const k = E.inOutSine(seg(t, 32.35, 33.25));
    if (k > 0) {
      D2.dashedOval(b, zx, zy, 84, 54, k, C.INK, 501);
      D2.dashedOval(b, zx + 1, zy, 84, 54, k, C.INK, 501);
    }
    // the question mark, scribbled twice with a fat pen (second pass a little off the first)
    bigQuestion(b, zx - 44, zy + 4, E.outQuad(seg(t, 33.4, 33.7)), 502, 1.35);
    bigQuestion(b, zx - 41, zy + 2, E.outQuad(seg(t, 33.86, 34.1)), 503, 1.28);
  }
  const QMARK = [-15, -16, -12, -25, -4, -31, 6, -30, 13, -23, 13, -13, 6, -5, 1, 2, 0, 11];
  function bigQuestion(b, x, y, k, seed, sc) {
    if (k <= 0) return;
    const pts = QMARK.map((v, i) => (i % 2 ? y : x) + v * sc);
    const hook = Math.min(1, k / 0.85);
    for (let o = 0; o < 3; o += 1) D2.stroke(b, pts.map((v, i) => v + (i % 2 ? (o === 2 ? 1 : 0) : o === 1 ? 1 : 0)), hook, C.INK, seed, 1);
    if (k >= 0.95) D2.disc(b, x + 1 * sc, y + 21 * sc, 2.5, 2.5, C.INK);
  }
  function shadowOffset(L, x, y, lift, hover) {
    const fp = poolF(L, x, y);
    const fb = bulbF(L, x, y);
    const src = fb > fp ? [L.bulb.x, L.bulb.y, L.bulb.r] : [L.pool.x, L.pool.y, L.pool.r];
    const dx = x - src[0];
    const dy = y - src[1];
    const d = Math.hypot(dx, dy) || 1;
    const m = (1.5 + 3.5 * Math.min(1, d / src[2])) * lift * (1 + 4 * hover);
    return [(dx / d) * m, (dy / d) * m + 1.2 * lift];
  }
  function drawItem(b, it, t, L) {
    const p = scene.pose(it, t);
    const spr = scene.sprite(it, t);
    // the D. B. Cooper tape stays on the wall after the card is gone, with a scrap of the card under it
    if (it.id === 'dbc' && t >= scene.DBC_DROP) {
      const base = scene.sprite(it, scene.DBC_DROP - 0.01);
      const c = spritePoint(base, it.x, it.y, it.a, 76, 4);
      D2.poly(b, [c[0] - b.ox - 4, c[1] - b.oy - 2, c[0] - b.ox + 3, c[1] - b.oy - 3, c[0] - b.ox - 1, c[1] - b.oy + 4], C.PAPER);
      it.tapes.forEach((tp) => tape(b, base, it.x, it.y, it.a, tp));
    }
    if (!p || !spr) return;
    const off = shadowOffset(L, p.x, p.y, it.lift || 1, p.hover);
    blitRot(b, spr, p.x - b.ox, p.y - b.oy, p.a, { shadow: { dx: off[0], dy: off[1], steps: p.hover > 0.3 ? 1 : 2 } });
    blitRot(b, spr, p.x - b.ox, p.y - b.oy, p.a);
    if (it.id === 'dbc' && t >= scene.DBC_DROP) return;
    (it.tapes || []).forEach((tp) => tape(b, spr, p.x, p.y, p.a, tp));
  }
  /** Translucent tape: lightens what is under it by one step; torn ends. */
  function tape(b, spr, x, y, a, tp) {
    const c = spritePoint(spr, x, y, a, tp[0], tp[1]);
    const ang = a + tp[3];
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const half = tp[2] / 2;
    const r = Math.ceil(half + 4);
    for (let yy = -r; yy <= r; yy += 1)
      for (let xx = -r; xx <= r; xx += 1) {
        const along = xx * ca + yy * sa;
        const across = -xx * sa + yy * ca;
        if (Math.abs(across) > 3.2 || Math.abs(along) > half) continue;
        if (Math.abs(along) > half - 2 && hash(Math.round(across), Math.round(along), 77) < 0.5) continue;
        shade(b, Math.round(c[0] - b.ox + xx), Math.round(c[1] - b.oy + yy), -1);
      }
  }

  // ---------- resample world buffer -> screen ----------
  function resample(b, view, out) {
    const z = view.z;
    if (z > 0.8) {
      for (let y = 0; y < H; y += 1) {
        const by = Math.floor(view.vy0 + (y + 0.5) / z) - b.oy;
        const row = clamp(by, 0, b.h - 1) * b.w;
        for (let x = 0; x < W; x += 1) {
          const bx = Math.floor(view.vx0 + (x + 0.5) / z) - b.ox;
          out.d[y * W + x] = b.d[row + clamp(bx, 0, b.w - 1)];
        }
      }
      return;
    }
    // zoomed out: area-average in RGB, back to the nearest palette colour
    for (let y = 0; y < H; y += 1) {
      const ya = Math.floor(view.vy0 + y / z) - b.oy;
      const yb = Math.max(ya + 1, Math.floor(view.vy0 + (y + 1) / z) - b.oy);
      for (let x = 0; x < W; x += 1) {
        const xa = Math.floor(view.vx0 + x / z) - b.ox;
        const xb = Math.max(xa + 1, Math.floor(view.vx0 + (x + 1) / z) - b.ox);
        let r = 0;
        let g = 0;
        let bl = 0;
        let n = 0;
        for (let yy = ya; yy < yb; yy += 1) {
          const row = clamp(yy, 0, b.h - 1) * b.w;
          for (let xx = xa; xx < xb; xx += 1) {
            const c = RGB[b.d[row + clamp(xx, 0, b.w - 1)]];
            r += c[0];
            g += c[1];
            bl += c[2];
            n += 1;
          }
        }
        out.d[y * W + x] = D2.nearest(r / n, g / n, bl / n);
      }
    }
  }

  // ---------- desk top ----------
  let deskBuf = null;
  function deskLayer(sb, view, t, L, nOut) {
    if (view.Yb >= H) return;
    const base = room.deskTexture();
    if (!deskBuf) deskBuf = surf(base.w, base.h);
    deskBuf.d.set(base.d);
    D2.desk.drawDesk(deskBuf, t, (buf, spr, u, v, a, lift) => blitRot(buf, spr, u, v, a, { shadow: { dx: -3 * lift, dy: 4 * lift, steps: 1 } }));
    const z = view.z;
    const tilt = view.cam.tilt;
    const A = (z * tilt * view.cam.persp) / (2 * CAM.DESK_D);
    const Bq = z * tilt;
    const yFront = view.deskY(CAM.DESK_D);
    const faceK = z * view.kx(CAM.DESK_D) * (1 - 0.6 * tilt);
    const y0 = Math.max(0, Math.ceil(view.Yb));
    for (let y = y0; y < H; y += 1) {
      let v;
      if (y < yFront) {
        const dy = y + 0.5 - view.Yb;
        v = (-Bq + Math.sqrt(Bq * Bq + 4 * A * dy)) / (2 * A);
      } else v = CAM.DESK_D + (y + 0.5 - yFront) / faceK;
      if (v >= base.h) break;
      const vi = Math.floor(v);
      const k = z * view.kx(v);
      for (let x = 0; x < W; x += 1) {
        const u = Math.floor(view.cam.x + (x + 0.5 - W / 2) / k);
        if (u < 0 || u >= base.w) continue;
        const c = deskBuf.d[vi * base.w + u];
        if (c === T) continue;
        const n = deskN(L, u, v) + (vi >= CAM.DESK_D ? 0.8 : 0);
        nOut[y * W + x] = n;
        sb.d[y * W + x] = ramp(c, clamp(quant(n, x, y), -1, 4));
      }
    }
  }

  // ---------- strings, pins, glints (screen space, lit by the light under them) ----------
  /** Pixel lit by the light already computed under it; maxK caps darkening (strings stay readable). */
  function litPx(sb, nArr, x, y, c, maxK) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const n = nArr[y * W + x];
    sb.d[y * W + x] = ramp(c, clamp(quant(n - 0.6, x, y), -1, maxK === undefined ? 3 : maxK));
  }
  function walk(pts, fn) {
    for (let i = 0; i + 3 < pts.length; i += 2) {
      let x0 = Math.round(pts[i]);
      let y0 = Math.round(pts[i + 1]);
      const x1 = Math.round(pts[i + 2]);
      const y1 = Math.round(pts[i + 3]);
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      let guard = 0;
      for (;;) {
        fn(x0, y0, dx >= -dy);
        if ((x0 === x1 && y0 === y1) || guard > 4000) break;
        guard += 1;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          x0 += sx;
        }
        if (e2 <= dx) {
          err += dx;
          y0 += sy;
        }
      }
    }
  }
  function drawStrings(sb, nArr, view, list) {
    const z = view.z;
    const sh = Math.max(1, Math.round(2.4 * z));
    // shadows on the wall first (strings stand off the wall on their pins)
    for (const s of list) {
      if (s.desk) continue;
      walk(s.pts, (x, y) => {
        shade(sb, x + sh, y + sh + 1, 1);
      });
    }
    const thick = z >= 0.3;
    for (const s of list) {
      walk(s.pts, (x, y, flat) => {
        litPx(sb, nArr, x, y, C.RED, 1);
        if (thick) {
          if (flat) litPx(sb, nArr, x, y + 1, C.RED_D, 1);
          else litPx(sb, nArr, x + 1, y, C.RED_D, 1);
        }
      });
      if (s.head) pin(sb, nArr, s.head[0], s.head[1], z, s.headLift);
    }
  }
  function pin(sb, nArr, x, y, z, lift) {
    const r = z >= 1.5 ? 2 : z >= 0.7 ? 1 : 0;
    const off = Math.round((2 + lift * 5) * Math.max(0.6, z));
    for (let yy = -r; yy <= r; yy += 1)
      for (let xx = -r; xx <= r; xx += 1) if (xx * xx + yy * yy <= r * r + 1) shade(sb, Math.round(x + xx + off), Math.round(y + yy + off), 1);
    for (let yy = -r; yy <= r; yy += 1)
      for (let xx = -r; xx <= r; xx += 1) {
        if (xx * xx + yy * yy > r * r + 1) continue;
        const c = xx + yy > 0 ? C.CORK_L : C.BRASS;
        litPx(sb, nArr, x + xx, y + yy, c);
      }
    if (r > 0) litPx(sb, nArr, x - r + 1, y - r + 1, C.WHITE);
  }
  function glints(sb, view, t, L) {
    const it = scene.byId.get('composite');
    const spr = scene.sprite(it, t);
    D2.art.compositeGlints.forEach((g, i) => {
      const w = spritePoint(spr, it.x, it.y, it.a, g[0], g[1]);
      const f = bulbF(L, w[0], w[1]);
      if (f < 0.55) return;
      const s = view.wall(w[0], w[1]);
      const sz = Math.max(1, Math.round(view.z));
      // the lenses flash when the swaying bulb passes straight in front of them
      const hot = f > 0.8 && Math.abs(L.bulb.angle - 0.004 * i) < 0.012;
      D2.rect(sb, Math.round(s[0]), Math.round(s[1]), sz * (hot ? 2 : 1), sz, hot ? C.WHITE : C.STEEL);
      if (hot) D2.rect(sb, Math.round(s[0]), Math.round(s[1]) + sz, sz, sz, C.STEEL);
    });
  }

  // ---------- billboards and the bulb ----------
  function billboard(sb, spr, view, u, v, L, selfLit) {
    const base = view.desk(u, v);
    if (base[1] - spr.h * view.z * view.kx(v) > H) return;
    const k = view.z * view.kx(v);
    const w = Math.round(spr.w * k);
    const h = Math.round(spr.h * k);
    const x0 = Math.round(base[0] - w / 2);
    const y0 = Math.round(base[1] - h);
    const steps = clamp(Math.round(deskN(L, u, v) - 0.4), -1, 3);
    for (let y = 0; y < h; y += 1)
      for (let x = 0; x < w; x += 1) {
        const c = spr.d[Math.floor(y / k) * spr.w + Math.floor(x / k)];
        if (c === T) continue;
        px(sb, x0 + x, y0 + y, selfLit && (c === C.WHITE || c === C.BRASS) ? c : ramp(c, steps));
      }
  }
  function bulb(sb, view, L) {
    const P = 1.25;
    const z = view.z * P;
    const toS = (wx, wy) => [W / 2 + (wx - view.cam.x) * z, H / 2 + (wy - view.cam.y) * z];
    const b = toS(L.bulb.x, L.bulb.y);
    const top = toS(CAM.BULB.px, CAM.BULB.py);
    if (b[1] < -20 || b[0] < -30 || b[0] > W + 30) return;
    const on = L.bulb.i > 0.5;
    const r = Math.max(2, 5.5 * z);
    D2.line(sb, top[0], top[1], b[0], b[1] - r * 1.9, C.BLACK);
    if (on) {
      const R = Math.ceil(r * 2.3);
      for (let yy = -R; yy <= R; yy += 1)
        for (let xx = -R; xx <= R; xx += 1) if (xx * xx + yy * yy <= R * R) shade(sb, Math.round(b[0] + xx), Math.round(b[1] + yy), -1);
    }
    // socket, neck, globe (pear shape); a filament core when lit
    D2.rect(sb, b[0] - r * 0.45, b[1] - r * 2, r * 0.9, r * 0.9, C.GRAPH);
    D2.rect(sb, b[0] - r * 0.45, b[1] - r * 2, r * 0.25, r * 0.9, C.STEEL);
    D2.disc(sb, b[0], b[1] - r * 0.85, r * 0.5, r * 0.45, on ? C.BRASS : C.GRAPH);
    D2.disc(sb, b[0], b[1], r, r * 0.95, on ? C.BRASS : C.GRAPH);
    if (on) D2.disc(sb, b[0] - r * 0.1, b[1] - r * 0.1, r * 0.45, r * 0.45, C.WHITE);
    else px(sb, b[0] - r * 0.4, b[1] - r * 0.4, C.STEEL);
  }

  // ---------- frame ----------
  const nArr = new Float32Array(W * H);
  function render(t) {
    const cam = D2.camera(t);
    const L = D2.lights(t);
    const view = makeView(cam);
    const sb = surf(W, H, C.NIGHT);
    const b = wallBuffer(view, t, L);
    resample(b, view, sb);
    lightWall(sb, view, L, nArr);
    deskLayer(sb, view, t, L, nArr);
    drawStrings(sb, nArr, view, scene.strings(t, view));
    for (const p of scene.pins(t, view)) pin(sb, nArr, p[0], p[1], view.z, p[2]);
    glints(sb, view, t, L);
    billboard(sb, D2.desk.mugSprite(), view, 432, 236, L, false);
    billboard(sb, D2.desk.lampSprite(), view, 1168, 262, L, true);
    bulb(sb, view, L);
    return sb;
  }

  Object.assign(D2, { render, makeView });
})();
