import { describe, expect, it } from 'vitest';
import { NO_QUESTIONS, repairPrompt } from '../stages/repair.js';
import { closingQuestion, questionFinding } from './fix-reply.js';

describe('closingQuestion', () => {
  it('finds a question in the last paragraph', () => {
    expect(closingQuestion('Changed the gauge.\n\nShould I go ahead, or undo these edits?')).toBe(
      'Should I go ahead, or undo these edits?',
    );
    expect(closingQuestion('Done.\r\n\r\n**Want me to revert it?**\n')).toBe(
      '**Want me to revert it?**',
    );
    expect(closingQuestion('One line only, ok?')).toBe('One line only, ok?');
  });

  it('ignores questions that are not the closing paragraph and plain reports', () => {
    expect(
      closingQuestion('Why was it clipped? The camera.\n\nMoved it; verified.'),
    ).toBeUndefined();
    expect(closingQuestion('Moved the caption. Verified at 1.2 s.')).toBeUndefined();
    expect(closingQuestion('')).toBeUndefined();
  });

  it('shortens a long question in the finding', () => {
    const message = questionFinding(`${'a'.repeat(300)}?`).message;
    expect(message).toContain('…');
    expect(message.length).toBeLessThan(320);
  });
});

describe('repairPrompt', () => {
  it('keeps the built-in text and adds the no-questions close for worlds', () => {
    const legacy = repairPrompt('storyboard.json', ['a: b']);
    expect(legacy).toBe(
      "The file `storyboard.json` you wrote does not pass the app's checks:\n- a: b\n\nFix `storyboard.json` in place following the original rules of this task. Change nothing else, then reply with one line saying what you fixed.",
    );
    expect(repairPrompt('storyboard.json', ['a: b'], true)).toBe(`${legacy} ${NO_QUESTIONS}`);
  });
});
