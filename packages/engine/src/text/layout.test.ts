import { describe, expect, it } from 'vitest';
import { DISPLAY_FONT } from './font-display.js';
import { MONO_FONT } from './font-mono.js';
import { blockSize, inkBox, layoutText, lineOffset, measureLayout } from './layout.js';

describe('layoutText', () => {
  it('measures kerning-free widths in font units', () => {
    // H (6) + 1 + I (4); mono: 3 cells of 6 minus the trailing gap.
    expect(layoutText('HI', DISPLAY_FONT).width).toBe(11);
    expect(layoutText('abc', MONO_FONT).width).toBe(17);
    expect(layoutText('A B', MONO_FONT).width).toBe(17);
    expect(measureLayout(layoutText('HI', DISPLAY_FONT), 3)).toEqual({
      w: 33,
      h: 36,
      lines: ['HI'],
    });
  });

  it('wraps greedily at spaces, keeps explicit newlines and collapses spaces', () => {
    const layout = layoutText('aaa bbb  ccc\nddd', MONO_FONT, 47);
    expect(layout.lines.map((line) => line.text)).toEqual(['aaa bbb', 'ccc', 'ddd']);
    expect(layout.lines.map((line) => line.width)).toEqual([41, 17, 17]);
    expect(layout.words.map((word) => [word.text, word.line, word.x, word.token])).toEqual([
      ['aaa', 0, 0, 0],
      ['bbb', 0, 24, 1],
      ['ccc', 1, 0, 2],
      ['ddd', 2, 0, 3],
    ]);
  });

  it('breaks words that are wider than the line by character', () => {
    const layout = layoutText('abcdefgh', MONO_FONT, 23);
    expect(layout.lines.map((line) => line.text)).toEqual(['abcd', 'efgh']);
    expect(layout.words.map((word) => word.token)).toEqual([0, 0]);
  });

  it('aligns lines inside the block and computes the inked box', () => {
    const layout = layoutText('AAAA\nA', MONO_FONT);
    expect(blockSize(layout, 2)).toEqual({ w: 46, h: 48 });
    expect(lineOffset(layout, 1, 'center', 2)).toBe(18);
    expect(lineOffset(layout, 1, 'right', 2)).toBe(36);
    // Caps span rows 0..6 below the 3-row ascent; nothing descends.
    expect(inkBox(layout, 'left', 2, 10, 20)).toEqual({ x: 10, y: 26, w: 46, h: 38 });
    expect(inkBox(layoutText('Ó', MONO_FONT), 'left', 1, 0, 0)).toEqual({
      x: 0,
      y: 0,
      w: 5,
      h: 10,
    });
    expect(inkBox(layoutText('  ', MONO_FONT), 'left', 1, 4, 5)).toEqual({
      x: 4,
      y: 5,
      w: 0,
      h: 0,
    });
  });
});
