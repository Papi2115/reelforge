import { defineLook, LOOKS, voxelLook, type Look } from '@reelforge/kit';
import { lookIdSchema, treatmentSchema, type StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { lookLine, sceneLookVars, storyboardLookOptions, storyboardLookVars } from './looks.js';

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

  it('lists the available looks for a mixed storyboard (voxel alone today)', () => {
    expect(storyboardLookVars('mixed')).toEqual({ looks: lookLine(voxelLook), singleLook: true });
    expect(storyboardLookOptions('mixed')).toEqual({ lookMode: 'mixed', looks: ['voxel'] });
    const two = storyboardLookVars('mixed', [voxelLook, testLook]);
    expect(two).toMatchObject({ multiLook: true });
    expect(String(two['looks']).split('\n')).toEqual([lookLine(voxelLook), lookLine(testLook)]);
    expect(lookLine(testLook)).toBe(
      '- `test-look` (Test look): a look that exists only in tests. Rolls: B. Treatments: ui-mockup.',
    );
  });

  it("hands the scene build the shot's look docs; unknown looks build as voxel", () => {
    expect(sceneLookVars('mixed', SHOT)).toEqual({ lookId: 'voxel', lookDocs: voxelLook.docs });
    expect(sceneLookVars('mixed', { ...SHOT, look: 'test-look' }, [voxelLook, testLook])).toEqual({
      lookId: 'test-look',
      lookDocs: 'Build with test things.',
    });
    expect(sceneLookVars('mixed', { ...SHOT, look: 'retro-ui' })).toEqual({
      lookId: 'voxel',
      lookDocs: voxelLook.docs,
    });
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
