// Sketchbook look C (sketch-loud), template 3: "pop-up page" (showcase sketchbook-v2 shot 5). A
// kraft card taped into the book: the pencil hand lifts its cover and a MARCH 21 block and a paper
// sun on a hinged arm rise from the fold. Hold. The red pen pulls the tab: the sun slides off its
// pencilled notch; red loop on the empty notch, arrow along the drift ("the date stayed, the
// season moved"). The only 2.5D page of a film; at most one per ~60-90 s.
// Focal: the sun leaving its notch above the MARCH 21 block.
// Traces: the compass arc of the sun's path and a pencil ring round its notch, the block glued
// 3 px off its pencil guide, glue that ran past a tab, two torn tapes, a crooked tag on a thread.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'sc3',
  title: 'Sketch loud: pop-up page',
  treatment: 'title-card',
};

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    stock: 'cartridge',
    page: 5,
    pageTool: 'pencil',
    seed: 105,
  });
  ctx.scene.add(page);
  page.popup({
    x: 380,
    y: 272,
    w: 412,
    depth: 196,
    at: 0.36,
    elements: [
      { kind: 'arm', u: 220, length: 160, piece: 'sun', angle: 22.7, swing: -19 },
      { kind: 'block', u: 236, w: 102, h: 72, depth: 30, band: 'MARCH', text: '21' },
      { kind: 'tag', lines: ['spring', 'equinox'] },
      { kind: 'note', text: 'same date, same season', u: 34, depth: 114 },
    ],
    pull: { at: 4.4 },
    seed: 4500,
  });
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
