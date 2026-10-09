// Comic portrait (9:16 short, look comic-story), 2 of 3: a page that scrolls DOWN the phone.
// Narration: "The cable snapped on the fortieth floor. The car fell through the dark shaft and
// stopped one metre above the lobby."
// Flow: page.flow with no direction, so it reads 'down' (the portrait default, PLAN.md#13.18):
// a column of three panels longer than the page; the camera scrolls with the fall, each panel's
// foot landing at 80 % of the frame. Continuity (page.thread): the cable and the car drawn over
// all three panels and their gutters, from the roof to the lobby.
// Focal: the car on its broken cable, then STOP.
// Traces: SNAP on uneven beats, a pencilled floor count, a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cpt2',
  title: 'Comic portrait: the falling elevator',
  treatment: 'character-scene',
};

const BEATS = [0.3, 2.2, 4.2];

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 612, anchor: ctx.anchor, duration: ctx.shot.duration });
  ctx.scene.add(page);
  const { art } = page;
  const { track, rnd } = page.util;
  // The shaft: girders and rivets, darker with depth (0 = the roof, 1 = the lobby).
  const shaft =
    (depth) =>
    (g, t, [w, h]) => {
      g.plate.rect(0, 0, w, h, depth > 0.6 ? 'night' : 'greyDark');
      for (let i = 0; i < 6; i += 1) {
        const y = (i + 0.5) * (h / 6);
        g.line(0, y, w, y + 4, 'ink', 2);
        for (let j = 0; j < 5; j += 1) g.plate.ellipse(20 + j * 64, y - 5, 2, 2, 'greyLight');
      }
      g.line(26, 0, 26 + rnd(`girder${depth}`, 1) * 6, h, 'ink', 3);
      g.line(w - 26, 0, w - 30, h, 'ink', 3);
      if (depth === 0)
        art.backdrop(g, { preset: 'city', time: 'night', box: [0, 0, w, h * 0.42], t });
      if (depth === 1) art.backdrop(g, { preset: 'room', box: [0, h * 0.62, w, h * 0.4] });
    };
  const { boxes, panels } = page.flow({
    intent: 'the page scrolls down the forty floors the car falls, from the roof to the lobby',
    travel: 0.5,
    beats: [
      { at: BEATS[0], draw: shaft(0) },
      { at: BEATS[1], weight: 1.2, draw: shaft(0.5) },
      { at: BEATS[2], weight: 1.3, draw: shaft(1) },
    ],
  });
  const [x0] = boxes[0];
  const cableX = x0 + boxes[0][2] / 2;
  const lobby = boxes[2][1] + boxes[2][3] * 0.62;
  const carY = (t) =>
    track(
      [
        [0.9, boxes[0][1] + 150],
        [BEATS[1], boxes[1][1] + 90, 'inQuad'],
        [BEATS[2], lobby - 26, 'inQuad'],
      ],
      t,
    );
  page.thread({
    intent: 'one broken cable carries the falling car from the roof down to the lobby',
    through: panels,
    draw: (g, t) => {
      const y = carY(t);
      g.line(cableX, boxes[0][1], cableX, y - 60, 'sepiaTan', 2);
      g.plate.rect(cableX - 34, y - 60, 68, 60, 'yellow');
      g.ink([cableX - 34, y - 60, cableX + 34, y - 60, cableX + 34, y, cableX - 34, y], {
        key: 'car',
      });
      g.line(cableX, y - 60, cableX, y, 'ink', 1);
    },
  });
  page.caption('FLOOR 40.', { x: 60, y: 90, at: BEATS[0] + 0.2, tilt: -1 });
  page.sfx('SNAP', {
    x: cableX,
    y: boxes[0][1] + 120,
    at: 0.9,
    size: 5,
    beats: [0, 0.07, 0.15, 0.2],
    angles: [-0.08, 0.06, -0.03, 0.1],
  });
  page.balloon('STOP!', {
    x: cableX,
    y: lobby - 150,
    at: BEATS[2] + 0.3,
    tail: [cableX, lobby - 60],
  });
  page.note('39... 38...', { x: 230, y: boxes[1][1] + 30, at: BEATS[1], dur: 0.5 });
  page.thumbprint(320, lobby + 40);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
