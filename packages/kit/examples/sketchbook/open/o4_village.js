// Sketchbook open vocabulary 4 of 6: MEDIEVAL VILLAGE (look A, layout 'top-down-map'). Built only
// from the open layer: the map diagram (road, places, compass, the red X), a river generator
// turned on its side, project props drawn with the doodle DSL (a roof seen from above, the church
// seen from above, the well), crayon fields, a windmill generator for the mill.
// Narration: "The village grew around one well. The market was held right here, between the
// church and the well; the mill stood by the river."
// Focal: the red X between the church and the well, then the red "market".
// Traces: roofs at uneven angles, fields hatched out of their lines, a pencil "from above" note,
// a coffee ring over the corner of the map.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'so4',
  title: 'Sketch open vocabulary: medieval village',
  treatment: 'metaphor-object',
};

const ROOFS = [
  [0.2, 0.3, 12],
  [0.28, 0.42, -20],
  [0.16, 0.5, 4],
  [0.62, 0.28, 30],
  [0.7, 0.4, -8],
  [0.58, 0.62, 16],
  [0.68, 0.7, -26],
  [0.3, 0.72, 8],
];

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    stock: 'cartridge',
    page: 14,
    seed: 314,
    layout: 'top-down-map',
  });
  ctx.scene.add(page);
  const s = page.slots();
  const [mx, my, mw, mh] = s.thing;
  const at = (u, v) => [mx + u * mw, my + v * mh];
  page.defineProp('roof', {
    h: 26,
    doodle: {
      box: [40, 26],
      parts: [
        { rect: [0, 0, 40, 26], fill: 'coffee' },
        { line: [2, 13, 38, 13], sharp: true },
      ],
    },
  });
  page.defineProp('church-plan', {
    h: 70,
    doodle: {
      box: [90, 60],
      parts: [
        {
          poly: [
            0, 20, 60, 20, 60, 0, 74, 0, 74, 20, 90, 20, 90, 40, 74, 40, 74, 60, 60, 60, 60, 40, 0,
            40,
          ],
          fill: 'graphiteLight',
          width: 2,
        },
        { line: [4, 30, 86, 30], sharp: true, nib: 'fine' },
      ],
    },
  });

  // The map's paper edge and the land use, blooming in while the hand starts the road.
  page.doodle(
    { box: [100, 100], parts: [{ rect: [0, 0, 100, 100], nib: 'fine' }] },
    { x: mx, y: my, w: mw, h: mh, anchor: 'top-left', at: 0.2, appear: 'bloom' },
  );
  page.doodle(
    {
      box: [100, 100],
      parts: [
        { hatch: [4, 4, 30, 6, 28, 22, 6, 20], color: 'green' },
        { hatch: [76, 6, 96, 4, 95, 18, 74, 20], color: 'sticky' },
        { hatch: [6, 82, 22, 80, 24, 96, 4, 95], color: 'sticky' },
        { hatch: [80, 80, 96, 82, 95, 96, 78, 94], color: 'green' },
      ],
    },
    { x: mx, y: my, w: mw, h: mh, anchor: 'top-left', at: 0.3, appear: 'bloom' },
  );
  page.draw('river', {
    x: mx + mw * 0.5,
    y: my + mh * 0.97,
    w: mw * 0.96,
    h: 46,
    rot: -4,
    at: 0.4,
    appear: 'bloom',
  });

  // The village, drawn by the hand: road and places (map diagram), then church, well, roofs.
  const map = page.diagram('map', {
    x: mx,
    y: my,
    w: mw,
    h: mh,
    land: 'none',
    route: [
      [0.02, 0.56],
      [0.25, 0.6],
      [0.46, 0.5],
      [0.66, 0.52],
      [0.98, 0.42],
    ],
    places: [
      { label: 'church', at: [0.24, 0.17] },
      { label: 'well', at: [0.53, 0.38] },
      { label: 'mill', at: [0.86, 0.8] },
    ],
    compass: true,
    at: 0.6,
  });
  const [cx, cy] = at(0.4, 0.33);
  const church = page.use('church-plan', {
    x: cx,
    y: cy,
    h: 64,
    rot: -6,
    hero: true,
    at: map.end + 0.1,
  });
  const [wx, wy] = at(0.53, 0.47);
  page.doodle(
    {
      box: [30, 30],
      parts: [
        { circle: [15, 15, 13], width: 2 },
        { circle: [15, 15, 7], fill: 'bic', shade: 'dense', outline: false },
      ],
    },
    { x: wx, y: wy, h: 30, at: church.end + 0.1 },
  );
  ROOFS.forEach(([u, v, deg], i) => {
    const [rx, ry] = at(u, v);
    page.use('roof', {
      x: rx,
      y: ry,
      h: 22,
      rot: deg,
      at: church.end + 0.5 + i * 0.08,
      appear: 'bloom',
    });
  });
  const [px, py] = at(0.88, 0.7);
  page.draw('building', {
    type: 'windmill',
    x: px,
    y: py,
    h: 70,
    at: church.end + 0.9,
    appear: 'bloom',
  });

  // Words, then the red on the point after a beat.
  page.write('THE VILLAGE', { ...s.label, size: 32, hand: 'marker', tool: 'marker', at: 4.4 });
  page.write('from above', { ...s.note, hand: 'scrawl', tool: 'pencil', appear: 'bloom', at: 5 });
  const [kx, ky] = at(0.47, 0.44);
  page.stroke([kx - 12, ky - 12, kx + 12, ky + 12], {
    tool: 'red',
    width: 3,
    at: 6.6,
    smooth: false,
  });
  page.stroke([kx + 12, ky - 12, kx - 12, ky + 12], { tool: 'red', width: 3, smooth: false });
  page.write('market', {
    x: kx - 70,
    y: ky + 40,
    size: 28,
    hand: 'scrawl',
    tool: 'red',
    rot: -4,
    at: 7.1,
  });
  page.coffeeRing(830, 400, 34);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
