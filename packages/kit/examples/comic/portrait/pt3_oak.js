// Comic portrait (9:16 short, look comic-info), 3 of 3: staggered panels and a look back.
// Narration: "The oak on the square is older than the town. In 1850 it was a sapling by a dirt
// road; today it shades the whole market."
// Layout: 'stagger' on the 360x640 page (PLAN.md#13.18): three offset panels zig-zag down the
// phone (the square today, the trunk, the market in its shade). A torn sepia strip of 1850 is
// pasted over the middle on "In 1850" (a flashback, cover 'strip', its box defaulting to the
// safe middle of the portrait page).
// Focal: the oak's crown over the market, then the sapling in the old print.
// Traces: a pencilled age in the margin, a worn stamp, a thumbprint.
// Scene contract: no imports; build() lays the page out once, update(t) only repaints it.
export const meta = {
  id: 'cpt3',
  title: 'Comic portrait: the old oak',
  treatment: 'metaphor-object',
};

export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 613, anchor: ctx.anchor, duration: ctx.shot.duration });
  ctx.scene.add(page);
  const { art } = page;
  const [square, trunk, market] = page.panels('stagger');
  const [ax, ay, aw, ah] = square.box;
  square.draw((g, t) => {
    art.backdrop(g, { preset: 'village', time: 'day', horizon: 0.72, box: [ax, ay, aw, ah], t });
    art.tree(g, { kind: 'oak', x: ax + aw * 0.55, y: ay + ah * 0.95, size: ah * 1.05, t });
  });
  const [bx, by, bw, bh] = trunk.box;
  trunk.enter({ at: 1.2, kind: 'slide', from: 'right' }).draw((g, t) => {
    art.backdrop(g, { preset: 'meadow', box: [bx, by, bw, bh], t });
    art.tree(g, { kind: 'oak', x: bx + bw * 0.4, y: by + bh * 1.6, size: bh * 2.6, sway: 0, t });
    art.person(g, { x: bx + bw * 0.8, y: by + bh - 6, size: bh * 0.8, pose: 'look-up', t });
  });
  const [cx, cy, cw, ch] = market.box;
  market.enter({ at: 2.2, kind: 'pop' }).draw((g, t) => {
    art.backdrop(g, { preset: 'village', time: 'dusk', horizon: 0.6, box: [cx, cy, cw, ch], t });
    art.crowd(g, {
      x0: cx + 16,
      x1: cx + cw - 16,
      y: cy + ch - 8,
      count: 7,
      rows: 2,
      size: ch * 0.5,
    });
  });
  page.flashback({
    intent: 'the oak was a sapling by a dirt road before the town was built around it',
    when: 'IN 1850...',
    at: 3.2,
    until: 5.6,
    cover: 'strip',
    arrange: 'row',
    enter: 'drop',
    beats: [
      {
        at: 3.6,
        weight: 1.3,
        draw: (g, t, [w, h]) => {
          art.backdrop(g, { preset: 'meadow', box: [0, 0, w, h], t });
          art.land(g, { kind: 'road', box: [0, h * 0.7, w, h * 0.3] });
          art.tree(g, { kind: 'oak', x: w * 0.5, y: h * 0.78, size: h * 0.45, t });
        },
      },
      {
        at: 4.2,
        draw: (g, t, [w, h]) => {
          art.backdrop(g, { preset: 'meadow', time: 'dusk', box: [0, 0, w, h], t });
          art.vehicle(g, { kind: 'cart', x: w * 0.5, y: h * 0.86, size: w * 0.8, t });
        },
      },
    ],
  });
  page.caption('OLDER THAN THE TOWN.', { x: 50, y: 86, at: 0.3 });
  page.stamp('1850', { x: 270, y: 470, at: 4.6, angle: -0.12 });
  page.note('170 YEARS', { x: 200, y: 330, at: 1.6, dur: 0.4 });
  page.thumbprint(28, 600);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
