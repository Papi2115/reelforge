/**
 * Grim Ink (`c-cam`) in the stages (PLAN.md#14.12): offered with Experimental worlds only, its
 * project may turn looks off (project.json `worldLooks`): the storyboard then offers, letters and
 * checks only the looks in use, and a scene of a look that is off builds in the first look in use.
 * Other worlds ignore the field.
 */
import { LOOKS } from '@reelforge/kit';
import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { sceneLookVars, storyboardLookOptions, storyboardLookVars } from './looks.js';
import { paletteForShot } from './sound/palettes/index.js';
import {
  activeWorld,
  lookSetup,
  storyboardWorldOptions,
  storyboardWorldPromptVars,
} from './worlds.js';

const ON = { experimental: true };
const INK = ['ink-scene', 'ink-insert', 'ink-poster'];

function shot(look: string): StoryboardShot {
  return {
    id: 's01',
    t0: 0,
    t1: 4,
    treatment: 'character-scene',
    intent: 'x',
    scene: 's.js',
    look,
  };
}

const ids = (looks: readonly { id: string }[]): string[] => looks.map((look) => look.id);

describe('Grim Ink is wired behind Experimental worlds', () => {
  it('is active only with the switch on, with its three looks lettered A, B, C', () => {
    expect(activeWorld('c-cam')).toBeUndefined();
    expect(lookSetup({ style: 'c-cam' }).looks).toEqual([]);
    const setup = lookSetup({ style: 'c-cam' }, ON);
    expect(setup.world?.id).toBe('c-cam');
    expect(setup.lookMode).toBe('mixed');
    expect(ids(setup.looks)).toEqual(INK);
    expect(setup.looks.map((look) => look.rolls)).toEqual([['A'], ['B'], ['C']]);
    const vars = storyboardWorldPromptVars(setup, 120);
    expect(vars['world']).toBe('Grim Ink');
    expect(vars['worldFirstLook']).toBe('ink-scene');
    expect(storyboardWorldOptions(setup).worldVariety?.moments.map((m) => m.id)).toContain(
      'insert',
    );
  });

  it('sounds in its own palette', () => {
    for (const look of INK) {
      expect(paletteForShot(shot(look), { style: 'c-cam', looks: LOOKS }).id).toBe('c-cam');
    }
  });
});

describe('looks of this world (project.json worldLooks)', () => {
  it('changes nothing with every look on', () => {
    const plain = lookSetup({ style: 'c-cam' }, ON);
    const all = lookSetup({ style: 'c-cam', worldLooks: [...INK] }, ON);
    expect(all.looks).toEqual(plain.looks);
    expect(storyboardWorldPromptVars(all, 120)).toEqual(storyboardWorldPromptVars(plain, 120));
    expect(storyboardWorldOptions(all)).toEqual(storyboardWorldOptions(plain));
  });

  it('offers, letters and checks only the looks in use', () => {
    const setup = lookSetup({ style: 'c-cam', worldLooks: ['ink-poster', 'ink-scene'] }, ON);
    expect(ids(setup.looks)).toEqual(['ink-scene', 'ink-poster']);
    expect(setup.looks.map((look) => look.rolls)).toEqual([['A'], ['B']]);
    const looks = storyboardLookVars('mixed', setup.looks, 120, true)['looks'];
    expect(looks).toMatch(/`ink-poster` \(Ink poster\): .*Rolls: B\./u);
    expect(looks).not.toMatch(/ink-insert/u);
    expect(storyboardLookOptions('mixed', setup.looks)).toEqual({
      lookMode: 'mixed',
      looks: ['ink-scene', 'ink-poster'],
    });
    const vars = storyboardWorldPromptVars(setup, 120);
    expect(vars['worldRolls']).toMatch(/Turned off in this project .*`ink-insert`/u);
    expect(vars['worldMoments']).not.toMatch(/`insert`/u);
    const moments = storyboardWorldOptions(setup).worldVariety?.moments.map((m) => m.id) ?? [];
    expect(moments).not.toContain('insert');
    expect(moments).toEqual(expect.arrayContaining(['reverse', 'poster']));
  });

  it('builds a shot of a look that is off in the first look in use', () => {
    const setup = lookSetup({ style: 'c-cam', worldLooks: ['ink-insert'] }, ON);
    expect(setup.looks.map((look) => [look.id, look.rolls])).toEqual([['ink-insert', ['A']]]);
    expect(sceneLookVars('mixed', shot('ink-scene'), setup.looks)['lookId']).toBe('ink-insert');
    expect(storyboardWorldPromptVars(setup, 120)['worldFirstLook']).toBe('ink-insert');
  });

  it('is ignored by worlds whose looks are not optional', () => {
    const plain = lookSetup({ style: 'comic' }, ON);
    const chosen = lookSetup({ style: 'comic', worldLooks: ['comic-story'] }, ON);
    expect(chosen.looks).toEqual(plain.looks);
    expect(storyboardWorldPromptVars(chosen, 120)).toEqual(storyboardWorldPromptVars(plain, 120));
    const voxel = lookSetup({ style: 'voxel-pixel-crisp640', worldLooks: ['voxel'] }, ON);
    expect(voxel.looks.length).toBeGreaterThan(1);
  });
});
