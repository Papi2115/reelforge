/**
 * What the Sources panel shows (PLAN.md#12.18): the claims report, filters, the sources of a claim,
 * the status actions and the "Add source" form turned into an edit request. Pure, tested.
 */
import {
  claimsReport,
  type Claim,
  type ClaimsFile,
  type ClaimSource,
  type ClaimStatus,
} from '@reelforge/shared';
import type { ClaimEditRequest, ClaimsState } from '../../shared/publish-contract.js';

export const STATUS_LABELS: Readonly<Record<ClaimStatus, string>> = {
  sourced: 'Sourced',
  unsourced: 'No source',
  disputed: 'Disputed',
  'user-confirmed': 'Confirmed by you',
};

export const CLAIM_FILTERS = ['all', 'unsourced', 'disputed'] as const;
export type ClaimFilter = (typeof CLAIM_FILTERS)[number];
export const FILTER_LABELS: Readonly<Record<ClaimFilter, string>> = {
  all: 'All',
  unsourced: 'Without a source',
  disputed: 'Disputed',
};

/** "12 claims: 9 sourced, 2 without a source, 1 disputed, 0 confirmed by you". */
export function claimsSummary(file: ClaimsFile): string {
  const { total, counts } = claimsReport(file);
  if (total === 0) return 'No factual claims found in the script.';
  return `${String(total)} claim${total === 1 ? '' : 's'}: ${String(counts.sourced)} sourced, ${String(counts.unsourced)} without a source, ${String(counts.disputed)} disputed, ${String(counts['user-confirmed'])} confirmed by you`;
}

export function filterClaims(file: ClaimsFile, filter: ClaimFilter): Claim[] {
  return filter === 'all'
    ? [...file.claims]
    : file.claims.filter((claim) => claim.status === filter);
}

export function filterCount(file: ClaimsFile, filter: ClaimFilter): number {
  return filterClaims(file, filter).length;
}

export interface SourceView {
  readonly id: string;
  readonly name: string;
  /** URL, document path or note text. */
  readonly detail: string;
  readonly kind: ClaimSource['kind'];
}

export function claimSources(file: ClaimsFile, claim: Claim): SourceView[] {
  return claim.sourceIds.flatMap((id) => {
    const source = file.sources.find((candidate) => candidate.id === id);
    if (source === undefined) return [];
    return [
      {
        id,
        name: source.name,
        detail: source.url ?? source.document ?? source.note ?? '',
        kind: source.kind,
      },
    ];
  });
}

export interface StatusAction {
  readonly label: string;
  readonly status: ClaimStatus;
}

/** Confirm / dispute a claim, or clear the decision (the status follows its sources again). */
export function statusActions(claim: Claim): StatusAction[] {
  const actions: StatusAction[] = [];
  if (claim.status !== 'user-confirmed')
    actions.push({ label: 'Confirm', status: 'user-confirmed' });
  if (claim.status !== 'disputed') actions.push({ label: 'Dispute', status: 'disputed' });
  if (claim.status === 'user-confirmed' || claim.status === 'disputed') {
    actions.push({
      label: 'Clear decision',
      status: claim.sourceIds.length > 0 ? 'sourced' : 'unsourced',
    });
  }
  return actions;
}

export const SOURCE_FORM_KINDS = ['url', 'document', 'note'] as const;
export type SourceFormKind = (typeof SOURCE_FORM_KINDS)[number];
export const SOURCE_FORM_LABELS: Readonly<Record<SourceFormKind, string>> = {
  url: 'Link (URL)',
  document: 'Document',
  note: 'Note',
};

export interface SourceForm {
  readonly kind: SourceFormKind;
  readonly value: string;
  readonly name: string;
}

export const EMPTY_SOURCE_FORM: SourceForm = { kind: 'url', value: '', name: '' };

/** The edit request of the "Add source" form, or what is wrong with it. */
export function attachRequest(
  claimId: string,
  form: SourceForm,
): { readonly request: ClaimEditRequest } | { readonly problem: string } {
  const value = form.value.trim();
  const name = form.name.trim() === '' ? undefined : form.name.trim().slice(0, 60);
  if (value === '') return { problem: 'Fill in the source first.' };
  switch (form.kind) {
    case 'url':
      if (!/^https?:\/\/\S+$/i.test(value))
        return { problem: 'A link starts with https:// or http://.' };
      return { request: { op: 'attach', claimId, source: { kind: 'url', url: value, name } } };
    case 'document':
      return {
        request: { op: 'attach', claimId, source: { kind: 'document', document: value, name } },
      };
    case 'note':
      return { request: { op: 'attach', claimId, source: { kind: 'note', note: value, name } } };
  }
}

/** Label, availability and hint of the Check sources button. */
export function checkButton(
  state: ClaimsState | undefined,
  busy: boolean,
): { readonly label: string; readonly disabled: boolean; readonly title: string } {
  const checking = busy || (state?.status === 'ok' && state.checking);
  if (checking)
    return { label: 'Checking…', disabled: true, title: 'Claude is checking the claims' };
  if (state?.status !== 'ok')
    return { label: 'Check sources', disabled: true, title: 'No project' };
  if (!state.hasScript) {
    return { label: 'Check sources', disabled: true, title: 'Write the script first' };
  }
  return {
    label: state.file === null ? 'Check sources' : 'Check again',
    disabled: false,
    title: 'One Claude turn (Sonnet, no web): lists the claims and pins the research links',
  };
}
