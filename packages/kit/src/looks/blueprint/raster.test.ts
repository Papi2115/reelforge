import { describe, expect, it } from 'vitest';
import {
  arcPoints,
  bayerOn,
  circlePixels,
  hexPixel,
  packColor,
  pathPixels,
  PATTERNS,
  Raster,
} from './raster.js';
import { drawText, fitScale, textBox, textHeight, textWidth } from './text.js';

const RED = hexPixel('#ff0000');
const BLUE = hexPixel('#0000ff');

function count(raster: Raster, color: number): number {
  let total = 0;
  for (let y = 0; y < raster.height; y += 1) {
    for (let x = 0; x < raster.width; x += 1) if (raster.get(x, y) === color) total += 1;
  }
  return total;
}

describe('raster colours', () => {
  it('packs RGBA bytes in the buffer order', () => {
    const raster = new Raster(1, 1);
    raster.set(0, 0, hexPixel('#12355b'));
    expect([...raster.data]).toEqual([0x12, 0x35, 0x5b, 255]);
    expect(packColor(1, 2, 3, 0)).not.toBe(packColor(1, 2, 3, 255));
  });

  it('dithers coverage in Bayer order', () => {
    let on = 0;
    for (let y = 0; y < 4; y += 1) for (let x = 0; x < 4; x += 1) if (bayerOn(x, y, 0.5)) on += 1;
    expect(on).toBe(8);
    expect(bayerOn(3, 3, 0)).toBe(false);
    expect(bayerOn(3, 3, 1)).toBe(true);
  });
});

describe('raster primitives', () => {
  it('draws 8-connected lines through both end points without repeated joints', () => {
    const pixels = pathPixels([
      [0, 0],
      [5, 2],
      [5, 6],
    ]);
    expect(pixels[0]).toEqual([0, 0]);
    expect(pixels.at(-1)).toEqual([5, 6]);
    for (let index = 1; index < pixels.length; index += 1) {
      const [ax, ay] = pixels[index - 1] ?? [0, 0];
      const [bx, by] = pixels[index] ?? [0, 0];
      expect(Math.max(Math.abs(bx - ax), Math.abs(by - ay))).toBe(1);
    }
  });

  it('draws a prefix of the path for draw-ons, and dashes along it', () => {
    const full = new Raster(20, 3);
    full.line(0, 1, 19, 1, RED);
    expect(count(full, RED)).toBe(20);
    const half = new Raster(20, 3);
    half.line(0, 1, 19, 1, RED, { progress: 0.5 });
    expect(count(half, RED)).toBe(10);
    expect(half.get(0, 1)).toBe(RED);
    expect(half.get(19, 1)).toBe(0);
    const dashed = new Raster(20, 3);
    dashed.line(0, 1, 19, 1, RED, { dash: [3, 2] });
    expect(count(dashed, RED)).toBe(12);
  });

  it('fills polygons by pixel centres (a 4x3 rectangle covers 12 pixels)', () => {
    const raster = new Raster(10, 10);
    raster.polygon(
      [
        [
          [2, 2],
          [6, 2],
          [6, 5],
          [2, 5],
        ],
      ],
      RED,
    );
    expect(count(raster, RED)).toBe(12);
    raster.polygon(
      [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
      ],
      BLUE,
      PATTERNS.checker,
    );
    expect(count(raster, BLUE)).toBe(50);
  });

  it('clips and fades writes', () => {
    const raster = new Raster(8, 8);
    raster.clipped(2, 2, 3, 3, () => {
      raster.rect(0, 0, 8, 8, RED);
    });
    expect(count(raster, RED)).toBe(9);
    const faded = new Raster(8, 8);
    faded.faded(0.25, () => {
      faded.rect(0, 0, 8, 8, RED);
    });
    expect(count(faded, RED)).toBe(16);
  });

  it('draws symmetric circles and arc polylines', () => {
    const pixels = circlePixels(5);
    expect(pixels).toContainEqual([5, 0]);
    expect(pixels).toContainEqual([0, -5]);
    const points = arcPoints(0, 0, 10);
    expect(points[0]?.[0]).toBeCloseTo(10);
    expect(points.at(-1)?.[0]).toBeCloseTo(10);
  });

  it('snapshots and restores a rectangle', () => {
    const raster = new Raster(6, 6);
    raster.rect(1, 1, 3, 3, RED);
    const saved = raster.snapshot(0, 0, 4, 4);
    raster.clear();
    raster.restore(saved);
    expect(count(raster, RED)).toBe(9);
  });
});

describe('pixel lettering', () => {
  it('measures with the kit font at integer scales', () => {
    expect(textWidth('A', 1)).toBe(5);
    expect(textWidth('AB', 2)).toBe(22);
    expect(textHeight(1, 2)).toBe(14);
    expect(textBox(['AB'], 50, 10, { scale: 1, color: RED, align: 'center' }).x).toBe(45);
    expect(fitScale('WIDE LABEL', 60, 3)).toBe(1);
  });

  it('draws ink, a knock-out plate and typewriter prefixes', () => {
    const raster = new Raster(40, 20);
    const box = drawText(raster, ['HI'], 5, 5, { scale: 1, color: RED, plate: BLUE, pad: 2 });
    expect(box).toEqual({ x: 3, y: 3, width: textWidth('HI', 1) + 4, height: 11 });
    expect(count(raster, RED)).toBeGreaterThan(10);
    const typed = new Raster(40, 20);
    drawText(typed, ['HI'], 5, 5, { scale: 1, color: RED, chars: 1 });
    const full = new Raster(40, 20);
    drawText(full, ['HI'], 5, 5, { scale: 1, color: RED });
    expect(count(typed, RED)).toBeLessThan(count(full, RED));
  });
});
