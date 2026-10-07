/* detective-board 2a - the evidence: pixel illustrations standing in for photos and sketches.
 * No real faces: the composite is an anonymous silhouette with sunglasses; the boy is a small figure. */
(function () {
  'use strict';
  const D2 = window.D2;
  const { C, T, hash, surf, px, rect, line, disc, ring, poly, memo, sheet, print, typeText, handText } = D2;

  /** Diagonal hatch inside a polygon mask (pencil shading). */
  function hatch(s, pts, color, step, seed, slope) {
    const mask = surf(s.w, s.h);
    poly(mask, pts, 1);
    const k = slope === undefined ? 1 : slope;
    for (let y = 0; y < s.h; y += 1)
      for (let x = 0; x < s.w; x += 1) {
        if (mask.d[y * s.w + x] !== 1) continue;
        const v = Math.round(x * k + y);
        if (((v % step) + step) % step === 0 && hash(seed, x, y) > 0.12) px(s, x, y, color);
      }
  }

  // ---------- the composite: anonymous charcoal silhouette with sunglasses (no face drawn) ----------
  function composite() {
    return memo('composite', () => {
      const s = sheet(100, 128, 71, { curl: 'br', curlSize: 8 });
      // charcoal rubbed in behind the head on the shadow side, construction strokes on the other
      hatch(s, [3, 8, 42, 6, 34, 40, 26, 72, 12, 96, 3, 98], C.PAPER_D, 3, 70, -1);
      hatch(s, [3, 30, 26, 24, 22, 60, 3, 84], C.PAPER_DD, 4, 69, -1);
      line(s, 74, 14, 77, 70, C.PAPER_D);
      line(s, 79, 22, 80, 52, C.PAPER_D);
      line(s, 22, 76, 78, 74, C.PAPER_D);
      // suit, shoulders not level (head turned a touch), lapels and seams in ink
      const suitL = [2, 128, 4, 108, 14, 97, 30, 89, 38, 80, 45, 93, 47, 128];
      const suitR = [51, 128, 53, 93, 60, 80, 70, 87, 86, 95, 96, 108, 98, 128];
      poly(s, suitL, C.GRAPH);
      poly(s, suitR, C.GRAPH);
      hatch(s, suitL, C.DUSK, 3, 72, -1);
      hatch(s, suitR, C.DUSK, 4, 73, -1);
      line(s, 38, 80, 45, 110, C.INK);
      line(s, 60, 80, 53, 110, C.INK);
      line(s, 4, 108, 14, 97, C.INK);
      line(s, 86, 95, 96, 108, C.INK);
      // shirt collar and a dark tie
      poly(s, [38, 80, 48, 83, 45, 93], C.PAPER);
      poly(s, [50, 83, 60, 80, 53, 93], C.PAPER);
      line(s, 38, 80, 45, 93, C.PAPER_DD);
      poly(s, [47, 84, 51, 84, 52, 89, 46, 89], C.BLACK);
      poly(s, [46, 89, 52, 89, 54, 128, 44, 128], C.BLACK);
      line(s, 50, 91, 51, 126, C.INK);
      // neck and head: one dark mass, the jaw long and narrow
      poly(s, [40, 64, 58, 64, 60, 83, 38, 83], C.SHADOW);
      const head = [48, 18, 55, 18, 61, 21, 65, 27, 67, 35, 67, 45, 66, 53, 63, 61, 58, 68, 52, 72, 46, 72, 40, 68, 35, 61, 32, 53, 31, 45, 31, 35, 33, 27, 37, 21, 42, 18];
      poly(s, head, C.NIGHT);
      poly(s, [31, 43, 29, 45, 29, 51, 31, 53], C.NIGHT);
      poly(s, [67, 43, 69, 45, 69, 50, 67, 52], C.NIGHT);
      line(s, 40, 68, 46, 72, C.BLACK);
      line(s, 46, 72, 52, 72, C.BLACK);
      line(s, 52, 72, 58, 68, C.BLACK);
      // paper left showing along the lit side: the only modelling of the face
      line(s, 66, 33, 66, 46, C.PAPER_DD);
      line(s, 65, 49, 64, 57, C.PAPER_DD);
      line(s, 62, 61, 58, 67, C.PAPER_DD);
      line(s, 60, 69, 60, 80, C.SHADOW);
      // hair: darker than the face, side part on the left
      poly(s, [30, 42, 30, 32, 32, 25, 37, 19, 44, 15, 52, 14, 59, 16, 64, 20, 67, 27, 68, 37, 66, 40, 65, 32, 61, 27, 55, 25, 48, 26, 43, 28, 38, 30, 34, 35, 32, 42], C.BLACK);
      line(s, 43, 16, 40, 27, C.GRAPH);
      line(s, 52, 15, 60, 18, C.SHADOW);
      // sunglasses: black lenses, a lighter rim along the top, a drawn reflection streak
      poly(s, [33, 40, 46, 40, 46, 46, 44, 49, 36, 49, 33, 46], C.BLACK);
      poly(s, [50, 40, 64, 40, 64, 46, 62, 49, 52, 49, 50, 46], C.BLACK);
      rect(s, 46, 41, 4, 1, C.BLACK);
      line(s, 34, 40, 45, 40, C.GRAPH);
      line(s, 51, 40, 63, 40, C.GRAPH);
      line(s, 40, 47, 43, 44, C.GRAPH);
      line(s, 57, 47, 60, 44, C.GRAPH);
      px(s, 34, 41, C.STEEL);
      px(s, 51, 41, C.STEEL);
      // where the side of the drawing hand dragged through the charcoal
      for (let i = 0; i < 46; i += 1) {
        const x = 70 + Math.floor(hash(76, i, 1) * 16);
        const y = 98 + Math.floor(hash(76, i, 2) * 12);
        if (hash(76, i, 3) < 0.6) px(s, x, y, C.PAPER_D);
      }
      return s;
    });
  }
  /** Lens glints are lighting-dependent, so they are drawn per frame by the renderer. */
  const compositeGlints = [
    [36, 42],
    [53, 42],
  ];

  // ---------- Boeing 727, side view (T-tail, three rear engines) ----------
  function plane727(s, x, y, o) {
    const opt = o || {};
    const body = opt.dark ? C.GRAPH : C.STEEL;
    const top = opt.dark ? C.STEEL : C.WHITE;
    const P = (pts) => pts.map((v, i) => (i % 2 === 0 ? x + v : y + v));
    // far wing (dark wedge under the fuselage)
    poly(s, P([60, 7, 40, 7, 28, 12, 36, 13]), opt.dark ? C.DUSK : C.GRAPH);
    // fuselage with upswept tail cone
    poly(s, P([1, 1, 82, 0, 88, 2, 91, 5, 89, 7, 82, 8, 22, 8, 8, 7, -1, 3]), body);
    line(s, x + 4, y + 1, x + 84, y, top);
    line(s, x + 10, y + 8, x + 82, y + 8, C.GRAPH);
    for (let wx = 26; wx < 76; wx += 3) px(s, x + wx, y + 3, C.INK);
    rect(s, x + 82, y + 2, 4, 2, C.INK);
    // fin (swept, dark) and the T-tail stabiliser
    poly(s, P([-1, 1, 15, 1, 7, -19, 0, -20, -3, -17]), opt.dark ? C.DUSK : C.GRAPH);
    rect(s, x - 4, y - 21, 15, 2, body);
    // centre-engine intake at the fin root, side engine pod
    poly(s, P([13, 1, 15, -3, 22, -3, 23, 1]), body);
    px(s, x + 22, y - 2, C.INK);
    disc(s, x + 13, y + 4, 7, 2.6, body);
    line(s, x + 7, y + 6, x + 19, y + 6, C.GRAPH);
    rect(s, x + 20, y + 3, 1, 3, C.INK);
    if (opt.gear) {
      line(s, x + 48, y + 8, x + 48, y + 12, C.INK);
      line(s, x + 80, y + 8, x + 80, y + 12, C.INK);
      rect(s, x + 46, y + 12, 5, 2, C.INK);
      rect(s, x + 79, y + 12, 3, 2, C.INK);
    }
  }

  /** Portland, afternoon: the 727 on the apron. Caption "FLIGHT 305" on the border. */
  function planePhoto() {
    return memo('planePhoto', () =>
      print(116, 88, 5, 81, (img) => {
        rect(img, 0, 0, img.w, img.h, C.TEAL_D);
        rect(img, 0, 30, img.w, 14, C.TEAL);
        for (let x = 0; x < img.w; x += 1) if (hash(81, x, 1) < 0.5) px(img, x, 30, C.TEAL_D);
        rect(img, 0, 44, img.w, 1, C.DUSK);
        // terminal block on the horizon, low, off to the left
        rect(img, 4, 37, 34, 7, C.GRAPH);
        rect(img, 16, 33, 9, 4, C.GRAPH);
        for (let wx = 6; wx < 36; wx += 4) px(img, wx, 40, C.TEAL);
        rect(img, 0, 45, img.w, img.h - 45, C.GRAPH);
        rect(img, 0, 45, img.w, 2, C.PAPER_DD);
        for (let k = 0; k < 3; k += 1) line(img, 0, 54 + k * 6, img.w, 50 + k * 7, C.DUSK);
        plane727(img, 14, 32, { gear: true });
        // shadow of the plane on the apron
        rect(img, 24, 46, 62, 2, C.GRAPH);
      }, { bottom: 18, dogEar: 'tr' }),
    );
  }

  /** Seattle at night: floodlight, the 727 and a fuel truck on wet tarmac. */
  function refuelPhoto() {
    return memo('refuelPhoto', () =>
      print(112, 86, 5, 91, (img) => {
        rect(img, 0, 0, img.w, img.h, C.NAVY);
        rect(img, 0, 40, img.w, img.h - 40, C.INK);
        // floodlight on a mast, its glow
        line(img, 86, 4, 86, 40, C.GRAPH);
        disc(img, 86, 5, 9, 7, C.NAVY);
        disc(img, 86, 5, 4, 3, C.BRASS);
        disc(img, 86, 5, 1.5, 1.5, C.WHITE);
        plane727(img, 6, 26, { gear: true, dark: true });
        // lit belly and wing from the floodlight side
        line(img, 60, 34, 92, 34, C.STEEL);
        // fuel truck: tank, cab, hose to the wing
        rect(img, 62, 44, 24, 9, C.STEEL);
        rect(img, 62, 44, 24, 2, C.WHITE);
        rect(img, 86, 46, 9, 7, C.GRAPH);
        rect(img, 88, 47, 4, 3, C.BRASS);
        disc(img, 67, 54, 2, 2, C.BLACK);
        disc(img, 82, 54, 2, 2, C.BLACK);
        disc(img, 91, 54, 2, 2, C.BLACK);
        line(img, 62, 49, 52, 40, C.GRAPH);
        // wet tarmac: broken reflections of the floodlight
        for (let k = 0; k < 6; k += 1) rect(img, 83 + (k % 2), 58 + k * 3, 6 - k, 1, k < 2 ? C.BRASS : C.NAVY);
      }, { bottom: 16, curl: 'bl', curlSize: 7 }),
    );
  }

  /** In flight at night: the rear of the 727 close, the aft airstair lowered, cabin light on the steps. */
  function stairPhoto() {
    return memo('stairPhoto', () =>
      print(112, 84, 5, 101, (img) => {
        rect(img, 0, 0, img.w, img.h, C.NAVY);
        rect(img, 0, 0, img.w, 10, C.INK);
        for (let x = 0; x < img.w; x += 1) {
          const h1 = 50 + Math.round(2 * Math.sin(x * 0.13) + 2 * Math.sin(x * 0.31 + 1));
          rect(img, x, h1, 1, img.h - h1, C.DUSK);
          const h2 = 58 + Math.round(2 * Math.sin(x * 0.19 + 2));
          rect(img, x, h2, 1, img.h - h2, C.NIGHT);
        }
        // rear fuselage entering from the left, tapering into the tail cone
        poly(img, [0, 17, 66, 18, 88, 24, 94, 28, 88, 31, 66, 34, 0, 35], C.GRAPH);
        line(img, 0, 17, 66, 18, C.STEEL);
        line(img, 66, 18, 88, 24, C.STEEL);
        for (let wx = 4; wx < 40; wx += 4) px(img, wx, 23, C.BRASS);
        // T-tail: swept fin up to a high stabiliser
        poly(img, [56, 18, 74, 19, 90, 1, 80, 0], C.GRAPH);
        line(img, 56, 18, 80, 0, C.STEEL);
        rect(img, 70, 0, 30, 2, C.STEEL);
        // side engine pod and the centre intake at the fin root
        D2.disc(img, 60, 24, 11, 4, C.STEEL);
        rect(img, 49, 22, 1, 5, C.INK);
        line(img, 50, 27, 70, 27, C.GRAPH);
        poly(img, [52, 18, 56, 13, 64, 13, 66, 18], C.STEEL);
        // the airstair, hinged under the tail, hanging down and aft; the doorway lit
        rect(img, 64, 34, 10, 2, C.BRASS);
        poly(img, [64, 35, 73, 35, 86, 58, 80, 59], C.STEEL);
        for (let k = 1; k < 6; k += 1) line(img, 64 + k * 3.2, 35 + k * 4.2, 71 + k * 2.6, 35 + k * 4.2, k < 3 ? C.BRASS : C.GRAPH);
        line(img, 73, 35, 86, 58, C.PAPER_DD);
      }, { bottom: 16 }),
    );
  }

  /** The ransom: banded stacks of twenties under a desk light. */
  function cashPhoto() {
    return memo('cashPhoto', () =>
      print(122, 108, 5, 111, (img) => {
        rect(img, 0, 0, img.w, img.h, C.INK);
        disc(img, 50, 34, 52, 34, C.NAVY);
        const stack = (x, y, w, h, depth) => {
          for (let k = 0; k < depth; k += 1) rect(img, x, y + h + k, w, 1, k % 2 ? C.GREEN_D : C.PAPER_D);
          rect(img, x + w - 1, y + h, 1, depth, C.GREEN_D);
          D2.shapes.bill(img, x, y, w, h, false);
          const bx = x + Math.floor(w * 0.44);
          rect(img, bx, y, 6, h + depth, C.PAPER);
          rect(img, bx, y + h, 6, depth, C.PAPER_D);
          px(img, bx + 2, y + 3, C.PAPER_DD);
          px(img, bx + 3, y + 3, C.PAPER_DD);
        };
        stack(8, 40, 42, 16, 9);
        stack(56, 34, 42, 16, 11);
        stack(30, 14, 42, 16, 8);
        stack(66, 56, 36, 14, 7);
        // one loose note, slid half off the stack
        D2.shapes.bill(img, 6, 68, 30, 12, true);
      }, { bottom: 26, curl: 'tl', curlSize: 7 }),
    );
  }

  function indexCard(w, h, seed, o) {
    return sheet(w, h, seed, Object.assign({ lines: true }, o || {}));
  }
  /** "4 PARACHUTES": four canopies sketched in ink, the last one hurried. */
  function paraCard() {
    return memo('paraCard', () => {
      const s = indexCard(96, 60, 121, { dogEar: 'bl' });
      typeText(s, '4 PARACHUTES', 10, 4, C.INK, 121);
      for (let k = 0; k < 4; k += 1) {
        const cx = 16 + k * 21 + Math.round(hash(122, k, 1) * 2);
        const cy = 26 + Math.round(hash(122, k, 2) * 3);
        const hurried = k === 3;
        ring(s, cx, cy, 8, 6, C.INK, Math.PI, Math.PI * 2);
        line(s, cx - 8, cy, cx + 8, cy, C.INK);
        if (!hurried) {
          line(s, cx - 3, cy + 1, cx - 1, cy + 3, C.INK);
          line(s, cx + 3, cy + 1, cx + 1, cy + 3, C.INK);
        }
        const by = cy + 13;
        line(s, cx - 8, cy, cx - 1, by, C.INK);
        line(s, cx + 8, cy, cx + (hurried ? 2 : 1), by - (hurried ? 1 : 0), C.INK);
        line(s, cx, cy, cx, by, C.INK);
        rect(s, cx - 2, by, 4, 4, C.INK);
      }
      return s;
    });
  }
  /** Briefcase sketch: the claimed bomb is only a word with a question mark. */
  function briefcaseCard(written) {
    return memo('briefcase:' + written, () => {
      const s = indexCard(86, 60, 131, { curl: 'tr', curlSize: 6 });
      const x = 9;
      const y = 22;
      line(s, x, y, x + 40, y, C.INK);
      line(s, x, y, x - 1, y + 26, C.INK);
      line(s, x + 40, y, x + 41, y + 26, C.INK);
      line(s, x - 1, y + 26, x + 41, y + 26, C.INK);
      line(s, x + 15, y, x + 15, y - 5, C.INK);
      line(s, x + 15, y - 5, x + 26, y - 5, C.INK);
      line(s, x + 26, y - 5, x + 26, y, C.INK);
      rect(s, x + 7, y + 2, 4, 3, C.INK);
      rect(s, x + 30, y + 2, 4, 3, C.INK);
      line(s, x + 1, y + 10, x + 39, y + 10, C.PAPER_DD);
      handText(s, 'bomb?', 54, 44, C.INK, 132, { slant: 0.3, rise: -0.05, reveal: written });
      if (written >= 5) D2.underline(s, 53, 80, 47, 1, C.INK, 133, 2);
      return s;
    });
  }
  function handCard(text, seed, w, h, o) {
    const opt = o || {};
    return memo('hand:' + text + ':' + seed + ':' + (opt.reveal === undefined ? 'all' : opt.reveal), () => {
      const s = indexCard(w, h, seed, opt);
      const lines = text.split('|');
      lines.forEach((ln, i) => {
        const reveal = opt.reveal === undefined ? ln.length : Math.max(0, opt.reveal - lines.slice(0, i).join('').length);
        handText(s, ln, 6 + i * 3, 20 + i * 14, C.INK, seed + i, { slant: 0.22 + hash(seed, i, 1) * 0.12, rise: -0.03, reveal });
      });
      return s;
    });
  }
  /** Airline ticket: carrier band, the agent's handwriting for the name, the route typed. */
  function ticket(circleK) {
    return memo('ticket:' + circleK, () => {
      const s = sheet(122, 58, 141, { curl: 'br', curlSize: 6 });
      rect(s, 0, 0, 122, 13, C.TEAL_D);
      rect(s, 0, 13, 122, 1, C.INK);
      typeText(s, 'NORTHWEST ORIENT', 12, 3, C.PAPER, 141, { fade: C.TEAL });
      for (let y = 16; y < 56; y += 3) px(s, 4, y, C.PAPER_DD);
      handText(s, 'DAN COOPER', 13, 34, C.INK, 142, { slant: 0.32, rise: -0.02 });
      typeText(s, 'PORTLAND-SEATTLE', 12, 43, C.INK, 143);
      line(s, 12, 36, 70, 35, C.PAPER_D);
      // the name circled by the investigator: one loop that does not quite close
      if (circleK > 0) {
        const n = Math.floor(44 * circleK);
        for (let i = 0; i < n; i += 1) {
          const a = -2.6 + (i / 44) * Math.PI * 2.15;
          px(s, 42 + Math.cos(a) * (36 + (i > 38 ? 2 : 0)), 30 + Math.sin(a) * 9, C.INK);
        }
      }
      return s;
    });
  }
  /** D. B. Cooper card (typed), later struck through and marked "cleared". */
  function dbcCard(strikeK, written) {
    const key = 'dbc:' + strikeK.toFixed(2) + ':' + written.toFixed(2);
    return memo(key, () => {
      const s = indexCard(84, 50, 151, { dogEar: 'br' });
      typeText(s, 'D.B. COOPER', 8, 4, C.INK, 151);
      if (strikeK > 0) D2.strike(s, 6, 74, 7, strikeK, C.INK, 152);
      handText(s, 'cleared', 12, 33, C.INK, 153, { slant: 0.35, rise: -0.06, reveal: written });
      return s;
    });
  }
  /** The money card: typed sum, hand qualifier. */
  function moneyCard() {
    return memo('moneyCard', () => {
      const s = indexCard(80, 50, 161, { curl: 'bl', curlSize: 6 });
      handText(s, 'about', 8, 18, C.INK, 162, { slant: 0.3 });
      typeText(s, '$5,800', 10, 25, C.INK, 163, { scale: 2 });
      return s;
    });
  }
  /** River bank, 1980: sand, water, a small figure kneeling, decayed bills half in the sand. */
  function riverPhoto() {
    return memo('riverPhoto', () =>
      print(114, 86, 5, 171, (img) => {
        rect(img, 0, 0, img.w, img.h, C.PAPER_D);
        rect(img, 0, 0, img.w, 12, C.TEAL);
        // far bank tree line
        for (let x = 0; x < img.w; x += 1) {
          const h = 12 + Math.round(2 + 2 * Math.sin(x * 0.4) + hash(171, x, 1) * 2);
          rect(img, x, 9, 1, h - 9, C.GREEN_D);
        }
        // the river: two tones and a few wind lines
        rect(img, 0, 17, img.w, 17, C.TEAL_D);
        for (let k = 0; k < 5; k += 1) {
          const y = 20 + k * 3;
          const x0 = Math.floor(hash(172, k, 1) * 70);
          rect(img, x0, y, 14 + Math.floor(hash(172, k, 2) * 20), 1, C.TEAL);
        }
        // shore line, wet sand band, ripples in the dry sand
        for (let x = 0; x < img.w; x += 1) {
          const y = 34 + Math.round(1.5 * Math.sin(x * 0.12));
          rect(img, x, y, 1, 3, C.PAPER_DD);
        }
        for (let k = 0; k < 6; k += 1) {
          const y = 44 + k * 4;
          for (let x = 0; x < img.w; x += 1) if ((x + k * 5) % 9 < 5 && hash(173, x, k) > 0.2) px(img, x, y + Math.round(Math.sin(x * 0.3 + k)), C.PAPER);
        }
        // the boy: a small kneeling figure, back to the camera, hands in the sand
        const bx = 64;
        const by = 50;
        disc(img, bx, by - 9, 2.5, 2.5, C.INK);
        poly(img, [bx - 4, by - 6, bx + 4, by - 6, bx + 5, by + 1, bx - 3, by + 2], C.INK);
        poly(img, [bx + 4, by - 4, bx + 10, by + 1, bx + 9, by + 2, bx + 3, by - 2], C.INK);
        poly(img, [bx - 3, by + 1, bx + 4, by + 1, bx + 6, by + 5, bx - 5, by + 5], C.GRAPH);
        // decayed bills, half in the sand
        D2.shapes.bill(img, bx + 9, by + 3, 9, 4, true);
        D2.shapes.bill(img, bx + 16, by + 6, 8, 3, true);
        D2.shapes.bill(img, bx + 3, by + 8, 7, 3, true);
        rect(img, bx + 9, by + 6, 9, 1, C.PAPER_DD);
      }, { bottom: 14, dogEar: 'tl' }),
    );
  }

  Object.assign(D2, { art: { hatch, composite, compositeGlints, plane727, planePhoto, refuelPhoto, stairPhoto, cashPhoto, paraCard, briefcaseCard, handCard, ticket, dbcCard, moneyCard, riverPhoto, indexCard } });
})();
