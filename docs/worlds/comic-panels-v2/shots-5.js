/* comic-panels v2 showcase - shot 5: Houston answers. Static page; the panels arrive one by one
 * (slide-ins with different easing), the decision travels down the page as a pencil arrow.
 */
/* global window */
'use strict';
(function () {
  const CP = window.CP;
  const { C, E, seg, track } = CP;
  const { camera, paper, misFor, panel } = CP.page;
  const A = CP.art;
  const pop = CP.pop;

  const P1 = [12, 12, 438, 14, 436, 212, 14, 209];
  const P2 = [448, 12, 628, 10, 626, 348, 450, 346];
  const P3 = [14, 222, 436, 219, 438, 348, 12, 346];
  const CAP_T = 0.95;
  const CIRCLE_T = 1.3;
  const P2_T = 1.75;
  const LEAN_T = 3.05;
  const GO_T = 3.25;
  const ARROW_T = 3.9;
  const P3_T = 4.35;
  const RADIO_T = 4.95;

  function shot5(t) {
    const P = camera(320, 180, 1);
    paper(P, 'p5h');
    const flick = Math.floor(t * 3);
    let bales = null;
    panel(P, P1, 's5a', () => {
      bales = A.mocrRoom(P.at(P1[0], P1[1], 1), misFor('s5a'), { key: 's5room', flick });
    });
    if (t >= CAP_T) {
      const dy = Math.round(-4 * (1 - seg(t, CAP_T, CAP_T + 0.13, E.outQuad)));
      CP.caption(['MISSION CONTROL, HOUSTON.'], 26, 22 + dy, { key: 's5cap', tilt: 1 });
    }
    // The reader's pencil finds him in the room before we cut close.
    if (t >= CIRCLE_T && bales) {
      CP.pencilCircle(bales[0], bales[1] + 1, 10, 9, seg(t, CIRCLE_T, CIRCLE_T + 0.32, E.inOutSine), C.MOON_L, 's5ring', 1);
      if (t >= CIRCLE_T + 0.36) CP.text('hand', 'BALES', bales[0] + 12, bales[1] - 22, C.PAPER, { key: 's5bales', slant: 1, jitter: 1.3, reveal: Math.floor(seg(t, CIRCLE_T + 0.36, CIRCLE_T + 0.6) * 5.99) });
    }
    // P2 slides in from the right edge of the page and lands with a small overshoot.
    if (t >= P2_T) {
      const dx = Math.round(200 * (1 - track([[P2_T, 0], [P2_T + 0.26, 1.03, E.outCubic], [P2_T + 0.36, 1, E.inOutSine]], t)));
      const q = P2.map((v, i) => (i % 2 ? v : v + dx));
      const lean = Math.round(-3 * seg(t, LEAN_T, LEAN_T + 0.12, E.outQuad));
      const blink = t >= 2.62 && t < 2.69;
      panel(P, q, 's5b', () => A.balesProfile(P.at(q[0] + 112, q[1] + 132, 1.9), misFor('s5b'), { key: 's5bp', lean, blink, flick }));
    }
    if (t >= GO_T) {
      CP.balloon(['GO.'], 518, 54, 492, 118, { scale: pop(t, GO_T, 0.2), key: 's5go', zoom: 2 });
    }
    // The reader underlines the decision: two quick pencil strokes, the second shorter.
    if (t >= ARROW_T) {
      CP.strokeOn([500, 63, 516, 64, 537, 62], seg(t, ARROW_T, ARROW_T + 0.14, E.inQuad), C.PENCIL, 1);
      CP.strokeOn([503, 66, 519, 66, 531, 65], seg(t, ARROW_T + 0.2, ARROW_T + 0.3, E.inQuad), C.PENCIL, 1);
    }
    if (t >= P3_T) {
      const dy = Math.round(150 * (1 - seg(t, P3_T, P3_T + 0.3, E.outQuart)));
      const q = P3.map((v, i) => (i % 2 ? v + dy : v));
      let head = null;
      panel(P, q, 's5c', () => {
        head = A.capcom(P.at(q[0], q[1], 1), misFor('s5c'), { key: 's5cc', flick });
      });
      if (t >= RADIO_T && head) {
        CP.balloon(['WE\'RE GO ON', 'THAT ALARM.'], 318, 262, head[0] + 12, head[1] - 2, { scale: pop(t, RADIO_T, 0.24), key: 's5radio', zoom: 2 });
      }
    }
    CP.thumbprint(440, 352, 'thumb5h', C.SHADE);
    CP.smudge(443, 217, 6, 0.4, 's5smudge');
    return null;
  }

  CP.SHOTS[4] = {
    title: 'houston',
    dur: 7.5,
    render: shot5,
    transIn: { kind: 'split', dur: 0.7, x0: 372, x1: 290 },
    narration: 'Back in Houston, Bales has his answer: the alarm is real, but the computer is still doing the work that matters. His call: go. CAPCOM passes it up to Eagle.',
    note: 'a static page whose panels arrive in reading order - the room, the man, the radio - and a pencil arrow carries his word from one panel to the next.',
  };
})();
