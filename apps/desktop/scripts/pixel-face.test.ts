import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DISPLAY_FONT } from '@reelforge/engine';
import { describe, expect, it } from 'vitest';
import { inkRects, pixelFaceGlyphs, UNITS_PER_PIXEL } from './pixel-face-glyphs.js';
import { buildPixelFace, PIXEL_FACE_FILE, PIXEL_FACE_FAMILY } from './pixel-face.js';

const appRoot = path.resolve(import.meta.dirname, '..');

interface Table {
  readonly offset: number;
  readonly length: number;
  readonly checksum: number;
}

function tables(font: Uint8Array): Map<string, Table> {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  const result = new Map<string, Table>();
  for (let index = 0; index < view.getUint16(4); index += 1) {
    const record = 12 + index * 16;
    const tag = String.fromCharCode(...font.subarray(record, record + 4));
    result.set(tag, {
      checksum: view.getUint32(record + 4),
      offset: view.getUint32(record + 8),
      length: view.getUint32(record + 12),
    });
  }
  return result;
}

function sum(font: Uint8Array, start: number, length: number): number {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  let total = 0;
  for (let offset = start; offset < start + length; offset += 4) {
    const word = offset + 4 <= font.length ? view.getUint32(offset) : 0;
    total = (total + word) % 0x1_0000_0000;
  }
  return total;
}

/** Glyph id of a code point through the format 4 cmap (0 = not in the face). */
function glyphOf(font: Uint8Array, cmap: Table, codePoint: number): number {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  const sub = cmap.offset + view.getUint32(cmap.offset + 8);
  const segments = view.getUint16(sub + 6) / 2;
  for (let index = 0; index < segments; index += 1) {
    const end = view.getUint16(sub + 14 + index * 2);
    const start = view.getUint16(sub + 16 + segments * 2 + index * 2);
    const delta = view.getUint16(sub + 16 + segments * 4 + index * 2);
    if (codePoint >= start && codePoint <= end) return (codePoint + delta) % 0x1_0000;
  }
  return 0;
}

describe('pixel title face (PLAN.md#13.12, U13)', () => {
  it('is deterministic and the checked-in file matches the engine font', () => {
    const first = buildPixelFace();
    expect(Buffer.from(buildPixelFace()).equals(Buffer.from(first))).toBe(true);
    const checkedIn = readFileSync(path.join(appRoot, PIXEL_FACE_FILE));
    // Fails after an engine glyph change: run `pnpm --filter @reelforge/desktop pixel-face`.
    expect(checkedIn.equals(Buffer.from(first))).toBe(true);
  });

  it('is a well-formed TrueType file with valid checksums', () => {
    const font = buildPixelFace();
    const view = new DataView(font.buffer);
    expect(view.getUint32(0)).toBe(0x0001_0000);
    const directory = tables(font);
    const tags = [...directory.keys()];
    expect(tags).toEqual(
      ['OS/2', 'cmap', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'name', 'post'].sort(),
    );
    for (const [tag, table] of directory) {
      expect(table.offset % 4, tag).toBe(0);
      if (tag !== 'head') expect(sum(font, table.offset, table.length), tag).toBe(table.checksum);
    }
    expect(sum(font, 0, font.length)).toBe(0xb1b0_afba);
    const head = directory.get('head')?.offset ?? 0;
    expect(view.getUint32(head + 12)).toBe(0x5f0f_3cf5);
    expect(view.getUint16(head + 18)).toBe(1000);
    const hhea = directory.get('hhea')?.offset ?? 0;
    // Ascent = accents + capitals (10 px), descent 2 px: a 1.2 em content box.
    expect([view.getInt16(hhea + 4), view.getInt16(hhea + 6)]).toEqual([1000, -200]);
    const name = directory.get('name');
    const names = Buffer.from(
      font.subarray(name?.offset, (name?.offset ?? 0) + (name?.length ?? 0)),
    );
    expect(names.includes(Buffer.from(PIXEL_FACE_FAMILY, 'utf16le').swap16())).toBe(true);
  });

  it('maps lower case onto the capitals and leaves unknown characters to the system face', () => {
    const font = buildPixelFace();
    const cmap = tables(font).get('cmap');
    if (cmap === undefined) throw new Error('no cmap');
    const glyph = (char: string): number => glyphOf(font, cmap, char.codePointAt(0) ?? 0);
    expect(glyph('A')).toBeGreaterThan(0);
    expect(glyph('a')).toBe(glyph('A'));
    expect(glyph('ż')).toBe(glyph('Ż'));
    expect(glyph('’')).toBe(glyph("'"));
    expect(glyph('…')).toBeGreaterThan(0);
    expect(glyph(' ')).toBeGreaterThan(0);
    expect(glyph('@')).toBe(0);
    expect(glyph('{')).toBe(0);
  });

  it('draws each glyph exactly as the engine bitmap', () => {
    const glyphs = pixelFaceGlyphs(DISPLAY_FONT);
    const a = glyphs.find((item) => item.text === 'A');
    expect(a?.advance).toBe(DISPLAY_FONT.advance('A'));
    const engine = DISPLAY_FONT.glyph('A');
    const cells = new Set<string>();
    for (const rect of a?.rects ?? []) {
      for (let y = rect.top; y < rect.bottom; y += 1) {
        for (let x = rect.left; x < rect.right; x += 1) {
          expect(cells.has(`${String(x)},${String(y)}`)).toBe(false);
          cells.add(`${String(x)},${String(y)}`);
        }
      }
    }
    const expected = new Set<string>();
    engine.bits.forEach((bit, index) => {
      if (bit === 1) {
        const x = index % engine.width;
        const y = engine.top + Math.floor(index / engine.width);
        expected.add(`${String(x)},${String(y)}`);
      }
    });
    expect(cells).toEqual(expected);
    expect(UNITS_PER_PIXEL).toBe(100);
  });

  it('merges ink into few non-overlapping rectangles', () => {
    // A 2x3 block with a notch: two rectangles.
    expect(inkRects(new Set(['0,0', '1,0', '0,1', '1,1', '0,2']))).toEqual([
      { left: 0, right: 2, top: 0, bottom: 2 },
      { left: 0, right: 1, top: 2, bottom: 3 },
    ]);
    // Rows that are not adjacent never merge.
    expect(inkRects(new Set(['0,0', '0,2']))).toEqual([
      { left: 0, right: 1, top: 0, bottom: 1 },
      { left: 0, right: 1, top: 2, bottom: 3 },
    ]);
  });
});
