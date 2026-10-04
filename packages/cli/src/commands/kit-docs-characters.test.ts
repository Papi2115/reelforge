import {
  CAST,
  castListing,
  kitCatalog,
  loadProjectCast,
  MASCOTS,
  validateRoleSpec,
} from '@reelforge/kit';
import { describe, expect, it } from 'vitest';
import { CHARACTERS_INDEX_LINE } from './kit-docs-characters.js';
import { formatCatalog } from './kit-docs-index.js';
import { describeKitName } from './kit-docs.js';

const LIMIT = 28_000;

describe('kit-docs characters', () => {
  const catalog = kitCatalog();

  it('documents the whole pack under the Bash output limit', () => {
    const text = describeKitName(catalog, 'characters');
    expect(text.length).toBeLessThan(LIMIT);
    expect(text.split('\n')[0]).toMatch(/^kit\.cast — the character pack/);
    for (const id of [...MASCOTS, ...CAST]) expect(text).toContain(`  ${id} — `);
    for (const entry of castListing()) expect(text, entry.id).toContain(entry.id);
    expect(text).toContain('.walkTo([x, y, z]');
    expect(text).toContain('<= 4 colours');
  });

  it('answers the aliases and lists the pack in one index line in both look modes', () => {
    const text = describeKitName(catalog, 'characters');
    for (const alias of ['cast', 'kit.cast', 'kit.cast.mascot', 'mascot', 'role']) {
      expect(describeKitName(catalog, alias), alias).toBe(text);
    }
    for (const lookMode of ['voxel-only', 'mixed'] as const) {
      const index = formatCatalog(catalog, { lookMode }).split('\n');
      expect(index.filter((line) => line === CHARACTERS_INDEX_LINE)).toHaveLength(1);
    }
    expect(() => describeKitName(catalog, 'charactrs')).toThrow(/did you mean: characters/);
  });

  it('answers a character id with its call and the pack reference', () => {
    const text = describeKitName(catalog, 'characters');
    expect(describeKitName(catalog, 'doctor')).toBe(
      `doctor is a cast member: ctx.kit.cast.person('doctor'); the pack reference:\n${text}`,
    );
    expect(describeKitName(catalog, 'fox').split('\n')[0]).toBe(
      "fox is a mascot: ctx.kit.cast.mascot('fox'); the pack reference:",
    );
    const spec = {
      id: 'firefighter',
      label: 'Firefighter',
      top: { color: 'tan' },
      layers: ['turnoutCoat'],
      legs: { color: 'tan' },
      shoes: { style: 'boots', color: 'black' },
      held: 'axe',
    };
    const cast = loadProjectCast({
      roles: [
        {
          id: 'firefighter',
          file: 'characters/roles/firefighter.json',
          source: JSON.stringify(spec),
        },
      ],
      accessories: [],
    });
    expect(describeKitName(catalog, 'firefighter', { cast }).split('\n')[0]).toBe(
      "firefighter is a role of this project (characters/roles/firefighter.json): ctx.kit.cast.person('firefighter'); the pack reference:",
    );
    expect(() => describeKitName(catalog, 'firefighter')).toThrow(
      /characters \(mascots, cast, roles\): characters/,
    );
  });

  it('shows the staging and pointing notes', () => {
    const text = describeKitName(catalog, 'characters');
    expect(text).toContain('point raises the right arm along the way the body faces (+z)');
    expect(text).toContain('noir turns skin and outfits violet');
  });

  it('shows an example role spec that validates', () => {
    const text = describeKitName(catalog, 'characters');
    const example = /^example: kit\.cast\.role\((\{.*\}), \{/m.exec(text)?.[1];
    expect(example).toBeDefined();
    expect(validateRoleSpec(JSON.parse(example ?? '{}'))).toMatchObject({ ok: true });
  });
});
