import { endCardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import {
  checkShortStoryboard,
  firstSentence,
  validateShortHooks,
  validateShortScript,
} from './short.js';
import { checkShortCuts, validateStoryboard } from './storyboard.js';

const SCRIPT_30 = `Your kitchen glass is hiding a rainbow.

Fill it with water, shine a flashlight through it at an angle, and a tiny band of colors appears on the wall. No prism, no lab, nothing special.

But why does plain water do this? Isaac Newton studied the same effect in 1672 with a prism in a dark room. And one color always bends more than all the others.

The full answer is in the full video.
`;

const codes = (issues: readonly { code: string; severity: string }[], severity = 'error') =>
  issues.filter((entry) => entry.severity === severity).map((entry) => entry.code);

describe('validateShortScript', () => {
  it('accepts a 30 s teaser within its budget', () => {
    const result = validateShortScript(SCRIPT_30, { lengthS: 30 });
    expect(result.valid).toBe(true);
    expect(result.value).toEqual({ wordCount: 75, targetWords: 73, firstSentenceWords: 7 });
  });

  it('rejects a long first sentence, call-to-action phrases and a blown budget', () => {
    const long = `In this video we will look at a glass of water on a table. ${SCRIPT_30}`;
    expect(codes(validateShortScript(long, { lengthS: 30 }).issues)).toEqual([
      'word-count',
      'short-first-sentence',
      'short-forbidden-phrase',
    ]);
    const cta = SCRIPT_30.replace('The full answer', 'Subscribe! The full answer');
    expect(codes(validateShortScript(cta, { lengthS: 30 }).issues)).toContain(
      'short-forbidden-phrase',
    );
    expect(codes(validateShortScript(SCRIPT_30, { lengthS: 60 }).issues)).toEqual(['word-count']);
  });

  it('finds the first sentence', () => {
    expect(firstSentence('  Why? Because.')).toBe('Why?');
    expect(firstSentence('No end mark')).toBe('No end mark');
    expect(firstSentence('He said "stop." Then left.')).toBe('He said "stop."');
  });
});

describe('validateShortHooks', () => {
  const HOOKS = `## Hooks
1. Your kitchen glass is hiding a rainbow. — a familiar object with a secret
2. Water can split white light apart. — a bold claim
3. Newton needed a dark room for this. — a famous name
Chosen: 1
`;

  it('reads three hooks and the chosen one; the script opens with it', () => {
    const result = validateShortHooks(HOOKS, { script: SCRIPT_30 });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.value?.chosen).toBe(1);
    expect(result.value?.hooks[1]).toBe('Water can split white light apart.');
  });

  it('warns when the script opens with another line and rejects missing parts', () => {
    expect(
      codes(
        validateShortHooks(HOOKS.replace('Chosen: 1', 'Chosen: 2'), { script: SCRIPT_30 }).issues,
        'warning',
      ),
    ).toEqual(['hooks-mismatch']);
    expect(codes(validateShortHooks('1. One.\n2. Two.\n').issues)).toEqual([
      'hooks-count',
      'hooks-chosen',
    ]);
    expect(codes(validateShortHooks('1. Same.\n2. Same.\n3. Other.\nChosen: 3').issues)).toEqual([
      'hooks-duplicate',
    ]);
  });
});

function shots(lengths: readonly number[], hook = true) {
  let t = 0;
  return lengths.map((length, index) => {
    const shot = {
      id: `s${String(index + 1).padStart(2, '0')}`,
      t0: t,
      t1: Math.round((t + length) * 1000) / 1000,
      treatment: index % 2 === 0 ? 'title-card' : 'metaphor-object',
      intent: 'x',
      scene: `scenes/s${String(index + 1).padStart(2, '0')}.js`,
      ...(index === 0 && hook ? { hook: true } : {}),
    };
    t = shot.t1;
    return shot;
  });
}

describe('checkShortStoryboard', () => {
  it('passes a fast-cut short', () => {
    expect(
      checkShortStoryboard(shots([2, 2.5, 2, 3, 2, 2.5, 2, 2, 3, 2.5, 2.5, 2]), { lengthS: 30 }),
    ).toEqual([]);
  });

  it('flags a long hook, a slow average, a missing hook flag and an overlong short', () => {
    const slow = checkShortStoryboard(
      shots([3.4, 3.4, 3.4, 3.4, 3.4, 3.4, 3.4, 3.4, 3.4, 3.4], false),
      {
        lengthS: 30,
      },
    );
    expect(codes(slow)).toEqual(['short-hook-length', 'short-shot-rate']);
    expect(codes(slow, 'warning')).toEqual(['short-hook-flag', 'short-length']);
  });
});

describe('validateStoryboard with a short', () => {
  it('applies the short rules and skips a trailing end card; an end card mid-film is an error', () => {
    const narration = shots([2, 2.5, 2, 3, 2, 2.5, 2, 2, 3, 2.5, 2.5, 2]);
    const last = narration.at(-1)?.t1 ?? 0;
    const endCard = {
      id: 'end_card',
      t0: last,
      t1: last + 2,
      treatment: 'kinetic-text',
      intent: 'End card',
      scene: 'scenes/end_card.js',
      endCard: true,
    };
    const text = JSON.stringify({ version: 1, shots: [...narration, endCard] });
    const report = validateStoryboard(text, { short: { lengthS: 30 } });
    expect(codes(report.issues)).toEqual([]);
    const long = JSON.stringify({ version: 1, shots: shots([4, 2, 2, 2, 2, 2]) });
    expect(codes(validateStoryboard(long, { short: { lengthS: 30 } }).issues)).toEqual(
      expect.arrayContaining(['shot-length', 'short-hook-length']),
    );
    const middle = JSON.stringify({
      version: 1,
      shots: [{ ...narration[0], endCard: true }, ...narration.slice(1)],
    });
    expect(codes(validateStoryboard(middle).issues)).toContain('end-card-position');
  });
});

describe('checkShortCuts (reelforge validate)', () => {
  const typed = (lengths: readonly number[]) =>
    shots(lengths).map((shot) => ({ ...shot, treatment: 'title-card' as const }));

  it('passes a fast-cut short and exempts its trailing end card', () => {
    const narration = typed([2, 2.5, 2, 3, 2, 2.5, 2, 2, 3, 2.5, 2.5, 2]);
    const card = endCardShot(narration.at(-1)?.t1 ?? 0, 'Full video on YT: Voxplain');
    expect(checkShortCuts([...narration, card], { lengthS: 30 })).toEqual([]);
  });

  it('reports the short cut rules: shot length, hook, cut rate and a misplaced end card', () => {
    const slow = typed([4, 5, 5, 5, 5]);
    expect(codes(checkShortCuts(slow, { lengthS: 30 }))).toEqual([
      'shot-length',
      'shot-length',
      'shot-length',
      'shot-length',
      'shot-length',
      'short-hook-length',
      'short-shot-rate',
    ]);
    const card = endCardShot(2, 'Full video on YT: Voxplain');
    const middle = [
      ...typed([2]),
      card,
      ...typed([2, 2]).map((shot) => ({ ...shot, t0: shot.t0 + 4, t1: shot.t1 + 4 })),
    ];
    expect(codes(checkShortCuts(middle, { lengthS: 30 }))).toContain('end-card-position');
  });
});
