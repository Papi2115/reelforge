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
import { CRITIC_LOOK_RULES, storyboardLookVars, styleLookScope } from './looks.js';
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
  scriptWorldPromptVars,
  storyboardWorldOptions,
  storyboardWorldPromptVars,
  worldMomentCameraHints,
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
  it('has project defaults and prompt wording for every wired world', () => {
    const wired = WORLDS.filter((world) => world.wired);
    expect(wired.map((world) => world.id)).toEqual(['sketchbook', 'comic', 'game-b2', 'game-b1']);
    for (const world of wired) {
      expect(Object.keys(WORLD_PROJECT_DEFAULTS)).toContain(world.id);
      expect(Object.keys(WORLD_PROMPTS)).toContain(world.id);
    }
  });

  it('never offers a world that is not wired yet, flag or not', () => {
    // Every registered world is wired today; an unwired copy of each is never active.
    expect(WORLDS.filter((world) => !world.wired)).toEqual([]);
    const unwired = WORLDS.map((world) => ({ ...world, wired: false }));
    for (const { id } of unwired) {
      for (const scope of [{}, ON]) {
        expect(activeWorld(id, scope, unwired)).toBeUndefined();
        expect(activeWorld(id, scope, [])).toBeUndefined();
      }
      expect(activeWorld(id, ON)?.id).toBe(id);
      expect(styleLookScope(id, ON)).toEqual({ style: id, experimental: true });
    }
    // A style no world registers is no world: no world prompts or options.
    const missing = lookSetup({ style: 'game-b9' }, ON);
    expect(missing.world).toBeUndefined();
    expect(storyboardWorldPromptVars(missing, 120)).toEqual({});
    expect(storyboardWorldOptions(missing)).toEqual({});
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
        expect(storyboardWorldPromptVars(setup, 120)).toEqual({});
        expect(storyboardWorldOptions(setup, { minBreakthroughs: 2 })).toEqual({});
      }
      expect(effectiveLookMode({ style, lookMode: 'mixed' })).toBe('mixed');
      expect(sceneWorldPromptVars(undefined)).toEqual({});
      expect(fixWorldPromptVars(undefined, shot('s01'), listLooks())).toEqual({});
      expect(criticWorldPromptVars(undefined)).toEqual({});
      expect(scriptWorldPromptVars(undefined)).toEqual({});
      expect(worldMomentCameraHints(undefined)).toBeUndefined();
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

  it("plans moments: the catalog and quota for the storyboard, the shot's moment for its turns", () => {
    expect(storyboardWorldPromptVars(setup)).not.toHaveProperty('worldMoments');
    const vars = storyboardWorldPromptVars(setup, 156);
    expect(vars['worldMoments']).toContain(
      '- `popup` (breakthrough; look `sketch-loud`; a shot of at least 4.5 s)',
    );
    expect(vars['worldMomentRules']).toContain('needs at least 2 and at most 5');
    const override = storyboardWorldPromptVars(setup, 50, { minBreakthroughs: 2 });
    expect(override['worldMomentRules']).toContain('needs at least 2 and at most 2');
    const options = storyboardWorldOptions(setup, { minBreakthroughs: 2 });
    expect(options.worldVariety?.moments.map((moment) => moment.id)).toContain('strip');
    expect(options.worldVariety?.override).toEqual({ minBreakthroughs: 2 });
    expect(storyboardWorldOptions(setup).worldVariety).not.toHaveProperty('override');
    const strip = shot('s07', { look: 'sketch-graph', worldMoment: 'strip' });
    expect(sceneWorldPromptVars(setup.world, strip)['worldMomentDirective']).toContain(
      'page.strip(',
    );
    expect(fixWorldPromptVars(setup.world, strip, setup.looks)['worldMoment']).toBe('strip');
    expect(criticWorldPromptVars(setup.world, strip)['worldMomentCheck']).toContain('accordion');
    expect(sceneWorldPromptVars(setup.world, shot('s01'))).not.toHaveProperty('worldMoment');
    expect(scriptWorldPromptVars(setup.world)['worldSurprise']).toContain('page moment');
    expect(worldMomentCameraHints(setup.world)?.['slow-motion']).not.toMatch(/orbit around/);
  });
});

describe('comic project', () => {
  const setup = lookSetup({ style: 'comic', lookMode: 'voxel-only' }, ON);

  it('is offered only with experimental worlds, in its own looks and transitions', () => {
    expect(activeWorld('comic')).toBeUndefined();
    expect(lookSetup({ style: 'comic' }).looks).toEqual([]);
    expect(setup.lookMode).toBe('mixed');
    expect(setup.looks.map((look) => look.id)).toEqual(['comic-story', 'comic-info', 'comic-loud']);
    expect(worldTransitionOptions(setup.world).map((option) => option.id)).toEqual([
      'comic-page-turn',
      'comic-page-back',
      'comic-gutter-wipe',
      'comic-panel-zoom',
      'comic-panel-slam',
      'comic-ink-bleed',
      'comic-page-slide',
      'comic-page-scroll',
      'comic-panel-push',
      'comic-gutter-collapse',
    ]);
    expect(storyboardWorldPromptVars(setup)).toMatchObject({
      world: 'Comic',
      worldFirstLook: 'comic-story',
    });
  });

  it('builds with the comic page, sounds in the comic palette, judges each look', () => {
    const names = kitNamesFromCatalog({ style: 'comic', experimental: true });
    expect(names.fx.has('comicPage')).toBe(true);
    expect(names.fx.has('sketchPage')).toBe(false);
    expect(names.props.has('desk')).toBe(false);
    const options = { lookMode: 'mixed' as const, style: 'comic' };
    expect(paletteForShot(shot('s01', { look: 'comic-loud' }), options).id).toBe('comic');
    expect(fixWorldPromptVars(setup.world, shot('s01'), setup.looks)).toMatchObject({
      lookId: 'comic-story',
    });
    for (const look of setup.looks) expect(CRITIC_LOOK_RULES[look.id], look.id).toBeDefined();
  });

  it('plans flashbacks and spreads and gives the shot its moment', () => {
    const vars = storyboardWorldPromptVars(setup, 120);
    expect(vars['worldMoments']).toContain('- `flashback` (breakthrough; look `comic-info`)');
    expect(vars['worldMomentRules']).toContain('Breakthroughs (`flashback`, `spread`)');
    const options = storyboardWorldOptions(setup, undefined, true);
    expect(options.worldVariety?.moments.map((moment) => moment.id)).toContain('spread');
    expect(options.worldVariety?.continuityLinks).toBe(true);
    const spread = shot('s09', { look: 'comic-loud', worldMoment: 'spread' });
    expect(sceneWorldPromptVars(setup.world, spread)['worldMomentDirective']).toContain(
      'page.spread(',
    );
    expect(criticWorldPromptVars(setup.world, spread)['worldMomentCheck']).toContain('spread:');
    expect(scriptWorldPromptVars(setup.world)['worldSurprise']).toContain('CLANG');
    expect(worldMomentCameraHints(setup.world)?.['slow-motion']).not.toMatch(/orbit around/);
  });
});

describe('game-b2 project', () => {
  const setup = lookSetup({ style: 'game-b2', lookMode: 'voxel-only' }, ON);

  it('is offered only with experimental worlds, in its own looks and transitions', () => {
    expect(activeWorld('game-b2')).toBeUndefined();
    expect(lookSetup({ style: 'game-b2' }).looks).toEqual([]);
    expect(setup.lookMode).toBe('mixed');
    expect(setup.looks.map((look) => look.id)).toEqual(['rpg-explore', 'rpg-menu', 'rpg-boss']);
    expect(worldTransitionOptions(setup.world).map((option) => option.id)).toEqual([
      'game-b2-melt',
      'game-b2-fog',
      'game-b2-darkness',
      'game-b2-door',
      'game-b2-level-card',
      'game-b2-map-unfold',
      'game-b2-map-fold',
    ]);
    expect(storyboardWorldPromptVars(setup)).toMatchObject({
      world: 'Game B2: first-person RPG',
      worldFirstLook: 'rpg-explore',
    });
  });

  it('builds with the view and the HUD, sounds in its palette, judges each look', () => {
    const names = kitNamesFromCatalog({ style: 'game-b2', experimental: true });
    expect(names.fx.has('b2View')).toBe(true);
    expect(names.fx.has('b2Hud')).toBe(true);
    expect(names.fx.has('comicPage')).toBe(false);
    expect(names.props.has('desk')).toBe(false);
    const options = { lookMode: 'mixed' as const, style: 'game-b2' };
    expect(paletteForShot(shot('s01', { look: 'rpg-boss' }), options).id).toBe('game-b2');
    expect(fixWorldPromptVars(setup.world, shot('s01'), setup.looks)).toMatchObject({
      lookId: 'rpg-explore',
    });
    for (const look of setup.looks) expect(CRITIC_LOOK_RULES[look.id], look.id).toBeDefined();
  });

  it('plans automaps and tallies and gives the shot its moment', () => {
    const vars = storyboardWorldPromptVars(setup, 120);
    expect(vars['worldMoments']).toContain('- `automap` (breakthrough; look `rpg-menu`)');
    expect(vars['worldMomentRules']).toContain('Breakthroughs (`automap`, `tally`)');
    const options = storyboardWorldOptions(setup, undefined, true);
    expect(options.worldVariety?.moments.map((moment) => moment.id)).toContain('tally');
    expect(options.worldVariety?.continuityLinks).toBe(true);
    const tally = shot('s08', { look: 'rpg-menu', worldMoment: 'tally' });
    expect(sceneWorldPromptVars(setup.world, tally)['worldMomentDirective']).toContain(
      'hud.tally(',
    );
    expect(sceneWorldPromptVars(setup.world, tally)['worldMissing']).toContain(
      'reelforge validate level',
    );
    expect(criticWorldPromptVars(setup.world, tally)['worldMomentCheck']).toContain('tally:');
    expect(scriptWorldPromptVars(setup.world)['worldSurprise']).toContain('a sudden game moment');
    expect(scriptWorldPromptVars(setup.world)['worldScript']).toContain(
      'ONE first-person game run',
    );
    expect(storyboardWorldPromptVars(setup)['worldRolls']).toContain('`## Game map` of `beats.md`');
    expect(worldMomentCameraHints(setup.world)?.['slow-motion']).not.toMatch(/orbit around/);
  });
});

describe('game-b1 project', () => {
  const setup = lookSetup({ style: 'game-b1', lookMode: 'voxel-only' }, ON);

  it('is offered only with experimental worlds, in its own looks and transitions', () => {
    expect(activeWorld('game-b1')).toBeUndefined();
    expect(lookSetup({ style: 'game-b1' }).looks).toEqual([]);
    expect(setup.lookMode).toBe('mixed');
    expect(setup.looks.map((look) => look.id)).toEqual(['atari-story', 'atari-menu', 'atari-boss']);
    const options = worldTransitionOptions(setup.world);
    expect(options.map((option) => [option.id, option.link])).toEqual([
      ['game-b1-calendar-zoom', 'zoom-through'],
      ['game-b1-cartridge-in', 'carry-environment'],
      ['game-b1-cartridge-out', 'carry-environment'],
      ['game-b1-attract-cycle', undefined],
      ['game-b1-scanline-wipe', undefined],
      ['game-b1-page-slide', undefined],
      ['game-b1-page-turn', undefined],
      ['game-b1-room-shake', undefined],
      ['game-b1-screen-flip', undefined],
    ]);
    expect(storyboardWorldPromptVars(setup)).toMatchObject({
      world: 'Game B1: Atari boss montage',
      worldFirstLook: 'atari-story',
    });
    expect(storyboardWorldPromptVars(setup)['worldTransitions']).toContain(
      '- `game-b1-calendar-zoom` (wipe, about 1.2 s; the `zoom-through` link)',
    );
  });

  it('builds with the screen, sounds in its palette, judges each look', () => {
    const names = kitNamesFromCatalog({ style: 'game-b1', experimental: true });
    expect(names.fx.has('b1Screen')).toBe(true);
    expect(names.fx.has('b2View')).toBe(false);
    expect(names.props.has('desk')).toBe(false);
    const options = { lookMode: 'mixed' as const, style: 'game-b1' };
    expect(paletteForShot(shot('s01', { look: 'atari-boss' }), options).id).toBe('game-b1');
    expect(fixWorldPromptVars(setup.world, shot('s01'), setup.looks)).toMatchObject({
      lookId: 'atari-story',
    });
    for (const look of setup.looks) expect(CRITIC_LOOK_RULES[look.id], look.id).toBeDefined();
  });

  it('plans score tables and manual pages and gives the shot its moment', () => {
    const vars = storyboardWorldPromptVars(setup, 120);
    expect(vars['worldMoments']).toContain('- `score-table` (breakthrough; look `atari-menu`)');
    expect(vars['worldMomentRules']).toContain(
      'Breakthroughs (`inventory`, `shop`, `splits`, `score-table`, `manual`)',
    );
    const options = storyboardWorldOptions(setup, undefined, true);
    expect(options.worldVariety?.moments.map((moment) => moment.id)).toContain('manual');
    expect(options.worldVariety?.transitions?.[0]?.link).toBe('zoom-through');
    const manual = shot('s08', { look: 'atari-menu', worldMoment: 'manual' });
    expect(sceneWorldPromptVars(setup.world, manual)['worldMomentDirective']).toContain(
      'screen.manual(',
    );
    expect(criticWorldPromptVars(setup.world, manual)['worldMomentCheck']).toContain('manual:');
    expect(scriptWorldPromptVars(setup.world)['worldSurprise']).toContain('attract mode');
    expect(scriptWorldPromptVars(setup.world)).not.toHaveProperty('worldScript');
    expect(worldMomentCameraHints(setup.world)?.['slow-motion']).not.toMatch(/orbit around/);
  });

  it('never fills a link transition into a shot without a link', () => {
    const options = worldTransitionOptions(setup.world);
    const shots = Array.from({ length: 40 }, (_, index) =>
      shot(`s${String(index + 1).padStart(2, '0')}`, {
        transitionIn: { type: 'wipe', duration: 0.8 },
      }),
    );
    const filled = assignWorldTransitions(shots, options, 1983).shots.slice(1);
    const styles = new Set(
      filled.map((entry) => (entry.transitionIn?.type === 'cut' ? '' : entry.transitionIn?.style)),
    );
    expect([...styles].sort()).toEqual([
      'game-b1-attract-cycle',
      'game-b1-page-slide',
      'game-b1-page-turn',
      'game-b1-room-shake',
      'game-b1-scanline-wipe',
      'game-b1-screen-flip',
    ]);
  });
});
