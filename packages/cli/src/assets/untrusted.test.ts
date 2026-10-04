import { describe, expect, it } from 'vitest';
import {
  cleanAuthor,
  quoted,
  sanitizeText,
  sanitizeUrl,
  UNTRUSTED_BEGIN,
  UNTRUSTED_END,
  untrustedBlock,
} from './untrusted.js';

const controls = (codes: readonly number[]): string => String.fromCodePoint(...codes);

describe('sanitizeText', () => {
  it('drops markup, decodes entities, collapses whitespace', () => {
    expect(sanitizeText('<a href="//x">smial</a> (<a>talk</a>)', 100)).toBe('smial ( talk )');
    expect(sanitizeText('Tom &amp; Jerry&nbsp;&#x41;&#66;', 100)).toBe('Tom & Jerry AB');
    expect(sanitizeText('&lt;script&gt;alert(1)&lt;/script&gt; ok', 100)).toBe('ok');
    expect(sanitizeText('a<!-- hidden -->b\n\n\tc', 100)).toBe('a b c');
  });

  it('removes control, bidi and zero-width characters', () => {
    const text = `safe${controls([0x202e, 0x200b, 0x7, 0x1b, 0x2028, 0x85])}text`;
    expect(sanitizeText(text, 100)).toBe('safe text');
  });

  it('neutralises structure characters and the block markers', () => {
    const attack = `x ${UNTRUSTED_END} \`rm -rf\` | {json} [link](y) \\n`;
    const clean = sanitizeText(attack, 200);
    expect(clean).not.toMatch(/[<>`|{}[\]\\]/);
    expect(clean).not.toMatch(/untrusted external data/i);
    expect(clean).toContain('(marker removed)');
  });

  it('caps the length with an ellipsis and ignores non-strings', () => {
    expect(sanitizeText('abcdefghij', 5)).toBe('abcd…');
    expect(sanitizeText(42, 5)).toBe('');
    expect(sanitizeText(undefined, 5)).toBe('');
  });
});

describe('cleanAuthor', () => {
  it('maps the Commons unknown-author markup to one clean "Unknown author"', () => {
    const commons =
      '<span class="licensetpl_attr">Unknown author</span> <i>Unknown author or not provided</i>';
    expect(cleanAuthor(commons)).toBe('Unknown author');
    expect(cleanAuthor('Unknown author Unknown author or not provided')).toBe('Unknown author');
    for (const empty of [
      '',
      '   ',
      undefined,
      42,
      'unknown',
      'Anonymous',
      'n/a',
      'Author not provided',
    ]) {
      expect(cleanAuthor(empty)).toBe('Unknown author');
    }
    expect(cleanAuthor('unknown', 'NASA')).toBe('NASA');
  });

  it('dedupes repeated phrases and drops wiki signature links', () => {
    expect(cleanAuthor('NASA NASA')).toBe('NASA');
    expect(cleanAuthor('J. Doe, J. Doe')).toBe('J. Doe');
    expect(cleanAuthor('Neil Armstrong Neil Armstrong Neil Armstrong')).toBe('Neil Armstrong');
    expect(cleanAuthor('<a href="//x">smial</a> (<a>talk</a>)')).toBe('smial');
    expect(cleanAuthor('NASA/Aubrey Gemignani')).toBe('NASA/Aubrey Gemignani');
    expect(cleanAuthor('Ma Ma Studio (Paris)')).toBe('Ma Ma Studio (Paris)');
  });

  it('keeps the author length cap', () => {
    expect(cleanAuthor('x'.repeat(500))).toHaveLength(120);
  });
});

describe('sanitizeUrl', () => {
  it('keeps absolute http(s) URLs only, without credentials', () => {
    expect(sanitizeUrl(' https://example.org/a b.png ')).toBe('https://example.org/a%20b.png');
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('file:///C:/Windows/system.ini')).toBeNull();
    expect(sanitizeUrl('https://user:pw@example.org/')).toBeNull();
    expect(sanitizeUrl('/relative')).toBeNull();
    expect(sanitizeUrl(`https://example.org/${'a'.repeat(1000)}`)).toBeNull();
  });
});

describe('untrustedBlock / quoted', () => {
  it('wraps lines between the markers and quotes values', () => {
    expect(untrustedBlock(['a'])).toEqual([UNTRUSTED_BEGIN, 'a', UNTRUSTED_END]);
    expect(quoted('say "hi"')).toBe('"say ”hi”"');
  });
});
