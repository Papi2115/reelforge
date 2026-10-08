import { storyboardShotSchema } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { offensiveJsonIssues, offensiveTextIssues } from './offensive.js';
import { validateScript } from './script.js';
import { validateStoryboard } from './storyboard.js';

const shot = (intent: string, annotations?: unknown) =>
  storyboardShotSchema.parse({
    id: 's00',
    t0: 0,
    t1: 5,
    treatment: 'map',
    intent,
    scene: 'scenes/s00.js',
    ...(annotations === undefined ? {} : { annotations }),
  });

describe('offensive words in stage outputs', () => {
  it('flags a slur in the narration as a script error, once per word', () => {
    const text = 'The pick hit the flint. Chink. Then another chink, and the skull was out.';
    const result = validateScript(text, { targetWords: 15 });
    expect(result.valid).toBe(false);
    expect(result.issues.filter((entry) => entry.code === 'offensive-word')).toEqual([
      {
        severity: 'error',
        code: 'offensive-word',
        message: 'offensive or slur-like word "Chink" — use another word (e.g. CLINK, CLANG, TINK)',
      },
      {
        severity: 'error',
        code: 'offensive-word',
        message: 'offensive or slur-like word "chink" — use another word (e.g. CLINK, CLANG, TINK)',
      },
    ]);
  });

  it('keeps clean narration clean', () => {
    const text = 'Glasses were clinking and chinking while the ink dried; think of a clink.';
    expect(offensiveTextIssues(text)).toEqual([]);
    expect(validateScript(text, { targetWords: 13 }).valid).toBe(true);
  });

  it('flags any string of the storyboard with its path', () => {
    const intent = 'a pick strikes the gravel: CHINK breaks the frame';
    const text = JSON.stringify({ version: 1, shots: [shot(intent)] });
    const issues = validateStoryboard(text).issues.filter(
      (entry) => entry.code === 'offensive-word',
    );
    expect(issues).toEqual([
      {
        severity: 'error',
        code: 'offensive-word',
        message: 'offensive or slur-like word "CHINK" — use another word (e.g. CLINK, CLANG, TINK)',
        path: 'shots[0].intent',
      },
    ]);
    expect(offensiveJsonIssues({ shots: [shot('a pick strikes the gravel: CLINK')] })).toEqual([]);
  });
});
