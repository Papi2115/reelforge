// Game B1 breakthrough (PLAN.md#13.15 B1 rework), example 4: the SPLIT TIMER. An expedition's
// climb as a speedrun in days: the timer spins up and lands on each camp's day on its word.
// Narration: "Base camp on day one. Camp two by day nine. The summit on day twenty-three, four days
// faster than the year before."
// Focal: the big day counter landing gold. Traces: rows printing unevenly, the timer easing into
// each value, the delta arriving a beat after its split, the climber crossing the bottom.
export const meta = {
  id: 'gb1-p4',
  title: 'Breakthrough: splits',
  treatment: 'ui-mockup',
};

const ASSETS = {
  version: 1,
  world: 'game-b1',
  describe: 'An expedition',
  generated: {
    climber: { kind: 'person', role: 'ranger', hat: 'hood', tool: 'pick' },
  },
}; // prettier-ignore

export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({
    size: [ctx.shot.width, ctx.shot.height],
    duration: ctx.shot.duration,
    seed: 23,
  });
  screen.assets(ASSETS);
  const r = screen.splits({
    intent: 'the climb in days: base camp, camp two, the summit four days faster than before',
    at: 0,
    until: 6,
    unit: 'DAYS',
    splits: [
      { name: 'BASE CAMP', value: 1, at: 1.2 },
      { name: 'CAMP TWO', value: 9, at: 2.6 },
      { name: 'SUMMIT', value: 23, at: 4.1, delta: -4 },
    ],
    runner: 'climber',
  }); // prettier-ignore
  for (const c of r.cues) ctx.sfx.at(c.t, c.name);
  ctx.scene.add(screen);
  return { screen };
}

export function update(t, state) {
  state.screen.update(t);
}
