// Sketchbook open vocabulary 2 of 6: OCEAN (look B feel on cartridge, no layout preset: the
// page is one vertical cutaway). Built only from the open layer: the cutaway diagram, generators
// (whale, jellyfish, rowboat, sun), a spot-art fish icon defined once and used three times.
// Narration: "Sunlight fades fast: below two hundred metres the sea is dark, yet a sperm whale
// dives to two thousand metres."
// Focal: the diving whale deep in the dark band, then the red "2,000 m".
// Traces: a pencil "200 m" line ruled by hand, a pencil margin note, a smudge where the hand
// dragged through the blue; labels bloom in while the hand draws the whale.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'so2',
  title: 'Sketch open vocabulary: ocean',
  treatment: 'metaphor-object',
};

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    stock: 'cartridge',
    page: 12,
    seed: 312,
  });
  ctx.scene.add(page);
  // A school-of-fish icon in spot art (orange crayon dabs, an ink eye).
  page.defineProp('small-fish', {
    spot: {
      rows: ['..oo..o', '.ooooo.', 'oo*ooo.', '.ooooo.', '..oo..o'],
      legend: { o: { color: 'orange', nib: 'crayon' }, '*': 'ink' },
      px: 4,
    },
  });

  const title = page.write('THE DEEP', {
    x: 640,
    y: 96,
    size: 54,
    hand: 'marker',
    tool: 'marker',
    rot: -2,
    at: 0.2,
  });
  const [x, top, w, h] = [70, 150, 500, 350];
  const sea = page.diagram('cutaway', {
    x,
    y: top,
    w,
    h,
    layers: [
      { label: 'sunlit', color: 'skyPencil', depth: 1 },
      { label: 'twilight', color: 'bicLight', depth: 1.2 },
      { label: 'midnight', color: 'bic', depth: 1.9 },
    ],
    pen: 'bic',
    at: title.end + 0.1,
  });
  page.draw('vehicle', {
    type: 'rowboat',
    x: 190,
    y: top + 4,
    h: 28,
    at: sea.end + 0.05,
    appear: 'bloom',
  });
  page.draw('icon', {
    type: 'sun',
    x: 520,
    y: top - 20,
    h: 54,
    at: sea.end + 0.1,
    appear: 'bloom',
  });
  for (const [fx, fy] of [
    [300, 196],
    [340, 214],
    [380, 190],
  ]) {
    page.use('small-fish', { x: fx, y: fy, h: 18, at: sea.end + 0.2, appear: 'pop' });
  }
  page.draw('sealife', {
    type: 'jellyfish',
    x: 150,
    y: 330,
    h: 60,
    at: sea.end + 0.3,
    appear: 'bloom',
  });

  // Hero: the sperm whale, nose down, drawn by the hand.
  const whale = page.draw('fish', {
    type: 'whale',
    x: 330,
    y: 420,
    h: 120,
    rot: 28,
    anchor: 'center',
    color: 'graphiteLight',
    shade: 'dense',
    hero: true,
    bold: true,
    at: sea.end + 0.1,
    until: sea.end + 2,
  });
  page.ruled(x + 4, 236, x + w - 6, 238, { tool: 'pencil', dur: 0.45, at: whale.end + 0.2 });
  page.write('200 m', {
    x: x + 8,
    y: 230,
    size: 15,
    tool: 'pencil',
    quick: true,
    appear: 'bloom',
    at: whale.end + 0.4,
  });

  // The margin note, then the red correction on the point after a beat.
  page.write('(sperm whale)', {
    x: 650,
    y: 140,
    size: 18,
    hand: 'scrawl',
    tool: 'pencil',
    appear: 'bloom',
    at: whale.end,
  });
  const [bx, by, bw, bh] = whale.box;
  page.diagram('callout', {
    x: bx + bw * 0.9,
    y: by + bh * 0.88,
    label: '2,000 m',
    from: [600, 486],
    size: 40,
    highlight: 0,
    at: 7,
  });
  page.smudge(560, 300, 60, 26, -12);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
