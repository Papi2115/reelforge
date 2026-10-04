import { describe, expect, it } from 'vitest';
import {
  applyClaimEdit,
  claimChipName,
  claimsReport,
  formatClaimsReport,
  mergeClaims,
  researchClaimSources,
  researchSourceExcerpts,
  sourceDisplayName,
  urlHost,
} from './claims-ops.js';
import {
  claimsFileSchema,
  claimWordRange,
  scriptSentences,
  textFingerprint,
  type ClaimsFile,
} from './claims.js';

const SCRIPT =
  'Doom runs on almost anything. Fridges, watches, even a printer.\n\nThe original game needed four megabytes. Here, everything has to fit in 61 KB.';

const RESEARCH = [
  '## Key facts',
  '- Doom (1993) needed 4 MB of RAM — https://doomwiki.org/wiki/Doom',
  '- The TI-84 Plus CE has 154 KB of user RAM ([TI specs](https://education.ti.com/en/products/ti-84).)',
  '- Same link again https://doomwiki.org/wiki/Doom',
  '## Open questions',
  '- unclear who ported it first',
].join('\n');

function file(overrides: Partial<ClaimsFile> = {}): ClaimsFile {
  return claimsFileSchema.parse({
    version: 1,
    sources: researchClaimSources(RESEARCH),
    claims: [
      {
        id: 'c1',
        text: 'needed four megabytes',
        sentence: 2,
        kind: 'number',
        sourceIds: ['r1'],
        status: 'sourced',
      },
      { id: 'c2', text: '61 KB', sentence: 3, kind: 'number', sourceIds: [], status: 'unsourced' },
      {
        id: 'c3',
        text: 'even a printer',
        sentence: 1,
        kind: 'name',
        sourceIds: ['r2'],
        status: 'disputed',
        note: 'only a mod',
      },
    ],
    ...overrides,
  });
}

describe('claims.json schema', () => {
  it('accepts a valid file and rejects broken references and statuses', () => {
    expect(file().claims).toHaveLength(3);
    const bad = (claims: unknown[]): boolean =>
      claimsFileSchema.safeParse({ version: 1, sources: [], claims }).success;
    const claim = {
      id: 'c1',
      text: 'x',
      sentence: 0,
      kind: 'date',
      sourceIds: [],
      status: 'unsourced',
    };
    expect(bad([claim])).toBe(true);
    expect(bad([{ ...claim, status: 'sourced' }])).toBe(false);
    expect(bad([{ ...claim, sourceIds: ['r9'] }])).toBe(false);
    expect(bad([claim, claim])).toBe(false);
    expect(bad([{ ...claim, kind: 'opinion' }])).toBe(false);
    expect(claimsFileSchema.safeParse({ version: 2, sources: [], claims: [] }).success).toBe(false);
  });
});

describe('script sentences and word ranges', () => {
  it('splits sentences and finds a claim by tokens, punctuation-insensitive', () => {
    const sentences = scriptSentences(SCRIPT);
    expect(sentences.map((sentence) => sentence.text)).toEqual([
      'Doom runs on almost anything.',
      'Fridges, watches, even a printer.',
      'The original game needed four megabytes.',
      'Here, everything has to fit in 61 KB.',
    ]);
    expect(claimWordRange(sentences, 3, '61 KB')).toEqual([22, 23]);
    expect(claimWordRange(sentences, 1, 'watches even')).toEqual([6, 7]);
    expect(claimWordRange(sentences, 1, 'not there')).toBeUndefined();
    expect(claimWordRange(sentences, 9, '61 KB')).toBeUndefined();
  });

  it('fingerprints text deterministically', () => {
    expect(textFingerprint(SCRIPT)).toBe(textFingerprint(SCRIPT));
    expect(textFingerprint(SCRIPT)).toMatch(/^[0-9a-f]{8}$/);
    expect(textFingerprint(`${SCRIPT} `)).not.toBe(textFingerprint(SCRIPT));
  });
});

describe('research sources', () => {
  it('lists each link once with a URL-free display name', () => {
    const sources = researchClaimSources(RESEARCH);
    expect(sources).toEqual([
      {
        id: 'r1',
        kind: 'research',
        name: 'doomwiki.org',
        url: 'https://doomwiki.org/wiki/Doom',
        excerpt: 'Doom (1993) needed 4 MB of RAM',
      },
      {
        id: 'r2',
        kind: 'research',
        name: 'TI specs',
        url: 'https://education.ti.com/en/products/ti-84',
        excerpt: 'The TI-84 Plus CE has 154 KB of user RAM (TI specs.)',
      },
    ]);
    expect(urlHost('https://www.NASA.gov/x')).toBe('nasa.gov');
    expect(urlHost('not a url')).toBeNull();
    expect(sourceDisplayName('see https://www.bbc.co.uk/news/1')).toBe('see bbc.co.uk');
    expect(
      sourceDisplayName('A very long source name that goes on and on beyond the limit of the chip'),
    ).toBe('A very long source name that goes on and on beyond the...');
  });

  it('keeps every line that cites a link (real run 2.3: one article backed 15 facts)', () => {
    const excerpts = researchSourceExcerpts(RESEARCH);
    expect(excerpts.get('https://doomwiki.org/wiki/Doom')).toEqual([
      'Doom (1993) needed 4 MB of RAM',
      'Same link again',
    ]);
    expect(excerpts.get('https://education.ti.com/en/products/ti-84')).toEqual([
      'The TI-84 Plus CE has 154 KB of user RAM (TI specs.)',
    ]);
    const twice = ['- a — https://x.org/a', '- a — https://x.org/a'].join('\n');
    expect(researchSourceExcerpts(twice).get('https://x.org/a')).toEqual(['a']);
  });
});

describe('report and edits', () => {
  it('counts statuses and lists the claims without a source', () => {
    const report = claimsReport(file());
    expect(report.counts).toEqual({ sourced: 1, unsourced: 1, disputed: 1, 'user-confirmed': 0 });
    expect(report.withoutSource.map((claim) => claim.id)).toEqual(['c2']);
    expect(formatClaimsReport(file())).toBe(
      [
        '3 claims: 1 sourced, 1 without a source, 1 disputed, 0 confirmed by you',
        'Without a source:',
        '- c2 (number): "61 KB"',
        'Disputed:',
        '- c3 (name): "even a printer" — only a mod',
        '',
      ].join('\n'),
    );
  });

  it('attaches a URL (claim becomes sourced), detaches it again, confirms by hand', () => {
    const attached = applyClaimEdit(file(), {
      op: 'attach',
      claimId: 'c2',
      source: { kind: 'url', url: 'https://www.cemetech.net/doom' },
    });
    if (!attached.ok) throw new Error(attached.message);
    const c2 = attached.file.claims[1];
    expect(c2).toMatchObject({ sourceIds: ['u1'], status: 'sourced' });
    expect(attached.file.sources.at(-1)).toEqual({
      id: 'u1',
      kind: 'url',
      name: 'cemetech.net',
      url: 'https://www.cemetech.net/doom',
    });
    if (c2 !== undefined) expect(claimChipName(attached.file, c2)).toBe('cemetech.net');
    const detached = applyClaimEdit(attached.file, { op: 'detach', claimId: 'c2', sourceId: 'u1' });
    if (!detached.ok) throw new Error(detached.message);
    expect(detached.file.claims[1]).toMatchObject({ sourceIds: [], status: 'unsourced' });
    expect(detached.file.sources.some((source) => source.id === 'u1')).toBe(false);
    const confirmed = applyClaimEdit(detached.file, {
      op: 'status',
      claimId: 'c2',
      status: 'user-confirmed',
    });
    expect(confirmed.ok && confirmed.file.claims[1]?.status).toBe('user-confirmed');
    const reset = applyClaimEdit(file(), { op: 'status', claimId: 'c1', status: 'unsourced' });
    expect(reset.ok && reset.file.claims[0]?.status).toBe('sourced');
  });

  it('refuses bad input and unknown claims', () => {
    expect(
      applyClaimEdit(file(), {
        op: 'attach',
        claimId: 'c2',
        source: { kind: 'url', url: 'ftp://x' },
      }),
    ).toMatchObject({ ok: false });
    expect(applyClaimEdit(file(), { op: 'status', claimId: 'c9', status: 'disputed' })).toEqual({
      ok: false,
      message: 'No claim c9.',
    });
    const note = applyClaimEdit(file(), {
      op: 'attach',
      claimId: 'c2',
      source: { kind: 'note', note: 'Checked in the TI manual, p. 12' },
    });
    expect(note.ok && note.file.sources.at(-1)).toMatchObject({ kind: 'note', name: 'Note' });
    if (note.ok) {
      const claim = note.file.claims[1];
      if (claim !== undefined) expect(claimChipName(note.file, claim)).toBeNull();
    }
  });

  it('merges a new check with the user sources and decisions', () => {
    const attached = applyClaimEdit(file(), {
      op: 'attach',
      claimId: 'c2',
      source: { kind: 'document', document: 'docs/ti-manual.pdf' },
    });
    if (!attached.ok) throw new Error(attached.message);
    const confirmed = applyClaimEdit(attached.file, {
      op: 'status',
      claimId: 'c1',
      status: 'user-confirmed',
    });
    if (!confirmed.ok) throw new Error(confirmed.message);
    const checked = claimsFileSchema.parse({
      version: 1,
      sources: researchClaimSources(RESEARCH),
      claims: [
        {
          id: 'c1',
          text: '61 KB!',
          sentence: 3,
          kind: 'number',
          sourceIds: [],
          status: 'unsourced',
        },
        {
          id: 'c2',
          text: 'Needed four megabytes',
          sentence: 2,
          kind: 'number',
          sourceIds: ['r1'],
          status: 'sourced',
        },
        {
          id: 'c3',
          text: 'Doom runs on almost anything',
          sentence: 0,
          kind: 'causal',
          sourceIds: [],
          status: 'unsourced',
        },
      ],
    });
    const merged = mergeClaims(confirmed.file, checked);
    expect(merged.claims.map((claim) => [claim.id, claim.status, claim.sourceIds])).toEqual([
      ['c1', 'sourced', ['u1']],
      ['c2', 'user-confirmed', ['r1']],
      ['c3', 'unsourced', []],
    ]);
    expect(merged.sources.at(-1)).toMatchObject({
      id: 'u1',
      kind: 'document',
      name: 'ti-manual.pdf',
    });
    expect(mergeClaims(null, checked)).toBe(checked);
  });
});
