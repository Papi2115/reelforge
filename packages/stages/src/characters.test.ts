import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CAST, EXPRESSIONS, MASCOTS, POSES } from '@reelforge/kit';
import { MASCOT_EXPRESSIONS, MASCOT_POSES } from '@reelforge/prompts';
import { CAST_PERSON_IDS, MASCOT_IDS } from '@reelforge/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { builtRoleIds, loadCharacterSettings, storyboardCharacterOptions } from './characters.js';

const root = mkdtempSync(path.join(os.tmpdir(), 'rf characters ż '));
afterAll(() => {
  rmSync(root, { recursive: true, force: true, maxRetries: 5 });
});

describe('characters plumbing (PLAN.md#12.20)', () => {
  it('mirrors the kit: mascot and cast ids, poses and expressions', () => {
    expect([...MASCOT_IDS]).toEqual([...MASCOTS]);
    expect([...CAST_PERSON_IDS]).toEqual([...CAST]);
    expect([...MASCOT_POSES]).toEqual([...POSES]);
    // `auto` (what the pose suggests) is the default of the expression cue.
    expect([...MASCOT_EXPRESSIONS]).toEqual(['auto', ...EXPRESSIONS]);
  });

  it('lists the roles built for the project', async () => {
    const dir = path.join(root, 'roles');
    expect(await builtRoleIds(dir)).toEqual([]);
    mkdirSync(path.join(dir, 'characters', 'roles'), { recursive: true });
    for (const file of ['firefighter.json', 'policeOfficer.json', 'notes.txt', 'Bad Id.json']) {
      writeFileSync(path.join(dir, 'characters', 'roles', file), '{}');
    }
    expect(await builtRoleIds(dir)).toEqual(['firefighter', 'policeOfficer']);
    const pack = await loadCharacterSettings(dir, { characters: 'pack', mascot: 'bean' });
    expect(pack).toEqual({
      characters: 'pack',
      mascot: 'bean',
      builtRoles: ['firefighter', 'policeOfficer'],
    });
    expect(storyboardCharacterOptions(pack)).toEqual(pack);
  });

  it('reads a legacy project as classic without a mascot or roles', async () => {
    expect(await loadCharacterSettings(path.join(root, 'roles'), {})).toEqual({
      characters: 'classic',
      mascot: 'none',
      builtRoles: [],
    });
    expect(
      await loadCharacterSettings(root, { characters: 'classic', mascot: 'fox' }),
    ).toMatchObject({ mascot: 'none' });
  });
});
