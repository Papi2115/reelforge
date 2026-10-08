/**
 * A quest log opens with its content (real run Game B2 2: a log with no DONE lines sat empty for
 * 1.7 s before its title typed): with nothing done the title types at once; with DONE lines it
 * still waits for their ticks.
 */
import { describe, expect, it } from 'vitest';
import { C } from '../palette.js';
import { createMenu, menuSchema } from './menu.js';
import { HudModel } from './model.js';

function paperAt(done: string[], t: number): number {
  const spec = menuSchema.parse({
    at: 0,
    until: 4,
    quest: { now: 'THE HARVEST', objective: 'BRING IT IN.', done, ahead: 1 },
  });
  const model = new HudModel(3, 4);
  model.menu(createMenu(spec, 0, 4, [], 3));
  return [...model.draw(t, undefined, undefined).d].filter((c) => c === C.PAPER).length;
}

describe('quest log opening', () => {
  it('types the title at once when nothing is done yet', () => {
    expect(paperAt([], 0.9)).toBeGreaterThan(paperAt(['SPRING · THE SEED'], 0.9) + 100);
  });

  it('keeps the wait for the DONE ticks when there are some', () => {
    expect(paperAt(['SPRING · THE SEED'], 1.2)).toBe(paperAt(['SPRING · THE SEED'], 0.5));
    expect(paperAt(['SPRING · THE SEED'], 2.2)).toBeGreaterThan(
      paperAt(['SPRING · THE SEED'], 1.2),
    );
  });
});
