/* comic-panels v2 showcase - shot 3: FLASHBACK, a sepia strip (new scene type).
 * Different print job: duotone brown key + tan tint on yellowed stock (page.js SEPIA), a coarser
 * halftone screen at another angle, no colour misregistration beyond the one tint plate, three narrow
 * letterboxed panels, a rubber date stamp, "Eight years earlier..." / "Meanwhile..." captions.
 * The camera never moves: the past is a still page.
 */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { C, E, seg, track, rnd, rndRange } = CP;
  const { camera, paper, panel, SEPIA } = CP.page;
  const A = CP.art;

  const PA = [26, 38, 612, 40, 610, 122, 28, 120];
  const PB = [56, 134, 616, 132, 613, 206, 54, 209];
  const PC = [26, 222, 590, 224, 592, 342, 27, 339];
  const CAP1_T = 1.05;
  const STAMP_T = 1.95;
  const YEARS_T = [2.75, 2.9, 3.1, 3.2, 3.38, 3.5, 3.71, 3.83, 4.12];
  const CAP2_T = 2.62;
  const CIRCLE_T = 4.5;
  const CAP3_T = 5.3;
  const SKETCH = [5.6, 7.15];
  const LABEL = [7.2, 7.95];

  /** Old stock: denser foxing than the 1969 newsprint, a browner edge, no grain that moves. */
  function agedPaper(P) {
    paper(P, 'p3old');
    for (let i = 0; i < 90; i++) {
      const x = Math.round(rndRange('fox', i, 0, CP.W));
      const y = Math.round(rndRange('fox', i + 500, 0, CP.H));
      const r = rnd('fox', i + 900) < 0.15 ? 2 : 1;
      CP.ellipse(x, y, r, r * 0.8, C.AGED);
    }
    CP.rect(0, 0, CP.W, CP.H, (x, y) => {
      const d = Math.min(x, y, CP.W - 1 - x, CP.H - 1 - y);
      if (d >= 8) return -1;
      const n = CP.noise2('edge3', x, y, 9) * 6;
      return d + n < 8 && CP.BAYER4[(y & 3) * 4 + (x & 3)] < 9 - d ? C.SHADE : -1;
    });
  }

  function shot3(t) {
    CP.setScreen(1.5, 0.52);
    const P = camera(320, 180, 1);
    agedPaper(P);
    // One tint plate only: it slips by a single pixel against the key, the same on every panel.
    const mis = [1, 0];
    panel(P, PA, 's3a', () => A.hall(P.at(PA[0], PA[1], 1), mis, { key: 's3hall' }), { border: 3, boil: 0.4 });
    const years = YEARS_T.filter((y) => t >= y).length;
    panel(P, PB, 's3b', () => {
      A.yearLine(P.at(PB[0], PB[1], 1), mis, t, {
        key: 's3yrs',
        years,
        circle: seg(t, CIRCLE_T, CIRCLE_T + 0.42, E.inOutSine),
        arrow: seg(t, CIRCLE_T + 0.55, CIRCLE_T + 0.95, E.inOutSine),
      });
    }, { border: 3, boil: 0.4 });
    const sketch = seg(t, SKETCH[0], SKETCH[1], E.linear);
    const label = seg(t, LABEL[0], LABEL[1]) * 18.9;
    panel(P, PC, 's3c', () => A.draftingTable(P.at(PC[0], PC[1], 1), mis, sketch, { key: 's3draft', label, enter: seg(t, SKETCH[0] - 0.42, SKETCH[0], E.outCubic) }), { border: 3, boil: 0.4 });

    // Captions: square-cornered boxes of the older house style, lettered the same hand.
    if (t >= CAP1_T) {
      const n = Math.floor(track([[CAP1_T, 0], [CAP1_T + 0.2, 6, E.linear], [CAP1_T + 0.34, 6.5, E.linear], [CAP1_T + 0.7, 22.99, E.outQuad]], t));
      CP.caption(['EIGHT YEARS EARLIER...'], 40, 26, { key: 's3cap1', tilt: -1, reveal: n });
    }
    if (t >= CAP2_T) {
      const dy = Math.round(-4 * (1 - seg(t, CAP2_T, CAP2_T + 0.14, E.outQuad)));
      CP.caption(['THE GOAL: THE MOON,', 'BEFORE THE DECADE', 'WAS OUT.'], 66, 140 + dy, { key: 's3cap2', tilt: 1 });
    }
    if (t >= CAP3_T) {
      const n = Math.floor(seg(t, CAP3_T, CAP3_T + 0.45, E.outQuad) * 11.99);
      CP.caption(['MEANWHILE...'], 36, 212, { key: 's3cap3', tilt: -1, reveal: n });
    }
    // The rubber date stamp: slammed on the margin, overlapping the first panel, never quite square.
    if (t >= STAMP_T) {
      const k = track([[STAMP_T, 1.55], [STAMP_T + 0.08, 0.96, E.inQuad], [STAMP_T + 0.16, 1, E.outQuad]], t);
      const sh = CP.shake(t, STAMP_T + 0.08, 3, 0.09, 's3stamp');
      CP.rubberStamp('1961', 536 + sh[0], 46 + sh[1], k, -0.13, C.RED, 's3st', { wear: 0.14, inner: true, w: 124, h: 54, size: 4.6, pitch: 27 });
    }
    CP.thumbprint(612, 352, 'thumb3old', C.AGED);
    return { remap: SEPIA };
  }

  CP.SHOTS[2] = {
    title: 'flashback',
    dur: 8.5,
    render: shot3,
    transIn: { kind: 'turn', back: true, dur: 0.9, slope: -0.18 },
    narration: 'Eight years earlier, in 1961, the country had set itself a goal: a person on the Moon before the decade was out. Meanwhile, somebody had to build the computer that would fly them there.',
    note: 'turning BACK a page: an older print job - brown key, one tan screen, coarse dots at another angle, yellowed stock - three letterboxed panels and a date stamp. The camera never moves; the past is still.',
  };
})();
