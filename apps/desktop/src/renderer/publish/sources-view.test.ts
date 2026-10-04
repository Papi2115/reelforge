import { claimsFileSchema, type ClaimsFile } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { ClaimsState } from '../../shared/publish-contract.js';
import {
  attachRequest,
  checkButton,
  claimsSummary,
  claimSources,
  filterClaims,
  filterCount,
  statusActions,
} from './sources-view.js';

const FILE: ClaimsFile = claimsFileSchema.parse({
  version: 1,
  scriptFingerprint: '0123abcd',
  sources: [
    { id: 'r1', kind: 'research', name: 'doomwiki.org', url: 'https://doomwiki.org/wiki/Doom' },
    { id: 'u1', kind: 'note', name: 'Note', note: 'Checked the TI manual' },
  ],
  claims: [
    {
      id: 'c1',
      text: 'four megabytes',
      sentence: 3,
      kind: 'number',
      sourceIds: ['r1'],
      status: 'sourced',
    },
    { id: 'c2', text: '61 KB', sentence: 4, kind: 'number', sourceIds: [], status: 'unsourced' },
    {
      id: 'c3',
      text: 'runs Doom',
      sentence: 7,
      kind: 'causal',
      sourceIds: ['u1'],
      status: 'disputed',
    },
    {
      id: 'c4',
      text: 'hackers rewrote it',
      sentence: 5,
      kind: 'causal',
      sourceIds: [],
      status: 'user-confirmed',
    },
  ],
});

const state = (overrides: Partial<Extract<ClaimsState, { status: 'ok' }>> = {}): ClaimsState => ({
  status: 'ok',
  file: FILE,
  hasScript: true,
  scriptChanged: false,
  checking: false,
  problem: null,
  ...overrides,
});

describe('sources view', () => {
  it('summarises the report and filters the claims without a source', () => {
    expect(claimsSummary(FILE)).toBe(
      '4 claims: 1 sourced, 1 without a source, 1 disputed, 1 confirmed by you',
    );
    expect(claimsSummary({ ...FILE, claims: [] })).toBe('No factual claims found in the script.');
    expect(filterClaims(FILE, 'unsourced').map((claim) => claim.id)).toEqual(['c2']);
    expect(filterCount(FILE, 'all')).toBe(4);
    expect(filterCount(FILE, 'disputed')).toBe(1);
  });

  it('lists a claim’s sources with their link, document or note', () => {
    const [first, , third] = FILE.claims;
    if (first === undefined || third === undefined) throw new Error('fixture');
    expect(claimSources(FILE, first)).toEqual([
      {
        id: 'r1',
        name: 'doomwiki.org',
        detail: 'https://doomwiki.org/wiki/Doom',
        kind: 'research',
      },
    ]);
    expect(claimSources(FILE, third)[0]?.detail).toBe('Checked the TI manual');
  });

  it('offers confirm / dispute / clear decision', () => {
    const claim = (index: number): ClaimsFile['claims'][number] => {
      const found = FILE.claims[index];
      if (found === undefined) throw new Error('fixture');
      return found;
    };
    const labels = (index: number): string[] =>
      statusActions(claim(index)).map((action) => action.label);
    expect(labels(0)).toEqual(['Confirm', 'Dispute']);
    expect(labels(2)).toEqual(['Confirm', 'Clear decision']);
    expect(statusActions(claim(3)).at(-1)).toEqual({
      label: 'Clear decision',
      status: 'unsourced',
    });
  });

  it('turns the Add source form into an edit request or a problem', () => {
    expect(attachRequest('c2', { kind: 'url', value: ' https://ti.com/84 ', name: '' })).toEqual({
      request: {
        op: 'attach',
        claimId: 'c2',
        source: { kind: 'url', url: 'https://ti.com/84', name: undefined },
      },
    });
    expect(attachRequest('c2', { kind: 'url', value: 'ti.com', name: '' })).toEqual({
      problem: 'A link starts with https:// or http://.',
    });
    expect(
      attachRequest('c2', { kind: 'document', value: 'manual.pdf', name: 'TI manual' }),
    ).toEqual({
      request: {
        op: 'attach',
        claimId: 'c2',
        source: { kind: 'document', document: 'manual.pdf', name: 'TI manual' },
      },
    });
    expect(attachRequest('c2', { kind: 'note', value: '  ', name: '' })).toEqual({
      problem: 'Fill in the source first.',
    });
  });

  it('enables Check sources only with a script and while nothing runs', () => {
    expect(checkButton(undefined, false)).toMatchObject({ disabled: true });
    expect(checkButton(state({ hasScript: false, file: null }), false)).toMatchObject({
      disabled: true,
      title: 'Write the script first',
    });
    expect(checkButton(state({ file: null }), false)).toMatchObject({
      label: 'Check sources',
      disabled: false,
    });
    expect(checkButton(state(), false)).toMatchObject({ label: 'Check again', disabled: false });
    expect(checkButton(state({ checking: true }), false)).toMatchObject({
      label: 'Checking…',
      disabled: true,
    });
    expect(checkButton(state(), true)).toMatchObject({ disabled: true });
  });
});
