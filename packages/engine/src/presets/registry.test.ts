/**
 * Style registry (PLAN.md#13.1): world styles register next to the built-in presets, experimental
 * ones resolve without being listed, and the built-in list stays exactly as it was.
 */
import { describe, expect, it } from 'vitest';
import {
  TEST_WORLD,
  TEST_WORLD_ID,
  TEST_WORLD_STYLE,
} from '../../../kit/src/testing/test-world.js';
import { WORLDS } from '../../../kit/src/worlds/index.js';
import { buildPaletteLut, hexToRgb, lutLookup } from '../palette.js';
import { resolveStyle } from '../style.js';
import {
  BUILT_IN_STYLE_PRESETS,
  createStyleRegistry,
  renderStyleProblem,
  STYLE_PRESET_IDS,
  STYLE_REGISTRY,
} from './index.js';

const BUILT_IN_IDS = ['voxel-pixel-crisp640', 'noir-voxel', 'soft-480'];
const WITH_TEST_WORLD = createStyleRegistry(BUILT_IN_STYLE_PRESETS, [TEST_WORLD]);

describe('style registry', () => {
  it('lists exactly the built-in styles while only experimental worlds ship', () => {
    expect(STYLE_PRESET_IDS).toEqual(BUILT_IN_IDS);
    expect(STYLE_REGISTRY.allIds).toEqual([...BUILT_IN_IDS, ...WORLDS.map((world) => world.id)]);
    for (const id of BUILT_IN_IDS) {
      expect(STYLE_REGISTRY.entry(id)?.world).toBeUndefined();
      expect(STYLE_REGISTRY.isExperimental(id)).toBe(false);
    }
    expect(STYLE_REGISTRY.isExperimental('sketchbook')).toBe(true);
    expect(STYLE_REGISTRY.isExperimental('comic')).toBe(true);
  });

  it('resolves the comic style palette-pure: every swatch maps to itself through the LUT', () => {
    const style = resolveStyle({ style: 'comic' });
    expect([style.width, style.height]).toEqual([640, 360]);
    const swatches = Object.values(STYLE_REGISTRY.find('comic')?.palette ?? {});
    expect(swatches).toHaveLength(22);
    const lut = buildPaletteLut(swatches.map(hexToRgb));
    swatches.forEach((hex, index) => {
      expect(lutLookup(lut, hexToRgb(hex)), hex).toBe(index);
    });
    expect(renderStyleProblem(STYLE_REGISTRY, 'comic', false)).toMatch(/--experimental/);
    expect(renderStyleProblem(STYLE_REGISTRY, 'comic', true)).toBeUndefined();
  });

  it('resolves the sketchbook style palette-pure: every swatch maps to itself through the LUT', () => {
    const style = resolveStyle({ style: 'sketchbook' });
    expect([style.width, style.height]).toEqual([960, 540]);
    const swatches = Object.values(STYLE_REGISTRY.find('sketchbook')?.palette ?? {});
    expect(swatches).toHaveLength(24);
    const lut = buildPaletteLut(swatches.map(hexToRgb));
    swatches.forEach((hex, index) => {
      expect(lutLookup(lut, hexToRgb(hex)), hex).toBe(index);
    });
    expect(renderStyleProblem(STYLE_REGISTRY, 'sketchbook', false)).toMatch(/--experimental/);
    expect(renderStyleProblem(STYLE_REGISTRY, 'sketchbook', true)).toBeUndefined();
  });

  it('registers a world style with its fonts, sound palette and looks', () => {
    expect(WITH_TEST_WORLD.ids).toEqual(BUILT_IN_IDS);
    expect(WITH_TEST_WORLD.allIds).toEqual([...BUILT_IN_IDS, TEST_WORLD_ID]);
    expect(WITH_TEST_WORLD.isExperimental(TEST_WORLD_ID)).toBe(true);
    expect(WITH_TEST_WORLD.entry(TEST_WORLD_ID)?.world).toEqual({
      label: 'Test world',
      experimental: true,
      fonts: { display: 'display', mono: 'mono' },
      soundPalette: 'test-world',
      looks: ['test-world-page'],
    });
    const preset = WITH_TEST_WORLD.find(TEST_WORLD_ID);
    expect(Object.keys(preset?.palette ?? {})).toHaveLength(16);
    expect(preset?.resolution).toEqual({ width: 640, height: 360 });
  });

  it('lists a world once it is no longer experimental', () => {
    const shipped = createStyleRegistry(BUILT_IN_STYLE_PRESETS, [
      { ...TEST_WORLD, experimental: false },
    ]);
    expect(shipped.ids).toEqual([...BUILT_IN_IDS, TEST_WORLD_ID]);
  });

  it('resolves the world style through the same path as the built-in ones', () => {
    const style = resolveStyle({ style: TEST_WORLD_ID }, WITH_TEST_WORLD);
    expect(style.id).toBe(TEST_WORLD_ID);
    expect([style.width, style.height]).toEqual([640, 360]);
    expect(style.palette.text).toBe(TEST_WORLD_STYLE.palette.paper);
    expect(style.post.outline).toBeUndefined();
    expect(() => resolveStyle({ style: TEST_WORLD_ID })).toThrow(
      /style "test-world" is unknown; available: voxel-pixel-crisp640, noir-voxel, soft-480/,
    );
  });

  it('keeps every built-in style resolving exactly as before', () => {
    for (const id of BUILT_IN_IDS) {
      expect(resolveStyle({ style: id }, WITH_TEST_WORLD)).toEqual(resolveStyle({ style: id }));
    }
  });

  it('rejects broken world styles and repeated ids', () => {
    const style = (overrides: Record<string, unknown>) => ({
      ...TEST_WORLD,
      style: { ...TEST_WORLD_STYLE, ...overrides },
    });
    expect(() => createStyleRegistry(BUILT_IN_STYLE_PRESETS, [style({ tokens: {} })])).toThrow(
      /invalid style of world "test-world": tokens/,
    );
    expect(() =>
      createStyleRegistry(BUILT_IN_STYLE_PRESETS, [
        { ...TEST_WORLD, fonts: { display: 'comic-hand', mono: 'mono' } },
      ]),
    ).toThrow(/fonts\.display "comic-hand" is not an engine font/);
    expect(() => createStyleRegistry(BUILT_IN_STYLE_PRESETS, [TEST_WORLD, TEST_WORLD])).toThrow(
      /style id "test-world" is registered twice/,
    );
    expect(() =>
      createStyleRegistry(BUILT_IN_STYLE_PRESETS, [
        { ...TEST_WORLD, id: 'noir-voxel', style: { ...TEST_WORLD_STYLE, id: 'noir-voxel' } },
      ]),
    ).toThrow(/style id "noir-voxel" is registered twice/);
  });

  it('lets only showcase renders use an experimental world style', () => {
    expect(renderStyleProblem(WITH_TEST_WORLD, 'noir-voxel', false)).toBeUndefined();
    expect(renderStyleProblem(WITH_TEST_WORLD, TEST_WORLD_ID, true)).toBeUndefined();
    expect(renderStyleProblem(WITH_TEST_WORLD, TEST_WORLD_ID, false)).toMatch(
      /experimental world; pass --experimental/,
    );
    expect(renderStyleProblem(WITH_TEST_WORLD, 'nope', false)).toBe(
      'unknown style "nope"; available: voxel-pixel-crisp640, noir-voxel, soft-480',
    );
    expect(renderStyleProblem(WITH_TEST_WORLD, 'nope', true)).toMatch(/soft-480, test-world$/);
  });
});
