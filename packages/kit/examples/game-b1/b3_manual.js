// Game B1 look B (atari-menu), breakthrough: the instruction manual (showcase game-hud-b1-boss-v2
// shot 8). The manual from the returned box, opened flat: a cheap two-colour HOW TO PLAY page
// listing how a flood of copies kills a market. FIG. 1 is a bad-print shelf: the hit (the only
// cartridge with colour) and its look-alikes. Dad's pencil ticks follow the narrator; at step 5 his
// red pen strikes BAD, writes ANY and circles it. The page turns from its corner onto the
// level-select map, the cursor hops on to ALAMOGORDO 83.
// Focal: step 5, the red ANY (frame t = 0 is the complete spread, the title read first).
// Traces: the teal plate off-register; the sheet fed crooked; ink-gain type with a jumpy baseline;
// a starved-ink band through the halftone; crease, staples, two coffee rings, a thumbprint;
// uneven pencil ticks; the red correction; a silent beat before it.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-b3',
  title: 'Atari menu: the instruction manual',
  treatment: 'ui-mockup',
};

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 1983,
  });
  const page = screen.manual({
    intent: 'a flood of look-alikes teaches buyers to stop buying any game, not just the bad ones',
    at: 0,
    until: 8.2,
    steps: [
      'A HIT GAME SELLS.',
      'EVERYONE COPIES IT,\nFAST.',
      'SHELVES FILL WITH\nLOOK-ALIKES.',
      "BUYERS CAN'T TELL\nGOOD FROM BAD.",
      'SO THEY\nSTOP BUYING BAD GAMES.',
    ],
    figure: {
      caption: 'THE SHELF',
      shape: 'cartridge',
      layout: 'shelf',
      count: 7,
      hit: 6,
      callouts: [
        { item: 6, step: 1 },
        { item: 2, step: 2 },
      ],
    },
    ticks: [2.3, 2.95, 4.1, 5.05],
    correction: { step: 5, strike: 'BAD', write: 'ANY', at: 5.82 },
    enter: 'cut',
    exit: 'turn',
  });
  for (const cue of page.cues) ctx.sfx.at(cue.t, cue.name);
  // Under the page: the level-select map, revealed as the page turns.
  const map = screen.levelSelect({
    intent: 'the story moves on to the burial: from the stores to the Alamogordo landfill',
    at: 7.6,
    until: 8.5,
    nodes: [
      { label: 'XMAS 82', icon: 'home', x: 24, y: 118 },
      { label: 'STORES 83', icon: 'store', x: 62, y: 80, above: true },
      { label: 'ALAMOGORDO 83', icon: 'pit', x: 104, y: 124 },
      { icon: 'lock', x: 136, y: 70, above: true },
    ],
    route: { from: 1, to: 2, at: 7.78, dur: 0.66 },
  });
  for (const cue of map.cues) ctx.sfx.at(cue.t, cue.name);
  screen.year('1983', { at: -1 });
  screen.progress({ from: 0.7, to: 0.8, slots: 10 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
