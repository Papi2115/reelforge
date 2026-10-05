/* detective-board 2a - the desk in front of the wall: case file (NORJAK), printed route map with the
 * pencil route, ticket stub, magnifier, pencil, the stamp; mug and lamp stand up as billboards. */
(function () {
  'use strict';
  const D2 = window.D2;
  const { C, T, E, hash, seg, lerp, clamp, wobble, surf, px, rect, line, disc, ring, poly, memo, sheet, typeText, handText, labelTape } = D2;

  // ---------- printed route map (the detective's road map) ----------
  const ROUTE = [96, 26, 104, 52, 109, 78, 106, 104, 103, 128, 100, 156];
  function mapSprite() {
    return memo('deskMap', () => {
      const s = sheet(150, 166, 401, { fill: C.PAPER, dogEar: 'tl' });
      // fold creases
      rect(s, 74, 0, 1, 166, C.PAPER_D);
      rect(s, 0, 82, 150, 1, C.PAPER_D);
      // the Pacific and the coast
      for (let y = 1; y < 165; y += 1) {
        const cx = 26 + Math.round(3 * Math.sin(y * 0.09) + 2 * Math.sin(y * 0.23));
        rect(s, 1, y, cx - 1, 1, C.TEAL);
        px(s, cx, y, C.TEAL_D);
      }
      // Puget Sound
      for (let y = 1; y < 46; y += 1) {
        const x = 84 + Math.round(2 * Math.sin(y * 0.3));
        rect(s, x, y, 4 - (y > 36 ? 1 : 0), 1, C.TEAL);
      }
      // Columbia River from the coast past Portland
      const river = [27, 112, 40, 110, 52, 106, 62, 108, 70, 116, 78, 124, 92, 127, 110, 126, 149, 129];
      for (let i = 0; i + 3 < river.length; i += 2) {
        line(s, river[i], river[i + 1], river[i + 2], river[i + 3], C.TEAL_D);
        line(s, river[i], river[i + 1] + 1, river[i + 2], river[i + 3] + 1, C.TEAL);
      }
      // a highway in thin print
      for (let y = 4; y < 164; y += 2) px(s, 92 + Math.round(Math.sin(y * 0.05) * 3), y, C.PAPER_D);
      disc(s, 96, 26, 1.5, 1.5, C.INK);
      disc(s, 82, 128, 1.5, 1.5, C.INK);
      typeText(s, 'SEATTLE', 101, 17, C.INK, 402, { clean: true });
      typeText(s, 'PORTLAND', 86, 133, C.INK, 403, { clean: true });
      // the north leg already pencilled (Portland up to Seattle), slightly wobbly
      D2.stroke(s, [82, 126, 86, 98, 90, 70, 93, 46, 96, 28], 1, C.GRAPH, 404, 1);
      D2.thumbprint(s, 130, 150, 405, C.PAPER_D);
      return s;
    });
  }
  /** Pencil route south: steady, a hesitation where the jump happened, then on and off the map. */
  function routeProgress(t) {
    if (t < 25.95) return 0;
    if (t < 26.75) return 0.45 * E.outQuad(seg(t, 25.95, 26.75));
    if (t < 27.25) return 0.45;
    return lerp(0.45, 1, E.inOutSine(seg(t, 27.25, 27.95)));
  }
  function routeTip(k) {
    return pointAlong(ROUTE, k);
  }
  function pointAlong(pts, k) {
    let total = 0;
    const lens = [];
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const l = Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
      lens.push(l);
      total += l;
    }
    let left = total * clamp(k, 0, 1);
    for (let i = 0; i < lens.length; i += 1) {
      if (left <= lens[i]) {
        const f = lens[i] ? left / lens[i] : 0;
        return [lerp(pts[i * 2], pts[i * 2 + 2], f), lerp(pts[i * 2 + 1], pts[i * 2 + 3], f)];
      }
      left -= lens[i];
    }
    return [pts[pts.length - 2], pts[pts.length - 1]];
  }
  const MEXICO = 'to Mexico City';
  const mexicoTimes = D2.handTimes(MEXICO, 28.15, 406, 10);
  function mapAt(t) {
    const k = Math.round(routeProgress(t) * 40) / 40;
    const w = Math.round(D2.handReveal(mexicoTimes, t, 28.15) * 4) / 4;
    const hes = t > 26.75 ? 1 : 0;
    return memo('deskMap:' + k + ':' + w + ':' + hes, () => {
      const s = D2.copy(mapSprite());
      D2.stroke(s, ROUTE, k, C.GRAPH, 407, 0);
      D2.stroke(s, ROUTE.map((v, i) => v + (i % 2 ? 0 : 1)), k, C.GRAPH, 408, 0);
      // where the pencil stopped: a pressed dot and a tiny scribble
      if (hes) {
        disc(s, 108, 80, 1.5, 1.5, C.GRAPH);
        px(s, 112, 77, C.GRAPH);
      }
      if (k >= 1) {
        line(s, 100, 160, 96, 153, C.GRAPH);
        line(s, 100, 160, 105, 154, C.GRAPH);
      }
      handText(s, MEXICO, 30, 152, C.GRAPH, 409, { slant: 0.25, rise: -0.04, reveal: w });
      return s;
    });
  }

  // ---------- case file: open manila folder, typed sheet, coffee ring, label-maker tab ----------
  function fileSprite() {
    return memo('deskFile', () => {
      const s = surf(370, 196, T);
      // panels
      rect(s, 2, 16, 182, 178, C.BRASS);
      rect(s, 186, 18, 182, 176, C.BRASS);
      rect(s, 184, 16, 2, 178, C.CORK_L);
      for (let y = 16; y < 194; y += 1) {
        px(s, 2, y, C.CORK_L);
        px(s, 367, y, C.CORK_L);
      }
      rect(s, 2, 193, 366, 1, C.CORK_L);
      // tab with label-maker strip
      rect(s, 22, 2, 86, 15, C.BRASS);
      rect(s, 22, 2, 86, 1, C.CORK_L);
      D2.blit(s, labelTape('NORJAK', 410), 30, 3);
      // typed sheet, slightly crooked inside the left panel
      const page = sheet(150, 160, 411, { torn: false });
      typeText(page, 'FLIGHT 305', 14, 14, C.INK, 412, { clean: true });
      typeText(page, 'NOV 24 1971', 14, 26, C.INK, 413, { clean: true });
      typeText(page, 'PORTLAND-SEATTLE', 14, 38, C.INK, 414, { clean: true });
      D2.coffeeRing(page, 120, 64, 14, 415);
      D2.blit(s, page, 18, 26);
      // paper clip
      rect(s, 30, 24, 2, 16, C.STEEL);
      rect(s, 30, 24, 6, 2, C.STEEL);
      rect(s, 34, 24, 2, 12, C.STEEL);
      return s;
    });
  }
  /** The stamp: "SUSPENDED 2016" in red with uneven ink, rotated by the hand that pressed it. */
  function stampSprite() {
    return memo('stamp', () => {
      const s = surf(128, 52, T);
      const ink = C.RED;
      rect(s, 2, 2, 124, 2, ink);
      rect(s, 2, 48, 124, 2, ink);
      rect(s, 2, 2, 2, 48, ink);
      rect(s, 124, 2, 2, 48, ink);
      typeText(s, 'SUSPENDED', 10, 9, ink, 420, { scale: 2, clean: true });
      typeText(s, '2016', 40, 30, ink, 421, { scale: 2, clean: true });
      // uneven pressure: the lower-right starves of ink, small skips everywhere
      for (let y = 0; y < s.h; y += 1)
        for (let x = 0; x < s.w; x += 1) {
          const i = y * s.w + x;
          if (s.d[i] === T) continue;
          const starve = (x / s.w) * 0.22 + (y < 28 ? 0.06 : 0);
          if (hash(422, x >> 1, y >> 1) < starve * 0.8 || hash(423, x, y) < 0.05) s.d[i] = T;
        }
      return s;
    });
  }
  function stubSprite() {
    return memo('deskStub', () => {
      const s = sheet(66, 34, 430, { torn: 'top' });
      rect(s, 0, 4, 66, 10, C.TEAL_D);
      typeText(s, 'NORTHWEST', 6, 6, C.PAPER, 431, { fade: C.TEAL });
      typeText(s, 'FLIGHT 305', 4, 19, C.INK, 432);
      return s;
    });
  }

  // ---------- desk timeline ----------
  const STAMP_T = 57.3;
  /** Magnifier slides in, overshoots the stub, settles on it. Returns centre (desk coords). */
  function magnifierPos(t) {
    const k = E.inOutCubic(seg(t, 25.75, 26.6));
    const settle = t > 26.6 ? wobble(t - 26.6, 13, 6) * 4 : 0;
    return [lerp(1040, 930, k) - settle, lerp(290, 212, k) + settle * 0.5];
  }
  function pencilPos(t, mapPose) {
    const inK = E.outCubic(seg(t, 25.5, 25.95));
    const outK = E.inQuad(seg(t, 29.45, 29.9));
    let tip;
    if (t < 28.0) tip = routeTip(routeProgress(t));
    else {
      // writing the note: the tip follows the text baseline
      const w = D2.handReveal(mexicoTimes, t, 28.15) / MEXICO.length;
      tip = [30 + w * 62, 150 - w * 3];
    }
    const p = mapPose(tip[0], tip[1]);
    return [p[0] + (1 - inK) * 70 + outK * 90, p[1] - (1 - inK) * 60 - outK * 70, 1 - inK + outK];
  }

  function pencilDraw(s, x, y, lift) {
    // held at an angle, pointing down-left to the tip
    const dx = 0.78;
    const dy = -0.62;
    const L = 44;
    const ox = Math.round(lift * 2);
    for (let k = 0; k < L; k += 1) {
      const cx = x + dx * k + ox;
      const cy = y + dy * k - ox;
      let c = C.BRASS;
      if (k < 2) c = C.GRAPH;
      else if (k < 7) c = C.PAPER_D;
      else if (k > L - 6) c = k > L - 3 ? C.PAPER_DD : C.STEEL;
      px(s, cx, cy, c);
      px(s, cx + 1, cy, k < 2 ? C.GRAPH : c === C.BRASS ? C.CORK_L : c);
      if (k >= 5) px(s, cx + 1, cy + 1, c === C.BRASS ? C.CORK : c);
      if (k >= 7 && k <= L - 6) px(s, cx, cy - 1, C.WHITE);
    }
  }

  /** Draw all desk-top items for time t into a desk buffer (copy of the desk texture). */
  function drawDesk(buf, t, shadowFn) {
    const I = D2.world.DESK_ITEMS;
    const file = fileSprite();
    shadowFn(buf, file, I.file.u, I.file.v, I.file.a, 1);
    D2.blitRot(buf, file, I.file.u, I.file.v, I.file.a);
    const map = mapAt(t);
    shadowFn(buf, map, I.map.u, I.map.v, I.map.a, 1);
    D2.blitRot(buf, map, I.map.u, I.map.v, I.map.a);
    const stub = stubSprite();
    shadowFn(buf, stub, I.stub.u, I.stub.v, I.stub.a, 1);
    D2.blitRot(buf, stub, I.stub.u, I.stub.v, I.stub.a);
    if (t >= STAMP_T) {
      const st = stampSprite();
      D2.blitRot(buf, st, 612, 196, D2.world.deg(-5));
    } else if (t > STAMP_T - 0.32) {
      // the stamp block hovering: its shadow sharpens as it comes down
      const k = seg(t, STAMP_T - 0.32, STAMP_T);
      const grow = Math.round((1 - k) * 10);
      for (let y = 196 - 30 - grow; y < 196 + 30 + grow; y += 1)
        for (let x = 612 - 70 - grow; x < 612 + 70 + grow; x += 1) if (((x + y) & 1) === 0 || k > 0.6) D2.shade(buf, x + 8, y + 10, 1);
    }
    const mapPose = (lx, ly) => D2.spritePoint(map, I.map.u, I.map.v, I.map.a, lx, ly);
    const mp = magnifierPos(t);
    magnifier(buf, Math.round(mp[0]), Math.round(mp[1]));
    if (t > 25.5 && t < 29.9) {
      const p = pencilPos(t, mapPose);
      // pencil shadow first (to the lower right), then the pencil
      pencilShadow(buf, p[0] + 4 + p[2] * 8, p[1] + 5 + p[2] * 8);
      pencilDraw(buf, Math.round(p[0]), Math.round(p[1]), p[2]);
    }
  }
  function pencilShadow(s, x, y) {
    for (let k = 0; k < 44; k += 1) D2.shade(s, Math.round(x + 0.78 * k), Math.round(y - 0.62 * k), 1);
  }
  /** Magnifier: the lens shows the desk under it at 2x; steel rim, wooden handle, one glint. */
  function magnifier(s, cx, cy) {
    const r = 20;
    const under = D2.copy(s);
    for (let k = 0; k < 30; k += 1) {
      D2.shade(s, cx + 22 + k * 0.7 + 6, cy + 18 + k * 0.7 + 6, 1);
      D2.shade(s, cx + 23 + k * 0.7 + 6, cy + 18 + k * 0.7 + 6, 1);
    }
    ring(s, cx + 5, cy + 6, r + 1, r + 1, C.SHADOW);
    for (let y = -r; y <= r; y += 1)
      for (let x = -r; x <= r; x += 1) {
        if (x * x + y * y > r * r) continue;
        const c = D2.get(under, cx + Math.floor(x / 2), cy + Math.floor(y / 2));
        px(s, cx + x, cy + y, c === T ? C.SHADOW : c);
      }
    ring(s, cx, cy, r, r, C.STEEL);
    ring(s, cx, cy, r + 1, r + 1, C.GRAPH);
    ring(s, cx, cy, r - 1, r - 1, C.GRAPH, 0.2, 2.4);
    ring(s, cx, cy, r - 4, r - 4, C.WHITE, 3.6, 4.1);
    for (let k = 0; k < 30; k += 1) {
      const x = cx + 15 + k * 0.7;
      const y = cy + 15 + k * 0.7;
      px(s, x, y, C.CORK_DD);
      px(s, x + 1, y, C.CORK_D);
      px(s, x, y + 1, C.CORK_DD);
    }
  }

  // ---------- billboards standing on the desk ----------
  function mugSprite() {
    return memo('mug', () => {
      const s = surf(34, 34, T);
      rect(s, 3, 6, 24, 26, C.TEAL_D);
      rect(s, 5, 8, 3, 22, C.TEAL);
      rect(s, 23, 6, 4, 26, C.INK);
      D2.disc(s, 15, 6, 12, 3, C.PAPER_D);
      D2.disc(s, 15, 6, 10, 2, C.CORK_DD);
      D2.disc(s, 15, 31, 12, 2.5, C.TEAL_D);
      ring(s, 28, 18, 5, 7, C.TEAL_D, -1.4, 1.4);
      ring(s, 28, 18, 4, 6, C.INK, -1.4, 1.4);
      px(s, 9, 14, C.PAPER);
      return s;
    });
  }
  function lampSprite() {
    return memo('lamp', () => {
      const s = surf(96, 160, T);
      D2.disc(s, 58, 152, 20, 6, C.GRAPH);
      D2.disc(s, 58, 150, 18, 4, C.STEEL);
      D2.disc(s, 58, 150, 16, 3, C.GRAPH);
      for (let k = -1; k <= 1; k += 1) {
        line(s, 58 + k, 148, 70 + k, 98, k ? C.GRAPH : C.STEEL);
        line(s, 70 + k, 98, 40 + k, 62, k ? C.GRAPH : C.STEEL);
      }
      D2.disc(s, 70, 98, 3, 3, C.GRAPH);
      // shade seen from behind, opening toward the wall: dark cone, lit rim
      poly(s, [26, 36, 52, 30, 64, 60, 44, 72], C.GRAPH);
      poly(s, [28, 38, 50, 33, 54, 42, 34, 48], C.SHADOW);
      line(s, 26, 36, 52, 30, C.BRASS);
      line(s, 27, 35, 51, 29, C.WHITE);
      line(s, 52, 30, 64, 60, C.STEEL);
      return s;
    });
  }

  Object.assign(D2, { desk: { mapAt, drawDesk, mugSprite, lampSprite, STAMP_T } });
})();
