import { describe, expect, it } from 'vitest';
import {
  countSpokenWords,
  hookSetFile,
  hookSetSchema,
  replaceScriptOpening,
  scriptOpening,
  spokenSeconds,
} from './hook-lab.js';

const SCRIPT =
  'Here is a quick experiment.\nTry it at home.\n\nWhite light is a mix.\r\n\r\nNewton saw it.\n';

describe('hook lab helpers', () => {
  it('finds the opening paragraph and replaces only it', () => {
    expect(scriptOpening(SCRIPT)).toEqual({
      text: 'Here is a quick experiment.\nTry it at home.',
      start: 0,
      end: 43,
    });
    expect(scriptOpening('\n\n  One paragraph only.  \n')?.text).toBe('One paragraph only.');
    expect(scriptOpening('  \n ')).toBeUndefined();
    const replaced = replaceScriptOpening(SCRIPT, '  What if light could split?  ');
    expect(replaced).toBe(
      'What if light could split?\n\nWhite light is a mix.\r\n\r\nNewton saw it.\n',
    );
    expect(replaceScriptOpening('', 'New.')).toBe('New.\n');
  });

  it('counts spoken words like the script validator and estimates seconds at 150 wpm', () => {
    expect(countSpokenWords('In 1672 — Newton split light!')).toBe(5);
    expect(spokenSeconds(50)).toBe(20);
  });

  it('validates a set: exactly three variants, a decision only once made', () => {
    const variant = (index: number, style: string) => ({
      index,
      style,
      text: 'x',
      firstVisual: 'y',
      claimsToSource: false,
      wordCount: 1,
    });
    const set = {
      version: 1,
      number: 2,
      createdAt: '2026-10-04T10:00:00.000Z',
      opening: 'Old.',
      scriptFingerprint: 'abcd1234',
      variants: [variant(1, 'cold-open'), variant(2, 'question'), variant(3, 'shocking-fact')],
    };
    expect(hookSetSchema.parse(set).warnings).toEqual([]);
    expect(hookSetSchema.safeParse({ ...set, variants: set.variants.slice(0, 2) }).success).toBe(
      false,
    );
    expect(
      hookSetSchema.safeParse({ ...set, decision: { kind: 'pick', index: 4, at: set.createdAt } })
        .success,
    ).toBe(false);
    expect(hookSetFile(2)).toBe('.reelforge/hooks/2.json');
  });
});
