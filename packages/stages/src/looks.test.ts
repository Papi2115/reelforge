import { defineLook, listLooks, LOOKS, voxelLook, type Look } from '@reelforge/kit';
import {
  lookIdSchema,
  TRANSITION_STYLE_LIST,
  TRANSITION_STYLES,
  treatmentSchema,
  type StoryboardShot,
} from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import {
  availableTransitionStyles,
  CRITIC_LOOK_RULES,
  criticLookVars,
  lookLine,
  sceneLookVars,
  storyboardLookOptions,
  storyboardLookVars,
  transitionLine,
} from './looks.js';

const SHOT: StoryboardShot = {
  id: 's01',
  t0: 0,
  t1: 4,
  treatment: 'ui-mockup',
  intent: 'A login window.',
  scene: 'scenes/s01.js',
};

/** A test-only second look (stands for the 2.0 looks). */
const testLook: Look = defineLook({
  ...voxelLook,
  id: 'test-look',
  label: 'Test look',
  description: 'a look that exists only in tests',
  rolls: ['B'],
  treatments: ['ui-mockup'],
  docs: 'Build with test things.',
  kit: {},
});

describe('look mode plumbing', () => {
  it('gives voxel-only projects nothing (prompts and checks as before looks)', () => {
    expect(storyboardLookVars('voxel-only')).toEqual({});
    expect(storyboardLookOptions('voxel-only')).toEqual({});
    expect(sceneLookVars('voxel-only', { ...SHOT, look: 'test-look' })).toEqual({});
  });

  it('lists the available looks for a mixed storyboard', () => {
    const available = listLooks();
    // The 2.0 looks first, in order; the 2.3 looks (each adds itself) after them.
    expect(available.slice(0, 4).map((look) => look.id)).toEqual([
      'voxel',
      'retro-ui',
      'diorama',
      'blueprint',
    ]);
    expect(available.map((look) => look.id)).toContain('flat-2d');
    expect(storyboardLookVars('mixed')).toEqual({
      looks: available.map(lookLine).join('\n'),
      multiLook: true,
      transitions: TRANSITION_STYLE_LIST.map(transitionLine).join('\n'),
    });
    expect(storyboardLookOptions('mixed')).toEqual({
      lookMode: 'mixed',
      looks: available.map((look) => look.id),
    });
    expect(storyboardLookVars('mixed', [voxelLook])).toEqual({
      looks: lookLine(voxelLook),
      singleLook: true,
    });
    const two = storyboardLookVars('mixed', [voxelLook, testLook]);
    expect(two).toMatchObject({ multiLook: true });
    expect(String(two['looks']).split('\n')).toEqual([lookLine(voxelLook), lookLine(testLook)]);
    expect(lookLine(testLook)).toBe(
      '- `test-look` (Test look): a look that exists only in tests. Rolls: B. Treatments: ui-mockup.',
    );
  });

  it('lists the transition styles the available looks can use', () => {
    expect(transitionLine(TRANSITION_STYLES['crt-zoom'])).toBe(
      '- `crt-zoom` (glitch, 0.5–0.8 s; look changes only: * -> retro-ui, retro-ui -> *): zoom into the screen centre, the tube powers off to a line, the new shot powers on.',
    );
    expect(transitionLine(TRANSITION_STYLES.iris)).toBe(
      '- `iris` (wipe, 0.3–0.7 s): a stair-stepped pixel circle opens from the centre with a bright rim.',
    );
    const ids = availableTransitionStyles([voxelLook, testLook]).map((style) => style.id);
    expect(ids).toContain('pixel-sort-melt');
    expect(ids).not.toContain('crt-zoom');
    expect(ids).not.toContain('tile-flip');
    expect(ids).not.toContain('draw-over');
    expect(storyboardLookVars('mixed', [voxelLook])).not.toHaveProperty('transitions');
  });

  it("hands the scene build the shot's look docs; unknown looks build as voxel", () => {
    expect(sceneLookVars('mixed', SHOT)).toEqual({ lookId: 'voxel', lookDocs: voxelLook.docs });
    expect(sceneLookVars('mixed', { ...SHOT, look: 'test-look' }, [voxelLook, testLook])).toEqual({
      lookId: 'test-look',
      lookDocs: 'Build with test things.',
    });
    const retroUi = LOOKS.find((look) => look.id === 'retro-ui');
    expect(sceneLookVars('mixed', { ...SHOT, look: 'retro-ui' })).toEqual({
      lookId: 'retro-ui',
      lookDocs: retroUi?.docs,
    });
    expect(sceneLookVars('mixed', { ...SHOT, look: 'retro-ui' }, [voxelLook])).toEqual({
      lookId: 'voxel',
      lookDocs: voxelLook.docs,
    });
    expect(sceneLookVars('mixed', { ...SHOT, look: 'test-look' })).toEqual({
      lookId: 'voxel',
      lookDocs: voxelLook.docs,
    });
  });

  it("hands the critic the shot's look, roll and look rules (none in voxel-only)", () => {
    expect(criticLookVars('voxel-only', { ...SHOT, look: 'retro-ui', roll: 'B' })).toEqual({});
    expect(criticLookVars('mixed', { ...SHOT, look: 'retro-ui', roll: 'B' })).toEqual({
      lookId: 'retro-ui',
      roll: 'B',
      lookRules: CRITIC_LOOK_RULES['retro-ui'],
    });
    expect(criticLookVars('mixed', SHOT)).toEqual({
      lookId: 'voxel',
      lookRules: CRITIC_LOOK_RULES['voxel'],
    });
    expect(criticLookVars('mixed', { ...SHOT, look: 'test-look' }, [voxelLook, testLook])).toEqual({
      lookId: 'test-look',
      lookRules: 'Test look: a look that exists only in tests.',
    });
    for (const look of listLooks()) expect(CRITIC_LOOK_RULES[look.id], look.id).toBeDefined();
  });

  it('keeps every look module in line with the storyboard schema', () => {
    for (const look of LOOKS) {
      expect(lookIdSchema.safeParse(look.id).success, look.id).toBe(true);
      for (const treatment of look.treatments) {
        expect(treatmentSchema.safeParse(treatment).success, `${look.id}: ${treatment}`).toBe(true);
      }
    }
  });
});
