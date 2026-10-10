import { PALETTE_TOKENS } from '@reelforge/shared';
import type { StylePreset } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { EngineError } from './errors.js';
import {
  BUILT_IN_STYLE_PRESETS,
  createStyleRegistry,
  DEFAULT_STYLE_ID,
  findStylePreset,
  STYLE_PRESET_IDS,
} from './presets/index.js';
import { postFragmentShader } from './gl/post-shader.js';
import { resolveStyle, scanlineFactor, vignetteFactor } from './style.js';

/** Export size: every preset must upscale to it by an integer factor (ffmpeg `neighbor`). */
const EXPORT = { width: 1920, height: 1080 };

describe('built-in style presets', () => {
  it('ships the three presets with the crisp 640 one as default', () => {
    expect(STYLE_PRESET_IDS).toEqual(['voxel-pixel-crisp640', 'noir-voxel', 'soft-480']);
    expect(DEFAULT_STYLE_ID).toBe('voxel-pixel-crisp640');
  });

  it.each(STYLE_PRESET_IDS)('%s upscales to 1080p by one integer factor', (id) => {
    const preset = findStylePreset(id);
    if (!preset) throw new Error(`missing preset ${id}`);
    const { width, height } = preset.resolution;
    const factor = EXPORT.width / width;
    expect(Number.isInteger(factor)).toBe(true);
    expect(EXPORT.height / height).toBe(factor);
  });

  it('renders soft-480 at 480x270 (x4 to 1080p)', () => {
    expect(findStylePreset('soft-480')?.resolution).toEqual({ width: 480, height: 270 });
  });
});

describe('resolveStyle', () => {
  it('defaults to the crisp 640 style and exposes swatches plus every token', () => {
    const style = resolveStyle({});
    expect(style).toMatchObject({ id: DEFAULT_STYLE_ID, width: 640, height: 360 });
    for (const token of PALETTE_TOKENS) expect(style.palette[token]).toMatch(/^#[0-9a-f]{6}$/);
    expect(style.palette.sky).toBe(style.palette['navy']);
    expect(style.post.dither).toEqual({ size: 4, spread: 0.12 });
    expect(style.post.outline?.color).toEqual([5 / 255, 6 / 255, 15 / 255]);
    expect(style.post.lut?.palette).toHaveLength(22);
  });

  it('resolves another preset with its own post-fx', () => {
    const noir = resolveStyle({ style: 'noir-voxel' });
    expect(noir.post.dither.size).toBe(8);
    expect(noir.post.scanlines).toEqual({ period: 3, strength: 0.25 });
    expect(resolveStyle({ style: 'soft-480' }).post.outline).toBeUndefined();
  });

  it('merges manifest palette overrides into the quantization set and the tokens', () => {
    const style = resolveStyle({ palette: { navy: '#000022', wood: '#7a4a2a' } });
    expect(style.palette.sky).toBe('#000022');
    expect(style.palette['wood']).toBe('#7a4a2a');
    expect(style.post.lut?.palette).toHaveLength(23);
  });

  it('rejects unknown styles, size mismatches and token-named overrides', () => {
    const failure = (request: Parameters<typeof resolveStyle>[0]): string => {
      try {
        resolveStyle(request);
      } catch (error) {
        if (error instanceof EngineError) return `${error.code}: ${error.message}`;
        throw error;
      }
      throw new Error('expected resolveStyle to throw');
    };
    expect(failure({ style: 'vaporwave' })).toMatch(
      /invalid-manifest: style "vaporwave" is unknown; available: voxel-pixel-crisp640, noir-voxel, soft-480/,
    );
    expect(failure({ style: 'soft-480', width: 640, height: 360 })).toMatch(
      /do not match style "soft-480" \(480x270\)/,
    );
    expect(failure({ palette: { sky: '#000000', ink: '#ffffff' } })).toMatch(
      /"sky" is a token name/,
    );
    expect(resolveStyle({ style: 'soft-480', width: 480, height: 270 }).width).toBe(480);
  });
});

describe('screen-space post-fx references', () => {
  const vignette = { strength: 0.4, radius: 0.5, softness: 0.4 };

  it('leaves the centre untouched and darkens the corners by the full strength', () => {
    expect(vignetteFactor(319, 179, 640, 360, vignette)).toBe(1);
    expect(vignetteFactor(0, 0, 640, 360, vignette)).toBeCloseTo(0.6, 2);
    expect(vignetteFactor(639, 359, 640, 360, vignette)).toBeCloseTo(
      vignetteFactor(0, 0, 640, 360, vignette),
    );
  });

  it('darkens every period-th row', () => {
    const rows = Array.from({ length: 6 }, (_, y) =>
      scanlineFactor(y, { period: 3, strength: 0.25 }),
    );
    expect(rows).toEqual([1, 1, 0.75, 1, 1, 0.75]);
  });
});

describe('full-colour styles (quantize: false)', () => {
  const base = findStylePreset('soft-480');
  if (!base) throw new Error('missing soft-480');
  const fullColour: StylePreset = { ...base, id: 'full-colour-test', quantize: false };
  const registry = createStyleRegistry([...BUILT_IN_STYLE_PRESETS, fullColour], []);

  it('quantizes unless the preset opts out', () => {
    for (const id of STYLE_PRESET_IDS) expect(resolveStyle({ style: id }).post.lut).toBeDefined();
    expect(resolveStyle({ style: fullColour.id }, registry).post.lut).toBeUndefined();
  });

  it('keeps the palette for the scene tokens', () => {
    const style = resolveStyle({ style: fullColour.id }, registry);
    expect(style.palette.sky).toBe(style.palette['dusk']);
    expect(style.swatches).toEqual(base.palette);
  });

  it('drops the dither table and the palette LUT from the shader, keeps the other passes', () => {
    const withFx: StylePreset = {
      ...fullColour,
      scanlines: { period: 3, strength: 0.2 },
      vignette: { strength: 0.3, radius: 0.6, softness: 0.4 },
    };
    const style = resolveStyle({ style: withFx.id }, createStyleRegistry([withFx], []));
    const shader = postFragmentShader(style.post);
    expect(shader).not.toMatch(/sampler3D|BAYER|texelFetch\(lut/);
    expect(shader).toContain('color *= vignette(p);');
    expect(shader).toContain('color *= scanline(p);');
    expect(shader).toMatch(/gl_FragColor = vec4\(clamp\(color, 0\.0, 1\.0\), 1\.0\);\s*}$/);
  });

  it('leaves the shader of quantizing styles with the dither table and the LUT', () => {
    const shader = postFragmentShader(resolveStyle({}).post);
    expect(shader).toContain('uniform highp sampler3D lut;');
    expect(shader).toContain('const float BAYER[16]');
    expect(shader).toContain('gl_FragColor = vec4(texelFetch(lut, cell, 0).rgb, 1.0);');
  });
});
