/** kit-docs of a world project (PLAN.md#13.6): always mixed, experimental looks behind the env. */
import { kitCatalog, LOOKS, WORLDS } from '@reelforge/kit';
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

  it('never lists the looks of a world that is not wired yet, switch or not', () => {
    // Grim Ink (c-cam, PLAN.md#14.2) is registered but not wired yet.
    const unwired = WORLDS.filter((world) => !world.wired).map((world) => world.id);
    expect(unwired).toEqual(['c-cam']);
    for (const style of unwired) {
      expect(kitDocsScope(style, true)).toEqual({ style });
      expect(kitCatalog([], LOOKS, kitDocsScope(style, true)).looks).toEqual([]);
    }
  });

  it('lists the comic page and its three looks only with experimental worlds on', () => {
    const catalog = kitCatalog([], LOOKS, kitDocsScope('comic', true));
    expect(catalog.looks.map((look) => look.id)).toEqual([
      'comic-story',
      'comic-info',
      'comic-loud',
    ]);
    const on = formatCatalog(catalog, { lookMode: 'mixed' });
    expect(on).toContain('comicPage');
    expect(on).not.toContain('sketchPage');
    expect(on).not.toContain('kit.voxel:');
    expect(Buffer.byteLength(on, 'utf8')).toBeLessThan(28 * 1024);
    const off = formatCatalog(kitCatalog([], LOOKS, kitDocsScope('comic', false)), {
      lookMode: 'mixed',
    });
    expect(off).not.toContain('comicPage');
  });

  it('lists the game view, HUD and its three looks only with experimental worlds on', () => {
    const catalog = kitCatalog([], LOOKS, kitDocsScope('game-b2', true));
    expect(catalog.looks.map((look) => look.id)).toEqual(['rpg-explore', 'rpg-menu', 'rpg-boss']);
    const on = formatCatalog(catalog, { lookMode: 'mixed' });
    expect(on).toContain('b2View');
    expect(on).toContain('b2Hud');
    expect(on).not.toContain('comicPage');
    expect(on).not.toContain('kit.voxel:');
    expect(Buffer.byteLength(on, 'utf8')).toBeLessThan(28 * 1024);
    const off = formatCatalog(kitCatalog([], LOOKS, kitDocsScope('game-b2', false)), {
      lookMode: 'mixed',
    });
    expect(off).not.toContain('b2View');
  });

  it('lists the Atari screen and its three looks only with experimental worlds on', () => {
    const catalog = kitCatalog([], LOOKS, kitDocsScope('game-b1', true));
    expect(catalog.looks.map((look) => look.id)).toEqual([
      'atari-story',
      'atari-menu',
      'atari-boss',
    ]);
    const on = formatCatalog(catalog, { lookMode: 'mixed' });
    expect(on).toContain('b1Screen');
    expect(on).not.toContain('b2View');
    expect(on).not.toContain('kit.voxel:');
    expect(Buffer.byteLength(on, 'utf8')).toBeLessThan(28 * 1024);
    const off = formatCatalog(kitCatalog([], LOOKS, kitDocsScope('game-b1', false)), {
      lookMode: 'mixed',
    });
    expect(off).not.toContain('b1Screen');
  });
});
