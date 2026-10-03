import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodePng } from './cli/png.js';
import { resolveStyle } from './style.js';
import { vibeGuard, type VibeImage } from './vibe.js';

const CRISP = resolveStyle({ style: 'voxel-pixel-crisp640' });
const KIT_GOLDENS = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  'kit',
  'test',
  'goldens',
  'swiftshader',
);

function image(colors: readonly (readonly [number, number, number, number?])[]): VibeImage {
  const data = new Uint8Array(colors.length * 4);
  colors.forEach(([r, g, b, a], index) => {
    data.set([r, g, b, a ?? 255], index * 4);
  });
  return { width: colors.length, height: 1, data };
}

describe('vibeGuard', () => {
  it('accepts a frame made only of palette colours', () => {
    const report = vibeGuard(
      image([
        [0x05, 0x06, 0x0f],
        [0xff, 0x8c, 0x42],
        [0x05, 0x06, 0x0f],
      ]),
      CRISP,
    );
    expect(report).toEqual({
      ok: true,
      offPalettePct: 0,
      offPalettePixels: 0,
      paletteColorsUsed: 2,
      issues: [],
    });
  });

  it('flags off-palette pixels (gradients, anti-aliasing) with examples and translucency', () => {
    const report = vibeGuard(
      image([
        [0xff, 0x8c, 0x42],
        [0x80, 0x80, 0x80],
        [0x80, 0x80, 0x80],
        [0x05, 0x06, 0x0f, 128],
      ]),
      CRISP,
    );
    expect(report.ok).toBe(false);
    expect(report.offPalettePct).toBe(50);
    expect(report.issues).toEqual([
      '50.000% of the pixels (2) are not in the voxel-pixel-crisp640 palette, e.g. #808080 x2: something bypassed the post-fx (smooth gradient, anti-aliasing, unfiltered image)',
      '1 pixels are not opaque: frames must be fully opaque',
    ]);
    const tolerant = vibeGuard(
      image([
        [0x80, 0x80, 0x80],
        [0xff, 0x8c, 0x42],
      ]),
      CRISP,
      {
        maxOffPalettePct: 60,
      },
    );
    expect(tolerant.ok).toBe(true);
  });

  it('uses the project palette overrides and rejects a malformed buffer', () => {
    const wood = resolveStyle({ style: 'voxel-pixel-crisp640', palette: { wood: '#8a5a2b' } });
    expect(vibeGuard(image([[0x8a, 0x5a, 0x2b]]), wood).ok).toBe(true);
    expect(vibeGuard(image([[0x8a, 0x5a, 0x2b]]), CRISP).ok).toBe(false);
    const broken = vibeGuard({ width: 2, height: 2, data: new Uint8Array(4) }, CRISP);
    expect(broken.ok).toBe(false);
    expect(broken.issues[0]).toMatch(/expected RGBA8/);
  });

  it('passes the voxel look goldens (post-fx output is always in the palette)', () => {
    const goldens = [
      ['kit-env-room-t0.png', 'voxel-pixel-crisp640'],
      ['kit-fx-counter-t1.2.png', 'voxel-pixel-crisp640'],
      ['kit-voxel-demo-t2.5.png', 'voxel-pixel-crisp640'],
      ['kit-voxel-demo-noir-voxel-t2.5.png', 'noir-voxel'],
      ['kit-voxel-demo-soft-480-t2.5.png', 'soft-480'],
    ] as const;
    for (const [file, style] of goldens) {
      const frame = decodePng(readFileSync(path.join(KIT_GOLDENS, file)));
      const report = vibeGuard(frame, resolveStyle({ style }));
      expect(report.issues, file).toEqual([]);
      expect(report.paletteColorsUsed, file).toBeGreaterThan(3);
    }
  });
});
