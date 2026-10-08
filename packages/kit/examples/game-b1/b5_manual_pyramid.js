// Game B1 look B (atari-menu), inspiration for the manual toolkit (a different mechanism from
// b3): how a pyramid scheme pays. Narration: "Early members get paid. They are paid with new
// members' money. Each level needs more recruits. Then the recruits run out. So who pays? Most of
// the recruits lose." The page slides in over the living room; FIG. 1 is a pyramid of people with
// the one at the top printed in colour; Dad pencils WHO PAYS? in the margin and corrects the
// printed NEW to MOST in red.
// Focal: the red MOST on rule 5 (the top person in teal is the second read).
// Traces: the slide's peek, hold and overshoot with a cast shadow; the HUD turns paper ink where
// the page passes; the crooked feed and the off-register plate; uneven pencil ticks; the margin
// note; the crease, staples and coffee rings of a page that was used.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb1-b5',
  title: 'Atari menu: the manual of a pyramid scheme',
  treatment: 'ui-mockup',
};

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 4,
  });
  // The page slides in over the living room (the TV idles in attract mode).
  screen.room({ calendar: false, lamp: true, carts: 2 });
  const page = screen.manual({
    intent: 'a pyramid pays its top with the money of the levels below, so most members lose',
    at: 0.2,
    until: 8,
    steps: [
      'EARLY MEMBERS GET PAID.',
      "THEY ARE PAID WITH\nNEW MEMBERS' MONEY.",
      'EACH LEVEL NEEDS\nMORE RECRUITS.',
      'THE RECRUITS RUN OUT.',
      'SO NEW\nRECRUITS LOSE.',
    ],
    figure: {
      caption: 'THE PYRAMID',
      shape: 'person',
      layout: 'pile',
      count: 10,
      hit: 0,
      callouts: [
        { item: 0, step: 1 },
        { item: 8, step: 4 },
      ],
    },
    ticks: [1.5, 2.55, 3.7],
    note: { text: 'WHO PAYS?', at: 4.3 },
    correction: { step: 5, strike: 'NEW', write: 'MOST', at: 5.4 },
    enter: 'slide',
  });
  for (const cue of page.cues) ctx.sfx.at(cue.t, cue.name);
  screen.progress({ from: 0.4, to: 0.5, slots: 8 });
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
