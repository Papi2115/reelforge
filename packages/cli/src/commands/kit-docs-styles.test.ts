/**
 * kit-docs per style (PLAN.md#13.1): the project's style decides which world looks the index and
 * the slices list; for every built-in style the text is exactly as before worlds.
 */
import { defineLook, defineProp, kitCatalog, LOOKS, voxelLook, type Look } from '@reelforge/kit';
import type { LookMode } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { formatCatalog } from './kit-docs-index.js';
import { describeKitName } from './kit-docs.js';

const BUILT_IN_STYLES = ['voxel-pixel-crisp640', 'noir-voxel', 'soft-480'] as const;
const MODES: readonly LookMode[] = ['voxel-only', 'mixed'];

const worldPage = defineProp({
  name: 'worldPage',
  description: 'A page of the test world.',
  params: z.object({}),
  build: (_params, tools) => tools.voxel.mesh(tools.voxel.box([1, 1, 1], 'hero')),
});

/** A world look (test only): offered in the `test-world` style only. */
const worldLook: Look = defineLook({
  ...voxelLook,
  id: 'test-world-page',
  label: 'Test world page',
  description: 'a page of the test world',
  docs: 'Build with kit.props.worldPage.',
  styles: ['test-world'],
  kit: { templates: [worldPage] },
});
const WITH_WORLD = [...LOOKS, worldLook];

describe('kit-docs per style', () => {
  it.each(BUILT_IN_STYLES)('%s: index and slices are byte-identical to the 2.x text', (style) => {
    const before = kitCatalog();
    const after = kitCatalog([], WITH_WORLD, { style });
    for (const lookMode of MODES) {
      expect(formatCatalog(after, { lookMode })).toBe(formatCatalog(before, { lookMode }));
      for (const name of ['templates', 'props', 'retro-ui']) {
        expect(describeKitName(after, name, { lookMode })).toBe(
          describeKitName(before, name, { lookMode }),
        );
      }
    }
  });

  it('lists the world look and its templates only in its style', () => {
    const catalog = kitCatalog([], WITH_WORLD, { style: 'test-world' });
    expect(formatCatalog(catalog, { lookMode: 'mixed' })).toContain('worldPage');
    expect(describeKitName(catalog, 'test-world-page', { lookMode: 'mixed' })).toContain(
      'kit.props.worldPage',
    );
    const elsewhere = kitCatalog([], WITH_WORLD, { style: 'noir-voxel' });
    expect(formatCatalog(elsewhere, { lookMode: 'mixed' })).not.toContain('worldPage');
    expect(() => describeKitName(elsewhere, 'test-world-page')).toThrow(/no kit function/);
  });
});
