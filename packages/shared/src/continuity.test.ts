import { describe, expect, it } from 'vitest';
import {
  applyContinuityTransitions,
  continuityBudget,
  continuityKindOf,
  continuityTransition,
  CONTINUITY_STYLE_IDS,
  CONTINUITY_STYLES,
  isContinuityStyle,
  plannedLinks,
  projectContinuityLinks,
} from './continuity.js';
import { storyboardFileSchema, storyboardShotSchema, type StoryboardShot } from './storyboard.js';
import { TRANSITION_STYLE_IDS } from './transitions.js';

function shot(id: string, t0: number, t1: number, extra: Partial<StoryboardShot> = {}) {
  return storyboardShotSchema.parse({
    id,
    t0,
    t1,
    treatment: 'metaphor-object',
    intent: `shot ${id}`,
    scene: `scenes/${id}.js`,
    ...extra,
  });
}

describe('continuity link schema', () => {
  it('accepts storyboards without links unchanged', () => {
    const file = { version: 1, shots: [shot('s01', 0, 4), shot('s02', 4, 8)] };
    expect(storyboardFileSchema.parse(file)).toEqual(file);
  });

  it('parses a link and rejects bad kinds and anchors', () => {
    const link = { kind: 'zoom-through', object: 'wall calendar', anchor: { x: 0.7, y: 0.3 } };
    expect(
      shot('s02', 4, 8, { continuity: link as StoryboardShot['continuity'] }).continuity,
    ).toEqual(link);
    const parse = (continuity: unknown) =>
      storyboardShotSchema.safeParse({ ...shot('s02', 4, 8), continuity }).success;
    expect(parse({ kind: 'teleport', object: 'x' })).toBe(false);
    expect(parse({ kind: 'shared-object', object: '' })).toBe(false);
    expect(parse({ kind: 'shared-object', object: 'map', anchor: { x: 1.2, y: 0 } })).toBe(false);
  });
});

describe('continuity styles', () => {
  it('has one style per kind, outside the transition kit ids', () => {
    expect(CONTINUITY_STYLE_IDS.map((id) => CONTINUITY_STYLES[id].kind)).toEqual([
      'zoom-through',
      'shared-object',
      'carry-environment',
    ]);
    for (const id of CONTINUITY_STYLE_IDS) {
      expect((TRANSITION_STYLE_IDS as readonly string[]).includes(id)).toBe(false);
      expect(isContinuityStyle(id)).toBe(true);
    }
    expect(isContinuityStyle('iris')).toBe(false);
    expect(isContinuityStyle(undefined)).toBe(false);
  });

  it('turns a link into its transition, capped at half the shot', () => {
    const link = { kind: 'zoom-through', object: 'calendar', anchor: { x: 0.7, y: 0.3 } } as const;
    expect(continuityTransition({ t0: 4, t1: 8 }, link)).toEqual({
      type: 'crossfade',
      duration: 1,
      style: 'continuity-zoom-through',
      focus: { x: 0.7, y: 0.3 },
    });
    const short = continuityTransition(
      { t0: 4, t1: 5.2 },
      { kind: 'shared-object', object: 'map' },
    );
    expect(short).toEqual({
      type: 'crossfade',
      duration: 0.6,
      style: 'continuity-shared-object',
      focus: { x: 0.5, y: 0.5 },
    });
    expect(continuityTransition({ t0: 0, t1: 1.1 }, link)).toMatchObject({ duration: 0.55 });
    expect(continuityKindOf(short)).toBe('shared-object');
    expect(continuityKindOf({ type: 'cut' })).toBeUndefined();
    expect(continuityKindOf({ type: 'wipe', duration: 1, style: 'iris' })).toBeUndefined();
  });

  it('writes linked transitions and leaves everything else as it was', () => {
    const plain = [shot('s01', 0, 4), shot('s02', 4, 8, { transitionIn: { type: 'cut' } })];
    const same = applyContinuityTransitions(plain);
    expect(same.changed).toEqual([]);
    expect(same.shots[0]).toBe(plain[0]);
    expect(same.shots[1]).toBe(plain[1]);

    const linked = [
      shot('s01', 0, 4),
      shot('s02', 4, 8, {
        transitionIn: { type: 'wipe', duration: 0.5, style: 'iris' },
        continuity: { kind: 'carry-environment', object: 'cartridge', anchor: { x: 0.4, y: 0.6 } },
      }),
    ];
    const applied = applyContinuityTransitions(linked);
    expect(applied.changed).toEqual(['s02']);
    expect(applied.shots[1]?.transitionIn).toEqual({
      type: 'crossfade',
      duration: 0.6,
      style: 'continuity-carry-environment',
      focus: { x: 0.4, y: 0.6 },
    });
    expect(applyContinuityTransitions(applied.shots).changed).toEqual([]);
  });

  it('never links into the first shot', () => {
    const first = shot('s01', 0, 4, { continuity: { kind: 'shared-object', object: 'map' } });
    expect(applyContinuityTransitions([first]).changed).toEqual([]);
    expect(plannedLinks([first])).toEqual([]);
  });

  it('lists planned links and whether their transition renders them', () => {
    const link = { kind: 'shared-object', object: 'map' } as const;
    const shots = [shot('s01', 0, 4), shot('s02', 4, 8, { continuity: link })];
    expect(plannedLinks(shots)).toEqual([
      { fromShotId: 's01', toShotId: 's02', link, wired: false },
    ]);
    expect(plannedLinks(applyContinuityTransitions(shots).shots)[0]?.wired).toBe(true);
  });

  it('budgets about one link per 45 s and reads the project switch', () => {
    expect(continuityBudget(30)).toBe(1);
    expect(continuityBudget(100)).toBe(2);
    expect(continuityBudget(480)).toBe(10);
    expect(projectContinuityLinks({})).toBe(false);
    expect(projectContinuityLinks({ continuityLinks: false })).toBe(false);
    expect(projectContinuityLinks({ continuityLinks: true })).toBe(true);
  });
});
