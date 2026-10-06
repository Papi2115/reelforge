/** kit-docs of a world project (PLAN.md#13.6): always mixed, experimental looks behind the env. */
import { kitCatalog, LOOKS } from '@reelforge/kit';
import { describe, expect, it } from 'vitest';
import { formatCatalog } from './kit-docs-index.js';
import {
  EXPERIMENTAL_WORLDS_ENV,
  experimentalWorldsEnabled,
  kitDocsLookMode,
  kitDocsScope,
} from './kit-docs-world.js';

describe('kit-docs in a world project', () => {
  it('mixes the looks of a world style whatever project.json says', () => {
    expect(kitDocsLookMode({ style: 'sketchbook', lookMode: 'voxel-only' })).toBe('mixed');
    expect(kitDocsLookMode({ style: 'noir-voxel', lookMode: 'voxel-only' })).toBe('voxel-only');
    expect(kitDocsLookMode({ style: 'noir-voxel' })).toBe('voxel-only');
  });

  it('reads the experimental switch from the environment', () => {
    expect(experimentalWorldsEnabled({})).toBe(false);
    expect(experimentalWorldsEnabled({ [EXPERIMENTAL_WORLDS_ENV]: '1' })).toBe(true);
    expect(experimentalWorldsEnabled({ [EXPERIMENTAL_WORLDS_ENV]: 'TRUE' })).toBe(true);
    expect(experimentalWorldsEnabled({ [EXPERIMENTAL_WORLDS_ENV]: '0' })).toBe(false);
  });

  it('lists the sketchbook page only with experimental worlds on, never the voxel kit', () => {
    const on = formatCatalog(kitCatalog([], LOOKS, kitDocsScope('sketchbook', true)), {
      lookMode: 'mixed',
    });
    expect(on).toContain('sketchPage');
    expect(on).not.toContain('kit.voxel:');
    const off = formatCatalog(kitCatalog([], LOOKS, kitDocsScope('sketchbook', false)), {
      lookMode: 'mixed',
    });
    expect(off).not.toContain('sketchPage');
    expect(kitDocsScope('noir-voxel', true)).toEqual({ style: 'noir-voxel', experimental: true });
    const builtIn = kitCatalog([], LOOKS, kitDocsScope('noir-voxel', true));
    expect(formatCatalog(builtIn, { lookMode: 'mixed' })).toBe(
      formatCatalog(kitCatalog(), { lookMode: 'mixed' }),
    );
  });
});
