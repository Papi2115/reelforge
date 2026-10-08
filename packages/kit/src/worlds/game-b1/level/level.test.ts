/**
 * The B1 level toolkit (PLAN.md#13.15 B1 rework) without a GPU: readable errors that say what to
 * change (a hero that never moves, a pit walked into, a ledge run off, overlapping jumps, a level
 * of scenery only), events derived from the geometry (collect, hit unless jumped, stomp from
 * above, goal), the coarse scroll in whole blocks, and every frame a pure function of t.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ScreenModel } from '../screen/model.js';
import { playToolkits } from '../screen/play-toolkits.js';
import { cameraX, heroAt } from './level-motion.js';
import { levelSchema, planLevel, type LevelInput } from './level-plan.js';

const at = (when: number | string): number => Number(when);

function setup() {
  const model = new ScreenModel(5, 6, 2);
  model.vocab.defineSprite('hero', { rows: ['.##.', '####', '.##.', '#..#'], colours: 'cream', rowH: 3 });
  model.vocab.defineSprite('coin', { rows: ['.##.', '####', '.##.'], colours: 'gold' });
  model.vocab.defineSprite('spike', { rows: ['..#.', '.###', '####'], colours: 'crimson', rowH: 2 });
  model.vocab.defineSprite('flag', { rows: ['##..', '###.', '#...', '#...'], colours: 'gold', rowH: 3 });
  return { model, kit: playToolkits(model, at, 6) };
} // prettier-ignore

const LEVEL: LevelInput = {
  intent: 'the run to the flag past one spike and a coin',
  at: 0,
  until: 6,
  width: 320,
  hero: {
    sprite: 'hero',
    run: [
      [0, 10],
      [4, 272],
    ],
  },
  things: [
    { sprite: 'coin', x: 60, role: 'item', label: 'COIN' },
    { sprite: 'spike', x: 120, role: 'obstacle' },
    { sprite: 'flag', x: 270, role: 'goal' },
  ],
};

const plan = (spec: LevelInput, model = setup().model) =>
  planLevel(levelSchema.parse(spec), at, 6, (id) => model.vocab.sprite(id));

describe('level()', () => {
  it('names what to change', () => {
    const { kit } = setup();
    expect(() => kit.level({ ...LEVEL, intent: undefined })).toThrow(/intent/);
    expect(() => kit.level({ ...LEVEL, hero: { sprite: 'hero', run: [[0, 10], [4, 12]] } })).toThrow(
      /must move/,
    );
    expect(() => kit.level({ ...LEVEL, ground: { pits: [[100, 112]] } })).toThrow(/walks into the pit.*add a jump/);
    expect(() =>
      kit.level({ ...LEVEL, things: [{ sprite: 'coin', x: 40, role: 'scenery' }, { sprite: 'flag', x: 270, role: 'goal' }] }),
    ).toThrow(/at least 2 items, obstacles, enemies or a goal/);
    expect(() =>
      kit.level({ ...LEVEL, hero: { ...LEVEL.hero, jumps: [{ at: 1, dur: 0.8 }, { at: 1.5 }] } }),
    ).toThrow(/starts before/);
    expect(() =>
      kit.level({ ...LEVEL, platforms: [{ x: 40, y: 120, w: 20 }], hero: { ...LEVEL.hero, jumps: [{ at: 0.5, onto: 0 }] } }),
    ).toThrow(/runs off its ledge/);
    expect(() => kit.level({ ...LEVEL, hero: { ...LEVEL.hero, sprite: 'dragon' } })).toThrow(/dragon/);
  }); // prettier-ignore

  it('derives the events from the geometry: collect, hit unless jumped, goal', () => {
    const walked = plan(LEVEL);
    expect(walked.events.map((event) => event.kind)).toEqual(['collect', 'hit', 'goal']);
    const jumped = plan({ ...LEVEL, hero: { ...LEVEL.hero, jumps: [{ at: 1.4, dur: 0.7, height: 30 }] } });
    expect(jumped.events.map((event) => event.kind)).toEqual(['collect', 'jump', 'goal']);
    const { kit } = setup();
    const r = kit.level(LEVEL);
    expect(r.cues.map((cue) => cue.name)).toEqual(['coin', 'hit', 'success']);
  }); // prettier-ignore

  it('stomps an enemy landed on from above', () => {
    const spec: LevelInput = {
      ...LEVEL,
      hero: {
        sprite: 'hero',
        run: [
          [0, 10],
          [3, 160],
        ],
        jumps: [{ at: 1.4, dur: 0.8, height: 30 }],
      },
      things: [
        { sprite: 'spike', x: 118, role: 'enemy' },
        { sprite: 'flag', x: 200, role: 'goal' },
      ],
    };
    expect(plan(spec).events.some((event) => event.kind === 'stomp')).toBe(true);
  });

  it('scrolls in whole blocks and keeps the hero left of centre', () => {
    const p = plan(LEVEL);
    for (const t of [0, 1.1, 2.3, 3.7]) {
      const cam = cameraX(p.width, true, heroAt(p, t));
      expect(cam % 4).toBe(0);
      expect(cam).toBeLessThanOrEqual(p.width - 160);
    }
    expect(cameraX(p.width, true, heroAt(p, 3.9))).toBeGreaterThan(0);
  });

  it('paints a pure function of t', () => {
    const one = setup();
    one.kit.level(LEVEL);
    const two = setup();
    two.kit.level(LEVEL);
    const hash = (m: ScreenModel, t: number) =>
      createHash('sha256').update(m.render(t)).digest('hex');
    const times = [0.4, 1.9, 3.3, 5.1];
    const forward = times.map((t) => hash(one.model, t));
    expect(
      [...times]
        .reverse()
        .map((t) => hash(two.model, t))
        .reverse(),
    ).toEqual(forward);
    expect(new Set(forward).size).toBe(times.length);
  });
});
