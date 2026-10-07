// Game B2 look B (rpg-menu), breakthrough: a tally against par (a different mechanism from b4:
// the room keeps living behind the plate, a percent, the plate melts away). The deadline as an
// end-of-level card over the office: the programmer keeps typing behind the smoked glass; TIME
// ticks to ~5 WEEKS, a typical PAR of ~26 weeks under the rule, then the share of par it got
// counts to 19%; the stamp says RUSHED and the card melts down into the office.
// Focal: the 19% counting (BULB), then the RUSHED stamp (the only accent).
// Traces: the uneven tick cadence, the hand-ruled line above PAR, the coffee ring, the stamp's
// ghost impression and smudge, the worker's uneven typing behind the glass.
// Facts: ~5 weeks (the E.T. schedule) is certain; a typical 2600 schedule of ~6 months is EST.
// Scene contract: no imports; build() sets everything up once, update(t) only repaints.
export const meta = {
  id: 'gb5',
  title: 'RPG menu: a tally against par',
  treatment: 'counter/odometer',
};

export function build(ctx) {
  const size = [ctx.shot.width, ctx.shot.height];
  const view = ctx.kit.fx.b2View({
    size,
    level: 'office',
    duration: ctx.shot.duration,
    seed: 1982,
    path: [
      { at: 0, x: 15.2, y: 7.6, yaw: -50, ease: 'lin' },
      { at: 7, x: 15.4, y: 7.4, yaw: -53, ease: 'sine' },
    ],
  });
  ctx.scene.add(view);

  const hud = ctx.kit.fx.b2Hud({ size, view, duration: ctx.shot.duration, seed: 1982 });
  const tally = hud.tally({
    intent: 'five weeks against a usual six months: the game got a fifth of the time it needed',
    at: 0,
    until: 7,
    title: 'THE DEADLINE',
    sub: '1982',
    rows: [
      { label: 'TIME', value: 5, format: 'unit', unit: ['WEEK', 'WEEKS'], approx: true },
      {
        label: 'PAR',
        value: 26,
        format: 'unit',
        unit: ['WEEK', 'WEEKS'],
        approx: true,
        est: true,
        role: 'par',
      },
      { label: 'OF PAR', value: 19, format: 'percent', underline: true },
    ],
    stamp: { text: 'RUSHED' },
    backdrop: 'live',
    enter: 'cut',
    exit: 'melt',
  });
  for (const cue of tally.cues) ctx.sfx.at(cue.t, cue.name);
  hud.narrate('THE PROGRAMMER GETS\nABOUT FIVE WEEKS.', { at: 0.5, until: 3.4 });
  ctx.scene.add(hud);
  return { view, hud };
}

export function update(t, state) {
  state.view.update(t);
  state.hud.update(t);
}
