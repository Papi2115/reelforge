// Game B1 look B (atari-menu), breakthrough: the high-score table (showcase game-hud-b1-boss-v2
// shot 4). The deadline is beaten, the game is over: the console drops into attract mode and
// prints the story's facts as a score table ranked by the order of events, the score = the year.
// Only 1ST has happened (E.T, 1982); 2ND-4TH are locked ??? rows (1983, 1985, 2014).
// Focal: the gold 1982 (the biggest type, left third, the only gold).
// Traces: the attract screen redraws in uneven bursts; rows print at uneven times with 2600
// flicker, one row a unit off the grid; a beat of silence on the empty slot, then the slam with a
// squash and a decaying shake; the initials scroll in at an irregular cadence and blink; Dad's
// egg-shaped grease-pencil ring overshoots its start, BOOM! in his hand, his thumbprint; INSERT
// COIN blinks like a machine and is burned into the phosphor. Right half empty on purpose.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-b1',
  title: 'Atari menu: the high-score table',
  treatment: 'counter/odometer',
};

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 1982,
  });
  // What the TV showed before the table draws in: the idle console's attract colours.
  screen.tv((g) => {
    g.attract();
  });
  const table = screen.scoreTable({
    intent: 'only the boom year has happened: the crash, the revival and the dig are still locked',
    at: 0,
    until: 7.5,
    rows: [{ who: 'E.T', score: 1982 }, { score: 1983 }, { score: 1985 }, { score: 2014 }],
    hero: 0,
    print: 0.62,
    slam: { at: 2.78 },
    ring: { at: 3.95, note: 'BOOM!' },
    prompt: { text: 'INSERT COIN', at: 5.15 },
  });
  for (const cue of table.cues) ctx.sfx.at(cue.t, cue.name);
  screen.year('1982', { at: -1 });
  screen.progress({ from: 0.3, to: 0.4, slots: 10 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
