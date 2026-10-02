import { describe, expect, it } from 'vitest';
import { compileFont } from './font.js';
import { DISPLAY_FONT, DISPLAY_FONT_SPEC } from './font-display.js';
import { MONO_FONT } from './font-mono.js';

const POLISH_UPPER = 'ĄĆĘŁŃÓŚŹŻ';
const POLISH_LOWER = 'ąćęłńóśźż';
const DIGITS = '0123456789';
const PUNCTUATION = '.,:;!?\'"-+=/()&%#$€·—';
const ASCII_PRINTABLE = Array.from({ length: 95 }, (_, index) => String.fromCharCode(32 + index))
  .filter((char) => !'^`{|}~'.includes(char))
  .join('');

function missing(font: typeof DISPLAY_FONT, chars: string): string[] {
  return Array.from(font.normalize(chars)).filter((char) => !font.has(char));
}

describe('pixel fonts', () => {
  it('display font covers A-Z, digits, punctuation and Polish capitals (lower case maps to caps)', () => {
    expect(missing(DISPLAY_FONT, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toEqual([]);
    expect(missing(DISPLAY_FONT, 'abcdefghijklmnopqrstuvwxyz')).toEqual([]);
    expect(missing(DISPLAY_FONT, POLISH_UPPER + POLISH_LOWER + DIGITS + PUNCTUATION)).toEqual([]);
    expect(DISPLAY_FONT.normalize('zażółć gęślą jaźń')).toBe('ZAŻÓŁĆ GĘŚLĄ JAŹŃ');
  });

  it('mono font covers printable ASCII and Polish letters in both cases', () => {
    expect(missing(MONO_FONT, ASCII_PRINTABLE)).toEqual([]);
    expect(missing(MONO_FONT, POLISH_UPPER + POLISH_LOWER + '€·—')).toEqual([]);
    expect(MONO_FONT.normalize('Zażółć')).toBe('Zażółć');
  });

  it('places accents above the letter and ogoneks below the baseline', () => {
    for (const font of [DISPLAY_FONT, MONO_FONT]) {
      for (const char of 'ĆŃÓŚŹŻ') {
        expect(font.glyph(char).inkTop, `${font.name} ${char}`).toBeLessThan(0);
        expect(font.glyph(char).inkTop).toBeGreaterThanOrEqual(-font.ascent);
      }
      for (const char of 'ĄĘ') {
        expect(font.glyph(char).inkBottom, `${font.name} ${char}`).toBeGreaterThanOrEqual(
          font.capHeight,
        );
        expect(font.glyph(char).inkBottom).toBeLessThan(font.capHeight + font.descent);
      }
    }
    // Lower-case accents sit above the x-height, inside the line box.
    expect(MONO_FONT.glyph('ó').inkTop).toBe(-1);
    expect(MONO_FONT.glyph('o').inkTop).toBe(2);
  });

  it('is monospaced (mono) and proportional (display)', () => {
    expect(new Set(Array.from('iMW. ąg').map((char) => MONO_FONT.advance(char)))).toEqual(
      new Set([6]),
    );
    expect(DISPLAY_FONT.advance('I')).toBeLessThan(DISPLAY_FONT.advance('M'));
    expect(DISPLAY_FONT.advance(' ')).toBe(3);
  });

  it('substitutes typographic characters and draws a box for unknown ones', () => {
    expect(MONO_FONT.normalize('„Hi” – ‘ok’…')).toBe('"Hi" - \'ok\'...');
    expect(MONO_FONT.has('☃')).toBe(false);
    expect(MONO_FONT.glyph('☃').width).toBe(5);
  });

  it('rejects malformed glyph data', () => {
    const broken = { ...DISPLAY_FONT_SPEC, glyphs: { A: '##/#' } };
    expect(() => compileFont(broken)).toThrow(/glyph "A": rows must be equally long/);
    const short = { ...DISPLAY_FONT_SPEC, glyphs: { A: '##/##' } };
    expect(() => compileFont(short)).toThrow(/glyph "A": needs 7..9 rows/);
  });
});
