import { chromium, type Browser, type Page } from 'playwright';
import { build } from 'esbuild';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PALETTE_TOKENS, type StylePreset } from '@reelforge/shared';
import { SWIFTSHADER_ARGS } from '../../src/cli/harness-session.js';
import { vignetteFactor } from '../../src/style.js';
import type { ProbeResult } from '../support/full-colour-probe.js';

/** A colour outside any 32-colour palette of the test presets. */
const FLAT = '#7a5c3e';
const FLAT_RGB = [0x7a, 0x5c, 0x3e];

const ENGINE_ROOT = path.resolve(import.meta.dirname, '..', '..');

/** Two-colour palette: the quantizing variant must snap FLAT to one of them. */
function preset(overrides: Partial<StylePreset>): StylePreset {
  return {
    version: 1,
    id: 'full-colour-probe',
    name: 'Probe',
    resolution: { width: 64, height: 36 },
    palette: { ink: '#000000', paper: '#ffffff' },
    tokens: Object.fromEntries(
      PALETTE_TOKENS.map((token) => [token, 'ink']),
    ) as StylePreset['tokens'],
    dither: { matrix: 'bayer4', spread: 0 },
    ...overrides,
  };
}

let browser: Browser;
let page: Page;

async function bundleProbe(): Promise<string> {
  const result = await build({
    entryPoints: [path.join(ENGINE_ROOT, 'test', 'support', 'full-colour-probe.ts')],
    write: false,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    alias: {
      '@reelforge/shared': path.join(ENGINE_ROOT, '..', 'shared', 'src', 'index.ts'),
      '@reelforge/kit': path.join(ENGINE_ROOT, '..', 'kit', 'src', 'index.ts'),
    },
    logLevel: 'warning',
  });
  const output = result.outputFiles[0];
  if (output === undefined) throw new Error('esbuild produced no probe bundle');
  return output.text;
}

function render(style: StylePreset): Promise<ProbeResult> {
  return page.evaluate(
    (input) =>
      (window as unknown as { __probe: (p: StylePreset, c: string) => ProbeResult }).__probe(
        input.style,
        input.colour,
      ),
    { style, colour: FLAT },
  );
}

beforeAll(async () => {
  browser = await chromium.launch({ headless: true, args: SWIFTSHADER_ARGS });
  page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: await bundleProbe() });
});

afterAll(async () => {
  await browser.close();
});

describe('full-colour post pass (quantize: false)', () => {
  it('passes a colour outside the palette through unchanged, with a non-zero dither spread', async () => {
    const result = await render(
      preset({ quantize: false, dither: { matrix: 'bayer8', spread: 0.5 } }),
    );
    expect(result.renderer).toMatch(/SwiftShader/);
    expect(result.center).toEqual(FLAT_RGB);
    expect(result.corner).toEqual(FLAT_RGB);
    expect(result.distinct).toBe(1);
  });

  it('still applies the vignette in truecolor, as the CPU reference (corner not snapped)', async () => {
    const vignette = { strength: 0.5, radius: 0.3, softness: 0.6 };
    const style = preset({ quantize: false, vignette });
    const result = await render(style);
    expect(result.center).toEqual(FLAT_RGB);
    const { width, height } = style.resolution;
    const factor = vignetteFactor(0, 0, width, height, vignette);
    expect(factor).toBeLessThan(0.9);
    result.corner.forEach((channel, index) => {
      expect(Math.abs(channel - (FLAT_RGB[index] ?? 0) * factor)).toBeLessThanOrEqual(1);
    });
    expect(result.distinct).toBeGreaterThan(2);
  });

  it('applies scanlines in truecolor', async () => {
    const result = await render(
      preset({ quantize: false, scanlines: { period: 2, strength: 0.5 } }),
    );
    expect(result.distinct).toBe(2);
  });

  it('keeps snapping to the palette when the flag is absent or true', async () => {
    for (const quantize of [undefined, true]) {
      const result = await render(preset(quantize === undefined ? {} : { quantize }));
      expect([
        [0, 0, 0],
        [255, 255, 255],
      ]).toContainEqual([...result.center]);
      expect(result.distinct).toBe(1);
    }
  });
});
