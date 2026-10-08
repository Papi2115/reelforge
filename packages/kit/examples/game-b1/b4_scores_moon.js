// Game B1 look B (atari-menu), inspiration for the high-score table toolkit (a different
// mechanism from b1): the Moon race as a score board. Narration: "1957, Sputnik. 1961, Gagarin.
// In 1969 Apollo 11 takes the record. Press start: one more mission is still to come."
// Two records are already on the board (done rows, tan); this shot's fact slams in BELOW them in
// gold with a hard shake; the last row is locked (???, 1972). No grease pencil this time: the
// typed name and PRESS START carry it. The table cuts in (the shot opens on it).
// Focal: the gold 1969 in the middle of the board.
// Traces: done rows print at uneven times with flicker; a beat of silence on the empty slot; the
// slam squashes and shakes hard; the name types at an irregular cadence; one row a unit off the
// grid; PRESS START blinks at a machine's steady rate, burned in.
// Facts: Sputnik 1 (1957), Gagarin (1961), Apollo 11 (1969), Apollo 17 the last crewed landing (1972).
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-b4',
  title: 'Atari menu: the Moon race board',
  treatment: 'counter/odometer',
};

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 1969,
  });
  const board = screen.scoreTable({
    intent:
      'two firsts are already on the board; the landing takes the top record, one mission left',
    at: 0,
    until: 7,
    title: 'MOON RACE',
    rows: [
      { who: 'SPUTNIK', score: 1957 },
      { who: 'GAGARIN', score: 1961 },
      { who: 'APOLLO 11', score: 1969 },
      { score: 1972 },
    ],
    hero: 2,
    enter: 'cut',
    print: 0.35,
    slam: { at: 2.4, shake: 5 },
    initials: 'typed',
    prompt: { text: 'PRESS START', at: 4.6 },
  });
  for (const cue of board.cues) ctx.sfx.at(cue.t, cue.name);
  screen.year('1969', { at: 2.4 });
  screen.progress({ from: 0.5, to: 0.6, slots: 8 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
