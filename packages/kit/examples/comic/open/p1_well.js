// Comic page flow (look comic-story), 1 of 2: a page that reads DOWNWARD.
// Narration: "The well is forty metres deep. The bucket drops past the stones, past the dark,
// and hits the water."
// Flow (page.flow, direction down): a tall narrow column of four panels, longer than the page; the
// camera reads it downward, one panel per phrase, so the reader falls with the bucket.
// Continuity (page.thread): the rope and the bucket are drawn over all four panels and the gutters
// between them, carried from the top of the shaft to the water.
// Focal: the bucket on its rope, then the splash at the bottom.
// Traces: the stones uneven, SPLASH on uneven beats with letters off-square, a pencilled depth in
// the margin, a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cp1',
  title: 'Comic page flow: down the well',
  treatment: 'character-scene',
};

const DEPTH = [0.3, 2.4, 3.6, 5];

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 521, anchor: ctx.anchor });
  ctx.scene.add(page);
  const { art } = page;
  const { track, rnd } = page.util;
  // The shaft, darker with depth (0 = the top of the well, 1 = the water).
  const shaft =
    (depth) =>
    (g, t, [w, h]) => {
      g.plate.rect(0, 0, w, h, depth > 0.6 ? 'night' : depth > 0.3 ? 'greyDark' : 'greyMid');
      for (let i = 0; i < 14; i += 1) {
        const x = rnd(`stone${depth}`, i) * w;
        const y = rnd(`stone${depth}`, i + 40) * h;
        const r = 8 + rnd(`stone${depth}`, i + 80) * 10;
        g.plate.ellipse(x, y, r * 1.4, r, depth > 0.6 ? 'cyanDeep' : 'greyLight');
        g.ink(g.ellipsePts(x, y, r * 1.4, r), { key: `s${depth}${i}` });
      }
      if (depth === 0) art.sky(g, { box: [0, 0, w, h * 0.35], kind: 'day', horizon: 1 });
      if (depth === 1) art.sea(g, { box: [0, h * 0.62, w, h * 0.4], horizon: 0, rough: 0.4, t });
    };
  const { boxes, panels } = page.flow({
    intent: 'the page reads downward the forty metres the bucket drops, from daylight to the water',
    direction: 'down',
    breadth: 300,
    travel: 0.5,
    beats: [
      { at: DEPTH[0], draw: shaft(0) },
      { at: DEPTH[1], draw: shaft(0.4) },
      { at: DEPTH[2], draw: shaft(0.7) },
      { at: DEPTH[3], weight: 1.4, draw: shaft(1) },
    ],
  });
  const ropeX = boxes[0][0] + 150;
  const bucketY = (t) =>
    track(
      [
        [0.8, 120],
        [DEPTH[1], 250],
        [DEPTH[2], 420],
        [DEPTH[3], 648, 'inQuad'],
      ],
      t,
    );
  page.thread({
    intent: 'the one rope carries the bucket from the top of the well down to the water',
    through: panels,
    draw: (g, t) => {
      const y = bucketY(t);
      g.line(ropeX, 0, ropeX, y - 20, 'sepiaTan', 2);
      art.object(g, { x: ropeX, y, kind: 'bucket', size: 34 });
    },
  });
  page.caption('FORTY METRES DOWN.', { x: 330, y: 40, at: DEPTH[0] + 0.2, tilt: -1 });
  page.sfx('SPLASH', {
    x: ropeX,
    y: 610,
    at: DEPTH[3],
    size: 5,
    fill: 'paper',
    shade: 'cyan',
    beats: [0, 0.07, 0.12, 0.22, 0.27, 0.36],
    angles: [-0.1, 0.06, -0.04, 0.09, -0.07, 0.03],
  });
  page.note('40 M', { x: 470, y: 600, at: DEPTH[3] + 0.6, dur: 0.4 });
  page.thumbprint(560, 700);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
