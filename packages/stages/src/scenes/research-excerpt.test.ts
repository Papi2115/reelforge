import { describe, expect, it } from 'vitest';
import { craftVerdicts, isFactConflict, verdictFindings } from './critic.js';
import { RESEARCH_EXCERPT_BYTES, researchExcerpt, shotFocus } from './research-excerpt.js';

const FLUORINE =
  '- Fluorine testing (1949) showed the jaw had far less fluorine than the skull — https://en.wikipedia.org/wiki/Piltdown_Man';

/** Long notes: many unrelated facts around the one the shot is about. */
function longNotes(): string {
  const filler = Array.from(
    { length: 40 },
    (_, index) =>
      `- Filler fact ${String(index)} about gravel pits and museum visitors in Sussex — https://example.org/${String(index)}`,
  );
  return [
    '# Research',
    '',
    '## Key facts',
    ...filler.slice(0, 20),
    FLUORINE,
    ...filler.slice(20),
  ].join('\n');
}

describe('researchExcerpt', () => {
  it('is undefined without notes (the prompts stay as before)', () => {
    expect(researchExcerpt(undefined, 'anything')).toBeUndefined();
    expect(researchExcerpt('# Research\n\n', 'anything')).toBeUndefined();
  });

  it('keeps short notes whole, without headings and source links', () => {
    const notes = `# Research\n\n## Key facts\n${FLUORINE}\n- 2016 study — https://a.org and https://b.org\n`;
    expect(researchExcerpt(notes, 'fluorine')).toBe(
      '- Fluorine testing (1949) showed the jaw had far less fluorine than the skull\n- 2016 study',
    );
  });

  it('picks the lines that share words with the shot when the notes are long', () => {
    const notes = longNotes();
    expect(Buffer.byteLength(notes, 'utf8')).toBeGreaterThan(RESEARCH_EXCERPT_BYTES);
    const focus = shotFocus(
      { t0: 29, t1: 32, intent: 'two gauges: fluorine in the skull vs the jaw' },
      undefined,
    );
    const excerpt = researchExcerpt(notes, focus) ?? '';
    expect(Buffer.byteLength(excerpt, 'utf8')).toBeLessThanOrEqual(RESEARCH_EXCERPT_BYTES);
    expect(excerpt).toContain('jaw had far less fluorine than the skull');
    expect(excerpt).not.toContain('https://');
    // Original order is kept: the filler before the fluorine line stays before it.
    const lines = excerpt.split('\n');
    expect(lines.indexOf(FLUORINE.split(' — ')[0] ?? '')).toBeGreaterThan(0);
    expect(researchExcerpt(notes, focus)).toBe(excerpt);
  });

  it('reads the shot focus from its intent and the words spoken during it', () => {
    const words = {
      words: [
        { text: 'before', t: 1, tEnd: 1.2 },
        { text: 'fluorine', t: 30, tEnd: 30.4 },
        { text: 'after', t: 33, tEnd: 33.2 },
      ],
    } as unknown as Parameters<typeof shotFocus>[1];
    expect(shotFocus({ t0: 29, t1: 32, intent: 'gauges' }, words)).toBe('gauges fluorine');
  });
});

describe('fact-conflict verdicts', () => {
  const conflict = { verdict: 'off-intent' as const, note: 'fact-conflict: intent vs research' };

  it('become warnings; other failures stay errors', () => {
    const findings = verdictFindings([
      conflict,
      { verdict: 'clipped', note: 'caption cut' },
      { verdict: 'ok', note: 'Fact-Conflict: inverted gauges' },
      { verdict: 'ok', note: 'fine' },
    ]);
    expect(findings.map((entry) => entry.severity)).toEqual(['warning', 'error', 'warning']);
    expect(findings[0]?.message).toContain('fact conflict');
  });

  it('are not turned into craft failures', () => {
    const ok = { verdict: 'ok' as const, note: 'fact-conflict: inverted gauges' };
    expect(isFactConflict(ok)).toBe(true);
    expect(craftVerdicts([ok])).toEqual([ok]);
  });
});
