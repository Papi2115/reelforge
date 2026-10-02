import { readFileSync } from 'node:fs';
import path from 'node:path';
import { decodePng, encodePng } from '@reelforge/engine/raster';
import { describe, expect, it } from 'vitest';
import { drawVoxelCube, ICON_SIZES, icoContainer, iconImage, upscale } from './icon-art.js';

const buildResources = path.resolve(import.meta.dirname, '..', 'build-resources');

function alphaAt(image: { width: number; data: Uint8Array }, x: number, y: number): number {
  return image.data[(y * image.width + x) * 4 + 3] ?? -1;
}

describe('voxel cube icon', () => {
  it('draws an opaque cube on a transparent background', () => {
    const cube = drawVoxelCube(32, 3);
    expect(alphaAt(cube, 0, 0)).toBe(0);
    expect(alphaAt(cube, 31, 31)).toBe(0);
    expect(alphaAt(cube, 16, 16)).toBe(255);
    expect(alphaAt(cube, 8, 20)).toBe(255);
  });

  it('upscales with crisp nearest-neighbour pixels', () => {
    const image = upscale({ width: 1, height: 1, data: new Uint8Array([1, 2, 3, 4]) }, 3);
    expect(image.width).toBe(3);
    expect([...image.data]).toEqual(Array.from({ length: 9 }, () => [1, 2, 3, 4]).flat());
  });

  it('writes an ICO directory of PNG entries (256 stored as 0)', () => {
    const entries = ICON_SIZES.map(([size, grid]) => ({
      size,
      png: encodePng(iconImage(size, grid)),
    }));
    const ico = icoContainer(entries);
    expect([ico.readUInt16LE(0), ico.readUInt16LE(2), ico.readUInt16LE(4)]).toEqual([0, 1, 6]);
    entries.forEach((entry, index) => {
      const at = 6 + 16 * index;
      expect(ico.readUInt8(at)).toBe(entry.size === 256 ? 0 : entry.size);
      expect(ico.readUInt16LE(at + 6)).toBe(32);
      const offset = ico.readUInt32LE(at + 12);
      const png = ico.subarray(offset, offset + ico.readUInt32LE(at + 8));
      expect(decodePng(png).width).toBe(entry.size);
    });
  });

  it('matches the committed build-resources/icon.ico and icon.png', () => {
    const entries = ICON_SIZES.map(([size, grid]) => ({
      size,
      png: encodePng(iconImage(size, grid)),
    }));
    expect(readFileSync(path.join(buildResources, 'icon.ico')).equals(icoContainer(entries))).toBe(
      true,
    );
    expect(decodePng(readFileSync(path.join(buildResources, 'icon.png'))).width).toBe(256);
  });
});
