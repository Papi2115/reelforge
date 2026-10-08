/**
 * The `claims` reply (PLAN.md#12.18): `{"claims":[{sentence,text,kind,sources,status,note?}]}`.
 * Every claim must quote its (1-based) sentence and may only pin the research source ids it was
 * given; `sourced` needs a source, `unsourced` has none. `claimsFileFromReply` keeps the usable
 * claims (unknown ids dropped, so an unsupported claim stays unsourced) and builds claims.json.
 */
import {
  CLAIM_KINDS,
  claimsFileSchema,
  claimWordRange,
  CLAIMS_FILE_VERSION,
  MAX_SOURCES_PER_CLAIM,
  normalizeClaimText,
  type Claim,
  type ClaimsFile,
  type ClaimSource,
  type ScriptSentence,
} from '@reelforge/shared';
import { z } from 'zod';
import {
  issue,
  parseJsonText,
  report,
  schemaIssues,
  type ValidationIssue,
  type ValidationReport,
} from './issues.js';

export const MAX_REPLY_CLAIMS = 60;

export const claimsReplySchema = z.strictObject({
  claims: z
    .array(
      z.strictObject({
        sentence: z.int().min(1),
        text: z.string().trim().min(1).max(400),
        kind: z.enum(CLAIM_KINDS),
        sources: z.array(z.string()).max(MAX_SOURCES_PER_CLAIM).default([]),
        status: z.enum(['sourced', 'unsourced', 'disputed']),
        note: z.string().trim().min(1).max(200).optional(),
      }),
    )
    .max(MAX_REPLY_CLAIMS),
});
export type ClaimsReply = z.infer<typeof claimsReplySchema>;
type ReplyClaim = ClaimsReply['claims'][number];

export interface ClaimsReplyOptions {
  readonly sentences: readonly ScriptSentence[];
  /** Ids of the research sources the prompt listed. */
  readonly sourceIds: ReadonlySet<string>;
}

function claimIssues(
  claim: ReplyClaim,
  index: number,
  options: ClaimsReplyOptions,
): ValidationIssue[] {
  const path = `claims[${String(index)}]`;
  const issues: ValidationIssue[] = [];
  if (options.sentences[claim.sentence - 1] === undefined) {
    issues.push(
      issue(
        'error',
        'claim-sentence',
        `sentence ${String(claim.sentence)} does not exist (1-${String(options.sentences.length)})`,
        `${path}.sentence`,
      ),
    );
  } else if (claimWordRange(options.sentences, claim.sentence - 1, claim.text) === undefined) {
    issues.push(
      issue(
        'error',
        'claim-not-quoted',
        `"${claim.text}" is not in sentence ${String(claim.sentence)}; copy the words exactly`,
        `${path}.text`,
      ),
    );
  }
  const unknown = claim.sources.filter((id) => !options.sourceIds.has(id));
  if (unknown.length > 0) {
    issues.push(
      issue(
        'error',
        'claim-unknown-source',
        `unknown source id(s) ${unknown.join(', ')}; pin only the listed research sources`,
        `${path}.sources`,
      ),
    );
  }
  if (claim.status === 'sourced' && claim.sources.length === 0) {
    issues.push(issue('error', 'claim-status', '"sourced" without a source', `${path}.status`));
  }
  if (claim.status === 'unsourced' && claim.sources.length > 0) {
    issues.push(issue('error', 'claim-status', '"unsourced" with sources', `${path}.status`));
  }
  return issues;
}

export function validateClaimsReply(
  text: string,
  options: ClaimsReplyOptions,
): ValidationReport<ClaimsReply> {
  const json = parseJsonText(text);
  if (!json.parsed) return report<ClaimsReply>(undefined, json.issues);
  const parsed = claimsReplySchema.safeParse(json.value);
  if (!parsed.success) {
    return report<ClaimsReply>(undefined, [...json.issues, ...schemaIssues(parsed.error)]);
  }
  const issues: ValidationIssue[] = [...json.issues];
  const seen = new Set<string>();
  parsed.data.claims.forEach((claim, index) => {
    issues.push(...claimIssues(claim, index, options));
    const key = `${String(claim.sentence)}:${normalizeClaimText(claim.text)}`;
    if (seen.has(key)) {
      issues.push(
        issue(
          'warning',
          'claim-duplicate',
          `"${claim.text}" is listed twice`,
          `claims[${String(index)}]`,
        ),
      );
    }
    seen.add(key);
  });
  return report(parsed.data, issues);
}

export interface ClaimsFileInput extends ClaimsReplyOptions {
  readonly sources: readonly ClaimSource[];
  readonly checkedAt: string;
  readonly scriptFingerprint: string;
}

/** Approximators that hedge a number ("about six", "~7 ft"). */
const HEDGES = new Set([
  'about',
  'around',
  'roughly',
  'nearly',
  'almost',
  'approximately',
  'approx',
  'circa',
  'some',
  'estimated',
]);
/** Words of the hedged number read before the claim's own words ("crews average about six"). */
const HEDGE_LOOKBACK = 3;
/** A dispute about a missing hedge (real run Game B1 2: "states it without a hedge"). */
const HEDGE_DISPUTE = /\bhedg|\bunhedged\b|\bqualif|\bexact\b|\bprecise\b|\bapproximat/i;

/** Whether the script hedges the claim: an approximator in or just before its words. */
export function claimIsHedged(
  sentences: readonly ScriptSentence[],
  sentence: number,
  words: readonly [number, number],
): boolean {
  const found = sentences[sentence];
  if (found === undefined) return false;
  const from = Math.max(0, words[0] - found.firstWord - HEDGE_LOOKBACK);
  return found.text
    .split(' ')
    .slice(from, words[1] - found.firstWord + 1)
    .some((word) => /^[~≈]/.test(word) || HEDGES.has(normalizeClaimText(word)));
}

/** `disputed` only for a missing hedge the script has is no dispute (the hedge is spoken). */
function hedgedDispute(claim: ReplyClaim, hedged: boolean): boolean {
  return claim.status === 'disputed' && hedged && HEDGE_DISPUTE.test(claim.note ?? '');
}

/**
 * claims.json from a parsed reply: claims that quote no sentence and duplicates are dropped,
 * unknown source ids are removed (a claim left without sources becomes `unsourced`), and a claim
 * disputed only for a missing hedge that the script speaks ("about six") is not disputed.
 */
export function claimsFileFromReply(reply: ClaimsReply, input: ClaimsFileInput): ClaimsFile {
  const claims: Claim[] = [];
  const seen = new Set<string>();
  for (const claim of reply.claims) {
    const sentence = claim.sentence - 1;
    const words = claimWordRange(input.sentences, sentence, claim.text);
    const key = `${String(sentence)}:${normalizeClaimText(claim.text)}`;
    if (words === undefined || seen.has(key)) continue;
    seen.add(key);
    const sourceIds = [...new Set(claim.sources.filter((id) => input.sourceIds.has(id)))];
    const hedged = hedgedDispute(claim, claimIsHedged(input.sentences, sentence, words));
    const disputed = claim.status === 'disputed' && !hedged;
    const status = disputed ? 'disputed' : sourceIds.length > 0 ? 'sourced' : 'unsourced';
    claims.push({
      id: `c${String(claims.length + 1)}`,
      text: claim.text,
      sentence,
      words,
      kind: claim.kind,
      sourceIds,
      status,
      ...(claim.note === undefined || hedged ? {} : { note: claim.note }),
    });
  }
  return claimsFileSchema.parse({
    version: CLAIMS_FILE_VERSION,
    checkedAt: input.checkedAt,
    scriptFingerprint: input.scriptFingerprint,
    sources: input.sources,
    claims,
  });
}

/** Characters of research lines shown per source (a source cited on many lines is cut here). */
export const CLAIMS_SOURCE_TEXT_MAX = 3000;

/** What the notes say with one source: every line citing its URL, `|` separated, capped. */
function sourceText(
  source: ClaimSource,
  excerpts: ReadonlyMap<string, readonly string[]> | undefined,
): string {
  const lines = source.url === undefined ? undefined : excerpts?.get(source.url);
  if (lines === undefined || lines.length === 0) return source.excerpt ?? source.url ?? '';
  const joined = lines.join(' | ');
  return joined.length <= CLAIMS_SOURCE_TEXT_MAX
    ? joined
    : `${joined.slice(0, CLAIMS_SOURCE_TEXT_MAX - 3)}...`;
}

/**
 * The numbered sentences and the source lines the `claims` prompt shows. `excerpts`
 * (`researchSourceExcerpts`): every research line citing a source's URL; without it only the
 * first line (`ClaimSource.excerpt`) is shown.
 */
export function claimsPromptVars(
  sentences: readonly ScriptSentence[],
  sources: readonly ClaimSource[],
  excerpts?: ReadonlyMap<string, readonly string[]>,
): { sentences: string; sources: string } {
  return {
    sentences: sentences
      .map((sentence, index) => `${String(index + 1)}. ${sentence.text}`)
      .join('\n'),
    sources:
      sources.length === 0
        ? '(the research notes list no sources)'
        : sources
            .map((source) => `${source.id} · ${source.name} · ${sourceText(source, excerpts)}`)
            .join('\n'),
  };
}
