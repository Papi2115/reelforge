// Game B1 look A (atari-story), template 2: Christmas 1982 (showcase game-hud-b1-boss-v2 shot 2).
// The living room around the TV: panelling, shag, the 2600 idling in attract mode, the tree. Under
// the tree a gap: a dashed outline is pencilled in where the gift should be, Dad's tag drops into
// it and swings to rest ("E.T. / XMAS 82"); the outline blinks. Then the camera pushes in on the
// wall calendar (December, the 25th ringed): the next shot's boss stands where it lands.
// Focal: the missing gift, the dashed gap + Dad's tag, lower right.
// Traces: uneven planks and grain; bulbs blinking on their own cadences; an unclosed pen ring on
// the 25th; a thumbprint on the TV glass; the hand-drawn joystick cable; the tag swings to rest;
// asymmetric rabbit ears. A still moment (5.4-7.0 s: only the bulbs and the attract mode move).
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb2',
  title: 'Atari story: Christmas 1982',
  treatment: 'character-scene',
};

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 1982,
  });
  // No tv() painter: the idle console shows its attract mode.
  screen.room({
    calendar: { month: 'DEC', mark: 25 },
    tree: true,
    gift: { slot: [2.3, 3.2], tag: ['E.T.', 'XMAS 82'], tagAt: [3.45, 4.15], blink: 4.3 },
  });
  // Hold on the room, then push in on the calendar (the match cut into the boss).
  screen.camera([
    { at: 7.1, on: 'room' },
    { at: 8.0, on: 'calendar', ease: 'inOut' },
  ]);
  // The story just jumped back a year: the old 1983 is still burned into the glass.
  screen.year('1983', { at: -1 });
  screen.year('1982', { at: -0.65 });
  screen.progress({ from: 0.1, to: 0.2, slots: 10 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
