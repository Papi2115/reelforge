import { describe, expect, it } from 'vitest';
import type { AssetImage } from '@reelforge/kit';
import { NO_ANCHORS } from '../anchors.js';
import type { SceneContext, SceneModule } from '../contract.js';
import { EngineError } from '../errors.js';
import { buildShot } from '../shot.js';
import { resolveStyle } from '../style.js';
import { createAssetLibrary, decodeBase64, NO_ASSETS, type AssetLibrary } from './library.js';
import { testCardManifestAsset } from './testing/test-card.js';

const style = resolveStyle({});
const settings = {
  colors: Object.values(style.swatches),
  lut: style.post.lut,
  ditherSize: style.post.dither.size,
};
const STILL = testCardManifestAsset('clip@2.5');
const library = createAssetLibrary(
  [testCardManifestAsset('test-card'), { ...STILL, mime: 'video/mp4', at: 2.5 }],
  settings,
);
const DEFAULT_STYLE = {
  crop: 'cover',
  contrast: true,
  dither: 0.5,
  colors: settings.colors,
} as const;

function errorOf(run: () => unknown): EngineError {
  try {
    run();
  } catch (error) {
    if (error instanceof EngineError) return error;
    throw error;
  }
  throw new Error('expected an EngineError');
}

describe('decodeBase64', () => {
  it('decodes like Buffer, padded or not', () => {
    const bytes = Uint8Array.from({ length: 50 }, (_, index) => (index * 37) % 256);
    for (const length of [0, 1, 2, 3, 49, 50]) {
      const text = Buffer.from(bytes.subarray(0, length)).toString('base64');
      expect([...decodeBase64(text)]).toEqual([...bytes.subarray(0, length)]);
      expect([...decodeBase64(text.replace(/=+$/, ''))]).toEqual([...bytes.subarray(0, length)]);
    }
  });
});

describe('asset library', () => {
  it('knows its refs, including video stills', () => {
    expect(library.refs).toEqual(['clip@2.5', 'test-card']);
    expect(library.has('test-card')).toBe(true);
    expect(library.has('nope')).toBe(false);
  });

  it('rejects unknown refs with the list of known ones', () => {
    const error = errorOf(() => library.image('nasa-x', DEFAULT_STYLE, 's01'));
    expect(error.code).toBe('asset-not-found');
    expect(error.message).toContain('known: clip@2.5, test-card');
    expect(error.shotId).toBe('s01');
    expect(errorOf(() => NO_ASSETS.image('a', DEFAULT_STYLE, 's01')).message).toContain(
      'known: none',
    );
  });

  it('stylizes to the palette without a post-fx LUT (full-colour style), like with one', () => {
    const fullColour = createAssetLibrary([testCardManifestAsset('test-card')], {
      ...settings,
      lut: undefined,
    });
    const expected = library.image('test-card', DEFAULT_STYLE, 's01').pixels(24, 16);
    const actual = fullColour.image('test-card', DEFAULT_STYLE, 's01').pixels(24, 16);
    expect(actual.colors).toEqual(expected.colors);
    expect([...actual.indices]).toEqual([...expected.indices]);
  });

  it('gives handles with a stable key and memoised, palette-pure pixels', () => {
    const first = library.image('test-card', DEFAULT_STYLE, 's01');
    const second = library.image('test-card', DEFAULT_STYLE, 's02');
    expect(first.key).toBe(second.key);
    expect(first.aspect).toBeCloseTo(4 / 3);
    const pixels = first.pixels(48, 32);
    expect(second.pixels(48, 32)).toBe(pixels);
    const allowed = new Set(settings.colors);
    expect(pixels.colors).toEqual(settings.colors);
    expect(pixels.rgba.length).toBe(48 * 32 * 4);
    for (let pixel = 0; pixel < 48 * 32; pixel += 1) {
      const [r, g, b, a] = pixels.rgba.subarray(pixel * 4, pixel * 4 + 4);
      const hex = `#${[r, g, b].map((value) => (value ?? 0).toString(16).padStart(2, '0')).join('')}`;
      expect(allowed.has(hex)).toBe(true);
      expect(a).toBe(255);
    }
    const other = library.image('test-card', { ...DEFAULT_STYLE, dither: 0 }, 's01');
    expect(other.key).not.toBe(first.key);
  });

  it('validates sizes, colours and crops of pixel requests', () => {
    const handle = library.image('test-card', DEFAULT_STYLE, 's01');
    expect(errorOf(() => handle.pixels(0, 10)).code).toBe('invalid-asset-options');
    expect(errorOf(() => handle.pixels(10, 10, { colors: ['red'] })).code).toBe(
      'invalid-asset-options',
    );
    const crop = { focus: [2, 0], zoom: 1 } as unknown as AssetImage['crop'];
    expect(errorOf(() => handle.pixels(10, 10, { crop })).code).toBe('invalid-asset-options');
    expect(new Set(handle.pixels(10, 10, { colors: ['#000000', '#ffffff'] }).indices)).toEqual(
      new Set([0, 1]),
    );
  });
});

function shotWith(build: (ctx: SceneContext) => unknown, assets: AssetLibrary | undefined) {
  const module: SceneModule = {
    meta: { id: 's01' },
    build,
    update: (_t, state, ctx) => {
      if (state === 'probe-update') ctx.assets.image('test-card');
    },
  };
  return buildShot({
    shot: { id: 's01', t0: 0, duration: 2, width: 640, height: 360, fps: 30 },
    module,
    projectSeed: 1,
    palette: style.palette,
    resolveAnchor: NO_ANCHORS,
    assets,
  });
}

describe('ctx.assets', () => {
  it('builds handles in build() with tones resolved against the palette', () => {
    let handle: AssetImage | undefined;
    shotWith((ctx) => {
      expect(ctx.assets.refs).toEqual(['clip@2.5', 'test-card']);
      handle = ctx.assets.image('test-card', { tones: ['text', 'shadow'], crop: 'center' });
      return null;
    }, library);
    expect(handle?.pixels(8, 8).colors).toEqual([style.palette.text, style.palette.shadow]);
    expect(handle?.crop).toBe('center');
  });

  it('refuses image() in update(), bad options and unknown tones', () => {
    const shot = shotWith(() => 'probe-update', library);
    expect(() => {
      shot.update(0.5);
    }).toThrow(/assets-outside-build|was called in update/);
    const bad = (options: unknown) =>
      errorOf(() => shotWith((ctx) => ctx.assets.image('test-card', options as never), library));
    expect(bad({ dither: 2 }).code).toBe('invalid-asset-options');
    expect(bad({ fit: 'cover' }).code).toBe('invalid-asset-options');
    expect(bad({ tones: ['notAColour', 'text'] }).message).toContain('notAColour');
  });

  it('is empty (never undefined) for videos without assets', () => {
    let refs: readonly string[] | undefined;
    shotWith((ctx) => {
      refs = ctx.assets.refs;
      expect(ctx.assets.has('test-card')).toBe(false);
      return null;
    }, undefined);
    expect(refs).toEqual([]);
  });
});
