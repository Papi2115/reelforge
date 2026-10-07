/** kit-docs of a world's own assets (PLAN.md#13.15 phase 2): the one-liners, the topic, slices. */
import { kitCatalog, LOOKS } from '@reelforge/kit';
import { describe, expect, it } from 'vitest';
import { describeKitName } from './kit-docs.js';
import { describeWorldAssets, kitDocsScope, projectAssetsSection } from './kit-docs-world.js';

describe('kit-docs world assets', () => {
  it('gives each world its one line that loads ctx.worldAssets, nothing outside a world', () => {
    expect(projectAssetsSection('sketchbook').join('\n')).toContain('library: ctx.worldAssets');
    expect(projectAssetsSection('comic').join('\n')).toContain('page.art.load(ctx.worldAssets)');
    expect(projectAssetsSection('game-b2').join('\n')).toContain('assets: ctx.worldAssets');
    expect(projectAssetsSection('game-b1').join('\n')).toContain('screen.assets(ctx.worldAssets)');
    expect(projectAssetsSection('voxel-pixel-crisp640')).toEqual([]);
  });

  it('lists the format and the project ids in kit-docs world-assets', () => {
    const text = describeWorldAssets('comic', { characters: ['ranger'], props: [] });
    expect(text).toContain('assets/comic/<name>.json');
    expect(text).toContain('this project: characters: ranger');
    expect(describeWorldAssets('noir-voxel', undefined)).toContain('only world projects');
  });

  it("adds the section to a world look's slice only", () => {
    const world = kitCatalog([], LOOKS, kitDocsScope('comic', true));
    const comic = describeKitName(world, 'comic-story', { lookMode: 'mixed' });
    expect(comic).toContain('Project assets');
    expect(comic).toContain('page.art.load(ctx.worldAssets)');
    const voxel = describeKitName(kitCatalog([], LOOKS, {}), 'voxel', { lookMode: 'mixed' });
    expect(voxel).not.toContain('Project assets');
    const topic = describeKitName(world, 'world-assets', { style: 'game-b1' });
    expect(topic).toContain('world assets of game-b1');
  });
});
