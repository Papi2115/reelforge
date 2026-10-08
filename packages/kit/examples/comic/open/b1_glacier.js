// Comic breakthrough (look comic-info), open composition 1 of 3: a glacier that pulled back.
// Narration: "In 1900 the glacier reached the lake. Every summer since, it has pulled back up the
// valley: today the ice ends two kilometres from the shore."
// Mechanism (page.panelBreak, invented for this claim, never a preset): the valley of 1900 fills
// the page as an old sepia print; on "pulled back" the print itself shrinks back up into the top
// corner, the way the ice withdrew up the valley, and lifts off the page as a loose photograph,
// while the valley of today unrolls from the right in colour underneath it.
// Focal: the ice tongue, touching the lake in the old print, far up the valley today.
// Traces: the old print lifted with its shadow, a pencilled arrow and TWO KM in the margin, the
// caption off-square, a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cb1',
  title: 'Comic panel break: the glacier pulls back',
  treatment: 'data-chart-3d',
};

const PULL = 3.2;
const TODAY = 5.4;
const KM = 6.3;
const PAGE_BOX = [24, 26, 592, 304];

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 511, anchor: ctx.anchor });
  ctx.scene.add(page);
  const { art } = page;
  const { lerp } = page.util;
  // reach = how far down the valley the ice runs (1 = into the lake).
  const valley = (g, [w, h], reach) => {
    art.sky(g, { box: [0, 0, w, h], kind: 'overcast', horizon: 0.5, clouds: 2 });
    art.hills(g, {
      box: [0, 0, w, h],
      horizon: 0.56,
      peaks: true,
      snow: true,
      height: 0.42,
      fill: 'greyMid',
    });
    art.land(g, { box: [0, 0, w, h], kind: 'rock', horizon: 0.56 });
    g.plate.ellipse(w * 0.8, h * 0.92, w * 0.26, h * 0.12, 'cyan');
    g.ink(g.ellipsePts(w * 0.8, h * 0.92, w * 0.26, h * 0.12), { key: 'lake' });
    const end = [lerp(w * 0.26, w * 0.6, reach), lerp(h * 0.58, h * 0.86, reach)];
    const half = w * (0.025 + 0.04 * reach);
    const tongue = [
      w * 0.1,
      h * 0.53,
      w * 0.3,
      h * 0.51,
      end[0] + half,
      end[1],
      end[0] - half,
      end[1] + 4,
    ];
    g.plate.poly(tongue, 'paper');
    g.ink(tongue, { key: 'ice' });
    for (let i = 1; i <= 3; i += 1) {
      const u = i / 4;
      const [x, y] = [lerp(w * 0.2, end[0], u), lerp(h * 0.52, end[1], u)];
      g.line(x - half * 0.6, y - 2, x + half * 0.5, y + 1, 'greyLight');
    }
  };
  page.panelBreak({
    intent:
      'the glacier that reached the lake in 1900 has pulled back up the valley, two kilometres from the shore today',
    at: 0.2,
    when: 'IN 1900...',
    panels: [
      {
        id: 'today',
        box: PAGE_BOX,
        at: PULL + 0.15,
        enter: 'unroll',
        from: 'right',
        dur: 1.3,
        draw: (g, t, size) => valley(g, size, 0.1),
      },
      { id: 'then', box: PAGE_BOX, print: 'past', draw: (g, t, size) => valley(g, size, 1) },
    ],
    moves: [{ target: 'then', at: PULL, dur: 1.5, to: { box: [40, 34, 214, 124], rotate: -4 } }],
    gutters: { kind: 'lift', at: PULL, dur: 0.8 },
  });
  page.caption('TODAY THE ICE ENDS HERE.', { x: 300, y: 140, at: TODAY, tilt: 1 });
  page.arrow([330, 166], [222, 206], { at: TODAY + 0.3, dur: 0.35, color: 'ink' });
  page.arrow([216, 216], [330, 290], { at: KM, dur: 0.5 });
  page.note('TWO KM', { x: 290, y: 236, at: KM + 0.5, dur: 0.4 });
  page.thumbprint(612, 350);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
