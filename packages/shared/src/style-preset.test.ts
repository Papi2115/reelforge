import { describe, expect, it } from 'vitest';
import { PALETTE_TOKENS, stylePresetSchema, type StylePreset } from './index.js';

function preset(overrides: Partial<StylePreset> = {}): unknown {
  return {
    version: 1,
    id: 'test-style',
    name: 'Test',
    resolution: { width: 640, height: 360 },
    palette: { ink: '#000000', paper: '#ffffff' },
    tokens: Object.fromEntries(PALETTE_TOKENS.map((token) => [token, 'ink'])),
    dither: { matrix: 'bayer4', spread: 0.1 },
    ...overrides,
  };
}

function issueMessages(input: unknown): string[] {
  const result = stylePresetSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('stylePresetSchema', () => {
  it('accepts a minimal preset and optional effects', () => {
    expect(issueMessages(preset())).toEqual([]);
    expect(
      issueMessages(
        preset({
          outline: { color: 'outline', threshold: 0.1 },
          ao: { strength: 0.4, radius: 2, range: 1 },
          scanlines: { period: 2, strength: 0.2 },
          vignette: { strength: 0.3, radius: 0.6, softness: 0.4 },
          safeArea: { x: 0.06, y: 0.08 },
        }),
      ),
    ).toEqual([]);
  });

  it('accepts the quantize flag (absent = snap to the palette) and rejects non-booleans', () => {
    expect(stylePresetSchema.parse(preset()).quantize).toBeUndefined();
    expect(stylePresetSchema.parse(preset({ quantize: true })).quantize).toBe(true);
    expect(stylePresetSchema.parse(preset({ quantize: false })).quantize).toBe(false);
    expect(issueMessages({ ...(preset() as object), quantize: 'no' })).toHaveLength(1);
  });

  it('still needs a 2..32 colour palette for the tokens of a full-colour style', () => {
    expect(issueMessages(preset({ quantize: false, palette: { ink: '#000000' } }))).toHaveLength(1);
  });

  it('bounds the text safe-area margins', () => {
    expect(issueMessages(preset({ safeArea: { x: 0.3, y: 0.05 } }))).toHaveLength(1);
    expect(issueMessages(preset({ safeArea: { x: -0.1, y: 0.05 } }))).toHaveLength(1);
  });

  it('requires every token to point at a swatch', () => {
    const tokens = Object.fromEntries(
      PALETTE_TOKENS.map((token) => [token, 'ink']),
    ) as StylePreset['tokens'];
    expect(issueMessages(preset({ tokens: { ...tokens, hero: 'orange' } }))).toEqual([
      'token "hero" refers to unknown swatch "orange"',
    ]);
    const missingSky = Object.fromEntries(
      PALETTE_TOKENS.filter((token) => token !== 'sky').map((token) => [token, 'ink']),
    );
    expect(issueMessages(preset({ tokens: missingSky as StylePreset['tokens'] }))).toHaveLength(1);
  });

  it('rejects swatches named like tokens, unknown outline colours and bad ids', () => {
    expect(issueMessages(preset({ palette: { ink: '#000000', sky: '#0000ff' } }))).toEqual([
      'swatch "sky" collides with a palette token name',
    ]);
    expect(issueMessages(preset({ outline: { color: 'gold', threshold: 0.1 } }))).toEqual([
      'outline colour "gold" is neither a swatch nor a token',
    ]);
    expect(issueMessages(preset({ id: 'Bad Id' }))).toHaveLength(1);
  });
});
