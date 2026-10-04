import { describe, expect, it } from 'vitest';
import { decodePam, encodePam, fittedSize, normalizeRaster } from './pixels.js';
import { refAt, refId, refLiterals, referencedAssetRefs } from './refs.js';

describe('PAM', () => {
  it('round-trips RGB and RGBA', () => {
    for (const channels of [3, 4] as const) {
      const data = Uint8Array.from({ length: 2 * 3 * channels }, (_, index) => index * 7);
      const image = { width: 2, height: 3, channels, data };
      expect(decodePam(encodePam(image))).toEqual(image);
    }
  });

  it('rejects other files with a reason', () => {
    expect(() => decodePam(Buffer.from('P6\n1 1\n255\n\0\0\0'))).toThrow(/not a PAM/);
    const deep =
      'P7\nWIDTH 1\nHEIGHT 1\nDEPTH 2\nMAXVAL 255\nTUPLTYPE GRAYSCALE_ALPHA\nENDHDR\n\0\0';
    expect(() => decodePam(Buffer.from(deep, 'latin1'))).toThrow(/only 8-bit RGB/);
    const short = 'P7\nWIDTH 2\nHEIGHT 2\nDEPTH 3\nMAXVAL 255\nTUPLTYPE RGB\nENDHDR\n\0';
    expect(() => decodePam(Buffer.from(short, 'latin1'))).toThrow(/truncated/);
  });
});

describe('normalizeRaster', () => {
  it('fits the longest edge and never upscales', () => {
    expect(fittedSize(1920, 1080, 640)).toEqual({ width: 640, height: 360 });
    expect(fittedSize(300, 1200, 640)).toEqual({ width: 160, height: 640 });
    expect(fittedSize(320, 240, 640)).toEqual({ width: 320, height: 240 });
  });

  it('area-averages to RGB and composites alpha over black (integers only)', () => {
    const checker = new Uint8Array(4 * 4 * 4);
    for (let pixel = 0; pixel < 16; pixel += 1) {
      const white = (pixel % 4) % 2 === Math.floor(pixel / 4) % 2;
      checker.set([white ? 255 : 0, white ? 255 : 0, white ? 255 : 0, 255], pixel * 4);
    }
    const small = normalizeRaster({ width: 4, height: 4, channels: 4, data: checker }, 2);
    expect(small).toMatchObject({ width: 2, height: 2, channels: 3 });
    expect([...small.data]).toEqual(new Array<number>(12).fill(128));
    const halfAlpha = normalizeRaster(
      { width: 1, height: 1, channels: 4, data: Uint8Array.from([200, 100, 50, 128]) },
      8,
    );
    expect([...halfAlpha.data]).toEqual([100, 50, 25]);
  });
});

describe('asset refs in sources', () => {
  it('finds ref-shaped string literals and keeps the known ids', () => {
    const source = `const a = ctx.assets.image('nasa-apollo');
      const b = ctx.assets.image("nasa-launch@12.5");
      kit.props.monitor({ screen: 'code' }); const c = \`wm-7\`; const d = 'Not-An-Id';`;
    expect(refLiterals(source)).toEqual(['nasa-apollo', 'nasa-launch@12.5', 'code', 'wm-7']);
    const known = new Set(['nasa-apollo', 'nasa-launch', 'wm-7']);
    expect(referencedAssetRefs([source, "'nasa-apollo'"], known)).toEqual([
      'nasa-apollo',
      'nasa-launch@12.5',
      'wm-7',
    ]);
    expect(refId('nasa-launch@12.5')).toBe('nasa-launch');
    expect(refAt('nasa-launch@12.5')).toBe(12.5);
    expect(refAt('nasa-apollo')).toBeUndefined();
  });
});
