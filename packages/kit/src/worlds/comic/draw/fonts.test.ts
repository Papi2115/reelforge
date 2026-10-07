/**
 * The lettering face's W (real run Comic 2: BELON, DONN, GLONED, TUBE NORMS): its legs meet the
 * middle stroke in two points on the baseline, so it reads neither as an N (one diagonal) nor as
 * an upside-down M (legs standing on both outer corners). The display face of the onomatopoeia
 * (Forge Display, 2-px strokes) gets the same W.
 */
import { describe, expect, it } from 'vitest';
import { FONTS, type Glyph } from './fonts.js';

function rows(glyph: Glyph | undefined): string[] {
  if (glyph === undefined) throw new Error('missing glyph');
  return Array.from({ length: glyph.h }, (_, y) =>
    Array.from({ length: glyph.w }, (_, x) => (glyph.bits[y * glyph.w + x] === 1 ? '#' : '.')).join(
      '',
    ),
  );
}

describe('Inkhand W', () => {
  const w = rows(FONTS.hand.glyphs.get('W'));

  it('ends in two points on the baseline, not on the outer corners', () => {
    const base = w[w.length - 1] ?? '';
    expect(base[0]).toBe('.');
    expect(base[base.length - 1]).toBe('.');
    expect(base.replaceAll('.', '')).toBe('##');
  });

  it('has a middle stroke reaching down to the points', () => {
    const middle = Math.floor((w[0]?.length ?? 0) / 2);
    const stroke = w.slice(3, w.length - 1).map((row) => row[middle]);
    expect(stroke.every((cell) => cell === '#')).toBe(true);
  });

  it('differs from N and from M upside down', () => {
    expect(w).not.toEqual(rows(FONTS.hand.glyphs.get('N')));
    expect(w).not.toEqual([...rows(FONTS.hand.glyphs.get('M'))].reverse());
  });
});

describe('Forge Display W (sound words)', () => {
  const w = rows(FONTS.display.glyphs.get('W'));

  it('ends in two points on the baseline, not on the outer corners', () => {
    const base = w[w.length - 1] ?? '';
    expect(base[0]).toBe('.');
    expect(base[base.length - 1]).toBe('.');
    expect(base.split('.').filter((run) => run.length > 0)).toHaveLength(2);
  });

  it('has a middle stroke down to the row above the points', () => {
    const middle = Math.floor((w[0]?.length ?? 0) / 2);
    const stroke = w.slice(3, w.length - 1).map((row) => row[middle]);
    expect(stroke.every((cell) => cell === '#')).toBe(true);
  });

  it('differs from N, U and from M upside down', () => {
    expect(w).not.toEqual(rows(FONTS.display.glyphs.get('N')));
    expect(w).not.toEqual(rows(FONTS.display.glyphs.get('U')));
    expect(w).not.toEqual([...rows(FONTS.display.glyphs.get('M'))].reverse());
  });
});
