/**
 * World projects in the stages (PLAN.md#13.6): the experimental flag, the forced look mode, the
 * world's transitions, prompt variables, kit names, sound palette and critic craft check, and
 * nothing at all for the built-in styles.
 */
import { listLooks, WORLDS } from '@reelforge/kit';
import { WORLD_PROMPTS } from '@reelforge/prompts';
import { WORLD_PROJECT_DEFAULTS } from '@reelforge/project';
import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { storyboardLookVars } from './looks.js';
import { craftVerdicts } from './scenes/critic.js';
import { kitNamesFromCatalog } from './scenes/tools.js';
import { paletteForShot } from './sound/palettes/index.js';
import {
  activeWorld,
  assignWorldTransitions,
  criticWorldPromptVars,
  effectiveLookMode,
  fixWorldPromptVars,
  lookSetup,
  sceneWorldPromptVars,
  storyboardWorldOptions,
  storyboardWorldPromptVars,
  worldTransitionOptions,
} from './worlds.js';

const BUILT_IN_STYLES = ['voxel-pixel-crisp640', 'noir-voxel', 'soft-480'] as const;
const ON = { experimental: true };

function shot(id: string, extra: Partial<StoryboardShot> = {}): StoryboardShot {
  return {
    id,
    t0: 0,
    t1: 3,
    treatment: 'title-card',
    intent: 'x',
    scene: `scenes/${id}.js`,
    ...extra,
  };
}

describe('world registry wiring', () => {
  it('has project defaults and prompt wording for every world', () => {
    for (const world of WORLDS) {
      expect(Object.keys(WORLD_PROJECT_DEFAULTS)).toContain(world.id);
      expect(Object.keys(WORLD_PROMPTS)).toContain(world.id);
    }
  });

  it('offers an experimental world only with the flag', () => {
    expect(activeWorld('sketchbook')).toBeUndefined();
    expect(activeWorld('sketchbook', ON)?.id).toBe('sketchbook');
    expect(lookSetup({ style: 'sketchbook', lookMode: 'voxel-only' }).looks).toEqual([]);
    const setup = lookSetup({ style: 'sketchbook', lookMode: 'voxel-only' }, ON);
    expect(setup.lookMode).toBe('mixed');
    expect(setup.looks.map((look) => look.id)).toEqual([
      'sketch-story',
      'sketch-graph',
      'sketch-loud',
    ]);
  });

  it('changes nothing for the built-in styles, flag or not', () => {
    for (const style of BUILT_IN_STYLES) {
      for (const scope of [{}, ON]) {
        const setup = lookSetup({ style, lookMode: 'voxel-only' }, scope);
        expect(setup).toEqual({ lookMode: 'voxel-only', looks: listLooks(), world: undefined });
        expect(storyboardWorldPromptVars(setup)).toEqual({});
        expect(storyboardWorldOptions(setup)).toEqual({});
      }
      expect(effectiveLookMode({ style, lookMode: 'mixed' })).toBe('mixed');
      expect(sceneWorldPromptVars(undefined)).toEqual({});
      expect(fixWorldPromptVars(undefined, shot('s01'), listLooks())).toEqual({});
      expect(criticWorldPromptVars(undefined)).toEqual({});
      expect(paletteForShot(shot('s01'), { lookMode: 'mixed', style }).id).toBe('voxel');
      expect(kitNamesFromCatalog({ style })).toEqual(kitNamesFromCatalog());
    }
  });
});

describe('sketchbook project', () => {
  const setup = lookSetup({ style: 'sketchbook' }, ON);

  it('lists the page-native transitions and leaves out the transition kit', () => {
    expect(worldTransitionOptions(setup.world).map((option) => option.id)).toEqual([
      'sketchbook-page-flip',
      'sketchbook-riffle',
      'sketchbook-crumple-toss',
      'sketchbook-tape-peel',
      'sketchbook-torn-strip',
    ]);
    const vars = storyboardLookVars('mixed', setup.looks, 60, true);
    expect(vars).toMatchObject({ multiLook: true, maxTransitions: '3' });
    expect(vars).not.toHaveProperty('transitions');
    expect(vars).not.toHaveProperty('wowTransitions');
    expect(storyboardWorldPromptVars(setup)).toMatchObject({
      world: 'Sketchbook',
      worldFirstLook: 'sketch-story',
    });
    expect(storyboardWorldOptions(setup).worldTransitions).toHaveLength(5);
  });

  it('fills page-native styles deterministically, never the same twice in a row', () => {
    const options = worldTransitionOptions(setup.world);
    const shots = [
      shot('s01'),
      shot('s02', { transitionIn: { type: 'crossfade', duration: 0.4 } }),
      shot('s03', { transitionIn: { type: 'wipe', duration: 0.8 } }),
      shot('s04', { transitionIn: { type: 'wipe', duration: 0.8, style: 'sketchbook-riffle' } }),
      shot('s05', { transitionIn: { type: 'cut' } }),
      shot('s06', {
        transitionIn: { type: 'crossfade', duration: 0.6, style: 'continuity-shared-object' },
      }),
    ];
    const first = assignWorldTransitions(shots, options, 7);
    expect(assignWorldTransitions(shots, options, 7)).toEqual(first);
    expect(first.changed).toEqual(['s02', 's03']);
    const styles = first.shots.map((entry) =>
      entry.transitionIn?.type === 'cut' ? undefined : entry.transitionIn?.style,
    );
    expect(styles[1]).toMatch(/^sketchbook-/);
    expect(styles[2]).not.toBe(styles[1]);
    expect(first.shots[1]?.transitionIn).toMatchObject({ type: 'wipe' });
    expect(first.shots.slice(3)).toEqual(shots.slice(3));
  });

  it('builds with the world names and sounds in the world palette', () => {
    const names = kitNamesFromCatalog({ style: 'sketchbook', experimental: true });
    expect(names.fx.has('sketchPage')).toBe(true);
    expect(names.props.has('desk')).toBe(false);
    const options = { lookMode: 'mixed' as const, style: 'sketchbook' };
    expect(paletteForShot(shot('s01'), options).id).toBe('sketchbook');
    expect(paletteForShot(shot('s01', { look: 'sketch-loud' }), options).id).toBe('sketchbook');
    expect(paletteForShot(shot('s01', { look: 'retro-ui' }), options).id).toBe('sketchbook');
  });

  it('gives the prompts the world wording and fails an ok frame without craft', () => {
    expect(sceneWorldPromptVars(setup.world)).toHaveProperty('craftBrief');
    expect(
      fixWorldPromptVars(setup.world, shot('s01', { look: 'sketch-graph' }), setup.looks),
    ).toMatchObject({ lookId: 'sketch-graph' });
    expect(fixWorldPromptVars(setup.world, shot('s01'), setup.looks)).toMatchObject({
      lookId: 'sketch-story',
    });
    expect(criticWorldPromptVars(setup.world)).toHaveProperty('worldChecklist');
    expect(
      craftVerdicts([
        { verdict: 'ok', note: 'focal: red 1582; traces: tape, smudge, crossed-out 21' },
        { verdict: 'ok', note: 'looks right' },
        { verdict: 'clipped', note: 'title cut' },
      ]).map((entry) => entry.verdict),
    ).toEqual(['ok', 'off-intent', 'clipped']);
  });
});
