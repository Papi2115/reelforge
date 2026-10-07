// Game B1 look A (atari-story), template: the cartridge comes out (showcase game-hud-b1-boss-v2
// shot 7 head). Inside the TV the game everybody got for Christmas, its pits; the camera pulls
// back out of the glass into the console close-up of the same room; Dad's hand comes down, grips
// the XMAS 82 cartridge, squeezes, pushes it down a hair and pulls it out; the TV rolls garbage
// and goes dark. "So the games came back."
// Focal: the cartridge with Dad's tape label leaving the slot.
// Traces: the anticipation squeeze and push-down before the pull; the knit sleeve; the tape torn
// off the roll at a slant; the garbage frame; the glow on the console top dying with the TV.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-a5',
  title: 'Atari story: the cartridge comes out',
  treatment: 'character-scene',
};

function pits(g, t) {
  const { hash } = g.util;
  g.bands(0, 160, [[0, 'tealDark'], [30, 'teal'], [118, 'avocado'], [124, 'oliveDark']]); // prettier-ignore
  for (const [x, w] of [[14, 22], [58, 30], [112, 26]]) {
    g.rect(x, 128, w, 30, 'void');
    g.rect(x - 2, 126, w + 4, 2, 'oliveDark');
  } // prettier-ignore
  // a small figure walks along the edge in uneven steps (one colour per row)
  const step = Math.floor(t * 5);
  const x = 40 + step * 2 + (hash(5, step, 1) > 0.7 ? 1 : 0);
  g.sprite(['.##.', '####', '####', '.##.', '#..#'], ['orange', 'orange', 'tan', 'tan', 'walnut'], x % 150, 116, { rowH: 2, flicker: false });
} // prettier-ignore

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 7,
  });
  screen.tv(pits);
  const swap = screen.cartridge({
    intent: 'the Christmas cartridge goes back: the games came back to the stores',
    action: 'pull',
    at: 0.6,
    label: 'XMAS 82',
    enter: 'pull-back',
    hold: 1.2,
  });
  for (const cue of swap.cues) ctx.sfx.at(cue.t, cue.name);
  screen.year('1983', { at: -1 });
  screen.progress({ from: 0.6, to: 0.7, slots: 10 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
