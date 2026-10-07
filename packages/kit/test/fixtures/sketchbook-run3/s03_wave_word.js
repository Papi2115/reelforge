// Loud page: marker "SYRUP" slaps on, a still beat, then the red pen strikes it and inserts "WAVE".
// focal: the red "WAVE" over the struck marker "SYRUP", right of centre | traces: a marker smudge, a zigzag red strike, angled tape on a pencil note
export const meta = { id: 's03_wave_word', title: 'A wave of syrup', treatment: 'kinetic-text' };

export function build(ctx) {
  const { kit, anchor, sfx } = ctx;
  const syrup = anchor('syrup');
  const down = anchor('down');
  const street = anchor('street');

  const page = kit.fx.sketchPage({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    stock: 'lined',
    page: 3,
    anchor,
  });
  ctx.scene.add(page);

  page.write('SYRUP', {
    x: 250,
    y: 430,
    size: 170,
    hand: 'marker',
    tool: 'marker',
    nib: [19, -42, 3],
    rot: -4,
    hero: true,
    at: 0.05,
    speed: 2,
  });
  page.smudge(660, 445, 80, 24, -10, { at: syrup.tEnd });
  // still beat (>= 0.5 s) on the marker word, then the one red correction
  page.crossOut(250, 290, 480, 120, { style: 'strike', tool: 'red', at: down.t });
  page.write('WAVE', {
    x: 470,
    y: 205,
    size: 110,
    hand: 'marker',
    tool: 'red',
    rot: 7,
    speed: 2,
    at: down.t + 0.3,
  });
  page.write('down the street.', {
    x: 150,
    y: 120,
    size: 26,
    hand: 'scrawl',
    tool: 'pencil',
    rot: -2,
    appear: 'bloom',
    at: street.t,
  });
  page.tape(820, 470, 70, 20, -18, { at: street.t + 0.2 });

  sfx.at(0.05, 'scribble');
  sfx.at(down.t, 'marker-squeak');
  sfx.at(street.t, 'pencil-scratch');
  return { page };
}

export function update(t, s) {
  s.page.update(t);
}
