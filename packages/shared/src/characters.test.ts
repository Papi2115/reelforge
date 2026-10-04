import { describe, expect, it } from 'vitest';
import {
  MASCOT_PROFILES,
  projectCharacters,
  projectFileSchema,
  projectMascot,
  shotMascot,
  storyboardFileSchema,
} from './index.js';

const PROJECT = {
  version: 1,
  title: 'Doom on a calculator',
  language: 'en',
  style: 'voxel-pixel-crisp640',
  fps: 30,
  seed: 2115,
};

const SHOT = {
  id: 's01',
  t0: 0,
  t1: 4,
  treatment: 'data-chart-3d',
  intent: 'Sales rise.',
  scene: 'scenes/s01.js',
};

describe('project characters (PLAN.md#12.20)', () => {
  it('reads a project without the fields as classic without a mascot', () => {
    const legacy = projectFileSchema.parse(PROJECT);
    expect(legacy).not.toHaveProperty('characters');
    expect(legacy).not.toHaveProperty('mascot');
    expect(projectCharacters(legacy)).toBe('classic');
    expect(projectMascot(legacy)).toBe('none');
  });

  it('puts the mascot in effect only with the pack', () => {
    const pack = projectFileSchema.parse({ ...PROJECT, characters: 'pack', mascot: 'fox' });
    expect(projectMascot(pack)).toBe('fox');
    const classic = projectFileSchema.parse({ ...PROJECT, characters: 'classic', mascot: 'fox' });
    expect(projectMascot(classic)).toBe('none');
    expect(projectFileSchema.safeParse({ ...PROJECT, mascot: 'cat' }).success).toBe(false);
    expect(projectFileSchema.safeParse({ ...PROJECT, characters: 'new' }).success).toBe(false);
  });

  it('has a profile for every mascot', () => {
    expect(Object.keys(MASCOT_PROFILES)).toEqual(['bulb', 'screen', 'fox', 'bean']);
  });
});

describe('storyboard mascot and new roles', () => {
  it('keeps storyboards without them unchanged', () => {
    const parsed = storyboardFileSchema.parse({ version: 1, shots: [SHOT] });
    expect(parsed).toEqual({ version: 1, shots: [SHOT] });
  });

  it('parses shot.mascot and newRoles and resolves the mascot', () => {
    const mascot = { role: 'pointer', action: 'points at the 2007 bar' } as const;
    const parsed = storyboardFileSchema.parse({
      version: 1,
      shots: [{ ...SHOT, mascot }],
      newRoles: [{ id: 'firefighter', description: 'helmet, turnout coat, axe' }],
    });
    const shot = parsed.shots[0];
    if (shot === undefined) throw new Error('no shot');
    expect(shotMascot(shot, 'bean')).toEqual({ id: 'bean', ...mascot });
    expect(shotMascot(shot, 'none')).toBeUndefined();
    expect(shotMascot({}, 'bean')).toBeUndefined();
    expect(parsed.newRoles?.[0]?.id).toBe('firefighter');
  });

  it('refuses unknown roles, long actions and bad role ids', () => {
    const bad = (extra: Record<string, unknown>, file: Record<string, unknown> = {}): boolean =>
      storyboardFileSchema.safeParse({ version: 1, shots: [{ ...SHOT, ...extra }], ...file })
        .success;
    expect(bad({ mascot: { role: 'doctor', action: 'x' } })).toBe(false);
    expect(bad({ mascot: { role: 'pointer', action: 'x'.repeat(121) } })).toBe(false);
    expect(bad({}, { newRoles: [{ id: 'Fire Fighter', description: 'x' }] })).toBe(false);
    expect(bad({}, { newRoles: [{ id: 'fire-fighter', description: '' }] })).toBe(false);
  });
});
