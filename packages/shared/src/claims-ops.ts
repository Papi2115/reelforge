/**
 * Pure operations on `claims.json` (PLAN.md#12.18): research.md links as sources, the report of
 * claims without a source, the user's edits (attach a URL/document/note, detach, confirm) and the
 * merge of a new "Check sources" result with what the user already did.
 */
import {
  claimsFileSchema,
  normalizeClaimText,
  SOURCE_NAME_MAX,
  type Claim,
  type ClaimsFile,
  type ClaimSource,
  type ClaimStatus,
} from './claims.js';

const URL_PATTERN = /https?:\/\/[^\s<>"'\]]+/g;
/** research.md links kept as sources (research is ~10-40 links). */
export const MAX_RESEARCH_SOURCES = 150;

const count = (text: string, char: string): number => text.split(char).length - 1;

/** A URL as written in markdown, without trailing punctuation or an unbalanced `)`. */
function cleanUrl(raw: string): string {
  let url = raw.replace(/[.,;:!?'"]+$/, '');
  while (url.endsWith(')') && count(url, ')') > count(url, '(')) {
    url = url.slice(0, -1).replace(/[.,;:!?'"]+$/, '');
  }
  return url;
}

/** Host of a URL without `www.` ("en.wikipedia.org"), or null when it is not an http(s) URL. */
export function urlHost(url: string): string | null {
  const host = /^https?:\/\/(?:[^@/\s]*@)?([^/:?#\s]+)/i.exec(url)?.[1];
  return host === undefined ? null : host.toLowerCase().replace(/^www\./, '');
}

/**
 * Display name of a source for the chip: no URLs (a URL becomes its host), single spaces, at most
 * `SOURCE_NAME_MAX` characters cut at a word with "...".
 */
export function sourceDisplayName(name: string): string {
  const plain = name
    .replace(URL_PATTERN, (url) => urlHost(url) ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= SOURCE_NAME_MAX) return plain;
  const cut = plain.slice(0, SOURCE_NAME_MAX - 3);
  const space = cut.lastIndexOf(' ');
  return `${(space > 12 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, '')}...`;
}

/** A research.md line without its links and list marker: what the line says (≤ 400 chars). */
function lineExcerpt(line: string): string {
  return line
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(URL_PATTERN, '')
    .replace(/\(\s*\)/g, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s*/, '')
    .replace(/[\s—–:(.-]+$/, '')
    .trim()
    .slice(0, 400);
}

/**
 * Every line of research.md that cites a link, per link (cleaned URL → excerpts in order, no
 * duplicates). One link usually backs many facts (a Wikipedia article on 15 lines); the claims
 * prompt needs all of them, not only the first line kept in `ClaimSource.excerpt`.
 */
export function researchSourceExcerpts(markdown: string): Map<string, string[]> {
  const excerpts = new Map<string, string[]>();
  for (const line of markdown.split(/\r?\n/)) {
    const excerpt = lineExcerpt(line);
    if (excerpt === '') continue;
    for (const match of line.matchAll(URL_PATTERN)) {
      const url = cleanUrl(match[0]);
      if (urlHost(url) === null) continue;
      const list = excerpts.get(url) ?? [];
      if (!list.includes(excerpt)) list.push(excerpt);
      excerpts.set(url, list);
    }
  }
  return excerpts;
}

/** Every distinct link of research.md as a `research` source (`r1`, `r2`, … in order). */
export function researchClaimSources(markdown: string): ClaimSource[] {
  const sources: ClaimSource[] = [];
  const seen = new Set<string>();
  for (const line of markdown.split(/\r?\n/)) {
    const links = new Map<string, string>();
    for (const match of line.matchAll(/\[([^\]]{1,80})\]\((https?:\/\/[^)\s]+)\)/g)) {
      links.set(cleanUrl(match[2] ?? ''), (match[1] ?? '').trim());
    }
    for (const match of line.matchAll(URL_PATTERN)) {
      const url = cleanUrl(match[0]);
      const host = urlHost(url);
      if (seen.has(url) || host === null || sources.length >= MAX_RESEARCH_SOURCES) continue;
      seen.add(url);
      const excerpt = lineExcerpt(line);
      sources.push({
        id: `r${String(sources.length + 1)}`,
        kind: 'research',
        name: sourceDisplayName(links.get(url) ?? host),
        url,
        ...(excerpt === '' ? {} : { excerpt }),
      });
    }
  }
  return sources;
}

/** Claims without a source: `unsourced` ones (a disputed claim has its own list). */
export function claimsWithoutSource(file: ClaimsFile): Claim[] {
  return file.claims.filter((claim) => claim.status === 'unsourced');
}

export interface ClaimsReport {
  readonly total: number;
  readonly counts: Readonly<Record<ClaimStatus, number>>;
  readonly withoutSource: readonly Claim[];
  readonly disputed: readonly Claim[];
}

export function claimsReport(file: ClaimsFile): ClaimsReport {
  const counts: Record<ClaimStatus, number> = {
    sourced: 0,
    unsourced: 0,
    disputed: 0,
    'user-confirmed': 0,
  };
  for (const claim of file.claims) counts[claim.status] += 1;
  return {
    total: file.claims.length,
    counts,
    withoutSource: claimsWithoutSource(file),
    disputed: file.claims.filter((claim) => claim.status === 'disputed'),
  };
}

/** The report as plain text (log, tests, docs). */
export function formatClaimsReport(file: ClaimsFile): string {
  const report = claimsReport(file);
  const { counts } = report;
  const lines = [
    `${String(report.total)} claims: ${String(counts.sourced)} sourced, ${String(counts.unsourced)} without a source, ${String(counts.disputed)} disputed, ${String(counts['user-confirmed'])} confirmed by you`,
  ];
  if (report.withoutSource.length > 0) {
    lines.push('Without a source:');
    for (const claim of report.withoutSource) {
      lines.push(`- ${claim.id} (${claim.kind}): "${claim.text}"`);
    }
  }
  if (report.disputed.length > 0) {
    lines.push('Disputed:');
    for (const claim of report.disputed) {
      lines.push(
        `- ${claim.id} (${claim.kind}): "${claim.text}"${claim.note === undefined ? '' : ` — ${claim.note}`}`,
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

/** What the user attaches to a claim in the Sources panel. */
export type AttachedSource =
  | { readonly kind: 'url'; readonly url: string; readonly name?: string | undefined }
  | { readonly kind: 'document'; readonly document: string; readonly name?: string | undefined }
  | { readonly kind: 'note'; readonly note: string; readonly name?: string | undefined };

export type ClaimEdit =
  | { readonly op: 'attach'; readonly claimId: string; readonly source: AttachedSource }
  | { readonly op: 'detach'; readonly claimId: string; readonly sourceId: string }
  | { readonly op: 'status'; readonly claimId: string; readonly status: ClaimStatus };

function nextUserSourceId(sources: readonly ClaimSource[]): string {
  const used = sources
    .filter((source) => source.id.startsWith('u'))
    .map((source) => Number(source.id.slice(1)));
  return `u${String(Math.max(0, ...used) + 1)}`;
}

function userSource(id: string, source: AttachedSource): ClaimSource {
  const given = source.name?.trim() ?? '';
  switch (source.kind) {
    case 'url':
      return {
        id,
        kind: 'url',
        name: sourceDisplayName(given === '' ? (urlHost(source.url) ?? source.url) : given),
        url: source.url.trim(),
      };
    case 'document': {
      const file = source.document.trim();
      const base = file.split(/[\\/]/).at(-1) ?? file;
      return {
        id,
        kind: 'document',
        name: sourceDisplayName(given === '' ? base : given),
        document: file,
      };
    }
    case 'note':
      return {
        id,
        kind: 'note',
        name: sourceDisplayName(given === '' ? 'Note' : given),
        note: source.note.trim(),
      };
  }
}

/** The status a claim gets from its sources unless the user decided (disputed / confirmed). */
function settledStatus(claim: Claim, sourceIds: readonly string[]): ClaimStatus {
  if (claim.status === 'disputed' || claim.status === 'user-confirmed') return claim.status;
  return sourceIds.length > 0 ? 'sourced' : 'unsourced';
}

export type ClaimEditResult =
  | { readonly ok: true; readonly file: ClaimsFile }
  | { readonly ok: false; readonly message: string };

/** Applies one edit; the result is validated (an invalid URL or note is refused, not written). */
export function applyClaimEdit(file: ClaimsFile, edit: ClaimEdit): ClaimEditResult {
  const claim = file.claims.find((candidate) => candidate.id === edit.claimId);
  if (claim === undefined) return { ok: false, message: `No claim ${edit.claimId}.` };
  let sources = file.sources;
  let next: Claim;
  if (edit.op === 'attach') {
    const source = userSource(nextUserSourceId(sources), edit.source);
    sources = [...sources, source];
    const sourceIds = [...claim.sourceIds, source.id];
    next = { ...claim, sourceIds, status: settledStatus(claim, sourceIds) };
  } else if (edit.op === 'detach') {
    const sourceIds = claim.sourceIds.filter((id) => id !== edit.sourceId);
    next = { ...claim, sourceIds, status: settledStatus(claim, sourceIds) };
    const stillUsed = file.claims.some(
      (other) => other.id !== claim.id && other.sourceIds.includes(edit.sourceId),
    );
    if (edit.sourceId.startsWith('u') && !stillUsed) {
      sources = sources.filter((source) => source.id !== edit.sourceId);
    }
  } else {
    const status =
      edit.status === 'sourced' || edit.status === 'unsourced'
        ? claim.sourceIds.length > 0
          ? 'sourced'
          : 'unsourced'
        : edit.status;
    next = { ...claim, status };
  }
  const parsed = claimsFileSchema.safeParse({
    ...file,
    sources,
    claims: file.claims.map((candidate) => (candidate.id === claim.id ? next : candidate)),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid source.' };
  }
  return { ok: true, file: parsed.data };
}

/**
 * A new check result merged with the previous file: a claim with the same text keeps the user's
 * sources, decision (disputed / confirmed) and note; the user's sources are kept with their ids.
 */
export function mergeClaims(previous: ClaimsFile | null, checked: ClaimsFile): ClaimsFile {
  if (previous === null) return checked;
  const userSources = previous.sources.filter((source) => source.kind !== 'research');
  const byText = new Map(previous.claims.map((claim) => [normalizeClaimText(claim.text), claim]));
  const claims = checked.claims.map((claim) => {
    const old = byText.get(normalizeClaimText(claim.text));
    if (old === undefined) return claim;
    const kept = old.sourceIds.filter((id) => id.startsWith('u'));
    const sourceIds = [...new Set([...claim.sourceIds, ...kept])];
    const decided = old.status === 'user-confirmed' || old.status === 'disputed';
    const status: ClaimStatus = decided
      ? old.status
      : sourceIds.length > 0
        ? 'sourced'
        : claim.status === 'disputed'
          ? 'disputed'
          : 'unsourced';
    const note = claim.note ?? old.note;
    return { ...claim, sourceIds, status, ...(note === undefined ? {} : { note }) };
  });
  const used = new Set(claims.flatMap((claim) => claim.sourceIds));
  return claimsFileSchema.parse({
    ...checked,
    sources: [...checked.sources, ...userSources.filter((source) => used.has(source.id))],
    claims,
  });
}

/** Name of the first source of a claim (what its on-screen chip shows), or null. */
export function claimChipName(file: ClaimsFile, claim: Claim): string | null {
  const first = claim.sourceIds
    .map((id) => file.sources.find((source) => source.id === id))
    .find((source) => source !== undefined && source.kind !== 'note');
  return first === undefined ? null : sourceDisplayName(first.name);
}
