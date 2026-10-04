import { describe, expect, it } from 'vitest';
import { renderPrompt } from '../catalog.js';
import { hooksPromptVars, numbersIn, validateHooksReply } from './hooks.js';

const OPENING =
  'Here is a quick experiment you can try at home. Take a glass of water and shine a flashlight through it.';
const RESEARCH =
  '- Newton described it in 1672 — https://example.org\n- Index about 1.33 — https://x.org';

const COLD =
  'A beam of white light hits a plain glass of water on a kitchen table, and suddenly a small rainbow glows on the wall behind it. No prism, no lab, no special equipment. Just a flashlight, a glass and a dark room. So where do those colours come from?';
const QUESTION =
  'What if the plain white light from your flashlight was secretly hiding every colour of the rainbow? You can find out tonight with nothing more than a glass of water, a table and a dark room. Shine the light through the glass and watch what the water quietly reveals on the wall.';
const FACT =
  'In 1672, Isaac Newton showed that white light is not one colour at all. It is a mix of many, and anything that bends light can pull them apart. Water does it too: its index of about 1.33 is enough to split a beam. You can see it yourself, at home, tonight.';

function hook(style: string, text: string, claimsToSource = false) {
  return { style, text, firstVisual: 'A beam of light', claimsToSource };
}

function reply(hooks: readonly object[]): string {
  return JSON.stringify({ hooks });
}

const OPTIONS = { currentOpening: OPENING, research: RESEARCH };

describe('validateHooksReply', () => {
  it('accepts three different openings, orders them and flags numbers as claims', () => {
    const checked = validateHooksReply(
      reply([hook('shocking-fact', FACT), hook('cold-open', COLD), hook('question', QUESTION)]),
      OPTIONS,
    );
    expect(checked.valid).toBe(true);
    expect(checked.value?.map((entry) => [entry.index, entry.style, entry.claimsToSource])).toEqual(
      [
        [1, 'cold-open', false],
        [2, 'question', false],
        [3, 'shocking-fact', true],
      ],
    );
    expect(checked.value?.[0]?.wordCount).toBe(49);
    expect(checked.issues.map((entry) => entry.code)).toEqual(['hook-claim-flag']);
  });

  it('checks word counts, spoken form, distinct forms and differences', () => {
    const codes = (hooks: readonly object[]): string[] =>
      validateHooksReply(reply(hooks), OPTIONS).issues.map((entry) => entry.code);
    expect(
      codes([
        hook('cold-open', 'Too short.'),
        hook('question', QUESTION),
        hook('shocking-fact', FACT, true),
      ]),
    ).toContain('hook-word-count');
    expect(
      codes([
        hook('cold-open', `[VISUAL] ${COLD}`),
        hook('question', QUESTION),
        hook('shocking-fact', FACT, true),
      ]),
    ).toContain('stage-direction');
    expect(
      codes([
        hook('cold-open', COLD),
        hook('cold-open', QUESTION),
        hook('shocking-fact', FACT, true),
      ]),
    ).toContain('hook-styles');
    expect(
      codes([
        hook('cold-open', COLD),
        hook('question', `${COLD} Really.`),
        hook('shocking-fact', FACT, true),
      ]),
    ).toContain('hook-similar');
    expect(
      codes([
        hook('cold-open', OPENING),
        hook('question', QUESTION),
        hook('shocking-fact', FACT, true),
      ]),
    ).toContain('hook-unchanged');
  });

  it('refuses numbers missing in research.md unless the opening is flagged', () => {
    const invented = FACT.replace('1672', '1666');
    const strict = validateHooksReply(
      reply([hook('cold-open', COLD), hook('question', QUESTION), hook('shocking-fact', invented)]),
      OPTIONS,
    );
    expect(strict.valid).toBe(false);
    expect(strict.issues.map((entry) => entry.code)).toContain('hook-number-not-in-research');
    const flagged = validateHooksReply(
      reply([
        hook('cold-open', COLD),
        hook('question', QUESTION),
        hook('shocking-fact', invented, true),
      ]),
      OPTIONS,
    );
    expect(flagged.valid).toBe(true);
    expect(flagged.issues.map((entry) => entry.code)).toEqual(['hook-number-unsourced']);
  });

  it('rejects broken replies', () => {
    expect(validateHooksReply('nope', OPTIONS).issues[0]?.code).toBe('invalid-json');
    expect(validateHooksReply(reply([hook('cold-open', COLD)]), OPTIONS).valid).toBe(false);
  });

  it('normalises numbers', () => {
    expect(numbersIn('In 1672, 1704 and 1,024 or 3,5 and 1.33.')).toEqual([
      '1672',
      '1704',
      '1024',
      '3,5',
      '1.33',
    ]);
  });
});

describe('hooksPromptVars', () => {
  it('splits the script into the opening and the rest and renders the prompt', () => {
    const vars = hooksPromptVars({
      script: `${OPENING}\n\nThe rest stays.\n`,
      research: RESEARCH,
      language: 'pl',
    });
    expect(vars).toMatchObject({ language: 'Polish', opening: OPENING, rest: 'The rest stays.' });
    const prompt = renderPrompt('hooks', vars ?? {});
    expect(prompt.ok && prompt.value).toContain('40–70 spoken words');
    expect(prompt.ok && prompt.value).toContain('Do not create or edit any file');
    expect(hooksPromptVars({ script: ' \n', research: '', language: 'en' })).toBeUndefined();
  });
});
