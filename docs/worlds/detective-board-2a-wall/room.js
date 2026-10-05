/* detective-board 2a - the room: one cork wall (1600 x 900 world px) with a pencil map of the
 * Pacific Northwest drawn straight onto the tiles, the left side wall with a blinded window, ceiling,
 * floor, and the desk top (built once; pure functions of their seeds). */
(function () {
  'use strict';
  const D2 = window.D2;
  const { C, T, hash, noise2, surf, px, rect, line, poly, stroke, handText } = D2;

  const WALL_W = 1600;
  const WALL_H = 900;
  // world texture covers the wall plus ceiling, side wall and floor margins
  const OX = 240;
  const OY = 160;
  const TEX_W = WALL_W + OX + 240;
  const TEX_H = WALL_H + OY + 100;

  // hand-drawn map of the Pacific Northwest on the cork (schematic, not to scale)
  const MAP = {
    coast: [300, 0, 292, 60, 306, 120, 296, 190, 314, 260, 300, 330, 290, 410, 306, 480, 296, 560, 310, 640, 302, 690, 316, 760, 304, 840, 312, 900],
    river: [304, 690, 340, 684, 380, 695, 420, 688, 462, 676, 500, 668, 530, 677, 556, 700, 580, 734, 612, 760, 642, 776, 700, 783, 760, 778, 830, 787, 900, 781, 980, 791, 1050, 785],
    soundW: [688, 0, 698, 40, 684, 92, 702, 140, 692, 192, 708, 238, 700, 268],
    soundE: [730, 0, 726, 52, 744, 100, 730, 160, 742, 206, 724, 240],
    seattle: [752, 150],
    portland: [630, 800],
  };

  /** Pencil polyline on the cork: 2-px graphite with small skips where the lead lifted. */
  function pencil(s, pts, seed, color) {
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const x0 = pts[i] + OX;
      const y0 = pts[i + 1] + OY;
      const x1 = pts[i + 2] + OX;
      const y1 = pts[i + 3] + OY;
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
      for (let k = 0; k <= n; k += 1) {
        if (hash(seed, i, k >> 2) < 0.06) continue;
        const x = x0 + ((x1 - x0) * k) / n;
        const y = y0 + ((y1 - y0) * k) / n;
        px(s, x, y, color);
        if (hash(seed, i + 7, k) < 0.7) px(s, x + 1, y, color);
      }
    }
  }

  function corkPixel(x, y, tileSeed) {
    const fine = noise2(x / 2.8, y / 2.8, 11 + tileSeed);
    const coarse = noise2(x / 34, y / 34, 12);
    if (fine > 0.35 - coarse * 0.16) return C.CORK_D;
    if (fine < -0.43) return C.CORK_L;
    if (hash(x, y, 13) < 0.003) return C.CORK_DD;
    return C.CORK;
  }

  let texture = null;
  /** The whole room behind the desk as one indexed texture (built once). */
  function wallTexture() {
    if (texture) return texture;
    const s = surf(TEX_W, TEX_H, C.NIGHT);
    // ceiling and cornice
    rect(s, 0, 0, TEX_W, OY, C.NIGHT);
    rect(s, OX - 40, OY - 7, WALL_W + 80, 6, C.CORK_DD);
    rect(s, OX - 40, OY - 7, WALL_W + 80, 1, C.CORK_D);
    // cork tiles: 160 x 150, each with its own speckle seed; one newer, paler tile
    for (let y = 0; y < WALL_H; y += 1) {
      for (let x = 0; x < WALL_W; x += 1) {
        const tx = Math.floor(x / 160);
        const ty = Math.floor(y / 150);
        let c = corkPixel(x, y, tx * 7 + ty * 13);
        if (tx === 8 && ty === 1 && c === C.CORK_D && hash(x, y, 5) < 0.5) c = C.CORK;
        s.d[(y + OY) * TEX_W + x + OX] = c;
      }
    }
    for (let tx = 1; tx < 10; tx += 1) {
      for (let y = 0; y < WALL_H; y += 1) {
        const off = hash(tx, Math.floor(y / 150), 3) < 0.3 ? 1 : 0;
        px(s, OX + tx * 160 + off, OY + y, C.CORK_DD);
        if (hash(tx, y, 4) < 0.5) px(s, OX + tx * 160 + off + 1, OY + y, C.CORK_L);
      }
    }
    for (let ty = 1; ty < 6; ty += 1) {
      for (let x = 0; x < WALL_W; x += 1) {
        px(s, OX + x, OY + ty * 150, C.CORK_DD);
        if (hash(x, ty, 6) < 0.5) px(s, OX + x, OY + ty * 150 + 1, C.CORK_L);
      }
    }
    // old pin holes: pairs and singles, more where things were pinned before
    for (let i = 0; i < 520; i += 1) {
      const x = Math.floor(hash(i, 1, 21) * WALL_W);
      const y = Math.floor(hash(i, 2, 21) * WALL_H);
      px(s, OX + x, OY + y, C.CORK_DD);
      if (hash(i, 3, 21) < 0.4) px(s, OX + x + 2, OY + y + 1, C.CORK_DD);
    }
    // the pencil map: an older, erased route ghost first, then coast, sound, river
    pencil(s, [560, 860, 600, 600, 690, 380, 740, 170], 31, C.CORK_D);
    pencil(s, MAP.coast, 32, C.CORK_DD);
    pencil(s, MAP.soundW, 33, C.CORK_DD);
    pencil(s, MAP.soundE, 34, C.CORK_DD);
    pencil(s, MAP.river, 35, C.CORK_DD);
    pencil(s, MAP.river.map((v, i) => (i % 2 ? v + 5 : v)).slice(10, 34), 36, C.CORK_DD);
    // city marks: small hand circles
    [MAP.seattle, MAP.portland].forEach((p, k) => {
      D2.ring(s, OX + p[0], OY + p[1], 4, 4, C.GRAPH, 0.3, 6.1);
      px(s, OX + p[0], OY + p[1], C.GRAPH);
      px(s, OX + p[0] + 5 + k, OY + p[1] - 3, C.GRAPH);
    });
    // "PACIFIC OCEAN" pencilled big and faint down the empty sea
    handText(s, 'PACIFIC', OX + 108, OY + 330, C.CORK_D, 41, { scale: 3, slant: 0.18, rise: 0.06 });
    handText(s, 'OCEAN', OX + 130, OY + 384, C.CORK_D, 42, { scale: 3, slant: 0.18, rise: 0.05 });
    sideWall(s);
    // corner shadow along the far right, skirting board, floor
    for (let y = 0; y < WALL_H; y += 1) rect(s, OX + WALL_W, OY + y, 240, 1, C.SHADOW);
    rect(s, OX + WALL_W, OY, 2, WALL_H, C.NIGHT);
    rect(s, 0, OY + WALL_H, TEX_W, 12, C.CORK_DD);
    rect(s, 0, OY + WALL_H, TEX_W, 1, C.CORK_D);
    rect(s, 0, OY + WALL_H + 12, TEX_W, TEX_H - OY - WALL_H - 12, C.NIGHT);
    texture = { s, OX, OY };
    return texture;
  }

  /** Left side wall in perspective with a window and half-open blinds lit from the street. */
  function sideWall(s) {
    // wall plane x -240..0 receding toward the corner
    for (let x = 0; x < OX; x += 1) {
      const k = x / OX;
      const top = Math.round(OY - 60 * (1 - k));
      const bot = Math.round(OY + WALL_H + 40 * (1 - k));
      rect(s, x, top, 1, bot - top, C.SHADOW);
      rect(s, x, Math.max(0, top - 8), 1, 8, C.NIGHT);
    }
    rect(s, OX - 1, OY, 1, WALL_H, C.NIGHT);
    // window: perspective trapezoid, near edge (left) taller
    const wx0 = 36;
    const wx1 = 196;
    const yTop = (x) => OY + 70 + Math.round((60 * (OX - x)) / OX) * -1 + 40;
    const yBot = (x) => OY + 520 + Math.round((70 * (OX - x)) / OX);
    for (let x = wx0; x < wx1; x += 1) {
      const t0 = yTop(x);
      const t1 = yBot(x);
      rect(s, x, t0, 1, t1 - t0, C.NAVY);
      // street-light glow low in the glass
      for (let y = t0; y < t1; y += 1) {
        const g = (y - t0) / (t1 - t0);
        if (g > 0.55 && hash(x, y, 51) < (g - 0.55) * 1.6) px(s, x, y, C.BLUE);
      }
      // blinds: slats in perspective, dark against the glow, a few bent
      const slatN = 22;
      for (let k = 0; k < slatN; k += 1) {
        const y = t0 + Math.round(((t1 - t0) * (k + 0.5)) / slatN);
        const bent = (k === 6 || k === 13) && x > 90 && x < 140 ? 1 : 0;
        rect(s, x, y + bent, 1, 3, C.DUSK);
        px(s, x, y + bent + 3, C.BLACK);
      }
    }
    // frame and sill
    for (let x = wx0 - 4; x < wx1 + 4; x += 1) {
      const xx = Math.min(Math.max(x, wx0), wx1 - 1);
      rect(s, x, yTop(xx) - 4, 1, 4, C.GRAPH);
      rect(s, x, yBot(xx), 1, 6, C.GRAPH);
      px(s, x, yBot(xx), C.STEEL);
    }
    rect(s, wx0 - 4, yTop(wx0) - 4, 4, yBot(wx0) - yTop(wx0) + 10, C.GRAPH);
    rect(s, wx1, yTop(wx1) - 4, 3, yBot(wx1) - yTop(wx1) + 10, C.GRAPH);
    // blind cord
    line(s, wx1 - 12, yTop(wx1 - 12), wx1 - 14, yBot(wx1 - 14) + 40, C.STEEL);
  }

  // ---------- the desk top (u = wall x, v = depth from the wall, 0..300; 300..322 = front edge) ----------
  const DESK = { u0: 120, u1: 1480, depth: 300, face: 22 };
  let deskBase = null;
  function deskTexture() {
    if (deskBase) return deskBase;
    const s = surf(1600, DESK.depth + DESK.face, T);
    for (let v = 0; v < DESK.depth; v += 1) {
      const plank = Math.floor(v / 75);
      for (let u = DESK.u0; u < DESK.u1; u += 1) {
        const grain = noise2(u / 60, v / 3.2, 61 + plank) + noise2(u / 9, v / 1.6, 62) * 0.35;
        let c = C.CORK_D;
        if (grain > 0.22) c = C.CORK_DD;
        else if (grain < -0.3) c = C.CORK;
        if (v % 75 === 0) c = C.CORK_DD;
        s.d[v * s.w + u] = c;
      }
    }
    // leather blotter under the case file
    rect(s, 470, 46, 560, 230, C.SHADOW);
    rect(s, 470, 46, 560, 2, C.GRAPH);
    rect(s, 470, 274, 560, 2, C.GRAPH);
    for (let u = 470; u < 1030; u += 1) if (hash(u, 9, 63) < 0.08) px(s, u, 47 + Math.floor(hash(u, 8, 63) * 226), C.DUSK);
    // front face of the desk
    rect(s, DESK.u0, DESK.depth, DESK.u1 - DESK.u0, DESK.face, C.CORK_DD);
    rect(s, DESK.u0, DESK.depth, DESK.u1 - DESK.u0, 2, C.CORK);
    rect(s, DESK.u0, DESK.depth + DESK.face - 2, DESK.u1 - DESK.u0, 2, C.SHADOW);
    deskBase = s;
    return s;
  }

  Object.assign(D2, { room: { WALL_W, WALL_H, OX, OY, TEX_W, TEX_H, MAP, wallTexture, deskTexture, DESK } });
})();
