/* Shot 8 (intermission tally) - the painted background still: the returns loading dock at dusk.
   Like Doom's intermission map painting it is drawn once (shapes + seeded noise, palette indices only) and never
   animates. Wear on purpose: rust under the girts, oil stains, a tipped retail box, a hand-lettered RETURNS card
   taped on crooked. Built lazily by intermission.js (RF.TALLY_ART.paint), so script order does not matter. */
'use strict';
(function () {
  const RF = window.RF, C = RF.C, Bmp = RF.Bmp;
  const W = 640, H = 360;
  const DOOR = { x0: 446, x1: 604, top: 62, slats: 152, horizon: 214, floor: 262 };
  const STEEL = [C.VOID, C.SHADOW, C.NIGHT_D, C.NIGHT, C.CHAR, C.SLATE, C.HAZE];
  const CONCRETE = [C.VOID, C.SHADOW, C.NIGHT_D, C.CHAR, C.SLATE, C.GREY, C.HAZE, C.MOON];
  const SKY = [C.NIGHT_D, C.NIGHT, C.DUSK, C.HAZE, C.MOON, C.SAND_L];

  /** Ordered-dither a value in [0,1] across a ramp of palette colours. */
  function pick(x, y, v, ramp) {
    const f = RF.clamp01(v) * (ramp.length - 1);
    const i = Math.floor(f);
    return ramp[Math.min(ramp.length - 1, i + (RF.bayer(x, y) < f - i ? 1 : 0))];
  }

  /** Light that leaks in through the door, as seen on the back wall (strong at the jambs, gone by the far left). */
  function wallLight(x, y) {
    let l = 0.1;
    if (x < DOOR.x0) l += 0.46 * Math.exp(-(DOOR.x0 - x) / 95);
    else if (x > DOOR.x1) l += 0.5 * Math.exp(-(x - DOOR.x1) / 34);
    return l * (0.62 + 0.38 * (y / DOOR.floor));
  }

  function wall(b) {
    const PROFILE = [0.62, 0.9, 0.7, 0.42, 0.26, 0.3, 0.46]; // one corrugation, lit from the right
    for (let y = 0; y < DOOR.floor; y++)
      for (let x = 0; x < W; x++) {
        const rib = PROFILE[(x + (y > 150 ? 3 : 0)) % 7];
        const grime = RF.vnoise(x, y, 23, 41) * 0.16 - 0.08;
        b.d[y * W + x] = pick(x, y, wallLight(x, y) * rib * 1.55 + grime, STEEL);
      }
    // girts (painted steel beams), the paint worn to the metal in places
    [[34, 6], [150, 7]].forEach(([gy, gh]) => {
      for (let x = 0; x < W; x++) {
        const l = wallLight(x, gy);
        for (let y = gy; y < gy + gh; y++) {
          const worn = RF.hash3(x >> 2, y, 13) < 0.12;
          b.d[y * W + x] = worn ? C.CHAR : y === gy ? (l > 0.3 ? C.CLAY : C.BROWN) : l > 0.34 ? C.BROWN : C.UMBER;
        }
        b.d[(gy + gh) * W + x] = C.VOID;
      }
    });
    // rust streaks running down from the girts
    for (let k = 0; k < 26; k++) {
      const x = Math.floor(RF.hash3(k, 1, 3) * W), gy = k % 3 ? 41 : 158;
      const len = 8 + RF.hash3(k, 2, 3) * 38;
      for (let y = gy; y < gy + len && y < DOOR.floor; y++)
        if (RF.hash3(x, y, 17) < 0.8 - (y - gy) / len) b.px(x + (y - gy > len * 0.6 ? 1 : 0), y, wallLight(x, y) > 0.3 ? C.CLAY : C.DIRT_D);
    }
  }

  function doorway(b) {
    const { x0, x1, top, horizon, floor } = DOOR;
    for (let y = top; y < floor; y++)
      for (let x = x0; x < x1; x++) {
        let c;
        if (y < horizon) {
          const s = (y - top) / (horizon - top);
          c = pick(x, y, Math.pow(s, 1.9) * 0.95, SKY);
        } else {
          const s = (y - horizon) / (floor - horizon);
          c = pick(x, y, 0.42 - s * 0.36 + RF.vnoise(x, y * 3, 9, 7) * 0.12, [C.VOID, C.NIGHT_D, C.DIRT_D, C.DIRT]);
        }
        b.d[y * W + x] = c;
      }
    // mesas on the horizon (a long flat one, a low one) - the desert the next shot drives into
    for (let x = x0; x < x1; x++) {
      const a = x > 462 && x < 538 ? 14 - Math.max(0, Math.abs(x - 500) - 30) * 0.9 : 0;
      const m = x > 556 && x < 600 ? 7 - Math.max(0, Math.abs(x - 578) - 15) * 0.8 : 0;
      const h = Math.max(a, m, 0) + RF.vnoise(x, 0, 4, 19) * 2;
      for (let y = Math.round(horizon - h); y < horizon + 2; y++) b.px(x, y, C.NIGHT_D);
    }
    // the roll-up door is half down (closing time): slats lit from below by the dusk, one dented, one bent at the lip
    for (let y = top - 16; y < DOOR.slats; y++)
      for (let x = x0 - (y < top ? 9 : 0); x < x1 + (y < top ? 9 : 0); x++) {
        let c;
        if (y < top) c = y === top - 16 ? C.VOID : (y - top) % 3 === 0 ? C.SLATE : C.CHAR;
        else {
          const k = (y - top) % 9, lift = (y - top) / (DOOR.slats - top);
          const dent = x > 512 && x < 530 && y > 118 && y < 128 ? 0.12 : 0;
          c = k === 0 ? C.VOID : k === 1 ? C.CHAR : pick(x, y, 0.3 + lift * 0.42 - dent + (k === 2 ? 0.12 : 0) + RF.vnoise(x, y, 14, 47) * 0.1, STEEL);
        }
        b.d[y * W + x] = c;
      }
    for (let x = x0; x < x1; x++) {
      const bend = x > 566 && x < 590 ? Math.round(Math.sin(((x - 566) / 24) * Math.PI) * 2) : 0;
      for (let y = DOOR.slats; y < DOOR.slats + 3 + bend; y++) b.px(x, y, y === DOOR.slats ? C.GREY : C.SLATE);
      b.px(x, DOOR.slats + 3 + bend, C.VOID);
    }
    b.px(531, 166, C.HAZE); // one early star under the door's edge
    [[x0 - 9, 1], [x1, -1]].forEach(([jx, side]) => {
      b.rect(jx, top, 9, floor - top, C.CHAR);
      b.rect(side > 0 ? jx + 8 : jx, top, 1, floor - top, C.HAZE);
      b.rect(side > 0 ? jx : jx + 8, top, 1, floor - top, C.VOID);
      for (let y = top + 6; y < floor; y += 23 + ((y >> 3) % 3)) b.rect(jx + 3, y, 3, 2, C.SLATE);
    });
    // dock lip: the painted edge is mostly worn off
    for (let x = x0 - 9; x < x1 + 9; x++) {
      b.px(x, floor, C.GREY);
      if (RF.vnoise(x, 0, 6, 3) > 0.45) b.px(x, floor + 1, C.SAND);
      b.px(x, floor + 2, C.VOID);
    }
  }

  /** The doorway pile throws a soft, narrowing shadow toward us (the light is the door behind it). */
  function pileShadow(x, y) {
    if (y < 286) return 1;
    const t = (y - 286) / 64;
    if (t >= 1) return 1;
    const l = 470 + t * 26, r = 566 - t * 30;
    const inside = Math.min(x - l, r - x) / 10;
    if (inside <= 0) return 1;
    return 1 - Math.min(1, inside) * 0.6 * (1 - t);
  }
  function floor(b) {
    const { x0, x1, floor: fy } = DOOR;
    for (let y = fy + 3; y < H; y++) {
      const t = (y - fy) / (H - fy);
      const a = x0 - 30 - t * 150, z = x1 + 10 + t * 70;
      for (let x = 0; x < W; x++) {
        const edge = Math.min(x - a, z - x);
        const spill = edge > 0 ? Math.min(1, edge / 46) * (0.52 - 0.3 * t) : 0;
        const shadow = pileShadow(x, y);
        const stain = RF.vnoise(x, y * 2.2, 17, 29) < 0.3 ? -0.07 : 0;
        b.d[y * W + x] = pick(x, y, 0.13 + spill * shadow + stain + (RF.hash3(x, y, 5) - 0.5) * 0.05, CONCRETE);
      }
    }
    // expansion joint + a crack that wanders off it
    RF.handStroke(b, [0, 318, 210, 309, 430, 300], C.VOID, 404, 2, 1);
    RF.handStroke(b, [300, 305, 318, 314, 326, 312, 341, 323], C.SHADOW, 405, 2, 1);
  }

  /** A shipping carton: face, shaded side, tape, stencil. `lit` 0..2 picks the value band. */
  function carton(b, x, y, w, h, lit, seed) {
    const face = [C.UMBER, C.BROWN, C.WOOD][lit], side = [C.SHADOW, C.UMBER, C.BROWN][lit];
    b.rect(x, y, w, h, face);
    b.rect(x + w - 4, y, 4, h, side);
    b.rect(x + (w >> 1) - 2, y, 4, 5 + (seed % 3), lit ? C.TAN : C.BROWN);
    if (w > 20 && h > 12) RF.drawText(b, 'E.T.', x + 3 + (seed % 4), y + h - 10, side, 1);
    b.frame(x, y, w, h, C.VOID);
  }
  /** The generic retail box from the returns desk (night-blue sleeve, the moon dot). */
  function retailBox(b, x, y, w, h) {
    b.rect(x, y, w, h, C.NIGHT); b.rect(x + w - 3, y, 3, h, C.NIGHT_D);
    b.rect(x + 2, y + 3, Math.round(w * 0.38), 2, C.SLATE);
    b.ellipse(x + w * 0.64, y + h * 0.56, 2.5, 2.5, C.DUSK);
    b.frame(x, y, w, h, C.VOID);
  }
  function rim(b, x, w, y, c) { for (let k = 0; k < w; k++) if (RF.hash3(x + k, y, 77) < 0.85) b.px(x + k, y, c); }

  function stacks(b) {
    // the pile just inside the doorway, backlit by the sky
    b.rect(466, 280, 104, 7, C.UMBER);
    for (let x = 468; x < 568; x += 17 + (x % 3)) b.rect(x, 282, 5, 5, C.SHADOW);
    carton(b, 470, 254, 32, 26, 0, 1); carton(b, 503, 252, 34, 28, 0, 2); carton(b, 538, 256, 30, 24, 0, 3);
    carton(b, 482, 230, 34, 24, 0, 5); carton(b, 518, 232, 29, 21, 0, 6);
    retailBox(b, 486, 219, 24, 11); retailBox(b, 512, 222, 22, 10);
    rim(b, 482, 34, 230, C.DUSK); rim(b, 486, 24, 219, C.HAZE); rim(b, 512, 22, 222, C.HAZE); rim(b, 538, 30, 256, C.DUSK);
    // one box slid off and lies tipped on the floor
    const tipped = new Bmp(24, 12);
    retailBox(tipped, 0, 0, 24, 12);
    b.blit(RF.rotate(tipped, 17), 440, 296);
    // tall stack right of the door, cropped by the frame, lit from the door side
    let y = 300;
    [[26, 0], [22, 1], [27, 2], [24, 3], [25, 4], [21, 5], [23, 6]].forEach(([h, i]) => {
      y -= h;
      const x = 609 + (i % 3) * 2 - (i === 4 ? 4 : 0);
      carton(b, x, y, 44, h, i > 3 ? 1 : 2, i);
      rim(b, x, 1, y, C.HAZE);
      for (let yy = y + 1; yy < y + h - 1; yy++) b.px(x + 1, yy, C.DUSK);
    });
    // low stack deep in the dark (mostly a ghost under the plate)
    carton(b, 214, 236, 38, 26, 0, 8); carton(b, 253, 240, 30, 22, 0, 9); carton(b, 222, 214, 32, 22, 0, 10);
  }

  /** Hand-lettered card taped to the wall: the real sign of this place (the returns desk's back room). */
  function card(b) {
    const s = new Bmp(66, 22, C.SAND);
    s.rect(0, 21, 66, 1, C.DIRT);
    RF.drawText(s, 'RETURNS', 8, 8, C.UMBER, 1, { jitter: 61, bold: true });
    RF.handStroke(s, [7, 18, 34, 18, 58, 17], C.DIRT, 62, 1.5, 0.84);
    s.rect(1, 0, 8, 4, C.GREY); s.rect(56, 1, 9, 4, C.GREY); // tape
    for (let i = 0; i < 40; i++) s.px(RF.hash3(i, 1, 63) * 66, RF.hash3(i, 2, 63) * 21, C.DIRT); // grime
    b.blit(RF.rotate(s, 3.5), 366, 108);
  }

  RF.TALLY_ART = {
    DOOR: DOOR,
    paint: function () {
      const b = new Bmp(W, H, C.VOID);
      wall(b);
      doorway(b);
      floor(b);
      stacks(b);
      card(b);
      return b;
    },
  };
})();
