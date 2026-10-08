// Comic breakthrough (look comic-story), open composition 3 of 3: the levee gives way.
// Narration: "For a week the river pushed against the levee. At dawn one section cracked, and the
// water dragged the rest of the wall down with it."
// Mechanism (page.panelBreak, invented for this claim, never a preset): the panels ARE the wall,
// three leaning sections side by side with the flood showing through the gutters between them;
// on "cracked" the frames tear and the first section shudders, and on "dragged" it falls and
// pulls the next section after it, then the last, opening the page to the water behind.
// Focal: the first section cracking, then the water where the wall stood.
// Traces: the torn frames, CRACK on uneven beats with letters off-square, the caption
// off-square, a smudge and a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cb3',
  title: 'Comic panel break: the levee gives way',
  treatment: 'character-scene',
};

const CRACK = 3.3;
const DRAG = 4.6;

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 513, anchor: ctx.anchor });
  ctx.scene.add(page);
  const { art } = page;
  const { seg } = page.util;
  const flood = (g, t, [w, h]) => {
    art.sky(g, { box: [0, 0, w, h], kind: 'dawn', horizon: 0.22 });
    art.sea(g, { box: [0, 0, w, h], horizon: 0.22, rough: 0.8, waves: 30, t });
    if (t > DRAG + 0.3) {
      const burst = seg(t, DRAG + 0.3, DRAG + 1.2, 'outQuad');
      art.effect(g, { kind: 'splash', x: w * 0.3, y: h * 0.62, size: 150, progress: burst, t });
    }
  };
  // One section of the wall, seen from the dry side: the river high behind it.
  const section =
    (cracks) =>
    (g, t, [w, h]) => {
      art.sky(g, { box: [0, 0, w, h], kind: 'dawn', horizon: 0.26 });
      art.sea(g, { box: [0, 0, w, h * 0.3], horizon: 0.6, rough: 0.6, waves: 8, t });
      for (let row = 0; row < 6; row += 1) {
        const y = h * 0.3 + row * h * 0.12;
        g.plate.rect(0, y, w, h * 0.12, row % 2 === 0 ? 'greyMid' : 'greyLight');
        g.line(0, y, w, y, 'ink');
        const shift = row % 2 === 0 ? 0 : w / 6;
        for (let x = shift; x < w; x += w / 3) g.line(x, y, x, y + h * 0.12, 'greyDark');
      }
      if (cracks) {
        const crack = [
          w * 0.46,
          h * 0.3,
          w * 0.52,
          h * 0.44,
          w * 0.42,
          h * 0.58,
          w * 0.55,
          h * 0.78,
        ];
        g.strokeOn(crack, seg(t, CRACK, CRACK + 0.45, 'outQuad'), 'ink', 2);
      }
    };
  page.panelBreak({
    intent:
      'one cracked section of the levee dragged the rest of the wall down and the river poured through',
    panels: [
      { id: 'water', box: [0, 0, 640, 360], border: 0, draw: flood },
      { id: 'first', box: [28, 38, 186, 292], shape: 'lean', lean: 10, draw: section(true) },
      { id: 'second', box: [228, 44, 186, 286], shape: 'lean', lean: 10, draw: section(false) },
      { id: 'third', box: [428, 38, 186, 292], shape: 'lean', lean: 10, draw: section(false) },
    ],
    moves: [
      {
        target: ['first', 'second', 'third'],
        at: DRAG,
        dur: 0.9,
        ease: 'inCubic',
        lag: 0.32,
        to: { x: 40, y: 330, rotate: 10 },
      },
    ],
    drive: (t) => ({
      first: { x: t > CRACK && t < DRAG ? Math.sin(t * 70) * 1.5 : 0 },
    }),
    gutters: { kind: 'tear', at: CRACK, dur: 0.5 },
  });
  page.caption('AT DAWN.', { x: 36, y: 24, at: 2.8, tilt: -1 });
  page.sfx('CRACK', {
    x: 170,
    y: 150,
    at: CRACK,
    until: DRAG + 0.8,
    size: 7,
    beats: [0, 0.05, 0.13, 0.17, 0.27],
    angles: [-0.12, 0.04, -0.06, 0.1, -0.02],
    rise: [4, -3, 2, -5, 1],
  });
  page.shake(DRAG + 0.3, 5);
  page.smudge(620, 300, { length: 8, angle: 2.4 });
  page.thumbprint(612, 350);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
