/**
 * Length control of Grim Ink scripts (PLAN.md#14.18): the script prompt states the words budget
 * from 150 wpm (~2.5 words/s × the target) and the validator warns past +10 %; other worlds and
 * the plain explainer keep the ±15 % target only.
 */
import { describe, expect, it } from 'vitest';
import { renderPrompt as render } from './catalog.js';
import { validateScript } from './validators/script.js';
import { scriptWorldVars, worldPromptText, worldWordBudget } from './worlds/index.js';

const words = (count: number): string =>
  Array.from({ length: count }, (_, index) => `word${String(index)}`).join(' ') + '.';

describe('Grim Ink length control', () => {
  it('states the words budget in the script prompt', () => {
    const text = worldPromptText('c-cam');
    if (text === undefined) throw new Error('no c-cam prompt text');
    expect(worldWordBudget(text, 0.5)).toEqual({ words: 75, over: 0.1, wordsPerSecond: 2.5 });
    const vars = scriptWorldVars({ label: 'Grim Ink', text }, 0.5);
    expect(vars['worldScript']).toContain('~2.5 words/s × 30 s = 75 words');
    expect(vars['worldScript']).toContain('more than 82 words is too long');
    const prompt = render('script', {
      brief: 'x',
      language: 'en',
      targetMinutes: 0.5,
      targetWords: 75,
      tone: 't',
      audience: 'a',
      ...vars,
    });
    expect(prompt.ok && prompt.value).toContain('words budget is ~2.5 words/s × 30 s = 75 words');
  });

  it('leaves other worlds without a budget', () => {
    const comic = worldPromptText('comic');
    if (comic === undefined) throw new Error('no comic prompt text');
    expect(worldWordBudget(comic, 1)).toBeUndefined();
    expect(scriptWorldVars({ label: 'Comic', text: comic }, 1)['worldScript']).toBeUndefined();
  });

  it('warns when the script runs over the budget by more than 10 %', () => {
    const budget = { words: 75, over: 0.1 };
    const codes = (count: number): string[] =>
      validateScript(words(count), { targetWords: 75, budget }).issues.map(
        (entry) => `${entry.severity}:${entry.code}`,
      );
    expect(codes(82)).toEqual([]);
    expect(codes(83)).toEqual(['warning:word-budget']);
    expect(validateScript(words(83), { targetWords: 75 }).issues).toEqual([]);
  });
});
