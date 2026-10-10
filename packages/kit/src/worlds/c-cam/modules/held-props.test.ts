/**
 * Props a person holds (PLAN.md#14.18, real run Grim Ink 1: the editor's sword and cloth never
 * showed on his contact sheet and the cloth floated on his belly). A minimal person holding a
 * prop through `held(...)` and `arms(p)`, per the contract: the prop is on the sheet (the sheet
 * draws through the module's hooks with its default props) and it is drawn in its arm's own
 * layer, behind the torso when the arm swings behind the body, in front when it is the near arm.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RecordingPaint } from '../draw/recording-paint.js';
import { definePerson } from './person.js';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', '..', '..', 'examples', 'c-cam');
const SWORD = '#a5714a';

interface Ink {
  blob(pts: readonly number[], fill: string, o?: unknown): unknown;
}

async function swordsman(): Promise<ReturnType<typeof definePerson>> {
  const url = pathToFileURL(path.join(EXAMPLES, 'people', 'nightBaker.js')).href;
  const base = (await import(url)) as { person: Record<string, unknown> };
  return definePerson({
    ...base.person,
    id: 'swordsman',
    arms: (p: { sword?: boolean }) => (p.sword === false ? undefined : { L: { hand: 'grip' } }),
    held(_g: unknown, ink: Ink, side: string, palm: readonly number[], p: { sword?: boolean }) {
      if (side !== 'L' || p.sword === false) return;
      const [x = 0, y = 0] = palm;
      ink.blob([x - 8, y - 20, x + 8, y - 20, x + 6, y + 140, x - 6, y + 140], SWORD, { seed: 7 });
    },
  });
}

/** Index of the first fill of `colour` and of the apron (the torso) in the call list. */
function order(g: RecordingPaint, apron: string): { prop: number; torso: number } {
  const fills = g.calls.filter((call) => call.op === 'set:fillStyle').map((call) => call.args[0]);
  return { prop: fills.indexOf(SWORD), torso: fills.indexOf(apron) };
}

describe('held props', () => {
  it('shows the default props on the contact sheet', async () => {
    const person = await swordsman();
    const g = new RecordingPaint();
    person.sheet(g, 0);
    const fills = g.calls.filter((call) => call.op === 'set:fillStyle');
    // one sword per figure of the turnaround (6 views x 3 poses)
    expect(fills.filter((call) => call.args[0] === SWORD)).toHaveLength(18);
  });

  it('draws the prop in its arm layer: behind the torso when the arm is behind', async () => {
    const person = await swordsman();
    const apron = (person.character.tones as Record<string, string>)['apron'] ?? '';
    expect(apron).not.toBe('');
    const at = (view: number): { prop: number; torso: number } => {
      const g = new RecordingPaint();
      person.draw(g, undefined, { x: 900, y: 1000, s: 0.8, view, t: 1 });
      return order(g, apron);
    };
    // three-quarter facing right: the left arm is the far one (behind the body)
    const far = at(1);
    expect(far.prop).toBeGreaterThanOrEqual(0);
    expect(far.prop).toBeLessThan(far.torso);
    // mirrored: the left arm is the near one, drawn in front of the torso with its sword
    const near = at(-1);
    expect(near.prop).toBeGreaterThan(near.torso);
    const g = new RecordingPaint();
    person.draw(g, undefined, { view: 0, t: 1, props: { sword: false } });
    expect(order(g, apron).prop).toBe(-1);
  });
});
