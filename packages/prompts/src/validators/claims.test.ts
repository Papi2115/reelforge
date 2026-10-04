import { researchClaimSources, researchSourceExcerpts, scriptSentences } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { renderPrompt } from '../catalog.js';
import {
  CLAIMS_SOURCE_TEXT_MAX,
  claimsFileFromReply,
  claimsPromptVars,
  validateClaimsReply,
} from './claims.js';

const SCRIPT = 'Doom came out in 1993. It needed four megabytes of memory.\n\nIt runs everywhere.';
const SOURCES = researchClaimSources(
  '- Doom released December 1993 — https://doomwiki.org/wiki/Doom\n- 4 MB RAM — https://en.wikipedia.org/wiki/Doom',
);
const OPTIONS = {
  sentences: scriptSentences(SCRIPT),
  sourceIds: new Set(SOURCES.map((source) => source.id)),
};

const claim = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  sentence: 1,
  text: 'Doom came out in 1993',
  kind: 'date',
  sources: ['r1'],
  status: 'sourced',
  ...overrides,
});
const reply = (...claims: Record<string, unknown>[]): string => JSON.stringify({ claims });
const codes = (text: string): string[] =>
  validateClaimsReply(text, OPTIONS).issues.map((entry) => entry.code);

describe('validateClaimsReply', () => {
  it('accepts quoted claims with listed sources', () => {
    const checked = validateClaimsReply(
      reply(
        claim(),
        claim({ sentence: 2, text: 'four megabytes', kind: 'number', sources: ['r2'] }),
      ),
      OPTIONS,
    );
    expect(checked.valid).toBe(true);
    expect(checked.value?.claims).toHaveLength(2);
  });

  it('rejects misquotes, bad sentences, invented sources and inconsistent statuses', () => {
    expect(codes(reply(claim({ text: 'Doom came out in 1994' })))).toEqual(['claim-not-quoted']);
    expect(codes(reply(claim({ sentence: 9 })))).toEqual(['claim-sentence']);
    expect(codes(reply(claim({ sources: ['r1', 'https://x.org'] })))).toEqual([
      'claim-unknown-source',
    ]);
    expect(codes(reply(claim({ sources: [] })))).toEqual(['claim-status']);
    expect(codes(reply(claim({ status: 'unsourced' })))).toEqual(['claim-status']);
    expect(codes(reply(claim(), claim()))).toEqual(['claim-duplicate']);
    expect(codes(reply(claim({ status: 'user-confirmed' })))).toEqual(['schema']);
    expect(codes('not json')).toEqual(['invalid-json']);
  });

  it('builds claims.json keeping only usable claims; invented sources leave a claim unsourced', () => {
    const parsed = validateClaimsReply(
      reply(
        claim(),
        claim({ sentence: 2, text: 'four megabytes', kind: 'number', sources: ['r7'] }),
        claim({ sentence: 3, text: 'misquoted', sources: [], status: 'unsourced' }),
        claim({
          sentence: 3,
          text: 'runs everywhere',
          kind: 'causal',
          sources: ['r2'],
          status: 'disputed',
          note: 'not all devices',
        }),
      ),
      OPTIONS,
    ).value;
    if (parsed === undefined) throw new Error('unparsed');
    const file = claimsFileFromReply(parsed, {
      ...OPTIONS,
      sources: SOURCES,
      checkedAt: '2026-10-04T00:00:00.000Z',
      scriptFingerprint: '0123abcd',
    });
    expect(
      file.claims.map((entry) => [
        entry.id,
        entry.sentence,
        entry.words,
        entry.sourceIds,
        entry.status,
      ]),
    ).toEqual([
      ['c1', 0, [0, 4], ['r1'], 'sourced'],
      ['c2', 1, [7, 8], [], 'unsourced'],
      ['c3', 2, [12, 13], ['r2'], 'disputed'],
    ]);
  });

  it('renders the prompt with numbered sentences and source lines, read-only and without web', () => {
    const prompt = renderPrompt('claims', claimsPromptVars(OPTIONS.sentences, SOURCES));
    if (!prompt.ok) throw new Error(prompt.error.kind);
    expect(prompt.value).toContain(
      '1. Doom came out in 1993.\n2. It needed four megabytes of memory.\n3. It runs everywhere.',
    );
    expect(prompt.value).toContain('r1 · doomwiki.org · Doom released December 1993');
    expect(prompt.value).toContain('do not browse the web');
    expect(claimsPromptVars([], []).sources).toBe('(the research notes list no sources)');
  });

  it('shows every research line of a source, capped', () => {
    const long = Array.from(
      { length: 10 },
      (_, index) => `- ${String(index)} ${'x'.repeat(380)} — https://example.org/long`,
    );
    const research = [
      '- Doom released December 1993 — https://en.wikipedia.org/wiki/Doom',
      '- It needed 4 MB of RAM — https://en.wikipedia.org/wiki/Doom',
      ...long,
    ].join(String.fromCharCode(10));
    const vars = claimsPromptVars(
      OPTIONS.sentences,
      researchClaimSources(research),
      researchSourceExcerpts(research),
    );
    const lines = vars.sources.split(String.fromCharCode(10));
    expect(lines[0]).toBe(
      'r1 · en.wikipedia.org · Doom released December 1993 | It needed 4 MB of RAM',
    );
    expect(lines[1]?.endsWith('...')).toBe(true);
    expect(lines[1]?.length).toBeLessThan(CLAIMS_SOURCE_TEXT_MAX + 40);
    // Without the excerpts only the first line shows (the stored ClaimSource.excerpt).
    const firstOnly = claimsPromptVars(OPTIONS.sentences, researchClaimSources(research));
    expect(firstOnly.sources.split(String.fromCharCode(10))[0]).toBe(
      'r1 · en.wikipedia.org · Doom released December 1993',
    );
  });
});
