import { describe, expect, it } from 'vitest';
import { renderPrompt } from '../catalog.js';
import { validatePlanReply, validateTriageReply } from './review.js';

const shotIds = ['s01', 's02', 's03'];

describe('validateTriageReply', () => {
  it('keeps suspects of known shots and warns about unknown or repeated ones', () => {
    const reply = JSON.stringify({
      suspects: [
        { shot: 's02', reason: 'title cut off at the right edge' },
        { shot: 's09', reason: 'no such shot' },
        { shot: 's02', reason: 'again' },
      ],
    });
    const report = validateTriageReply(reply, { shotIds });
    expect(report.valid).toBe(true);
    expect(report.value).toEqual({
      suspects: [{ shot: 's02', reason: 'title cut off at the right edge' }],
    });
    expect(report.issues.map((entry) => entry.code)).toEqual(['unknown-shot', 'repeated-shot']);
  });

  it('accepts an empty list and a fenced reply, rejects prose', () => {
    expect(validateTriageReply('```json\n{"suspects":[]}\n```', { shotIds }).valid).toBe(true);
    const prose = validateTriageReply('All shots look fine.', { shotIds });
    expect(prose.valid).toBe(false);
    expect(prose.issues[0]?.code).toBe('invalid-json');
  });

  it('takes the first JSON object of a chatty reply (fenced JSON followed by prose)', () => {
    const fenced =
      '```json\n{"suspects":[{"shot":"s03","reason":"hand over the label {left}"}]}\n```\n\nAll other shots look consistent; s03 has the hand over its label.';
    const report = validateTriageReply(fenced, { shotIds });
    expect(report.valid).toBe(true);
    expect(report.value?.suspects).toEqual([{ shot: 's03', reason: 'hand over the label {left}' }]);
    expect(report.issues.map((entry) => entry.code)).toEqual(['embedded-json']);
    const inline = validateTriageReply(
      'Here is my verdict: {"suspects":[{"shot":"s01","reason":"blank \\"page\\""}]} Thanks.',
      { shotIds },
    );
    expect(inline.value?.suspects).toEqual([{ shot: 's01', reason: 'blank "page"' }]);
    const brokenFirst = validateTriageReply('{not json} then {"suspects":[]}', { shotIds });
    expect(brokenFirst.value).toEqual({ suspects: [] });
  });
});

describe('validatePlanReply', () => {
  it('validates the fix list', () => {
    const report = validatePlanReply('{"fixes":[{"shot":"s01","change":"Move the title up."}]}', {
      shotIds,
    });
    expect(report.value?.fixes).toEqual([{ shot: 's01', change: 'Move the title up.' }]);
    expect(validatePlanReply('{"fixes":[{"shot":"s01"}]}', { shotIds }).valid).toBe(false);
  });
});

describe('review prompts', () => {
  it('render with their variables', () => {
    const triage = renderPrompt('review-triage', {
      imagePaths: '.reelforge/frames/review/sheet-1.png',
      shots: [{ id: 's01', intent: 'Doom runs anywhere' }],
      styleId: 'voxel-pixel-crisp640',
      focus: 'text size',
    });
    expect(triage.ok && triage.value).toContain('Pay extra attention to: text size');
    const plan = renderPrompt('review-plan', {
      request: 'Review the whole video and fix what looks wrong.',
      suspects: [{ shot: 's01', reason: 'blank' }],
    });
    expect(plan.ok && plan.value).not.toContain('Findings of the app');
  });
});
