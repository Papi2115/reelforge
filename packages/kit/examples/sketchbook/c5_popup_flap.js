// Sketchbook look C (sketch-loud), pop-up inspiration 2 of 4: a FLAP (door) that opens. Claim:
// "in October 1582 ten days were skipped: Thursday the 4th was followed by Friday the 15th".
// THU 4 rises on its word; the red pen pulls a knob at the bottom edge and a kraft door swings
// open toward us: behind it, FRI 15 (the days 5-14 are simply not there).
// Mechanism ideas, not a layout to copy: invent the motion that shows YOUR claim, and never use
// the same mechanism twice in one film.
// Focal: the open door and FRI 15 behind it.
// Traces: "5-14?" pencilled on the door, a red loop round the doorway, a smudge.
// Scene contract: no imports; build() draws everything once, update(t) only repaints the page.
export const meta = {
  id: 'sc5',
  title: 'Sketch loud: pop-up flap',
  treatment: 'metaphor-object',
};

export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    stock: 'cartridge',
    page: 8,
    seed: 108,
  });
  ctx.scene.add(page);
  page.popup({
    intent: 'open the door after THU 4 and you find FRI 15: ten days were skipped in 1582',
    x: 150,
    y: 230,
    w: 470,
    depth: 200,
    at: 0.3,
    elements: [
      // What the door covers is listed before the door (painted under it).
      { kind: 'card', id: 'after', u: 330, v: 70, w: 120, h: 78, text: 'FRI 15', paper: 'paper' },
      { kind: 'flap', id: 'door', u: 330, v: 70, w: 130, h: 88, hinge: 'left', text: '5-14?' },
      { kind: 'block', u: 60, w: 120, h: 76, depth: 40, band: 'THU OCT', text: '4', at: 1.9 },
      { kind: 'tag', lines: ['1582'], u: 200, depth: 120 },
    ],
    pull: {
      at: 3.4,
      tab: 'knob',
      side: 'bottom',
      dur: 1.2,
      ease: 'back',
      motions: [{ target: 'door', to: { open: 0.86 } }],
      callout: 'loop',
    },
    seed: 4700,
  });
  page.smudge(700, 420, 50, 14, -12);
  return { page };
}

export function update(t, state) {
  state.page.update(t);
}
