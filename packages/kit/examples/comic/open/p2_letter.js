// Comic page flow (look comic-story), 2 of 2: a page that reads SIDEWAYS.
// Narration: "The letter left the city on Monday, crossed the mountains by train, the sea by
// ship, and reached the farm on Friday."
// Flow (page.flow, direction across): one long narrow band of four panels, wider than the page;
// the camera reads it to the right, one panel per leg of the journey.
// Continuity (page.thread): the route, a red dashed line, and the letter riding it are drawn over
// all four panels and across the gutters, so the same letter travels the whole page.
// Focal: the letter on its route, arriving at the farm.
// Traces: the route pencilled in two strokes, the captions off-square, a smudge, a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cp2',
  title: 'Comic page flow: the letter crosses the page',
  treatment: 'character-scene',
};

const LEGS = [0.4, 2, 3.4, 5];

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 522, anchor: ctx.anchor });
  ctx.scene.add(page);
  const { art } = page;
  const { track } = page.util;
  const leg =
    (preset, thing) =>
    (g, t, [w, h]) => {
      art.backdrop(g, { preset, box: [0, 0, w, h], time: 'day' });
      thing?.(g, t, w, h);
    };
  const { boxes, panels } = page.flow({
    intent: 'the page reads sideways the way the letter travels, city to mountains to sea to farm',
    direction: 'across',
    breadth: 230,
    travel: 0.5,
    beats: [
      { at: LEGS[0], draw: leg('city') },
      {
        at: LEGS[1],
        draw: leg('mountains', (g, t, w, h) =>
          art.vehicle(g, { x: w * 0.5, y: h * 0.8, kind: 'train', size: 60 }),
        ),
      },
      {
        at: LEGS[2],
        draw: leg('ocean', (g, t, w, h) =>
          art.vehicle(g, { x: w * 0.55, y: h * 0.7, kind: 'ship', size: 70 }),
        ),
      },
      {
        at: LEGS[3],
        weight: 1.3,
        draw: leg('meadow', (g, t, w, h) =>
          art.building(g, { x: w * 0.6, y: h * 0.82, kind: 'barn', size: 90 }),
        ),
      },
    ],
  });
  const routeY = boxes[0][1] + 60;
  const last = boxes[3];
  const letterX = (t) =>
    track(
      [
        [0.6, 110],
        [LEGS[1], 340],
        [LEGS[2], 560],
        [LEGS[3], last[0] + last[2] * 0.55],
      ],
      t,
    );
  page.thread({
    intent: 'the same letter rides one route through the city, the mountains, the sea and the farm',
    through: panels,
    draw: (g, t) => {
      const x = letterX(t);
      for (let s = 40; s < x - 16; s += 18) g.line(s, routeY, s + 10, routeY + 1, 'red', 2);
      art.object(g, { x, y: routeY + 12, kind: 'envelope', size: 26 });
    },
  });
  page.caption('MONDAY.', { x: 40, y: boxes[0][1] + 8, at: LEGS[0] + 0.2, tilt: -1 });
  page.caption('FRIDAY.', { x: last[0] + 14, y: last[1] + 8, at: LEGS[3] + 0.3, tilt: 1 });
  page.smudge(300, 330, { length: 8, angle: 2.2 });
  page.thumbprint(last[0] + last[2] - 20, 340);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
