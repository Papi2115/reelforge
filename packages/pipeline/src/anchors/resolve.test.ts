import { describe, expect, it } from 'vitest';
import { AnchorIndex, resolveAnchor, type AnchorWord } from './resolve.js';
import { alignScript } from '../align/align.js';
import { loadSpikeFixture } from '../align/test-fixtures.js';

/** words.json-like list: one word every 0.5 s. */
function words(text: string, confidence = 1): AnchorWord[] {
  return text
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word, k) => ({ text: word, t: k * 0.5, tEnd: k * 0.5 + 0.4, confidence }));
}

const SCRIPT = words(
  'The spec sheet says 61 KB. Then the Spec-Sheet, again: only 61KB! Zażółć gęślą jaźń. In 1993, Doom shipped.',
);

describe('resolveAnchor', () => {
  it('ignores case and punctuation and returns the time span of the phrase', () => {
    const hit = resolveAnchor(SCRIPT, 'spec sheet');
    expect(hit).toMatchObject({
      ok: true,
      value: { t: 0.5, tEnd: 1.4, from: 1, to: 2, similarity: 1 },
    });
  });

  it('counts repetitions with nth', () => {
    expect(resolveAnchor(SCRIPT, 'spec sheet', 2)).toMatchObject({
      ok: true,
      value: { t: 4, tEnd: 4.4, from: 8, text: 'Spec-Sheet,' },
    });
    expect(resolveAnchor(SCRIPT, 'the', 2)).toMatchObject({ ok: true, value: { from: 7 } });
  });

  it('treats "61 KB", "61KB" and spelled numbers as the same phrase', () => {
    expect(resolveAnchor(SCRIPT, '61 KB')).toMatchObject({ ok: true, value: { from: 4, to: 5 } });
    expect(resolveAnchor(SCRIPT, '61KB', 2)).toMatchObject({
      ok: true,
      value: { from: 11, to: 11 },
    });
    expect(resolveAnchor(SCRIPT, 'sixty-one kilobytes', 2)).toMatchObject({
      ok: true,
      value: { from: 11 },
    });
    expect(resolveAnchor(SCRIPT, 'nineteen ninety three')).toMatchObject({ ok: false });
    expect(resolveAnchor(SCRIPT, '1993')).toMatchObject({ ok: true, value: { from: 16 } });
  });

  it('is diacritics-insensitive', () => {
    expect(resolveAnchor(SCRIPT, 'zazolc gesla jazn', 1, { lang: 'pl' })).toMatchObject({
      ok: true,
      value: { from: 12, to: 14, similarity: 1 },
    });
  });

  it('falls back to near matches when nothing matches exactly', () => {
    const hit = resolveAnchor(SCRIPT, 'spec sheets');
    expect(hit.ok).toBe(true);
    if (hit.ok) {
      expect(hit.value.from).toBe(1);
      expect(hit.value.similarity).toBeLessThan(1);
      expect(hit.value.similarity).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('weights confidence by word confidence', () => {
    expect(resolveAnchor(words('a b c', 0.5), 'b')).toMatchObject({
      ok: true,
      value: { confidence: 0.5 },
    });
  });

  it('explains a missing nth with the occurrences it did find', () => {
    const miss = resolveAnchor(SCRIPT, 'spec sheet', 3);
    expect(miss.ok).toBe(false);
    if (!miss.ok && miss.error.kind === 'not-found') {
      expect(miss.error.occurrences).toBe(2);
      expect(miss.error.candidates.map((c) => c.from)).toEqual([1, 8]);
      expect(miss.error.message).toContain('occurs only 2 times');
      expect(miss.error.message).toContain('"Spec-Sheet," at 4.00s');
    }
  });

  it('lists the closest candidates when the phrase is not spoken', () => {
    const miss = resolveAnchor(SCRIPT, 'Dom shipping');
    expect(miss.ok).toBe(false);
    if (!miss.ok && miss.error.kind === 'not-found') {
      expect(miss.error.occurrences).toBe(0);
      expect(miss.error.candidates[0]?.text).toBe('Doom shipped.');
      expect(miss.error.message).toMatch(
        /not found in words\.json\. Closest matches: "Doom shipped\." at 8\.50s/,
      );
    }
  });

  it('rejects empty phrases and invalid nth', () => {
    expect(resolveAnchor(SCRIPT, ' ... ')).toMatchObject({
      ok: false,
      error: { kind: 'invalid-phrase' },
    });
    expect(resolveAnchor(SCRIPT, 'spec', 0)).toMatchObject({
      ok: false,
      error: { kind: 'invalid-nth' },
    });
    expect(resolveAnchor(SCRIPT, 'spec', 1.5)).toMatchObject({
      ok: false,
      error: { kind: 'invalid-nth' },
    });
  });

  it('resolves against an aligned spike fixture within the ±150 ms anchor tolerance', () => {
    const fixture = loadSpikeFixture('en-doom');
    const aligned = alignScript(fixture.script, fixture.asr, { lang: 'en' }).words;
    const index = new AnchorIndex(aligned);
    const truthIndex = fixture.truth.words.findIndex((word) => word.text === 'Doom,');
    const hit = index.resolve('called Doom');
    expect(hit.ok).toBe(true);
    if (hit.ok) {
      const truthT = fixture.truth.words[truthIndex - 1]?.t ?? Number.NaN;
      expect(Math.abs(hit.value.t - truthT)).toBeLessThanOrEqual(0.15);
    }
    expect(index.occurrences('it').length).toBeGreaterThanOrEqual(3);
  });
});
