import { describe, expect, it } from 'vitest';
import { createExactAnchorResolver, NO_ANCHORS, normalizeTokens } from './anchors.js';

const words = [
  { text: 'The', t: 0.1, tEnd: 0.2 },
  { text: 'calculator,', t: 0.2, tEnd: 0.8 },
  { text: 'had', t: 0.9, tEnd: 1.0 },
  { text: '61', t: 1.1, tEnd: 1.4 },
  { text: 'KB.', t: 1.4, tEnd: 1.9 },
  { text: 'Only', t: 2.0, tEnd: 2.3 },
  { text: '61', t: 2.4, tEnd: 2.6 },
  { text: 'KB!', t: 2.6, tEnd: 3.0 },
];

describe('normalizeTokens', () => {
  it('lower-cases, strips punctuation and keeps diacritics', () => {
    expect(normalizeTokens('  Zażółć, "gęślą" JAŹŃ! ')).toEqual(['zażółć', 'gęślą', 'jaźń']);
  });
});

describe('createExactAnchorResolver', () => {
  const resolve = createExactAnchorResolver(words);

  it('resolves multi-word phrases ignoring case and punctuation', () => {
    expect(resolve('61 kb', 1)).toEqual({ t: 1.1, tEnd: 1.9 });
    expect(resolve('The Calculator', 1)).toEqual({ t: 0.1, tEnd: 0.8 });
  });

  it('honours nth and reports misses as undefined', () => {
    expect(resolve('61 KB', 2)).toEqual({ t: 2.4, tEnd: 3.0 });
    expect(resolve('61 KB', 3)).toBeUndefined();
    expect(resolve('doom', 1)).toBeUndefined();
    expect(resolve('', 1)).toBeUndefined();
    expect(resolve('61', 0)).toBeUndefined();
  });

  it('has a no-words fallback', () => {
    expect(NO_ANCHORS('anything', 1)).toBeUndefined();
  });
});
