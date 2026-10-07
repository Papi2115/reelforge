/* Frame compositor: world (320x180, chunky) -> 2x -> HUD/overlays at 640x360. frame = f(t), nothing else. */
'use strict';
(function () {
  const RF = window.RF, C = RF.C, E = RF.ease, seg = RF.seg, HUD = RF.HUD, OV = RF.OV;
  const W = RF.WW, H = RF.WH, SW = RF.HUD_W, SH = RF.HUD_H;
  const screen = (RF.screen = new RF.Bmp(SW, SH, C.VOID));
  const DIM_MENU = RF.makeDimMap(0.32, [1, 0.95, 0.9]);
  const DIM_CLOSE = RF.makeDimMap(0.62, [1, 0.97, 0.92]);
  const NOISE = [C.GREY, C.PUTTY, C.CHAR, C.SAGE, C.TUBE];
  const nightFog = RF.nearest(26, 37, 70), dawnFog = RF.nearest(206, 178, 146);

  function cameraLight(cam, ws) {
    const M = RF.MAP;
    const r = M.region[Math.floor(cam.y) * M.W + Math.floor(cam.x)];
    let l = ws.amb[r];
    ws.lights.forEach((L) => {
      if (L.reg !== r) return;
      const dx = L.x - cam.x, dy = L.y - cam.y, dz = L.z - 0.3;
      const q = 1 + (dx * dx + dy * dy + dz * dz) * L.inv;
      l += L.I / (q * q);
    });
    return { l: Math.min(1.15, l + 0.12), cmap: ws.cmaps[r] };
  }
  /** Flat-shaded (no dither: the hand is the nearest, calmest thing) + the forearm down to the frame edge. */
  function drawHand(h, cam, ws) {
    const spr = RF.SPR[h.spr];
    const { l, cmap } = cameraLight(cam, ws);
    const buf = RF.wbuf;
    const sh = (c) => RF.shadeIdx(cmap, c, l, 0, 1, 0);
    const w = Math.round(spr.w * h.s), hh = Math.round(spr.h * h.s);
    const x0 = Math.round(h.x), y0 = Math.round(h.y);
    const yb = y0 + hh;
    if (spr.cuff && yb < H) {
      const xl = x0 + spr.cuff[0] * h.s, xr = x0 + spr.cuff[1] * h.s;
      for (let y = yb - 1; y < H; y++) {
        const u = (y - yb) / Math.max(1, H - yb);
        const a = xl + u * 16, b2 = xr + u * 30;
        for (let x = Math.max(0, Math.floor(a)); x < Math.min(W, Math.ceil(b2)); x++)
          buf[y * W + x] = sh(x - a < 2 ? C.HAZE : x > b2 - 4 ? C.NIGHT : C.DUSK);
      }
    }
    for (let dy = 0; dy < hh; dy++) {
      const y = y0 + dy;
      if (y < 0 || y >= H) continue;
      const sy = Math.min(spr.h - 1, Math.floor(dy / h.s));
      for (let dx = 0; dx < w; dx++) {
        const x = x0 + dx;
        if (x < 0 || x >= W) continue;
        const c = spr.d[sy * spr.w + Math.min(spr.w - 1, Math.floor(dx / h.s))];
        if (c !== 255) buf[y * W + x] = sh(c);
      }
    }
  }
  function storeNoise(t) {
    const p = RF.storeNoise(t);
    if (p <= 0) return;
    const f = Math.floor(t * 30), buf = RF.wbuf;
    for (let y = 0; y < H; y++) {
      const band = RF.hash3(y >> 2, f, 11) < p * 0.5;
      for (let x = 0; x < W; x++) {
        const h = RF.hash3(x, y, f);
        if (h < p || (band && h < p * 3)) buf[y * W + x] = NOISE[Math.floor(RF.hash3(x, y, f + 7) * NOISE.length)];
      }
    }
  }
  const hudAlpha = (t, boot, end) => {
    const menu = 1 - seg(t, 24.0, 24.2) * (1 - seg(t, 30.8, 31.05));
    return Math.min(E.out(seg(t, boot, boot + 0.3)), menu, 1 - seg(t, end, end + 0.25));
  };

  /** Render global time t into RF.screen (palette indices). */
  RF.renderFrame = function (tIn) {
    const t = RF.clamp(tIn, 0, RF.DURATION - 1e-4);
    const ws = RF.worldState(t);
    ws.sprites = ws.sprites.concat(RF.dynamicSprites(t));
    const cam = RF.camera(t);
    RF.renderWorld(cam, ws);
    if (t > 33.5 && t < 39.2) storeNoise(t);
    const hand = RF.handAt(t, cam);
    if (hand) drawHand(hand, cam, ws);
    const buf = RF.wbuf;
    if (ws.fogBoost >= 0.999) {
      const f = seg(t, 56.7, 57.02);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) buf[y * W + x] = RF.bayer(x, y) < f ? dawnFog : nightFog;
    }
    const md = OV.menuDim(t);
    const cd = t > 9.62 && t < 14.5 ? 1 : 0;
    const map = md > 0 ? DIM_MENU : cd ? DIM_CLOSE : null;
    const sd = screen.d;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let c = buf[y * W + x];
        if (map && (md >= 1 || cd || RF.bayer(x, y) < md)) c = map[c];
        const p = y * 2 * SW + x * 2;
        sd[p] = sd[p + 1] = sd[p + SW] = sd[p + SW + 1] = c;
      }
    HUD.compass(screen, t, cam, hudAlpha(t, 0.25, 64.35));
    HUD.minimap(screen, t, cam, hudAlpha(t, 0.45, 63.75));
    if ((t < 24 || t >= 31) && (t < 57.0 || t >= 59.95)) HUD.market(screen, t, hudAlpha(t, 0, 64.05));
    OV.calendar(screen, t);
    OV.menu(screen, t);
    OV.boss(screen, t);
    HUD.toasts(screen, t);
    HUD.dialogue(screen, t);
    OV.options(screen, t);
    OV.interlude(screen, t);
    OV.complete(screen, t);
    return screen;
  };
})();
