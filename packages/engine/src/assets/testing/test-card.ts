/**
 * Synthetic test picture for asset tests (PLAN.md#12.11): a procedural "photo" - sky gradient
 * with a sun and halo, two mountain ridges, a house with a red roof, a rippled lake, a 1-px
 * checker (area averaging) and a strip of six colour patches (palette mapping). Integer math only;
 * made here, so it is CC0 like the rest of the generated test data. The committed fixture
 * `packages/engine/test/fixtures/asset-test-card.png` is this picture (a unit test checks it).
 */
import type { ManifestAsset } from '@reelforge/shared';

export const TEST_CARD_WIDTH = 320;
export const TEST_CARD_HEIGHT = 240;

const HORIZON = 150;
const SUN = { x: 230, y: 64, r: 20, halo: 34 } as const;
const PATCHES: readonly (readonly [number, number, number])[] = [
  [220, 40, 40],
  [40, 180, 60],
  [40, 70, 200],
  [60, 200, 210],
  [200, 60, 190],
  [235, 210, 60],
];

type Rgb = readonly [number, number, number];

/** Triangle wave 0..amplitude with period `period` (integers). */
function triangle(x: number, period: number, amplitude: number): number {
  const phase = ((x % period) + period) % period;
  const half = period >> 1;
  return Math.floor((amplitude * Math.abs(phase - half)) / half);
}

function sky(x: number, y: number): Rgb {
  const k = Math.floor((Math.min(y, HORIZON) * 256) / HORIZON);
  const base: Rgb = [40 + ((190 * k) >> 8), 70 + ((120 * k) >> 8), 170 + ((40 * k) >> 8)];
  const d2 = (x - SUN.x) ** 2 + (y - SUN.y) ** 2;
  if (d2 <= SUN.r * SUN.r) return [255, 236, 160];
  if (d2 <= SUN.halo * SUN.halo) {
    const w = Math.floor(
      ((SUN.halo * SUN.halo - d2) * 128) / (SUN.halo * SUN.halo - SUN.r * SUN.r),
    );
    return [
      base[0] + (((255 - base[0]) * w) >> 8),
      base[1] + (((220 - base[1]) * w) >> 8),
      base[2] + (((150 - base[2]) * w) >> 8),
    ];
  }
  return base;
}

function land(x: number, y: number): Rgb | undefined {
  const far = 92 + triangle(x + 13, 96, 34) + triangle(x + 50, 42, 10);
  const near = 118 + triangle(x + 70, 130, 26) + triangle(x, 23, 5);
  if (y >= near) return [40 + (x % 23), 92 + ((x * 3) % 29), 52];
  if (y >= far) return [70 + ((x >> 2) % 17), 84, 118];
  return undefined;
}

function house(x: number, y: number): Rgb | undefined {
  if (x >= 60 && x < 112 && y >= 122 && y < 160) {
    const window =
      (x >= 70 && x < 82 && y >= 132 && y < 144) || (x >= 92 && x < 104 && y >= 132 && y < 144);
    const door = x >= 82 && x < 92 && y >= 142;
    if (window) return [250, 220, 120];
    if (door) return [90, 50, 30];
    return [222, 218, 205];
  }
  const roofTop = 96;
  if (y >= roofTop && y < 122 && Math.abs(x - 86) <= Math.floor(((y - roofTop) * 30) / 26)) {
    return [186, 44, 40];
  }
  return undefined;
}

function lake(x: number, y: number): Rgb {
  const mirror = sky(x, 2 * HORIZON - y - 1);
  const ripple = (y * 7 + (x >> 3)) % 11 === 0;
  const scale = ripple ? 4 : 3;
  return [
    (mirror[0] * scale) >> 2,
    (mirror[1] * scale) >> 2,
    Math.min(255, ((mirror[2] * scale) >> 2) + 10),
  ];
}

/** Colour of pixel (x, y) of the test card. */
export function testCardPixel(x: number, y: number): Rgb {
  if (y >= 212) return PATCHES[Math.floor((x * PATCHES.length) / TEST_CARD_WIDTH)] ?? [0, 0, 0];
  if (x >= 272 && y >= 156 && y < 204) return (x + y) % 2 === 0 ? [255, 255, 255] : [0, 0, 0];
  if (y >= HORIZON) return lake(x, y);
  return house(x, y) ?? land(x, y) ?? sky(x, y);
}

/** The whole card as RGB8 (rows top-down). */
export function testCardRgb(): Uint8Array {
  const data = new Uint8Array(TEST_CARD_WIDTH * TEST_CARD_HEIGHT * 3);
  for (let y = 0; y < TEST_CARD_HEIGHT; y += 1) {
    for (let x = 0; x < TEST_CARD_WIDTH; x += 1) {
      data.set(testCardPixel(x, y), (y * TEST_CARD_WIDTH + x) * 3);
    }
  }
  return data;
}

/** The whole card as RGBA8 (alpha 255), for PNG fixtures. */
export function testCardRgba(): Uint8Array {
  const rgb = testCardRgb();
  const data = new Uint8Array(TEST_CARD_WIDTH * TEST_CARD_HEIGHT * 4);
  for (let pixel = 0; pixel < TEST_CARD_WIDTH * TEST_CARD_HEIGHT; pixel += 1) {
    data.set(rgb.subarray(pixel * 3, pixel * 3 + 3), pixel * 4);
    data[pixel * 4 + 3] = 255;
  }
  return data;
}

/** Fixed stand-in for the file hash of the test card in manifests built by tests. */
export const TEST_CARD_SHA256 = 'a'.repeat(64);

/** A render-manifest asset carrying the test card (or `rgb` of width x height). */
export function testCardManifestAsset(
  ref = 'test-card',
  picture: { readonly width: number; readonly height: number; readonly rgb: Uint8Array } = {
    width: TEST_CARD_WIDTH,
    height: TEST_CARD_HEIGHT,
    rgb: testCardRgb(),
  },
): ManifestAsset {
  return {
    ref,
    id: ref.split('@')[0] ?? ref,
    file: `.reelforge/assets/${ref.split('@')[0] ?? ref}.png`,
    mime: 'image/png',
    sha256: TEST_CARD_SHA256,
    width: picture.width,
    height: picture.height,
    rgb: Buffer.from(picture.rgb.buffer, picture.rgb.byteOffset, picture.rgb.byteLength).toString(
      'base64',
    ),
  };
}
