/**
 * Alignment quality on the spike 03 fixtures (thresholds: docs/spikes/03-audio.md §9 "4.4") and
 * alignment speed on long scripts (ADR-003: must be banded / anchor-split).
 */
import { describe, expect, it } from 'vitest';
import { alignScript, type AsrWord } from './align.js';
import { SPIKE_SAMPLES, loadSpikeFixture, startErrors } from './test-fixtures.js';
import { tokenizeScript } from '../text/normalize.js';

const MAX_RAW_WER = { en: 0.07, pl: 0.05 } as const;

describe('alignment on spike fixtures (turbo-q5, chunk mode, original audio)', () => {
  for (const sample of SPIKE_SAMPLES) {
    it(`${sample.id}: coverage, WER and start-time accuracy within spike thresholds`, () => {
      const fixture = loadSpikeFixture(sample.id);
      const result = alignScript(fixture.script, fixture.asr, {
        lang: sample.lang,
        audioS: fixture.audioS,
      });
      expect(result.words.map((word) => word.text)).toEqual(
        fixture.truth.words.map((word) => word.text),
      );
      expect(result.stats.coverage).toBeGreaterThanOrEqual(0.92);
      expect(result.stats.wer).toBeLessThanOrEqual(MAX_RAW_WER[sample.lang]);
      expect(result.stats.monotonic).toBe(true);
      const errors = startErrors(result.words, fixture.truth);
      expect(errors.n).toBeGreaterThan(60);
      expect(errors.maeMs).toBeLessThanOrEqual(120);
      expect(errors.within150).toBeGreaterThanOrEqual(0.85);
    });
  }
});

/** Deterministic pseudo-random generator (tests only). */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** Script of `count` words + a degraded "ASR" of it (substitutions, drops, insertions). */
function syntheticPair(
  vocabulary: readonly string[],
  count: number,
  seed: number,
): { script: string; asr: AsrWord[] } {
  const random = lcg(seed);
  const pick = (): string => vocabulary[Math.floor(random() * vocabulary.length)] ?? 'word';
  const words = Array.from({ length: count }, pick);
  const asr: AsrWord[] = [];
  words.forEach((word, k) => {
    const roll = random();
    const t = k * 0.4;
    if (roll < 0.03) return; // dropped
    const text = roll < 0.06 ? pick() : word; // substituted
    asr.push({ text, t, tEnd: t + 0.35, p: 0.9 });
    if (roll > 0.98) asr.push({ text: 'uh', t: t + 0.36, tEnd: t + 0.39, p: 0.5 });
  });
  const paragraphs: string[] = [];
  for (let k = 0; k < words.length; k += 60) paragraphs.push(words.slice(k, k + 60).join(' '));
  return { script: paragraphs.join('\n\n'), asr };
}

function elapsedMs(started: bigint): number {
  return Number(process.hrtime.bigint() - started) / 1e6;
}

describe('alignment performance', () => {
  const doom = loadSpikeFixture('en-doom');
  const realVocabulary = tokenizeScript(doom.script).map((word) => word.text);

  it('aligns 1,700 words of varied text in under 2 s (anchor split)', () => {
    const vocabulary = Array.from({ length: 900 }, (_, k) => `w${k.toString(36)}x`).concat(
      realVocabulary,
    );
    const { script, asr } = syntheticPair(vocabulary, 1700, 7);
    const started = process.hrtime.bigint();
    const { coverage } = alignScript(script, asr, { lang: 'en' }).stats;
    const ms = elapsedMs(started);
    expect(ms).toBeLessThan(2000);
    expect(coverage).toBeGreaterThan(0.9);
  });

  it('aligns 1,700 words of highly repetitive text in under 2 s (banded fallback)', () => {
    const { script, asr } = syntheticPair(realVocabulary.slice(0, 12), 1700, 11);
    const started = process.hrtime.bigint();
    const { coverage } = alignScript(script, asr, { lang: 'en' }).stats;
    const ms = elapsedMs(started);
    expect(ms).toBeLessThan(2000);
    expect(coverage).toBeGreaterThan(0.85);
  });

  it('aligns the real fixture repeated 20x (1,400+ words) with spike-level coverage', () => {
    const script = Array.from({ length: 20 }, () => doom.script).join('\n\n');
    const span = doom.audioS;
    const asr = Array.from({ length: 20 }, (_, n) =>
      doom.asr.map((word) => ({ ...word, t: word.t + n * span, tEnd: word.tEnd + n * span })),
    ).flat();
    const started = process.hrtime.bigint();
    const result = alignScript(script, asr, { lang: 'en' });
    const ms = elapsedMs(started);
    expect(ms).toBeLessThan(2000);
    const single = alignScript(doom.script, doom.asr, { lang: 'en' });
    expect(result.stats.coverage).toBeCloseTo(single.stats.coverage, 2);
  });
});
