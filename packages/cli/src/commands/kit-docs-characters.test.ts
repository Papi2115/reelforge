import { CAST, castListing, kitCatalog, MASCOTS, validateRoleSpec } from '@reelforge/kit';
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

  it('shows an example role spec that validates', () => {
    const text = describeKitName(catalog, 'characters');
    const example = /^example: kit\.cast\.role\((\{.*\}), \{/m.exec(text)?.[1];
    expect(example).toBeDefined();
    expect(validateRoleSpec(JSON.parse(example ?? '{}'))).toMatchObject({ ok: true });
  });
});
