import { countWords, WORDS_PER_MINUTE as PROMPTS_WPM } from '@reelforge/prompts';
import { PIPELINE_STAGES } from '@reelforge/stages';
import { describe, expect, it } from 'vitest';
import {
  countSpokenWords,
  estimateLine,
  formatMinutes,
  scriptEstimate,
  verdictOf,
  WORDS_PER_MINUTE,
} from './script-stats.js';
import { PIPELINE_STAGE_KEYS } from './stages-contract.js';

describe('script stats', () => {
  it('counts words exactly like the script validator', () => {
    const samples = [
      '',
      '   ',
      'Hello world.',
      'Zażółć gęślą jaźń — 1672, and… “quotes” here!',
      'line one\nline two\r\n\tthird — - 42',
    ];
    for (const text of samples) expect(countSpokenWords(text)).toBe(countWords(text));
    expect(WORDS_PER_MINUTE).toBe(PROMPTS_WPM);
  });

  it('estimates the duration at 150 wpm against the brief target', () => {
    const text = Array.from({ length: 84 }, () => 'word').join(' ');
    const estimate = scriptEstimate(text, 0.5);
    expect(estimate).toMatchObject({
      words: 84,
      seconds: 33.6,
      targetWords: 75,
      targetSeconds: 30,
      verdict: 'ok',
    });
    expect(estimateLine(estimate)).toBe('84 words · ~0:34 · target 0:30 (+12 %)');
    expect(scriptEstimate(text, null)).toMatchObject({ targetWords: null, verdict: 'none' });
    expect(estimateLine(scriptEstimate('one', null))).toBe('1 word · ~0:00');
  });

  it('turns amber outside ±15 % and red outside ±30 %', () => {
    expect([0, 0.15, -0.15, 0.2, -0.3, 0.31, -0.5].map(verdictOf)).toEqual([
      'ok',
      'ok',
      'ok',
      'warn',
      'warn',
      'bad',
      'bad',
    ]);
    expect(verdictOf(null)).toBe('none');
  });

  it('formats minutes', () => {
    expect([0, 29.6, 61, 600].map(formatMinutes)).toEqual(['0:00', '0:30', '1:01', '10:00']);
  });

  it('lists the same pipeline stages as the stage runner', () => {
    expect([...PIPELINE_STAGE_KEYS]).toEqual([...PIPELINE_STAGES]);
  });
});
