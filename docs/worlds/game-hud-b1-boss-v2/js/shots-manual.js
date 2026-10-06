/* B1 v2 shot 8 · INSTRUCTION MANUAL: how a flood of copies kills a market (8.5 s).
   The manual from the returned box, opened flat: a cheap two-colour spread (key ink WALNUT_D + one TEAL plate on
   CREAM paper). FIG. 1 is a bad-print halftone of a store shelf: the hit cartridge (the only one with colour) and
   its look-alike copies crowding in off the page edge. HOW TO PLAY lists the mechanism in five numbered steps.
   FOCAL: step 5 - the print says buyers stop buying BAD games; Dad's red pen strikes BAD and writes ANY, circled.
   TRACES: TEAL plate printed 3/2 px off-register (and rotated differently); the print fed crooked onto the sheet
   (drawing rotated, type skewed glyph by glyph so letters stay whole); worn/ink-gain type with a jumpy baseline, a starved-ink band through the halftone; crease with two saddle staples; two coffee rings
   (the mug was set down twice); a thumbprint where pages get turned; pencil ticks at uneven times; the red
   correction. Pencil (GREY_D) follows the narrator; red (CRIMSON) is used once, for the point.
   Timing: still 0-2.3 s (title read), tick tick . tick . tick, a silent beat, strike -> ANY -> circle, hold from
   7.25 s; the page turn (trans.js) owns the last 0.8 s and draws this scene live under it.
   The printed page is built once (it does not depend on t) and copied each frame; only the marks depend on t. */
'use strict';
(function () {
  const K = B1.core;
  const F = B1.fonts;
  const { C, W, H } = K;
  const film = B1.film;
  const SEED = K.sid('manual-8');

  // ---------- "rough print": a condensed proportional 4x7 caps face (manual body type), drawn bold ----------
  const GL = {
    A: '.##. #..# #..# #### #..# #..# #..#', B: '###. #..# #..# ###. #..# #..# ###.', C: '.##. #..# #... #... #... #..# .##.',
    D: '###. #..# #..# #..# #..# #..# ###.', E: '#### #... #... ###. #... #... ####', F: '#### #... #... ###. #... #... #...',
    G: '.##. #..# #... #.## #..# #..# .###', H: '#..# #..# #..# #### #..# #..# #..#', I: '### .#. .#. .#. .#. .#. ###',
    J: '...# ...# ...# ...# #..# #..# .##.', K: '#..# #..# #.#. ##.. #.#. #..# #..#', L: '#... #... #... #... #... #... ####',
    M: '#...# ##.## #.#.# #.#.# #...# #...# #...#', N: '#..# ##.# ##.# #.## #.## #..# #..#', O: '.##. #..# #..# #..# #..# #..# .##.',
    P: '###. #..# #..# ###. #... #... #...', Q: '.##. #..# #..# #..# #..# #.#. .#.#', R: '###. #..# #..# ###. #.#. #..# #..#',
    S: '.### #... #... .##. ...# ...# ###.', T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..', U: '#..# #..# #..# #..# #..# #..# .##.',
    V: '#...# #...# #...# .#.#. .#.#. .#.#. ..#..', W: '#...# #...# #...# #.#.# #.#.# ##.## #...#',
    X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#', Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..', Z: '#### ...# ..#. ..#. .#.. #... ####',
    0: '.##. #..# #..# #..# #..# #..# .##.', 1: '.#. ##. .#. .#. .#. .#. ###', 2: '.##. #..# ...# ..#. .#.. #... ####',
    3: '###. ...# ...# .##. ...# ...# ###.', 4: '..#. .##. #.#. #### ..#. ..#. ..#.', 5: '#### #... ###. ...# ...# #..# .##.',
    6: '.##. #... #... ###. #..# #..# .##.', 7: '#### ...# ..#. ..#. .#.. .#.. .#..', 8: '.##. #..# #..# .##. #..# #..# .##.',
    9: '.##. #..# #..# .### ...# ...# .##.', '.': '. . . . . . #', ',': '.. .. .. .. .# .# #.', ':': '. . # . . # .', "'": '# # . . . . .',
    '-': '... ... ... ### ... ... ...', '!': '# # # # # . #', '?': '.##. #..# ...# ..#. .#.. .... .#..', ' ': '.. .. .. .. .. .. ..',
  };
  Object.keys(GL).forEach((k) => { GL[k] = GL[k].split(' '); });
  function printWidth(str, s) {
    let w = 0;
    for (const ch of str) w += ((GL[ch] || GL[' '])[0].length + 1) * s;
    return w - s;
  }
  // Draws str at scale s. Cheap letterpress: stems bold (+1 px ink gain), a letter now and then sits a pixel off
  // the baseline, a cell here and there is worn (one pixel missing). skew: the sheet was fed crooked, so each
  // glyph (whole, never split) sits on the rotated baseline. Returns the x of each glyph (for marks).
  function print(str, x, y, s, c, seed, skew) {
    let cx = Math.round(x) + (skew ? Math.round(-(y - PIV.y) * Math.sin(ROT)) : 0);
    const xs = [];
    let i = 0;
    for (const ch of str) {
      const g = GL[ch] || GL[' '];
      const dy = (K.hash(seed, i, 1) < 0.16 ? (K.hash(seed, i, 2) < 0.5 ? -1 : 1) : 0) + (skew ? Math.round((cx - PIV.x) * Math.sin(ROT)) : 0);
      xs.push(cx);
      for (let r = 0; r < 7; r++) {
        for (let k = 0; k < g[r].length; k++) {
          if (g[r][k] !== '#') continue;
          const bx = cx + k * s; const by = y + r * s + dy;
          K.rect(bx, by, s + 1, s, c);
          if (K.hash(seed, i * 64 + r * 8 + k, 3) < 0.03) K.rect(bx + (r & 1) * s, by + s - 1, 1, 1, 0);
        }
      }
      cx += (g[0].length + 1) * s;
      i++;
    }
    xs.push(cx - s);
    return xs;
  }

  // ---------- layout (print space; the print is then rotated onto the sheet) ----------
  const CREASE = 290;
  const ROT = -0.0065; // the whole print sits a hair crooked on the sheet
  const PLATE = { dx: 3, dy: 2, rot: -0.0042 }; // the TEAL plate: off-register and rotated differently
  const PIV = { x: 320, y: 180 };
  const TXT = 356; // step text column
  const BADGE_X = 334;
  const STEPS = [
    { y: 86, lines: ['A HIT GAME SELLS.'] },
    { y: 110, lines: ['EVERYONE COPIES IT,', 'FAST.'] },
    { y: 153, lines: ['SHELVES FILL WITH', 'LOOK-ALIKES.'] },
    { y: 195, lines: ['BUYERS CAN\'T TELL', 'GOOD FROM BAD.'] },
    { y: 245, lines: ['SO THEY', 'STOP BUYING BAD GAMES.'] },
  ];
  const PITCH = 17;
  const marksAt = { bad: null }; // filled while building: frame box of the word BAD

  // print space -> frame
  function toFrame(u, v) {
    const co = Math.cos(ROT); const si = Math.sin(ROT);
    return [PIV.x + (u - PIV.x) * co - (v - PIV.y) * si, PIV.y + (u - PIV.x) * si + (v - PIV.y) * co];
  }

  // ---------- FIG. 1: the shelf. Key buffer values: 1..250 = halftone tone (v/250), 255 = solid ink ----------
  const T = (v) => Math.max(1, Math.round(v * 250));
  // A cartridge standing on the shelf, front view in the world's convention (grip ridges on top, label below),
  // black plastic as a heavy screen, the label art solid with a knocked-out star. lean = radians about the
  // bottom centre, then dropped so its lowest corner rests on the shelf. o.s = scale (back row is smaller).
  function cart(o, plate) {
    const s = o.s || 1;
    const w = 40; const h = 48;
    const co = Math.cos(o.lean); const si = Math.sin(o.lean);
    const drop = Math.abs((w / 2) * s * si);
    const P = (lx, ly) => [o.x + (lx * co - ly * si) * s, o.base + (lx * si + ly * co) * s - drop];
    const box = (x0, y0, x1, y1) => [...P(x0, y0), ...P(x1, y0), ...P(x1, y1), ...P(x0, y1)];
    const outline = (pts) => { for (let k = 0; k < 4; k++) K.line(pts[k * 2], pts[k * 2 + 1], pts[((k + 1) % 4) * 2], pts[((k + 1) % 4) * 2 + 1], 255); };
    const star = (st, c) => {
      const pts = [];
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? st[2] * 0.45 : st[2];
        const a = -Math.PI / 2 + (k * Math.PI) / 5 + (st[3] || 0);
        pts.push(...P(st[0] + Math.cos(a) * r, st[1] + Math.sin(a) * r));
      }
      K.poly(pts, c);
    };
    const stars = o.stars || [[0, -20.5, 6]];
    if (plate) {
      if (!o.hit) return;
      K.poly(box(-16, -31, 16, -3), T(0.5)); // the hit's label is the only one printed with colour
      stars.forEach((st) => star(st, 255));
      return;
    }
    K.poly(box(-w / 2, -h, w / 2, 0), T(o.tone || 0.7));
    // the ridged grip: solid black plastic with the ridge tops catching light (paper lines)
    K.poly(box(-w / 2, -h, w / 2, -h + 15), 255);
    for (let k = 0; k < 4; k++) { const a = P(-w / 2 + 4, -h + 3 + k * 3); const b = P(w / 2 - 4, -h + 3 + k * 3); K.line(a[0], a[1], b[0], b[1], 0); }
    const label = box(-16, -31, 16, -3);
    K.poly(label, o.hit ? 0 : T(0.09)); // the copies' labels print grubby
    outline(label);
    K.poly(box(-13, -28, 13, -13), 255);
    stars.forEach((st) => star(st, 0));
    K.poly(box(-12, -10, -12 + (o.barW || 14), -7), 255);
    outline(box(-w / 2, -h, w / 2, 0));
  }
  // The copies: same box, same star, never quite the same (smaller, shifted, doubled, crooked, muddier).
  const BACK = [
    { x: 14, lean: 0.05, stars: [[2, -20, 5]], barW: 9 }, { x: 56, lean: -0.08, stars: [[-3, -21, 5]], barW: 16 },
    { x: 97, lean: 0.03, stars: [[0, -20, 6]], barW: 7 }, { x: 139, lean: -0.05, stars: [[4, -21, 4]], barW: 12 },
    { x: 178, lean: 0.09, stars: [[0, -20, 5]], barW: 10 },
  ];
  const FRONT = [
    { x: -8, lean: 0.17, stars: [[3, -21, 5]], barW: 8, tone: 0.78 },
    { x: 34, lean: -0.07, stars: [[-5, -22, 4.5], [5, -19, 4]], barW: 18 },
    { x: 75, lean: 0.12, stars: [[2, -20, 6, 0.4]], barW: 11, tone: 0.8 },
    { x: 116, lean: -0.13, stars: [[-6, -20, 4]], barW: 6 },
    { x: 157, lean: 0.06, stars: [[1, -21.5, 5]], barW: 15, tone: 0.74 },
    { x: 196, lean: -0.035, stars: [[3, -20, 6]], barW: 12 },
  ];
  const HIT = { x: 251, lean: 0, stars: [[0, -20.5, 6.5]], barW: 14, hit: true, tone: 0.66, s: 1.2 };
  const PANEL = { x1: 278, y0: 70, y1: 240, shelf: 212 };
  function figure(plate) {
    const { x1, y0, y1, shelf } = PANEL;
    if (plate) { cart({ ...HIT, base: shelf }, true); return; }
    // backdrop: a light screen, a little heavier toward the shelf (depth); bleeds off the left page edge
    for (let y = y0 + 2; y < shelf; y++) K.rect(0, y, x1, 1, T(0.03 + 0.17 * Math.pow((y - y0) / (shelf - y0), 1.6)));
    BACK.forEach((c) => cart({ ...c, base: shelf - 17, s: 1.08, tone: 0.82 }));
    // the plank, price-tag holders (no prices), and the shadow under it
    K.rect(0, shelf, x1, 10, T(0.4));
    K.rect(0, shelf, x1, 1, 255); K.rect(0, shelf + 9, x1, 1, 255);
    [30, 128, 222].forEach((tx, k) => { K.rect(tx, shelf + 2, 15 + k * 3, 6, 0); K.rect(tx, shelf + 2, 15 + k * 3, 1, 255); });
    for (let y = shelf + 10; y < y1; y++) K.rect(0, y, x1, 1, T(0.24 * (1 - (y - shelf - 10) / (y1 - shelf - 10)) + 0.03));
    FRONT.forEach((c) => cart({ ...c, base: shelf, s: 1.2 }));
    cart({ ...HIT, base: shelf });
    // frame: top, right, bottom keyline; the left side bleeds off the page
    K.rect(0, y0, x1, 2, 255); K.rect(x1, y0, 2, y1 - y0 + 2, 255); K.rect(0, y1, x1 + 2, 2, 255);
  }

  function badge(cx0, cy0, n, plate, skew) {
    const at = skew ? toFrame(cx0, cy0).map(Math.round) : [cx0, cy0];
    const cx = at[0]; const cy = at[1];
    if (plate) { K.ellipse(cx, cy, 10, 10, 255); return; }
    // the ring is knocked out of whatever is behind it first (callouts sit on the screened backdrop)
    K.ellipse(cx, cy, 11.5, 11.5, 0);
    for (let a = 0; a < 64; a++) {
      const ang = (a / 64) * Math.PI * 2;
      K.rect(Math.round(cx + Math.cos(ang) * 10.5) - 1, Math.round(cy + Math.sin(ang) * 10.5) - 1, 2, 2, 255);
    }
    print(String(n), cx - (n === 1 ? 3 : 4), cy - 7, 2, 255, SEED + n, false);
  }
  function callout(bx, by, tx, ty, n, plate) {
    if (!plate) { K.line(bx, by + 11, tx, ty, 255); K.rect(tx - 1, ty - 1, 3, 3, 255); }
    badge(bx, by, n, plate);
  }

  // ---------- the two printing plates (key = drawing layer + type layer, and the TEAL plate) ----------
  const CALLOUTS = [[262, 100, 254, 156, 1], [104, 96, 122, 150, 2]];
  function keyPlate(art, type) {
    const keep = K.fb;
    K.target(art); K.setClip(); K.fill(0);
    figure(false);
    CALLOUTS.forEach((c) => callout(c[0], c[1], c[2], c[3], c[4], false));
    K.target(type); K.fill(0);
    print('FIG. 1', 34, 250, 2, 255, SEED + 40, true);
    print('THE SHELF', 34 + printWidth('FIG. 1', 2) + 12, 250, 2, 255, SEED + 41, true);
    // right page: header, rule, steps
    print('HOW TO PLAY', 323, 44, 3, 255, SEED + 50, true);
    const r0 = toFrame(323, 73); const r1 = toFrame(603, 73);
    K.line(r0[0], r0[1], r1[0], r1[1], 255);
    STEPS.forEach((s, i) => {
      badge(BADGE_X, s.y + 7, i + 1, false, true);
      s.lines.forEach((ln, j) => {
        const y = s.y + j * PITCH;
        const xs = print(ln, TXT + (j && i === 1 ? 1 : 0), y, 2, 255, SEED + 60 + i * 7 + j, true);
        const at = ln.indexOf('BAD GAMES');
        if (i === 4 && at >= 0) marksAt.bad = { x0: xs[at], x1: xs[at + 3] - 2, y: y + Math.round((xs[at] - PIV.x) * Math.sin(ROT)) };
      });
    });
    K.target(keep);
  }
  function colourPlate(buf) {
    const keep = K.fb;
    K.target(buf); K.setClip(); K.fill(0);
    figure(true);
    CALLOUTS.forEach((c) => callout(c[0], c[1], 0, 0, c[4], true));
    K.rect(323, 70, 283, 6, 255); // the header rule
    STEPS.forEach((s, i) => badge(BADGE_X, s.y + 7, i + 1, true, false));
    K.target(keep);
  }

  // ---------- halftone screens ----------
  function dot(u, v, tone, period, ang, seed, starve) {
    const co = Math.cos(ang); const si = Math.sin(ang);
    const a = (u * co + v * si) / period; const b = (v * co - u * si) / period;
    const ia = Math.floor(a); const ib = Math.floor(b);
    const fa = a - ia - 0.5; const fb = b - ib - 0.5;
    const gain = (0.8 + 0.42 * K.hash(seed, ia * 1013 + ib, 3)) * starve;
    const r = Math.sqrt(tone / Math.PI) * gain;
    return fa * fa + fb * fb < r * r;
  }
  // ink starved on one pass of the roller: a soft horizontal band where the halftone prints thin
  function starveAt(v) { const d = Math.abs(v - 163) / 7; return d >= 1 ? 1 : 0.55 + 0.45 * d * d; }

  function sample(buf, x, y, rot, dx, dy) {
    const co = Math.cos(rot); const si = Math.sin(rot);
    const rx = x + 0.5 - PIV.x - dx; const ry = y + 0.5 - PIV.y - dy;
    const u = Math.floor(PIV.x + rx * co + ry * si); const v = Math.floor(PIV.y - rx * si + ry * co);
    if (u < 0 || v < 0 || u >= W || v >= H) return { val: 0, u, v };
    return { val: buf[v * W + u], u, v };
  }

  // ---------- paper ----------
  function lutOf(pairs) { const out = K.PAL.map((_, i) => i); Object.keys(pairs).forEach((k) => { out[C[k]] = C[pairs[k]]; }); return out; }
  const STAIN = lutOf({ CREAM: 'TAN', WHITE: 'TAN', TAN: 'TEAK', TEAL: 'TEAL_D' });
  const RIM = lutOf({ CREAM: 'TEAK', WHITE: 'TAN', TAN: 'TEAK', TEAL: 'TEAL_D' });
  const AGE = lutOf({ CREAM: 'TAN', WHITE: 'CREAM' });
  function noiseRing(ang, seed) {
    return Math.sin(ang * 3 + K.hash(seed, 1, 1) * 6) * 0.5 + Math.sin(ang * 7 + K.hash(seed, 2, 1) * 6) * 0.3 + Math.sin(ang * 13 + K.hash(seed, 3, 1) * 6) * 0.2;
  }
  // A mug's ring: a band of varying width with a darker outer lip; only the arc from a0 sweeping `span` radians
  // is printed (the rest dried too thin to show). The newer ring gets a drip that ran off the lip.
  function coffeeRing(cx, cy, rx, ry, seed, a0, span, drip) {
    const fb = K.fb;
    for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) {
      for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const nx = (x + 0.5 - cx) / rx; const ny = (y + 0.5 - cy) / ry;
        const d = Math.hypot(nx, ny);
        if (d > 1) continue;
        const ang = Math.atan2(ny, nx);
        const rel = (((ang - a0) % (Math.PI * 2)) + Math.PI * 4) % (Math.PI * 2);
        if (rel > span) continue;
        const fade = Math.min(1, rel / 0.5, (span - rel) / 0.5); // the band thins out toward its ends
        const n = noiseRing(ang, seed);
        const th = ((1.6 + 1.6 * n) * fade + 0.6) / rx;
        const o = y * W + x;
        if (d > 1 - 1.1 / rx) { if (K.dith(x, y, (0.5 + 0.3 * n) * fade)) fb[o] = RIM[fb[o]]; } else if (d > 1 - th && K.dith(x, y, 0.75 * fade + 0.1)) fb[o] = STAIN[fb[o]];
      }
    }
    if (drip) {
      const dx = cx + Math.cos(drip) * (rx + 4); const dy = cy + Math.sin(drip) * (ry + 3);
      K.ellipse(dx, dy, 2.5, 2, C.TAN); K.px(dx + 1, dy + 1, C.TEAK);
    }
  }
  function paperPasses() {
    // edges yellowed, more at the outer corners and where thumbs turn the page (bottom right)
    [[0, 0.5], [1, 0.32], [2, 0.18], [3, 0.1], [5, 0.05]].forEach((e) => {
      K.remapRect(0, e[0], W, 1, AGE, e[1]); K.remapRect(0, H - 1 - e[0], W, 1, AGE, e[1]);
      K.remapRect(e[0], 0, 1, H, AGE, e[1]); K.remapRect(W - 1 - e[0], 0, 1, H, AGE, e[1]);
    });
    for (let y = 290; y < H; y++) {
      for (let x = 560; x < W; x++) { const d = Math.hypot(W - x, H - y) / 80; if (d < 1) K.remapRect(x, y, 1, 1, AGE, 0.3 * (1 - d) * (1 - d)); }
    }
    // the crease: shadow falls into the fold from the left page, a lit lip on the right
    [0.06, 0.1, 0.16, 0.24, 0.34, 0.5, 0.72].forEach((lv, k) => K.remapRect(CREASE - 7 + k, 0, 1, H, AGE, lv));
    const fb = K.fb;
    for (let y = 0; y < H; y++) {
      const o = y * W + CREASE;
      if (K.hash(SEED, y >> 2, 9) > 0.12) fb[o] = fb[o] === C.WALNUT_D ? C.WALNUT_D : C.TEAK;
      if (fb[o + 1] === C.CREAM && K.hash(SEED, y >> 3, 10) > 0.3) fb[o + 1] = C.WHITE;
    }
    K.remapRect(CREASE + 2, 0, 2, H, AGE, 0.12);
    // saddle staples in the fold
    [62, 296].forEach((sy, k) => {
      K.rect(CREASE - 1, sy, 3, 17 + k, C.GREY);
      K.rect(CREASE - 1, sy, 1, 17 + k, C.WHITE);
      K.rect(CREASE + 2, sy + 1, 1, 17 + k, C.GREY_D);
      K.rect(CREASE - 1, sy - 1, 3, 1, C.GREY_D); K.rect(CREASE - 1, sy + 17 + k, 3, 1, C.GREY_D);
    });
    // the mug, set down twice: a full ring and an older partial one
    coffeeRing(102, 298, 33, 30, SEED + 5, -2.2, Math.PI * 2 - 0.45, 0.7);
    coffeeRing(129, 309, 33, 30, SEED + 6, 3.6, 2.4, 0);
    // a thumbprint at the corner pages get turned from: broken ridge arcs, very faint
    for (let r = 4; r < 17; r += 2.6) {
      for (let a = 0; a < 80; a++) {
        const ang = (a / 80) * Math.PI * 2;
        if (K.hash(SEED, Math.round(r * 10), a >> 2) < 0.3) continue;
        const x = 604 + Math.cos(ang) * r * 0.78; const y = 322 + Math.sin(ang) * r - Math.cos(ang) * r * 0.25;
        const xi = Math.round(x); const yi = Math.round(y);
        if (xi >= 0 && yi >= 0 && xi < W && yi < H && K.dith(xi, yi, 0.6)) fb[yi * W + xi] = AGE[fb[yi * W + xi]];
      }
    }
  }

  // ---------- build the printed spread once ----------
  let page = null;
  function buildPage() {
    const key = K.newBuffer();
    const type = K.newBuffer();
    const col = K.newBuffer();
    keyPlate(key, type);
    colourPlate(col);
    const out = K.newBuffer();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let c = C.CREAM;
        const p = sample(col, x, y, PLATE.rot, PLATE.dx, PLATE.dy);
        if (p.val === 255 || (p.val > 0 && dot(p.u, p.v, p.val / 250, 3.4, 0.26, SEED + 2, 1))) c = C.TEAL;
        const k = sample(key, x, y, ROT, 0, 0);
        if (type[y * W + x] === 255 || k.val === 255 || (k.val > 0 && dot(k.u, k.v, k.val / 250, 4.6, Math.PI / 4, SEED + 1, starveAt(k.v)))) c = C.WALNUT_D;
        out[y * W + x] = c;
      }
    }
    const keep = K.fb;
    K.target(out); K.setClip();
    paperPasses();
    K.target(keep);
    return out;
  }

  // ---------- the marks (the only things that depend on t) ----------
  // Pencil: grainy graphite, 2 px, a few pixels skip where the tooth of the paper catches.
  function pencil(x0, y0, x1, y1, k, seed) {
    if (k <= 0) return;
    const bow = (K.hash(seed, 1, 1) - 0.5) * 2.4;
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nxv = -(y1 - y0) / len; const nyv = (x1 - x0) / len;
    for (let i = 0; i <= len * 2 * k; i++) {
      const f = i / (len * 2);
      const b = Math.sin(f * Math.PI) * bow;
      const x = Math.round(x0 + (x1 - x0) * f + nxv * b); const y = Math.round(y0 + (y1 - y0) * f + nyv * b);
      for (let q = 0; q < 2; q++) {
        const h = K.hash(seed, x * 7 + q, y);
        if (h < 0.18) continue;
        K.px(x + q, y, h < 0.42 ? C.GREY : C.GREY_D);
      }
    }
  }
  // A tick in the margin: short stroke down, long stroke up; sizes and lean vary per tick.
  const TICKS = [2.3, 2.95, 4.1, 5.05];
  function tick(i, t) {
    const t0 = TICKS[i];
    const d = 0.17 + K.hash(SEED, i, 30) * 0.09;
    const k = K.clamp01((t - t0) / d);
    if (k <= 0) return;
    const s = STEPS[i];
    const c = toFrame(306 + K.hash(SEED, i, 31) * 3, s.y + 9);
    const sz = 0.85 + K.hash(SEED, i, 32) * 0.35;
    const a = [c[0] - 6 * sz, c[1] - 2 * sz]; const b = [c[0] - 1, c[1] + 4 * sz]; const e = [c[0] + 8 * sz, c[1] - (10 + K.hash(SEED, i, 33) * 4) * sz];
    pencil(a[0], a[1], b[0], b[1], K.clamp01(k / 0.3), SEED + i * 3);
    pencil(b[0], b[1], e[0], e[1], K.clamp01((k - 0.3) / 0.7), SEED + i * 3 + 1);
  }
  // Red felt-tip: touch down (a dot), one firm strike, a beat, ANY, then the loop round it.
  const RED = { tap: 5.82, strike: 5.97, any: 6.4, circle: 6.95 };
  function correction(t) {
    const bad = marksAt.bad;
    const pen = { c: C.CRIMSON, brush: 3 };
    const a = [bad.x0 - 5, bad.y + 8]; const b = [bad.x1 + 5, bad.y + 5];
    if (t >= RED.tap && t < RED.strike) K.rect(a[0] - 1, a[1] - 1, 3, 3, C.CRIMSON);
    if (t >= RED.strike) F.handStroke(a[0], a[1], b[0], b[1], { ...pen, seed: SEED + 70, bow: 2, reveal: K.ease.out(K.clamp01((t - RED.strike) / 0.14)) });
    // ANY, written above the struck word (in the empty end of the line above)
    const at = [bad.x0 - 7, bad.y - 23];
    if (t >= RED.any) F.hand('ANY', { x: at[0], y: at[1], size: 3.0, angle: -0.06, seed: SEED + 72, c: C.CRIMSON, slant: 0.24, reveal: K.clamp01((t - RED.any) / 0.45), brush: 3 });
    // the circle round ANY: a loose loop that overshoots its start
    const kr = K.clamp01((t - RED.circle) / 0.3);
    if (kr <= 0) return;
    const cc = [bad.x0 + 15, bad.y - 14];
    const n = 40; const turn = Math.PI * 2 * 1.14;
    const lim = Math.floor(n * K.ease.inOut(kr));
    let prev = null;
    for (let i = 0; i <= lim; i++) {
      const f = i / n;
      const ang = 2.6 + f * turn;
      const wob = 1 + (K.hash(SEED + 75, i >> 2, 1) - 0.5) * 0.08 + f * 0.07;
      const p = [cc[0] + Math.cos(ang) * 34 * wob, cc[1] + Math.sin(ang - 0.08) * 16 * wob];
      if (prev) K.line(prev[0], prev[1], p[0], p[1], C.CRIMSON, 3);
      prev = p;
    }
  }

  function manual(t) {
    if (!page) page = buildPage();
    K.fb.set(page);
    for (let i = 0; i < TICKS.length; i++) tick(i, t);
    correction(t);
    return { hudDark: true };
  }

  film.scene[film.S.manual] = manual;
})();
