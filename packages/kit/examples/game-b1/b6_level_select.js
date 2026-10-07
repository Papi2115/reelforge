// Game B1 look B (atari-menu), template: the level-select map (showcase game-hud-b1-boss-v2, the
// cut from the hook back to Christmas 1982). The story jumps back in time: the map of its places,
// joined by hand-placed dotted paths; the cartridge cursor hops back from ALAMOGORDO 83 past
// STORES 83 (a breath there) to XMAS 82, which blinks gold as it lands. The place the story has
// not reached is a locked '?'.
// Focal: the cursor, then XMAS 82 blinking gold.
// Traces: dots unevenly spaced and a unit off here and there; nodes pop in at uneven times; hops
// of uneven length and duration with a squash on take-off and landing; the blink's uneven holds.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-b6',
  title: 'Atari menu: level select',
  treatment: 'map',
};

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 82,
  });
  const map = screen.levelSelect({
    intent: 'the story goes back a year, from the burial to the Christmas it all started',
    at: 0,
    until: 3.6,
    nodes: [
      { label: 'XMAS 82', icon: 'home', x: 24, y: 118 },
      { label: 'STORES 83', icon: 'store', x: 62, y: 80, above: true },
      { label: 'ALAMOGORDO 83', icon: 'pit', x: 104, y: 124 },
      { icon: 'lock', x: 136, y: 70, above: true },
    ],
    route: { from: 2, to: 0, at: 0.28, dur: 2.2 },
  });
  for (const cue of map.cues) ctx.sfx.at(cue.t, cue.name);
  screen.year('1983', { at: -1 });
  screen.year('1982', { at: 2.5 });
  screen.progress({ from: 0.1, to: 0.15, slots: 10 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
