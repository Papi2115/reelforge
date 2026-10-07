// Game B1 look C (atari-boss), template: continue? (showcase game-hud-b1-boss-v2 shot 10 head).
// Game over? Not quite. The picture goes black, THE LANDFILL card stays burned into the tube,
// CONTINUE? types in the score kernel and a gold digit counts down 9, 8, 7 with unequal holds;
// then a new grey cartridge drops in from above, drawn in FINER pixels than everything else (a
// new generation), lands with a squash and a shake, NES types under it, and Dad's old sticky note
// comes back on the glass: QUALITY CONTROL, ticked.
// Focal: the countdown digit, then the new cartridge, then the tick.
// Traces: the burned-in card; unequal countdown holds with a tick squash; the cartridge's squash,
// flash and decaying shake on landing; the note's two-stroke tick.
// Facts: 1985, the NES brings home games back with strict quality control.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-c3',
  title: 'Atari boss: continue?',
  treatment: 'kinetic-text',
};

const LAND = 3.08;

/** The new cartridge, front view, in square pixels: label above, grip grooves below. */
function nesCart(g, x, y, squash = 1) {
  const s = 1.35;
  const top = y + 100 * s * (1 - squash);
  const q = (rx, ry, rw, rh, c) =>
    g.rectPx(Math.round(x + rx * s), Math.round(top + ry * s * squash), Math.round(rw * s),
      Math.max(1, Math.round(rh * s * squash)), c); // prettier-ignore
  q(0, 0, 88, 100, 'grey');
  q(0, 0, 88, 1, 'cream');
  q(86, 0, 2, 100, 'greyDark');
  q(0, 99, 88, 1, 'greyDark');
  q(0, 0, 7, 8, 'void');
  q(81, 0, 7, 8, 'void');
  q(9, 6, 70, 46, 'cream');
  q(11, 8, 66, 30, 'blue');
  q(11, 30, 66, 8, 'avocado');
  q(54, 12, 8, 8, 'gold');
  q(18, 22, 6, 8, 'orange');
  q(17, 20, 8, 3, 'walnut');
  q(11, 41, 40, 5, 'walnut');
  for (let i = 0; i < 8; i += 1) q(5, 58 + i * 5, 78, 2, 'greyDark');
}

function picture(g, t) {
  const { ease, lerp, seg, shake, typed } = g.util;
  if (t < LAND) {
    // the countdown is the game-over overlay; the cartridge drops through it
    if (t >= 2.85) nesCart(g, 410, Math.round(lerp(-150, 112, ease.in(seg(t, 2.85, 3.06)))));
    return;
  }
  g.rect(0, 0, 160, 180, 'void');
  g.score('CONTINUE?', 16, 75, { colour: 'tube', cell: [6, 5] }); // burned in
  const sh = shake(t, LAND, 4, 10, 808);
  nesCart(g, 410 + sh.x, 112 + sh.y, t < LAND + 0.07 ? 0.86 : 1);
  g.rectPx(396, 250, 150, 2, 'greyDark');
  const n = typed('NES', t, 3.3, 89, 10);
  if (n > 0) g.text('NES'.slice(0, n), 102.5, 131, { colour: 'cream' });
  if (t < LAND + 0.04) g.remap('flash');
}

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 73,
  });
  screen.tv(picture);
  // the boss that won: defeated long ago, it lives on only as the burn-in behind CONTINUE?
  screen.boss({
    num: 3,
    name: 'THE LANDFILL',
    from: 'top',
    x: 40,
    y: 56,
    at: -30,
    seed: 73,
    hp: { n: 10, segW: 11 },
    defeat: -29,
  });
  const over = screen.gameOver({
    text: 'CONTINUE?',
    at: 0,
    until: LAND,
    count: [
      [0.3, 9],
      [1.2, 8],
      [2.0, 7],
    ],
  });
  for (const cue of over.cues) ctx.sfx.at(cue.t, cue.name);
  screen.note(['QUALITY CONTROL'], {
    at: 3.62,
    x: 196,
    y: 252,
    w: 230,
    h: 46,
    angle: -0.05,
    seed: 88,
    tick: 3.95,
  });
  screen.year('1983', { at: -1 });
  screen.year('1985', { at: 3.0 });
  screen.progress({ from: 0.9, to: 1, slots: 10 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
